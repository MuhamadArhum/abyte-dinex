const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

// Ensure tables exist for existing tenants
const ensureTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS recipes (
      recipe_id INT PRIMARY KEY AUTO_INCREMENT,
      recipe_name VARCHAR(255) NOT NULL,
      output_product_id INT NOT NULL,
      output_quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
      notes TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (output_product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
      INDEX idx_recipes_output (output_product_id)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      ingredient_id INT PRIMARY KEY AUTO_INCREMENT,
      recipe_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity DECIMAL(10,3) NOT NULL,
      unit VARCHAR(50),
      FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
      INDEX idx_recipe_ingredients_recipe (recipe_id)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS production_orders (
      production_id INT PRIMARY KEY AUTO_INCREMENT,
      recipe_id INT NOT NULL,
      batches DECIMAL(10,3) NOT NULL DEFAULT 1,
      output_quantity DECIMAL(10,3) NOT NULL,
      status ENUM('completed','cancelled') DEFAULT 'completed',
      notes TEXT,
      produced_by INT,
      produced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE RESTRICT,
      FOREIGN KEY (produced_by) REFERENCES users(user_id) ON DELETE SET NULL,
      INDEX idx_production_orders_recipe (recipe_id)
    )
  `);
};

// GET /api/recipes
exports.getAll = async (req, res) => {
  try {
    await ensureTables();
    const { search, is_active } = req.query;
    let sql = `
      SELECT r.*, p.product_name as output_product_name, p.product_type as output_product_type,
             i.available_stock as output_stock
      FROM recipes r
      JOIN products p ON r.output_product_id = p.product_id
      LEFT JOIN inventory i ON i.product_id = p.product_id
      WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND r.recipe_name LIKE ?'; params.push(`%${search}%`); }
    if (is_active !== undefined) { sql += ' AND r.is_active = ?'; params.push(is_active); }
    sql += ' ORDER BY r.created_at DESC';
    const recipes = await query(sql, params);

    // Fetch ingredients for each recipe in one batch query
    if (recipes.length > 0) {
      const ids = recipes.map(r => r.recipe_id);
      const ingredients = await query(
        `SELECT ri.*, p.product_name, p.product_type, i.available_stock
         FROM recipe_ingredients ri
         JOIN products p ON ri.product_id = p.product_id
         LEFT JOIN inventory i ON i.product_id = p.product_id
         WHERE ri.recipe_id IN (${ids.map(() => '?').join(',')})
         ORDER BY ri.ingredient_id`,
        ids
      );
      const byRecipe = {};
      for (const ing of ingredients) {
        if (!byRecipe[ing.recipe_id]) byRecipe[ing.recipe_id] = [];
        byRecipe[ing.recipe_id].push(ing);
      }
      for (const r of recipes) r.ingredients = byRecipe[r.recipe_id] || [];
    }

    res.json({ data: recipes });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/recipes/:id
exports.getById = async (req, res) => {
  try {
    await ensureTables();
    const [recipe] = await query(
      `SELECT r.*, p.product_name as output_product_name, p.product_type as output_product_type,
              i.available_stock as output_stock
       FROM recipes r
       JOIN products p ON r.output_product_id = p.product_id
       LEFT JOIN inventory i ON i.product_id = p.product_id
       WHERE r.recipe_id = ?`,
      [req.params.id]
    );
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    recipe.ingredients = await query(
      `SELECT ri.*, p.product_name, p.product_type, i.available_stock
       FROM recipe_ingredients ri
       JOIN products p ON ri.product_id = p.product_id
       LEFT JOIN inventory i ON i.product_id = p.product_id
       WHERE ri.recipe_id = ?
       ORDER BY ri.ingredient_id`,
      [recipe.recipe_id]
    );
    res.json(recipe);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/recipes
exports.create = async (req, res) => {
  try {
    await ensureTables();
    const { recipe_name, output_product_id, output_quantity, notes, is_active, ingredients } = req.body;
    if (!recipe_name) return res.status(400).json({ message: 'Recipe name is required' });
    if (!output_product_id) return res.status(400).json({ message: 'Output product is required' });
    if (!ingredients || ingredients.length === 0) return res.status(400).json({ message: 'At least one ingredient is required' });

    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      const result = await conn.query(
        'INSERT INTO recipes (recipe_name, output_product_id, output_quantity, notes, is_active) VALUES (?, ?, ?, ?, ?)',
        [recipe_name, output_product_id, output_quantity || 1, notes || null, is_active !== undefined ? is_active : 1]
      );
      const recipeId = Number(result.insertId);

      for (const ing of ingredients) {
        await conn.query(
          'INSERT INTO recipe_ingredients (recipe_id, product_id, quantity, unit) VALUES (?, ?, ?, ?)',
          [recipeId, ing.product_id, ing.quantity, ing.unit || null]
        );
      }

      await conn.commit();
      await logAction(req.user.user_id, req.user.name, 'RECIPE_CREATED', 'recipe', recipeId, { recipe_name }, req.ip);
      res.status(201).json({ message: 'Recipe created', recipe_id: recipeId });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/recipes/:id
exports.update = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { recipe_name, output_product_id, output_quantity, notes, is_active, ingredients } = req.body;
    if (!recipe_name) return res.status(400).json({ message: 'Recipe name is required' });
    if (!output_product_id) return res.status(400).json({ message: 'Output product is required' });
    if (!ingredients || ingredients.length === 0) return res.status(400).json({ message: 'At least one ingredient is required' });

    const [existing] = await query('SELECT recipe_id FROM recipes WHERE recipe_id = ?', [id]);
    if (!existing) return res.status(404).json({ message: 'Recipe not found' });

    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE recipes SET recipe_name=?, output_product_id=?, output_quantity=?, notes=?, is_active=?, updated_at=NOW() WHERE recipe_id=?',
        [recipe_name, output_product_id, output_quantity || 1, notes || null, is_active !== undefined ? is_active : 1, id]
      );

      // Replace all ingredients
      await conn.query('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id]);
      for (const ing of ingredients) {
        await conn.query(
          'INSERT INTO recipe_ingredients (recipe_id, product_id, quantity, unit) VALUES (?, ?, ?, ?)',
          [id, ing.product_id, ing.quantity, ing.unit || null]
        );
      }

      await conn.commit();
      await logAction(req.user.user_id, req.user.name, 'RECIPE_UPDATED', 'recipe', parseInt(id), { recipe_name }, req.ip);
      res.json({ message: 'Recipe updated' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/recipes/:id
exports.remove = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const [existing] = await query('SELECT recipe_id FROM recipes WHERE recipe_id = ?', [id]);
    if (!existing) return res.status(404).json({ message: 'Recipe not found' });

    const [usedInPO] = await query('SELECT COUNT(*) as cnt FROM production_orders WHERE recipe_id = ?', [id]);
    if (usedInPO.cnt > 0) return res.status(400).json({ message: 'Cannot delete — recipe has production orders' });

    await query('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id]);
    await query('DELETE FROM recipes WHERE recipe_id = ?', [id]);

    await logAction(req.user.user_id, req.user.name, 'RECIPE_DELETED', 'recipe', parseInt(id), {}, req.ip);
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
