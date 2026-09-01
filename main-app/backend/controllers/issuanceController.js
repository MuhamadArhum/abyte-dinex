const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const pad = (n, len = 6) => String(n).padStart(len, '0');

// ============ HELPERS ============
const NEXT_NUMBER_WHITELIST = {
  stock_issues:        'issue_number',
  stock_issue_returns: 'return_number',
  raw_sales:           'sale_number',
};

async function nextNumber(prefix, table, column) {
  if (NEXT_NUMBER_WHITELIST[table] !== column) {
    throw new Error(`nextNumber: disallowed table/column: ${table}.${column}`);
  }
  const [last] = await query(`SELECT ${column} FROM ${table} ORDER BY ${column} DESC LIMIT 1`);
  if (last?.[column]) {
    const m = last[column].match(/\d+$/);
    if (m) return `${prefix}${pad(parseInt(m[0]) + 1)}`;
  }
  return `${prefix}${pad(1)}`;
}

// ==================== STOCK ISSUES ====================

exports.getIssues = async (req, res) => {
  try {
    const { section_id, from_date, to_date } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (section_id) { where += ' AND si.section_id = ?'; params.push(section_id); }
    if (from_date)  { where += ' AND si.issue_date >= ?'; params.push(from_date); }
    if (to_date)    { where += ' AND si.issue_date <= ?'; params.push(to_date); }

    const sql = `SELECT si.*, s.section_name, u.name as created_by_name,
                   COUNT(sii.item_id) as item_count,
                   COALESCE(SUM(sii.quantity * sii.unit_cost), 0) as total_cost
                 FROM stock_issues si
                 JOIN sections s ON si.section_id = s.section_id
                 JOIN users u ON si.created_by = u.user_id
                 LEFT JOIN stock_issue_items sii ON si.issue_id = sii.issue_id
                 ${where} GROUP BY si.issue_id ORDER BY si.issue_date DESC, si.created_at DESC
                 LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) as total FROM stock_issues si ${where}`;

    const [rows, [{total}]] = await Promise.all([
      query(sql, [...params, limit, offset]),
      query(countSql, params)
    ]);
    res.json({ data: rows, pagination: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) } });
  } catch (err) { logger.error('getIssues error:', err); res.status(500).json({ message: err.message || 'Server error' }); }
};

exports.getIssueById = async (req, res) => {
  try {
    const [issue] = await query(
      `SELECT si.*, s.section_name, u.name as created_by_name
       FROM stock_issues si
       JOIN sections s ON si.section_id = s.section_id
       JOIN users u ON si.created_by = u.user_id
       WHERE si.issue_id = ?`, [req.params.id]
    );
    if (!issue) return res.status(404).json({ message: 'Stock issue not found' });
    const items = await query(
      `SELECT sii.*, p.product_name, p.barcode
       FROM stock_issue_items sii
       JOIN products p ON sii.product_id = p.product_id
       WHERE sii.issue_id = ?`, [req.params.id]
    );
    res.json({ ...issue, items });
  } catch (err) { logger.error('getIssueById error:', err); res.status(500).json({ message: err.message || 'Server error' }); }
};

