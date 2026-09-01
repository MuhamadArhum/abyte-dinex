// =============================================================
// inventoryController.js - Inventory Stock Controller
// Returns current stock levels, low-stock alerts, stats, and allows
// manual stock updates.
// Used by: /api/inventory routes
// =============================================================

const logger = require('../config/logger');
const { query } = require('../config/database');
const { logAction } = require('../services/auditService');

// GET /api/inventory
// Supports: ?page, ?limit, ?search, ?category_id, ?product_type, ?stock_status
exports.getAll = async (req, res) => {
  try {
    const { page, limit, search, category_id, product_type, stock_status } = req.query;

    const conditions = ['p.is_active = 1'];
    const params = [];

    if (search) {
      conditions.push('(p.product_name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (category_id) {
      conditions.push('p.category_id = ?');
      params.push(parseInt(category_id));
    }
    if (product_type) {
      conditions.push('p.product_type = ?');
      params.push(product_type);
    }
    if (stock_status === 'out_of_stock') {
      conditions.push('COALESCE(i.available_stock, 0) = 0');
    } else if (stock_status === 'low_stock') {
      conditions.push('COALESCE(i.available_stock, 0) > 0 AND COALESCE(i.available_stock, 0) <= COALESCE(p.min_stock_level, 10)');
    } else if (stock_status === 'in_stock') {
      conditions.push('COALESCE(i.available_stock, 0) > COALESCE(p.min_stock_level, 10)');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseSql = `
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      ${where}
    `;

    if (page && limit) {
      const pageNum  = parseInt(page);
      const limitNum = parseInt(limit);
      const offset   = (pageNum - 1) * limitNum;

      const countRows = await query(`SELECT COUNT(*) as total ${baseSql}`, params);
      const total     = Number(countRows[0].total);

      const rows = await query(
        `SELECT i.*, p.product_name, p.sku, p.barcode, p.price, p.cost_price,
                p.product_type, p.min_stock_level, p.has_variants,
                c.category_name
         ${baseSql}
         ORDER BY p.product_name
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      return res.json({
        data: rows,
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      });
    }

    const rows = await query(
      `SELECT i.*, p.product_name, p.sku, p.barcode, p.price, p.cost_price,
              p.product_type, p.min_stock_level, p.has_variants,
              c.category_name
       ${baseSql}
       ORDER BY p.product_name`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/inventory/stats
exports.getStats = async (req, res) => {
  try {
    const overviewRows = await query(`
      SELECT
        COUNT(*)                                                        AS total_products,
        SUM(COALESCE(i.available_stock, 0))                            AS total_units,
        COUNT(CASE WHEN COALESCE(i.available_stock, 0) = 0 THEN 1 END) AS out_of_stock,
        COUNT(CASE WHEN COALESCE(i.available_stock, 0) > 0
                    AND COALESCE(i.available_stock, 0) <= 10 THEN 1 END) AS low_stock,
        COALESCE(SUM(COALESCE(i.available_stock, 0) * COALESCE(p.cost_price, 0)), 0) AS inventory_value
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      WHERE p.is_active = 1
    `);

    const byType = await query(`
      SELECT p.product_type,
             COUNT(*)                                                          AS count,
             SUM(COALESCE(i.available_stock, 0))                              AS total_units,
             SUM(COALESCE(i.available_stock, 0) * COALESCE(p.cost_price, 0)) AS value
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      WHERE p.is_active = 1
      GROUP BY p.product_type
    `);

    res.json({ overview: overviewRows[0] || {}, by_type: byType });
  } catch (err) {
    logger.error('getStats error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/inventory/low-stock
exports.getLowStock = async (req, res) => {
  try {
    const { product_type } = req.query;
    const conditions = [
      'p.is_active = 1',
      'COALESCE(i.available_stock, 0) <= COALESCE(p.min_stock_level, 10)',
    ];
    const params = [];
    if (product_type) { conditions.push('p.product_type = ?'); params.push(product_type); }

    const rows = await query(
      `SELECT i.*, p.product_name, p.sku, p.price, p.cost_price, p.product_type, c.category_name
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       LEFT JOIN categories c ON p.category_id = c.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.available_stock ASC
       LIMIT 100`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/inventory/:id  (Admin/Manager only)
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { available_stock } = req.body;

    if (available_stock === undefined || available_stock < 0) {
      return res.status(400).json({ message: 'Valid stock quantity is required' });
    }

    const oldRows = await query('SELECT available_stock FROM inventory WHERE product_id = ?', [id]);
    const oldValue = oldRows.length > 0 ? oldRows[0].available_stock : null;

    await query('UPDATE inventory SET available_stock = ? WHERE product_id = ?', [available_stock, id]);
    await query('UPDATE products SET stock_quantity = ? WHERE product_id = ?', [available_stock, id]);

    await logAction(
      req.user.user_id, req.user.name, 'STOCK_UPDATED', 'inventory', parseInt(id),
      { old_stock: oldValue, new_stock: available_stock }, req.ip
    );

    res.json({ message: 'Stock updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
