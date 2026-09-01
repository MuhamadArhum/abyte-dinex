const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

const ADJUSTMENT_TYPES = ['addition', 'subtraction', 'correction', 'damage', 'theft', 'return', 'opening_stock', 'expired'];

// Types that reduce stock
const SUBTRACTIVE_TYPES = ['subtraction', 'damage', 'theft', 'expired'];
// Types that add stock
const ADDITIVE_TYPES = ['addition', 'return', 'opening_stock'];

exports.getAll = async (req, res) => {
  try {
    const { type, product_id, date_from, date_to, search } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let where = ' WHERE 1=1';
    const params = [];

    if (type) {
      where += ' AND sa.adjustment_type = ?';
      params.push(type);
    }
    if (product_id) {
      where += ' AND sa.product_id = ?';
      params.push(product_id);
    }
    if (date_from) {
      where += ' AND sa.created_at >= ?';
      params.push(date_from);
    }
    if (date_to) {
      where += ' AND sa.created_at <= ?';
      params.push(date_to + ' 23:59:59');
    }
    if (search) {
      where += ' AND (p.product_name LIKE ? OR sa.reference_number LIKE ? OR sa.reason LIKE ? OR u.name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM stock_adjustments sa JOIN products p ON sa.product_id = p.product_id JOIN users u ON sa.created_by = u.user_id${where}`,
      params
    );
    const total = Number(countResult[0].total);

    const data = await query(
      `SELECT sa.*, p.product_name, p.barcode, u.name as created_by_name
       FROM stock_adjustments sa
       JOIN products p ON sa.product_id = p.product_id
       JOIN users u ON sa.created_by = u.user_id
       ${where}
       ORDER BY sa.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Get stock adjustments error:', error);
    res.status(500).json({ message: 'Failed to fetch stock adjustments' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [adjustment] = await query(
      `SELECT sa.*, p.product_name, p.barcode, u.name as created_by_name
       FROM stock_adjustments sa
       JOIN products p ON sa.product_id = p.product_id
       JOIN users u ON sa.created_by = u.user_id
       WHERE sa.adjustment_id = ?`,
      [req.params.id]
    );
    if (!adjustment) return res.status(404).json({ message: 'Adjustment not found' });
    res.json(adjustment);
  } catch (error) {
    logger.error('Get stock adjustment error:', error);
    res.status(500).json({ message: 'Failed to fetch adjustment' });
  }
};

exports.create = async (req, res) => {
  const conn = await getConnection();
  try {
    const { product_id, adjustment_type, quantity_adjusted, reason, reference_number } = req.body;

    if (!product_id || !adjustment_type || !quantity_adjusted) {
      return res.status(400).json({ message: 'Product, type, and quantity are required' });
    }
    if (!ADJUSTMENT_TYPES.includes(adjustment_type)) {
      return res.status(400).json({ message: 'Invalid adjustment type' });
    }
    if (quantity_adjusted <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than 0' });
    }

    await conn.beginTransaction();

    // Get current stock
    const [product] = await conn.query(
      'SELECT product_id, product_name, stock_quantity FROM products WHERE product_id = ? FOR UPDATE',
      [product_id]
    );
    if (!product) {
      await conn.rollback();
      return res.status(404).json({ message: 'Product not found' });
    }

    const quantity_before = product.stock_quantity || 0;
    let quantity_after;

    if (adjustment_type === 'correction') {
      // Correction sets absolute value
      quantity_after = quantity_adjusted;
    } else if (SUBTRACTIVE_TYPES.includes(adjustment_type)) {
      quantity_after = quantity_before - quantity_adjusted;
      if (quantity_after < 0) {
        await conn.rollback();
        return res.status(400).json({ message: `Insufficient stock. Current: ${quantity_before}, Adjusting: -${quantity_adjusted}` });
      }
    } else {
      // Additive
      quantity_after = quantity_before + quantity_adjusted;
    }

    // Generate reference number if not provided
    const ref = reference_number || `SA-${Date.now()}`;

    // Insert adjustment record
    const result = await conn.query(
      `INSERT INTO stock_adjustments (product_id, adjustment_type, quantity_before, quantity_adjusted, quantity_after, reason, reference_number, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [product_id, adjustment_type, quantity_before, quantity_adjusted, quantity_after, reason || null, ref, req.user.user_id]
    );

    // Update product stock
    await conn.query('UPDATE products SET stock_quantity = ? WHERE product_id = ?', [quantity_after, product_id]);

    // Update inventory — preserve avg_cost on INSERT (B-024)
    const [existingInv] = await conn.query('SELECT avg_cost FROM inventory WHERE product_id = ?', [product_id]);
    const existingAvgCost = existingInv?.avg_cost || 0;
    await conn.query(
      'INSERT INTO inventory (product_id, available_stock, avg_cost) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE available_stock = ?',
      [product_id, quantity_after, existingAvgCost, quantity_after]
    );

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'STOCK_ADJUSTED', 'stock_adjustment', result.insertId, {
      product_name: product.product_name,
      adjustment_type,
      quantity_before,
      quantity_adjusted,
      quantity_after,
      reason
    }, req.ip);

    res.status(201).json({
      message: 'Stock adjustment created',
      adjustment_id: result.insertId,
      quantity_before,
      quantity_after
    });
  } catch (error) {
    await conn.rollback();
    logger.error('Create stock adjustment error:', error);
    res.status(500).json({ message: 'Failed to create stock adjustment' });
  } finally {
    conn.release();
  }
};

exports.getAdjustmentTypes = async (req, res) => {
  res.json(ADJUSTMENT_TYPES);
};

exports.getStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT
        adjustment_type,
        COUNT(*) as count,
        SUM(quantity_adjusted) as total_qty
      FROM stock_adjustments
      WHERE MONTH(created_at) = MONTH(CURRENT_DATE) AND YEAR(created_at) = YEAR(CURRENT_DATE)
      GROUP BY adjustment_type
    `);

    const totalThisMonth = await query(`
      SELECT COUNT(*) as total FROM stock_adjustments
      WHERE MONTH(created_at) = MONTH(CURRENT_DATE) AND YEAR(created_at) = YEAR(CURRENT_DATE)
    `);

    res.json({
      total: Number(totalThisMonth[0].total),
      by_type: stats
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};