exports.createIssue = async (req, res) => {
  const conn = await getConnection();
  try {
    const { section_id, issue_date, notes, items } = req.body;
    if (!section_id || !issue_date || !items?.length) {
      return res.status(400).json({ message: 'section_id, issue_date and items are required' });
    }

    await conn.beginTransaction();
    const issue_number = await nextNumber('ISS', 'stock_issues', 'issue_number');

    const result = await conn.query(
      'INSERT INTO stock_issues (issue_number, section_id, issue_date, notes, created_by) VALUES (?, ?, ?, ?, ?)',
      [issue_number, section_id, issue_date, notes || null, req.user.user_id]
    );
    const issueId = Number(result.insertId);

    for (const item of items) {
      await conn.query(
        'INSERT INTO stock_issue_items (issue_id, product_id, quantity, unit_cost) VALUES (?, ?, ?, ?)',
        [issueId, item.product_id, item.quantity, item.unit_cost || 0]
      );
      // Deduct from inventory
      await conn.query(
        'UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
      await conn.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'STOCK_ISSUE_CREATED', 'stock_issues', issueId, { issue_number }, req.ip);
    res.status(201).json({ message: 'Stock issue created', issue_id: issueId, issue_number });
  } catch (err) {
    await conn.rollback();
    logger.error('createIssue error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  } finally { conn.release(); }
};

exports.updateIssue = async (req, res) => {
  const conn = await getConnection();
  try {
    const { section_id, issue_date, notes, items } = req.body;
    if (!section_id || !issue_date || !items?.length) {
      return res.status(400).json({ message: 'section_id, issue_date and items are required' });
    }

    await conn.beginTransaction();

    // Fetch and lock inside transaction to prevent race conditions (B-012)
    const issueRows = await conn.query('SELECT * FROM stock_issues WHERE issue_id = ? FOR UPDATE', [req.params.id]);
    const issue = issueRows[0];
    if (!issue) { await conn.rollback(); return res.status(404).json({ message: 'Not found' }); }

    const oldItems = await conn.query('SELECT * FROM stock_issue_items WHERE issue_id = ?', [req.params.id]);

    // Reverse old stock
    for (const item of oldItems) {
      await conn.query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity, item.product_id]);
    }

    // Delete old items, insert new
    await conn.query('DELETE FROM stock_issue_items WHERE issue_id = ?', [req.params.id]);
    await conn.query(
      'UPDATE stock_issues SET section_id = ?, issue_date = ?, notes = ? WHERE issue_id = ?',
      [section_id, issue_date, notes || null, req.params.id]
    );

    for (const item of items) {
      await conn.query(
        'INSERT INTO stock_issue_items (issue_id, product_id, quantity, unit_cost) VALUES (?, ?, ?, ?)',
        [req.params.id, item.product_id, item.quantity, item.unit_cost || 0]
      );
      await conn.query('UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?', [item.quantity, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?', [item.quantity, item.product_id]);
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'STOCK_ISSUE_UPDATED', 'stock_issues', parseInt(req.params.id), { issue_number: issue.issue_number }, req.ip);
    res.json({ message: 'Stock issue updated', issue_number: issue.issue_number });
  } catch (err) {
    await conn.rollback();
    logger.error('updateIssue error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  } finally { conn.release(); }
};

exports.deleteIssue = async (req, res) => {
  const conn = await getConnection();
  try {
    const [issue] = await query('SELECT * FROM stock_issues WHERE issue_id = ?', [req.params.id]);
    if (!issue) return res.status(404).json({ message: 'Not found' });

    const items = await query('SELECT * FROM stock_issue_items WHERE issue_id = ?', [req.params.id]);

    await conn.beginTransaction();
    for (const item of items) {
      await conn.query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity, item.product_id]);
    }
    await conn.query('DELETE FROM stock_issues WHERE issue_id = ?', [req.params.id]);
    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'STOCK_ISSUE_DELETED', 'stock_issues', parseInt(req.params.id), {}, req.ip);
    res.json({ message: 'Stock issue deleted and stock reversed' });
  } catch (err) {
    await conn.rollback();
    logger.error('deleteIssue error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  } finally { conn.release(); }
};

// ==================== STOCK ISSUE RETURNS ====================

exports.getReturns = async (req, res) => {
  try {
    const { section_id, from_date, to_date } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (section_id) { where += ' AND sir.section_id = ?'; params.push(section_id); }
    if (from_date)  { where += ' AND sir.return_date >= ?'; params.push(from_date); }
    if (to_date)    { where += ' AND sir.return_date <= ?'; params.push(to_date); }

    const sql = `SELECT sir.*, s.section_name, u.name as created_by_name,
                   COUNT(siri.item_id) as item_count
                 FROM stock_issue_returns sir
                 JOIN sections s ON sir.section_id = s.section_id
                 JOIN users u ON sir.created_by = u.user_id
                 LEFT JOIN stock_issue_return_items siri ON sir.return_id = siri.return_id
                 ${where} GROUP BY sir.return_id ORDER BY sir.return_date DESC, sir.created_at DESC
                 LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) as total FROM stock_issue_returns sir ${where}`;

    const [rows, [{total}]] = await Promise.all([
      query(sql, [...params, limit, offset]),
      query(countSql, params)
    ]);
    res.json({ data: rows, pagination: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) } });
  } catch (err) { logger.error('getReturns error:', err); res.status(500).json({ message: err.message || 'Server error' }); }
};

exports.createReturn = async (req, res) => {
  const conn = await getConnection();
  try {
    const { section_id, return_date, notes, items } = req.body;
    if (!section_id || !return_date || !items?.length) {
      return res.status(400).json({ message: 'section_id, return_date and items are required' });
    }

    await conn.beginTransaction();
    const return_number = await nextNumber('SIR', 'stock_issue_returns', 'return_number');

    const result = await conn.query(
      'INSERT INTO stock_issue_returns (return_number, section_id, return_date, notes, created_by) VALUES (?, ?, ?, ?, ?)',
      [return_number, section_id, return_date, notes || null, req.user.user_id]
    );
    const returnId = Number(result.insertId);

    for (const item of items) {
      await conn.query(
        'INSERT INTO stock_issue_return_items (return_id, product_id, quantity) VALUES (?, ?, ?)',
        [returnId, item.product_id, item.quantity]
      );
      // Add back to inventory
      await conn.query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity, item.product_id]);
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'STOCK_RETURN_CREATED', 'stock_issue_returns', returnId, { return_number }, req.ip);
    res.status(201).json({ message: 'Stock return created', return_id: returnId, return_number });
  } catch (err) {
    await conn.rollback();
    logger.error('createReturn error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  } finally { conn.release(); }
};

exports.getReturnById = async (req, res) => {
  try {
    const [ret] = await query(
      `SELECT sir.*, s.section_name, u.name as created_by_name
       FROM stock_issue_returns sir
       JOIN sections s ON sir.section_id = s.section_id
       JOIN users u ON sir.created_by = u.user_id
       WHERE sir.return_id = ?`, [req.params.id]
    );
    if (!ret) return res.status(404).json({ message: 'Not found' });
    const items = await query(
      `SELECT siri.*, p.product_name FROM stock_issue_return_items siri
       JOIN products p ON siri.product_id = p.product_id WHERE siri.return_id = ?`, [req.params.id]
    );
    res.json({ ...ret, items });
  } catch (err) { logger.error('getReturnById error:', err); res.status(500).json({ message: err.message || 'Server error' }); }
};

// ==================== RAW SALES ====================

exports.getRawSales = async (req, res) => {
  try {
    const { section_id, from_date, to_date } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (section_id) { where += ' AND rs.section_id = ?'; params.push(section_id); }
    if (from_date)  { where += ' AND rs.sale_date >= ?'; params.push(from_date); }
    if (to_date)    { where += ' AND rs.sale_date <= ?'; params.push(to_date); }

    const sql = `SELECT rs.*, s.section_name, u.name as created_by_name,
                   COUNT(rsi.item_id) as item_count
                 FROM raw_sales rs
                 LEFT JOIN sections s ON rs.section_id = s.section_id
                 JOIN users u ON rs.created_by = u.user_id
                 LEFT JOIN raw_sale_items rsi ON rs.sale_id = rsi.sale_id
                 ${where} GROUP BY rs.sale_id ORDER BY rs.sale_date DESC, rs.created_at DESC
                 LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) as total FROM raw_sales rs ${where}`;

    const [rows, [{total}]] = await Promise.all([
      query(sql, [...params, limit, offset]),
      query(countSql, params)
    ]);
    res.json({ data: rows, pagination: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) } });
  } catch (err) { logger.error('getRawSales error:', err); res.status(500).json({ message: err.message || 'Server error' }); }
};

