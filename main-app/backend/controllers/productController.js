// =============================================================
// productController.js - Product & Category Management Controller
// Handles CRUD operations for products and categories.
// Products are the items sold through the POS system.
// Used by: /api/products routes
// =============================================================

const logger = require('../config/logger');
const { query } = require('../config/database');
const { logAction } = require('../services/auditService');

// Column migrations handled by migrationService.js at server startup

// --- Get All Products ---
// Returns all products with their category names and stock levels.
// Supports optional filters via query parameters:
//   ?search=keyword  - Search by product name or barcode
//   ?category=id     - Filter by category
//   ?stock=low       - Show only low stock (1-9 units)
//   ?stock=out       - Show only out of stock (0 units)
exports.getAll = async (req, res) => {
  try {
    const { search, category, stock, type } = req.query;

    let sql = `SELECT p.*, c.category_name, i.available_stock
               FROM products p
               LEFT JOIN categories c ON p.category_id = c.category_id
               LEFT JOIN inventory i ON p.product_id = i.product_id
               WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ' AND (p.product_name LIKE ? OR p.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) { sql += ' AND p.category_id = ?'; params.push(category); }
    if (type)     { sql += ' AND p.product_type = ?'; params.push(type); }
    if (stock === 'low') sql += ' AND i.available_stock > 0 AND i.available_stock < 10';
    else if (stock === 'out') sql += ' AND (i.available_stock = 0 OR i.available_stock IS NULL)';

    const { page, limit } = req.query;
    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      let countSql = `SELECT COUNT(*) as total
                      FROM products p
                      LEFT JOIN categories c ON p.category_id = c.category_id
                      LEFT JOIN inventory i ON p.product_id = i.product_id
                      WHERE 1=1` +
                      (search ? ' AND (p.product_name LIKE ? OR p.barcode LIKE ?)' : '') +
                      (category ? ' AND p.category_id = ?' : '') +
                      (type ? ' AND p.product_type = ?' : '') +
                      (stock === 'low' ? ' AND i.available_stock > 0 AND i.available_stock < 10' : '') +
                      (stock === 'out' ? ' AND (i.available_stock = 0 OR i.available_stock IS NULL)' : '');

      const countParams = [];
      if (search) countParams.push(`%${search}%`, `%${search}%`);
      if (category) countParams.push(category);
      if (type) countParams.push(type);

      const countResult = await query(countSql, countParams);
      const total = Number(countResult[0].total);

      sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      params.push(limitNum, offset);

      const rows = await query(sql, params);
      return res.json({ data: rows, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } });
    }

    sql += ' ORDER BY p.created_at DESC LIMIT 200';
    const rows = await query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Product By ID ---
// Returns a single product with its category name and stock level.
// Used when viewing or editing a specific product.
exports.getById = async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.*, c.category_name, i.available_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.category_id
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.product_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });

    const product = rows[0];

    // If product has variants, fetch them
    if (product.has_variants) {
      const variants = await query(
        `SELECT pv.*, vi.available_stock
         FROM product_variants pv
         LEFT JOIN variant_inventory vi ON pv.variant_id = vi.variant_id
         WHERE pv.product_id = ? AND pv.is_active = 1
         ORDER BY pv.variant_name`,
        [product.product_id]
      );

      // Get combinations for all variants in a single batch query (avoids N+1)
      if (variants.length > 0) {
        const variantIds = variants.map(v => v.variant_id);
        const allCombinations = await query(
          `SELECT vc.*, vv.value_name, vt.variant_name as type_name
           FROM variant_combinations vc
           JOIN variant_values vv ON vc.variant_value_id = vv.variant_value_id
           JOIN variant_types vt ON vv.variant_type_id = vt.variant_type_id
           WHERE vc.variant_id IN (${variantIds.map(() => '?').join(',')})`,
          variantIds
        );
        const combsByVariantId = {};
        for (const combo of allCombinations) {
          if (!combsByVariantId[combo.variant_id]) combsByVariantId[combo.variant_id] = [];
          combsByVariantId[combo.variant_id].push(combo);
        }
        for (const variant of variants) {
          variant.combinations = combsByVariantId[variant.variant_id] || [];
        }
      }

      product.variants = variants;
    }

    res.json(product);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Create New Product ---
// Adds a new product to the system and creates its inventory record.
// Two tables are updated: products (product info) and inventory (stock tracking).
// Only Admin and Manager can create products.
exports.create = async (req, res) => {
  try {
    const { product_name, category_id, price, stock_quantity, barcode, product_type, unit, cost_price, min_stock_level, sku, description } = req.body;

    // Validate required fields
    if (!product_name) {
      return res.status(400).json({ message: 'Product name is required' });
    }
    if (product_type !== 'raw_material' && !price) {
      return res.status(400).json({ message: 'Price is required for finished goods' });
    }

    const result = await query(
      'INSERT INTO products (product_name, category_id, price, stock_quantity, barcode, product_type, unit, cost_price, min_stock_level, sku, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [product_name, category_id || null, price || 0, stock_quantity || 0, barcode || null, product_type || 'finished_good', unit || 'pcs', cost_price || 0, min_stock_level || 0, sku || null, description || null]
    );

    // Also create a corresponding inventory record to track stock separately
    const productId = Number(result.insertId);
    await query(
      'INSERT INTO inventory (product_id, available_stock) VALUES (?, ?)',
      [productId, stock_quantity || 0]
    );

    await logAction(req.user.user_id, req.user.name, 'PRODUCT_CREATED', 'product', productId, { product_name, price }, req.ip);

    res.status(201).json({ message: 'Product created', product_id: productId });
  } catch (err) {
    // Handle duplicate barcode error from the UNIQUE constraint
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barcode already exists' });
    }
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Product ---
// Updates product details and syncs the inventory stock level.
// Both products and inventory tables are updated to keep stock in sync.
exports.update = async (req, res) => {
  try {
    const { id } = req.params;  // Product ID from URL
    const { product_name, category_id, price, stock_quantity, barcode, product_type, unit, cost_price, min_stock_level, sku, description } = req.body;

    const existing = await query(`SELECT product_id FROM products WHERE product_id = ?`, [id]);
    if (!existing.length) return res.status(404).json({ message: 'Product not found' });

    // Update the product record
    await query(
      'UPDATE products SET product_name = ?, category_id = ?, price = ?, stock_quantity = ?, barcode = ?, product_type = ?, unit = ?, cost_price = ?, min_stock_level = ?, sku = ?, description = ? WHERE product_id = ?',
      [product_name, category_id || null, price || 0, stock_quantity, barcode || null, product_type || 'finished_good', unit || 'pcs', cost_price || 0, min_stock_level || 0, sku || null, description || null, id]
    );

    // Sync the inventory table with the new stock quantity
    await query(
      'UPDATE inventory SET available_stock = ? WHERE product_id = ?',
      [stock_quantity, id]
    );

    await logAction(req.user.user_id, req.user.name, 'PRODUCT_UPDATED', 'product', parseInt(id), { product_name, price }, req.ip);

    res.json({ message: 'Product updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barcode already exists' });
    }
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Delete Product ---
// Removes a product from the system.
// SAFETY CHECK: Cannot delete a product that has been sold (to preserve sale history).
// Deletes from inventory first (child), then products (parent) to respect foreign keys.
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this product appears in any sale records
    const sales = await query('SELECT sale_detail_id FROM sale_details WHERE product_id = ? LIMIT 1', [id]);
    if (sales.length > 0) {
      return res.status(400).json({ message: 'Cannot delete product with sales history' });
    }

    // Get product name before deleting for audit log
    const product = await query(`SELECT product_name FROM products WHERE product_id = ?`, [id]);
    if (!product.length) return res.status(404).json({ message: 'Product not found' });
    const productName = product[0].product_name;

    // Delete inventory record first (foreign key constraint), then the product
    await query('DELETE FROM inventory WHERE product_id = ?', [id]);
    await query('DELETE FROM products WHERE product_id = ?', [id]);

    await logAction(req.user.user_id, req.user.name, 'PRODUCT_DELETED', 'product', parseInt(id), { product_name: productName }, req.ip);

    res.json({ message: 'Product deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get All Categories ---
// Returns categories filtered by branch (non-admin sees only their branch).
exports.getCategories = async (req, res) => {
  try {
    const { type } = req.query;

    let sql = `SELECT c.*, COUNT(p.product_id) as product_count
               FROM categories c
               LEFT JOIN products p ON c.category_id = p.category_id
               WHERE 1=1`;
    const params = [];
    if (type) {
      sql += ' AND c.category_type = ?';
      params.push(type);
    }
    sql += ' GROUP BY c.category_id ORDER BY c.parent_id ASC, c.category_name ASC';
    const rows = await query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Create New Category ---
exports.createCategory = async (req, res) => {
  try {
    const { category_name, category_type, description, is_active, parent_id } = req.body;
    if (!category_name) return res.status(400).json({ message: 'Category name is required' });

    const validTypes = ['raw_material', 'semi_finished', 'finished_good'];
    const catType = validTypes.includes(category_type) ? category_type : 'finished_good';

    let resolvedType = catType;
    if (parent_id) {
      const [parent] = await query('SELECT category_type FROM categories WHERE category_id = ?', [parent_id]);
      if (!parent) return res.status(400).json({ message: 'Parent category not found' });
      resolvedType = parent.category_type;
    }

    const result = await query(
      'INSERT INTO categories (category_name, category_type, parent_id, description, is_active) VALUES (?, ?, ?, ?, ?)',
      [category_name, resolvedType, parent_id || null, description || null, is_active !== undefined ? is_active : 1]
    );
    await logAction(req.user.user_id, req.user.name, 'CATEGORY_CREATED', 'category', result.insertId, { category_name, category_type: resolvedType, parent_id: parent_id || null }, req.ip);
    res.status(201).json({ message: 'Category created', category_id: Number(result.insertId) });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Category ---
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, category_type, description, is_active, parent_id } = req.body;
    if (!category_name) return res.status(400).json({ message: 'Category name is required' });

    const [existing] = await query(`SELECT category_id FROM categories WHERE category_id = ?`, [id]);
    if (!existing) return res.status(404).json({ message: 'Category not found' });

    // Prevent circular reference
    if (parent_id && Number(parent_id) === Number(id)) {
      return res.status(400).json({ message: 'Category cannot be its own parent' });
    }

    const validTypes = ['raw_material', 'semi_finished', 'finished_good'];
    const catType = validTypes.includes(category_type) ? category_type : 'finished_good';

    await query(
      'UPDATE categories SET category_name = ?, category_type = ?, description = ?, is_active = ?, parent_id = ? WHERE category_id = ?',
      [category_name, catType, description || null, is_active !== undefined ? is_active : 1, parent_id || null, id]
    );
    await logAction(req.user.user_id, req.user.name, 'CATEGORY_UPDATED', 'category', id, { category_name, category_type: catType }, req.ip);
    res.json({ message: 'Category updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Delete Category ---
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [owned] = await query(`SELECT category_id FROM categories WHERE category_id = ?`, [id]);
    if (!owned) return res.status(404).json({ message: 'Category not found' });
    const [productCount] = await query('SELECT COUNT(*) as cnt FROM products WHERE category_id = ?', [id]);
    if (productCount.cnt > 0) {
      return res.status(400).json({ message: `Cannot delete — ${productCount.cnt} products use this category.` });
    }
    const [subCount] = await query('SELECT COUNT(*) as cnt FROM categories WHERE parent_id = ?', [id]);
    if (subCount.cnt > 0) {
      return res.status(400).json({ message: `Cannot delete — ${subCount.cnt} sub-categories exist. Delete them first.` });
    }
    await query('DELETE FROM categories WHERE category_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'CATEGORY_DELETED', 'category', id, {}, req.ip);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Generate Barcode for Product ---
exports.generateBarcode = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await query('SELECT product_id, barcode FROM products WHERE product_id = ?', [id]);
    if (product.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product[0].barcode) {
      return res.json({ barcode: product[0].barcode, message: 'Product already has a barcode' });
    }

    // Generate unique barcode: ABP + product_id padded + random digits
    const paddedId = String(id).padStart(5, '0');
    const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    const barcode = `ABP${paddedId}${random}`;

    await query('UPDATE products SET barcode = ? WHERE product_id = ?', [barcode, id]);

    await logAction(req.user.user_id, req.user.name, 'BARCODE_GENERATED', 'product', parseInt(id), { barcode }, req.ip);

    res.json({ barcode, message: 'Barcode generated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barcode collision. Please try again.' });
    }
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
