const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  return { page: p, limit: l, offset: (p - 1) * l };
};

const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// GET /api/quotations?page=&limit=&status=&customer_id=&search=&date_from=&date_to=
const getAll = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);
    const { status, customer_id, search, date_from, date_to } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (status) {
      where += ' AND q.status = ?';
      params.push(status);
    }
    if (customer_id) {
      where += ' AND q.customer_id = ?';
      params.push(customer_id);
    }
    if (search) {
      where += ' AND (q.quotation_number LIKE ? OR c.customer_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (date_from) {
      where += ' AND DATE(q.created_at) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      where += ' AND DATE(q.created_at) <= ?';
      params.push(date_to);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.customer_id
       ${where}`,
      params
    );
    const total = countResult[0].total;

    const rows = await query(
      `SELECT q.*, c.customer_name AS customer_name, c.phone_number AS customer_phone,
              u.name AS created_by_name
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.customer_id
       LEFT JOIN users u ON q.created_by = u.user_id
       ${where}
       ORDER BY q.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get quotations error:', error);
    res.status(500).json({ message: 'Failed to fetch quotations' });
  }
};

// GET /api/quotations/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const quotations = await query(
      `SELECT q.*, c.customer_name AS customer_name, c.phone_number AS customer_phone,
              u.name AS created_by_name
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.customer_id
       LEFT JOIN users u ON q.created_by = u.user_id
       WHERE q.quotation_id = ?`,
      [id]
    );

    if (quotations.length === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    const items = await query(
      `SELECT qi.*, p.product_name, p.barcode AS sku
       FROM quotation_items qi
       LEFT JOIN products p ON qi.product_id = p.product_id
       WHERE qi.quotation_id = ?`,
      [id]
    );

    res.json({ ...quotations[0], items });
  } catch (error) {
    logger.error('Get quotation error:', error);
    res.status(500).json({ message: 'Failed to fetch quotation' });
  }
};

// POST /api/quotations
const create = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { customer_id, items, discount, tax_amount, notes, valid_until } = req.body;

    if (!items || items.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const quotation_number = `QT-${Date.now()}`;
    const subtotal = round2(items.reduce((sum, item) => sum + round2(item.unit_price * item.quantity), 0));
    const discountAmt = round2(discount || 0);
    const taxAmt = round2(tax_amount || 0);
    const total = round2(subtotal + taxAmt - discountAmt);

    const result = await conn.query(
      `INSERT INTO quotations (quotation_number, customer_id, created_by, subtotal, discount, tax_amount, total_amount, notes, valid_until, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [quotation_number, customer_id || 1, req.user.user_id, subtotal, discountAmt, taxAmt, total, notes || null, valid_until || null]
    );

    const quotation_id = Number(result.insertId);

    for (const item of items) {
      await conn.query(
        `INSERT INTO quotation_items (quotation_id, product_id, variant_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [quotation_id, item.product_id, item.variant_id || null, item.quantity, item.unit_price, round2(item.unit_price * item.quantity)]
      );
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'QUOTATION_CREATED', 'quotation', quotation_id, { quotation_number, total, items_count: items.length }, req.ip);

    res.status(201).json({ message: 'Quotation created', quotation_id, quotation_number });
  } catch (error) {
    await conn.rollback();
    logger.error('Create quotation error:', error);
    res.status(500).json({ message: 'Failed to create quotation' });
  } finally {
    conn.release();
  }
};

