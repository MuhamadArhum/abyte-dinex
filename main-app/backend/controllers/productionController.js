const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

// GET /api/production-orders
exports.getAll = async (req, res) => {
  try {
    const { page, limit } = req.query;
    let sql = `
      SELECT po.*, r.recipe_name,
             p.product_name as output_product_name, p.product_type as output_product_type,
             u.name as produced_by_name
      FROM production_orders po
      JOIN recipes r ON po.recipe_id = r.recipe_id
      JOIN products p ON r.output_product_id = p.product_id
      LEFT JOIN users u ON po.produced_by = u.user_id
      ORDER BY po.produced_at DESC`;

    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const [countRow] = await query('SELECT COUNT(*) as total FROM production_orders');
      const total = Number(countRow.total);
      const rows = await query(sql + ' LIMIT ? OFFSET ?', [limitNum, offset]);
      return res.json({ data: rows, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } });
    }

    const rows = await query(sql);
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/production-orders  — creates a production run
// Deducts ingredient stock, adds output product stock
exports.create = async (req, res) => {
  try {
    const { recipe_id, batches, notes } = req.body;
    if (!recipe_id) return res.status(400).json({ message: 'Recipe is required' });
    if (!batches || batches <= 0) return res.status(400).json({ message: 'Batches must be greater than 0' });

    // Load recipe + ingredients
    const [recipe] = await query(
      `SELECT r.*, p.product_type as output_product_type
       FROM recipes r
       JOIN products p ON r.output_product_id = p.product_id
       WHERE r.recipe_id = ? AND r.is_active = 1`,
      [recipe_id]
    );
    if (!recipe) return res.status(404).json({ message: 'Recipe not found or inactive' });

    const outputQty = Number(recipe.output_quantity) * Number(batches);

    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      // Check and lock ingredient stock inside the transaction (B-015)
      const ingredients = await conn.query(
        `SELECT ri.*, p.product_name, i.available_stock
         FROM recipe_ingredients ri
         JOIN products p ON ri.product_id = p.product_id
         LEFT JOIN inventory i ON i.product_id = p.product_id AND i.product_id = ri.product_id
         WHERE ri.recipe_id = ?
         FOR UPDATE`,
        [recipe_id]
      );

      const insufficient = [];
      for (const ing of ingredients) {
        const needed = Number(ing.quantity) * Number(batches);
        const available = Number(ing.available_stock || 0);
        if (available < needed) {
          insufficient.push(`${ing.product_name}: need ${needed}, have ${available}`);
        }
      }
      if (insufficient.length > 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Insufficient stock', details: insufficient });
      }

      // Deduct each ingredient from inventory
      for (const ing of ingredients) {
        const needed = Number(ing.quantity) * Number(batches);
        await conn.query(
          'UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?',
          [needed, ing.product_id]
        );
        await conn.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
          [needed, ing.product_id]
        );
      }

      // Add output product stock
      await conn.query(
        'UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?',
        [outputQty, recipe.output_product_id]
      );
      await conn.query(
        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?',
        [outputQty, recipe.output_product_id]
      );

      // Record production order
      const result = await conn.query(
        'INSERT INTO production_orders (recipe_id, batches, output_quantity, status, notes, produced_by) VALUES (?, ?, ?, ?, ?, ?)',
        [recipe_id, batches, outputQty, 'completed', notes || null, req.user.user_id]
      );
      const productionId = Number(result.insertId);

      await conn.commit();
      await logAction(req.user.user_id, req.user.name, 'PRODUCTION_ORDER_CREATED', 'production_order', productionId,
        { recipe_id, batches, output_quantity: outputQty }, req.ip);

      res.status(201).json({ message: 'Production order completed', production_id: productionId, output_quantity: outputQty });
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

// GET /api/production-orders/:id
exports.getById = async (req, res) => {
  try {
    const [po] = await query(
      `SELECT po.*, r.recipe_name, r.output_product_id, r.output_quantity as recipe_output_qty,
              p.product_name as output_product_name,
              u.name as produced_by_name
       FROM production_orders po
       JOIN recipes r ON po.recipe_id = r.recipe_id
       JOIN products p ON r.output_product_id = p.product_id
       LEFT JOIN users u ON po.produced_by = u.user_id
       WHERE po.production_id = ?`,
      [req.params.id]
    );
    if (!po) return res.status(404).json({ message: 'Production order not found' });

    // Fetch ingredients snapshot from recipe at time of production
    po.ingredients = await query(
      `SELECT ri.*, p.product_name
       FROM recipe_ingredients ri
       JOIN products p ON ri.product_id = p.product_id
       WHERE ri.recipe_id = ?`,
      [po.recipe_id]
    );

    res.json(po);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
