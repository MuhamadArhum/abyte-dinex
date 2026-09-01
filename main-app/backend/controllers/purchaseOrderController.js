const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const pad = (n) => String(n).padStart(6, '0');

async function nextPONumber() {
  const [last] = await query('SELECT po_number FROM purchase_orders ORDER BY po_id DESC LIMIT 1');
  if (last?.po_number) {
    const m = last.po_number.match(/\d+$/);
    if (m) return `PO-${pad(parseInt(m[0]) + 1)}`;
  }
  return `PO-${pad(1)}`;
}

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

exports.getAll = async (req, res) => {
  try {
    const { status, supplier_id, search, date_from, date_to } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = 'SELECT po.*, s.supplier_name FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.supplier_id WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.supplier_id WHERE 1=1';
    const params = [], countParams = [];

    if (search) {
      sql += ' AND (po.po_number LIKE ? OR s.supplier_name LIKE ?)';
      countSql += ' AND (po.po_number LIKE ? OR s.supplier_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      sql += ' AND po.status = ?';
      countSql += ' AND po.status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (supplier_id) {
      sql += ' AND po.supplier_id = ?';
      countSql += ' AND po.supplier_id = ?';
      params.push(supplier_id);
      countParams.push(supplier_id);
    }

    if (date_from) {
      sql += ' AND DATE(po.order_date) >= ?';
      countSql += ' AND DATE(po.order_date) >= ?';
      params.push(date_from);
      countParams.push(date_from);
    }

    if (date_to) {
      sql += ' AND DATE(po.order_date) <= ?';
      countSql += ' AND DATE(po.order_date) <= ?';
      params.push(date_to);
      countParams.push(date_to);
    }

    sql += ' ORDER BY po.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [orders, [{total}]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({ data: orders, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [po] = await query(
      `SELECT po.*, s.supplier_name, u.name as created_by_name FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.supplier_id LEFT JOIN users u ON po.created_by = u.user_id WHERE po.po_id = ?`,
      [req.params.id]
    );
    if (!po) return res.status(404).json({ message: 'PO not found' });

    const items = await query(
      'SELECT poi.*, p.product_name FROM purchase_order_items poi JOIN products p ON poi.product_id = p.product_id WHERE poi.po_id = ?',
      [req.params.id]
    );

    res.json({ ...po, items });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const conn = await getConnection();
  try {
    const { supplier_id, order_date, expected_date, notes, items, additional_charges } = req.body;
    if (!supplier_id || !order_date || !items || items.length === 0) return res.status(400).json({ message: 'Required fields missing' });

    await conn.beginTransaction();

    const extraCharges = Number(additional_charges) || 0;
    const total = items.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_cost), 0) + extraCharges;
    const po_number = await nextPONumber();

    const poResult = await conn.query(
      'INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_date, total_amount, additional_charges, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [po_number, supplier_id, order_date, expected_date || null, total, extraCharges, notes || null, req.user.user_id]
    );

    const poiPh = items.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const poiVals = items.flatMap(item => [poResult.insertId, item.product_id, item.quantity_ordered, item.unit_cost, item.quantity_ordered * item.unit_cost]);
    await conn.query(`INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, unit_cost, total_cost) VALUES ${poiPh}`, poiVals);

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PO_CREATED', 'purchase_order', poResult.insertId, { po_number, supplier_id }, req.ip);
    res.status(201).json({ message: 'PO created', po_id: poResult.insertId });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.update = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;
    const [po] = await query('SELECT * FROM purchase_orders WHERE po_id = ?', [id]);
    if (!po) return res.status(404).json({ message: 'PO not found' });
    if (po.status === 'received') return res.status(400).json({ message: 'Cannot edit a received PO' });
    if (po.status === 'cancelled') return res.status(400).json({ message: 'Cannot edit a cancelled PO' });

    const { supplier_id, order_date, expected_date, notes, items, additional_charges } = req.body;
    if (!supplier_id || !order_date || !items || items.length === 0)
      return res.status(400).json({ message: 'Required fields missing' });

    const extraCharges = Number(additional_charges) || 0;
    const total = items.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_cost), 0) + extraCharges;

    await conn.beginTransaction();
    await conn.query(
      'UPDATE purchase_orders SET supplier_id=?, order_date=?, expected_date=?, total_amount=?, additional_charges=?, notes=? WHERE po_id=?',
      [supplier_id, order_date, expected_date || null, total, extraCharges, notes || null, id]
    );
    await conn.query('DELETE FROM purchase_order_items WHERE po_id = ?', [id]);
    const updPoiPh = items.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const updPoiVals = items.flatMap(item => [id, item.product_id, item.quantity_ordered, item.unit_cost, item.quantity_ordered * item.unit_cost]);
    await conn.query(`INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, unit_cost, total_cost) VALUES ${updPoiPh}`, updPoiVals);
    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PO_UPDATED', 'purchase_order', id, { po_number: po.po_number }, req.ip);
    res.json({ message: 'PO updated' });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const [po] = await query('SELECT * FROM purchase_orders WHERE po_id = ?', [id]);
    if (!po) return res.status(404).json({ message: 'PO not found' });
    if (po.status === 'received') return res.status(400).json({ message: 'Cannot delete a received PO' });

    await query('DELETE FROM purchase_order_items WHERE po_id = ?', [id]);
    await query('DELETE FROM purchase_orders WHERE po_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'PO_DELETED', 'purchase_order', id, { po_number: po.po_number }, req.ip);
    res.json({ message: 'PO deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.receive = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;
    const { items } = req.body;

    await conn.beginTransaction();

    await conn.query('UPDATE purchase_orders SET status = ?, received_date = CURRENT_DATE WHERE po_id = ?', ['received', id]);

    // Batch update po_items, products, and inventory in 3 queries instead of 3×N
    const poiCase  = items.map(() => 'WHEN ? THEN ?').join(' ');
    const poiCaseP = items.flatMap(i => [i.po_item_id, i.quantity_received]);
    const poiIds   = items.map(i => i.po_item_id);
    await conn.query(
      `UPDATE purchase_order_items SET quantity_received = CASE po_item_id ${poiCase} END WHERE po_item_id IN (${poiIds.map(() => '?').join(',')})`,
      [...poiCaseP, ...poiIds]
    );
    // Aggregate by product_id in case same product appears on multiple PO lines
    const byProduct = new Map();
    for (const item of items) byProduct.set(item.product_id, (byProduct.get(item.product_id) || 0) + item.quantity_received);
    const prodEntries = [...byProduct.entries()];
    const prodCase  = prodEntries.map(() => 'WHEN ? THEN ?').join(' ');
    const prodCaseP = prodEntries.flatMap(([id, qty]) => [id, qty]);
    const prodIds   = prodEntries.map(([id]) => id);
    await conn.query(
      `UPDATE products SET stock_quantity = stock_quantity + (CASE product_id ${prodCase} END) WHERE product_id IN (${prodIds.map(() => '?').join(',')})`,
      [...prodCaseP, ...prodIds]
    );
    await conn.query(
      `UPDATE inventory SET available_stock = available_stock + (CASE product_id ${prodCase} END) WHERE product_id IN (${prodIds.map(() => '?').join(',')})`,
      [...prodCaseP, ...prodIds]
    );

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PO_RECEIVED', 'purchase_order', id, {}, req.ip);
    res.json({ message: 'PO received successfully' });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.cancel = async (req, res) => {
  try {
    const { id } = req.params;
    const [po] = await query('SELECT * FROM purchase_orders WHERE po_id = ?', [id]);
    if (!po) return res.status(404).json({ message: 'PO not found' });
    if (po.status === 'received') return res.status(400).json({ message: 'Cannot cancel a received PO' });
    if (po.status === 'cancelled') return res.status(400).json({ message: 'PO is already cancelled' });

    await query('UPDATE purchase_orders SET status = ? WHERE po_id = ?', ['cancelled', id]);
    await logAction(req.user.user_id, req.user.name, 'PO_CANCELLED', 'purchase_order', id, { po_number: po.po_number }, req.ip);
    res.json({ message: 'Purchase order cancelled' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStockAlerts = async (req, res) => {
  try {
    const { alert_type, status, search } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = 'SELECT sa.*, p.product_name FROM stock_alerts sa JOIN products p ON sa.product_id = p.product_id WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM stock_alerts sa JOIN products p ON sa.product_id = p.product_id WHERE 1=1';
    const params = [], countParams = [];

    if (alert_type) {
      sql += ' AND sa.alert_type = ?';
      countSql += ' AND sa.alert_type = ?';
      params.push(alert_type);
      countParams.push(alert_type);
    }

    if (status === 'active') {
      sql += ' AND sa.is_active = 1';
      countSql += ' AND sa.is_active = 1';
    } else if (status === 'resolved') {
      sql += ' AND sa.is_active = 0';
      countSql += ' AND sa.is_active = 0';
    }

    if (search) {
      sql += ' AND p.product_name LIKE ?';
      countSql += ' AND p.product_name LIKE ?';
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    sql += ' ORDER BY sa.is_active DESC, sa.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [alerts, [{ total }]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({ data: alerts, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAlertStats = async (req, res) => {
  try {
    const [stats] = await query(`
      SELECT
        SUM(is_active = 1) as total_active,
        SUM(is_active = 1 AND alert_type = 'low_stock') as low_stock,
        SUM(is_active = 1 AND alert_type = 'out_of_stock') as out_of_stock,
        SUM(is_active = 1 AND alert_type = 'overstock') as overstock
      FROM stock_alerts
    `);
    res.json({
      total_active: Number(stats.total_active) || 0,
      low_stock: Number(stats.low_stock) || 0,
      out_of_stock: Number(stats.out_of_stock) || 0,
      overstock: Number(stats.overstock) || 0
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const [alert] = await query('SELECT * FROM stock_alerts WHERE alert_id = ?', [id]);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (!alert.is_active) return res.status(400).json({ message: 'Alert is already resolved' });

    await query('UPDATE stock_alerts SET is_active = 0, resolved_at = NOW() WHERE alert_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'ALERT_RESOLVED', 'stock_alert', id, { product_id: alert.product_id, alert_type: alert.alert_type }, req.ip);
    res.json({ message: 'Alert resolved' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