// PUT /api/quotations/:id
const update = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const { customer_id, items, discount, tax_amount, notes, valid_until } = req.body;

    const existing = await conn.query(`SELECT * FROM quotations WHERE quotation_id = ?`, [id]);
    if (existing.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ message: 'Quotation not found' });
    }

    if (!['draft', 'sent'].includes(existing[0].status)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Can only edit quotations in draft or sent status' });
    }

    if (!items || items.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const subtotal = round2(items.reduce((sum, item) => sum + round2(item.unit_price * item.quantity), 0));
    const discountAmt = round2(discount || 0);
    const taxAmt = round2(tax_amount || 0);
    const total = round2(subtotal + taxAmt - discountAmt);

    await conn.query(
      `UPDATE quotations SET customer_id = ?, subtotal = ?, discount = ?, tax_amount = ?, total_amount = ?, notes = ?, valid_until = ?
       WHERE quotation_id = ?`,
      [customer_id || 1, subtotal, discountAmt, taxAmt, total, notes || null, valid_until || null, id]
    );

    // Replace items: delete old, insert new
    await conn.query('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);

    for (const item of items) {
      await conn.query(
        `INSERT INTO quotation_items (quotation_id, product_id, variant_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, item.product_id, item.variant_id || null, item.quantity, item.unit_price, round2(item.unit_price * item.quantity)]
      );
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'QUOTATION_UPDATED', 'quotation', parseInt(id), { total, items_count: items.length }, req.ip);

    res.json({ message: 'Quotation updated' });
  } catch (error) {
    await conn.rollback();
    logger.error('Update quotation error:', error);
    res.status(500).json({ message: 'Failed to update quotation' });
  } finally {
    conn.release();
  }
};

// PUT /api/quotations/:id/status
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const existing = await query(`SELECT * FROM quotations WHERE quotation_id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    const currentStatus = existing[0].status;

    // Validate status transitions
    const validTransitions = {
      draft: ['sent'],
      sent: ['accepted', 'rejected'],
    };

    // "expired" can come from any status
    const allowed = validTransitions[currentStatus] || [];
    if (status !== 'expired' && !allowed.includes(status)) {
      return res.status(400).json({ message: `Cannot transition from '${currentStatus}' to '${status}'` });
    }

    // Prevent transitioning already terminal statuses (except to expired)
    if (['accepted', 'rejected', 'converted', 'expired'].includes(currentStatus) && status !== 'expired') {
      return res.status(400).json({ message: `Quotation is already '${currentStatus}' and cannot be changed` });
    }

    await query('UPDATE quotations SET status = ? WHERE quotation_id = ?', [status, id]);

    await logAction(req.user.user_id, req.user.name, 'QUOTATION_STATUS_CHANGED', 'quotation', parseInt(id), { from: currentStatus, to: status }, req.ip);

    res.json({ message: `Quotation status updated to '${status}'` });
  } catch (error) {
    logger.error('Update quotation status error:', error);
    res.status(500).json({ message: 'Failed to update quotation status' });
  }
};

// POST /api/quotations/:id/convert
const convertToSale = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;

    const existing = await conn.query('SELECT * FROM quotations WHERE quotation_id = ?', [id]);
    if (existing.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ message: 'Quotation not found' });
    }

    if (existing[0].status !== 'accepted') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Only accepted quotations can be converted to sales' });
    }

    const items = await conn.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [id]);

    // Batch stock validation with sorted IDs — prevents deadlocks when two
    // transactions lock rows in the same table simultaneously.
    const reqProduct = new Map();
    const reqVariant = new Map();
    for (const item of items) {
      if (item.variant_id) reqVariant.set(item.variant_id, (reqVariant.get(item.variant_id) || 0) + item.quantity);
      else                 reqProduct.set(item.product_id,  (reqProduct.get(item.product_id)  || 0) + item.quantity);
    }

    if (reqVariant.size > 0) {
      const ids = [...reqVariant.keys()].sort((a, b) => a - b);
      const rows = await conn.query(
        `SELECT variant_id, available_stock FROM variant_inventory WHERE variant_id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids
      );
      const map = new Map(rows.map(r => [r.variant_id, r.available_stock]));
      for (const [vid, qty] of reqVariant) {
        if ((map.get(vid) ?? 0) < qty) {
          await conn.rollback(); conn.release();
          return res.status(400).json({ message: `Insufficient stock for variant ID ${vid}` });
        }
      }
    }

    if (reqProduct.size > 0) {
      const ids = [...reqProduct.keys()].sort((a, b) => a - b);
      const rows = await conn.query(
        `SELECT product_id, available_stock FROM inventory WHERE product_id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids
      );
      const map = new Map(rows.map(r => [r.product_id, r.available_stock]));
      for (const [pid, qty] of reqProduct) {
        if ((map.get(pid) ?? 0) < qty) {
          await conn.rollback(); conn.release();
          return res.status(400).json({ message: `Insufficient stock for product ID ${pid}` });
        }
      }
    }

    const quotation = existing[0];

    // Create sale
    const saleResult = await conn.query(
      `INSERT INTO sales (total_amount, discount, net_amount, user_id, customer_id, payment_method, amount_paid, status, tax_amount, note)
       VALUES (?, ?, ?, ?, ?, 'Credit', 0, 'completed', ?, ?)`,
      [quotation.total_amount, quotation.discount, quotation.total_amount, req.user.user_id, quotation.customer_id, quotation.tax_amount, `Converted from ${quotation.quotation_number}`]
    );

    const sale_id = Number(saleResult.insertId);

    // Bulk-insert sale details
    const sdPh = items.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const sdVals = items.flatMap(item => [sale_id, item.product_id, item.variant_id || null, item.quantity, item.unit_price, round2(item.unit_price * item.quantity)]);
    await conn.query(`INSERT INTO sale_details (sale_id, product_id, variant_id, quantity, unit_price, total_price) VALUES ${sdPh}`, sdVals);

    // Batch stock deduction (reuse aggregated maps built during validation above)
    if (reqProduct.size > 0) {
      const entries = [...reqProduct.entries()];
      const caseSql  = entries.map(() => 'WHEN ? THEN ?').join(' ');
      const caseParams = entries.flatMap(([id, qty]) => [id, qty]);
      const inPh = entries.map(() => '?').join(',');
      const ids   = entries.map(([id]) => id);
      await conn.query(`UPDATE inventory SET available_stock = available_stock - (CASE product_id ${caseSql} END) WHERE product_id IN (${inPh})`, [...caseParams, ...ids]);
      await conn.query(`UPDATE products SET stock_quantity = stock_quantity - (CASE product_id ${caseSql} END) WHERE product_id IN (${inPh})`, [...caseParams, ...ids]);
    }
    if (reqVariant.size > 0) {
      const entries = [...reqVariant.entries()];
      const caseSql  = entries.map(() => 'WHEN ? THEN ?').join(' ');
      const caseParams = entries.flatMap(([id, qty]) => [id, qty]);
      const inPh = entries.map(() => '?').join(',');
      const ids   = entries.map(([id]) => id);
      await conn.query(`UPDATE variant_inventory SET available_stock = available_stock - (CASE variant_id ${caseSql} END) WHERE variant_id IN (${inPh})`, [...caseParams, ...ids]);
      await conn.query(`UPDATE product_variants SET stock_quantity = stock_quantity - (CASE variant_id ${caseSql} END) WHERE variant_id IN (${inPh})`, [...caseParams, ...ids]);
    }

    // Update quotation status to converted
    await conn.query(
      'UPDATE quotations SET status = ?, converted_sale_id = ? WHERE quotation_id = ?',
      ['converted', sale_id, id]
    );

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'QUOTATION_CONVERTED', 'quotation', parseInt(id), { sale_id, quotation_number: quotation.quotation_number, total: quotation.total_amount }, req.ip);

    res.json({ message: 'Quotation converted to sale', sale_id });
  } catch (error) {
    await conn.rollback();
    logger.error('Convert quotation error:', error);
    res.status(500).json({ message: 'Failed to convert quotation to sale' });
  } finally {
    conn.release();
  }
};

// DELETE /api/quotations/:id
const deleteFn = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT * FROM quotations WHERE quotation_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    if (existing[0].status !== 'draft') {
      return res.status(400).json({ message: 'Only draft quotations can be deleted' });
    }

    await query('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);
    await query('DELETE FROM quotations WHERE quotation_id = ?', [id]);

    await logAction(req.user.user_id, req.user.name, 'QUOTATION_DELETED', 'quotation', parseInt(id), { quotation_number: existing[0].quotation_number }, req.ip);

    res.json({ message: 'Quotation deleted' });
  } catch (error) {
    logger.error('Delete quotation error:', error);
    res.status(500).json({ message: 'Failed to delete quotation' });
  }
};

// GET /api/quotations/stats
const getStats = async (req, res) => {
  try {
    const rows = await query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted,
         SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted
       FROM quotations`
    );

    res.json(rows[0]);
  } catch (error) {
    logger.error('Get quotation stats error:', error);
    res.status(500).json({ message: 'Failed to fetch quotation stats' });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  updateStatus,
  convertToSale,
  delete: deleteFn,
  getStats
};