exports.getRawSaleById = async (req, res) => {
  try {
    const [sale] = await query(
      `SELECT rs.*, s.section_name, u.name as created_by_name
       FROM raw_sales rs
       LEFT JOIN sections s ON rs.section_id = s.section_id
       JOIN users u ON rs.created_by = u.user_id
       WHERE rs.sale_id = ?`, [req.params.id]
    );
    if (!sale) return res.status(404).json({ message: 'Not found' });
    const items = await query(
      `SELECT rsi.*, p.product_name FROM raw_sale_items rsi
       JOIN products p ON rsi.product_id = p.product_id WHERE rsi.sale_id = ?`, [req.params.id]
    );
    res.json({ ...sale, items });
  } catch (err) { logger.error('getRawSaleById error:', err); res.status(500).json({ message: err.message || 'Server error' }); }
};

exports.createRawSale = async (req, res) => {
  const conn = await getConnection();
  try {
    const { section_id, customer_name, sale_date, notes, items } = req.body;
    if (!sale_date || !items?.length) {
      return res.status(400).json({ message: 'sale_date and items are required' });
    }

    await conn.beginTransaction();
    const sale_number = await nextNumber('RS', 'raw_sales', 'sale_number');
    const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);

    const result = await conn.query(
      'INSERT INTO raw_sales (sale_number, section_id, customer_name, sale_date, total_amount, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sale_number, section_id || null, customer_name || null, sale_date, total, notes || null, req.user.user_id]
    );
    const saleId = Number(result.insertId);

    for (const item of items) {
      const totalPrice = Number(item.quantity) * Number(item.unit_price);
      await conn.query(
        'INSERT INTO raw_sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [saleId, item.product_id, item.quantity, item.unit_price, totalPrice]
      );
      // Deduct from inventory
      await conn.query('UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?', [item.quantity, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?', [item.quantity, item.product_id]);
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'RAW_SALE_CREATED', 'raw_sales', saleId, { sale_number, total }, req.ip);
    res.status(201).json({ message: 'Raw sale created', sale_id: saleId, sale_number });
  } catch (err) {
    await conn.rollback();
    logger.error('createRawSale error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  } finally { conn.release(); }
};

exports.deleteRawSale = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Fetch sale and items inside transaction with lock (B-014)
    const saleRows = await conn.query('SELECT * FROM raw_sales WHERE sale_id = ? FOR UPDATE', [req.params.id]);
    if (!saleRows[0]) { await conn.rollback(); return res.status(404).json({ message: 'Raw sale not found' }); }

    const items = await conn.query('SELECT * FROM raw_sale_items WHERE sale_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity, item.product_id]);
    }
    await conn.query('DELETE FROM raw_sales WHERE sale_id = ?', [req.params.id]);
    await conn.commit();
    res.json({ message: 'Raw sale deleted and stock reversed' });
  } catch (err) {
    await conn.rollback();
    logger.error('deleteRawSale error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  } finally { conn.release(); }
};
