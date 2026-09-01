// =============================================================
// deliveryController.js - Delivery Management Controller
// Manages delivery orders, status tracking (pending/dispatched/delivered),
// and delivery stats.
// Used by: /api/deliveries routes
// =============================================================

const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (q) => {
  const page  = Math.max(1, parseInt(q.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// Generate delivery number: DL-01, DL-02 … (global sequential, named-lock protected)
async function generateDeliveryNumber(conn) {
  const lockKey = 'delivery_number_lock';
  const [lockRow] = await conn.query('SELECT GET_LOCK(?, 10) as locked', [lockKey]);
  if (!lockRow.locked) throw new Error('Could not acquire delivery number lock');
  try {
    const rows = await conn.query(
      `SELECT delivery_number FROM deliveries WHERE delivery_number LIKE 'DL-%' ORDER BY delivery_id DESC LIMIT 1`
    );
    let seq = 1;
    if (rows.length > 0) {
      seq = (parseInt(rows[0].delivery_number.replace('DL-', '')) || 0) + 1;
    }
    return `DL-${String(seq).padStart(2, '0')}`;
  } finally {
    await conn.query('SELECT RELEASE_LOCK(?)', [lockKey]);
  }
}

// GET /api/deliveries/stats
exports.getStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [total, byStatus, deliveredToday, charges] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM deliveries`),
      query(`SELECT status, COUNT(*) as count FROM deliveries GROUP BY status`),
      query(`SELECT COUNT(*) as count FROM deliveries WHERE status = 'delivered' AND DATE(actual_delivery) = ?`, [today]),
      query(`SELECT COALESCE(SUM(delivery_charges), 0) as total FROM deliveries WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`),
    ]);

    const statusMap = {};
    byStatus.forEach(r => { statusMap[r.status] = r.count; });

    res.json({
      total: total[0].count,
      pending:    statusMap['pending']    || 0,
      assigned:   statusMap['assigned']   || 0,
      dispatched: statusMap['dispatched'] || 0,
      in_transit: statusMap['in_transit'] || 0,
      delivered:  (statusMap['delivered'] || 0),
      failed:     statusMap['failed']     || 0,
      cancelled:  statusMap['cancelled']  || 0,
      delivered_today: deliveredToday[0].count,
      monthly_charges: charges[0].total,
    });
  } catch (err) {
    logger.error('deliveryStats:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// GET /api/deliveries
exports.getAll = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { search, status, date_from, date_to, rider } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(d.delivery_number LIKE ? OR c.customer_name LIKE ? OR d.rider_name LIKE ? OR d.delivery_city LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        conditions.push('d.status = ?');
        params.push(statuses[0]);
      } else if (statuses.length > 1) {
        conditions.push(`d.status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
    }
    if (date_from) {
      conditions.push('DATE(d.created_at) >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('DATE(d.created_at) <= ?');
      params.push(date_to);
    }
    if (rider) {
      conditions.push('d.rider_name LIKE ?');
      params.push(`%${rider}%`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows, countRows] = await Promise.all([
      query(`
        SELECT d.*,
               c.customer_name,
               c.phone_number            AS customer_phone,
               u.name                    AS created_by_name,
               s.sale_id                 AS linked_sale_id,
               s.status                  AS sale_status,
               s.invoice_no              AS sale_invoice_no,
               s.total_amount            AS sale_total_amount,
               s.sub_total               AS sale_sub_total,
               s.tax_amount              AS sale_tax_amount,
               s.additional_charges_amount AS sale_service_amount,
               s.payment_method          AS sale_payment_method
        FROM deliveries d
        JOIN customers c ON d.customer_id = c.customer_id
        LEFT JOIN users u ON d.created_by = u.user_id
        LEFT JOIN sales s ON d.sale_id = s.sale_id
        ${where}
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]),

      query(`
        SELECT COUNT(*) AS total
        FROM deliveries d
        JOIN customers c ON d.customer_id = c.customer_id
        ${where}
      `, params),
    ]);

    res.json({
      data: rows,
      pagination: {
        total: countRows[0].total,
        page,
        limit,
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (err) {
    logger.error('getDeliveries:', err);
    res.status(500).json({ message: 'Failed to fetch deliveries' });
  }
};

// GET /api/deliveries/:id
exports.getById = async (req, res) => {
  try {
    const rows = await query(`
      SELECT d.*,
             c.customer_name, c.phone_number AS customer_phone, c.email AS customer_email,
             u.name AS created_by_name,
             s.sale_id AS linked_sale_id, s.total_amount AS sale_total
      FROM deliveries d
      JOIN customers c ON d.customer_id = c.customer_id
      LEFT JOIN users u ON d.created_by = u.user_id
      LEFT JOIN sales s ON d.sale_id = s.sale_id
      WHERE d.delivery_id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ message: 'Delivery not found' });
    res.json(rows[0]);
  } catch (err) {
    logger.error('getDelivery:', err);
    res.status(500).json({ message: 'Failed to fetch delivery' });
  }
};

// POST /api/deliveries
exports.create = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const {
      sale_id, customer_id, delivery_address, delivery_city, delivery_phone,
      rider_name, rider_phone, delivery_charges, estimated_delivery, notes,
    } = req.body;

    if (!customer_id)        return res.status(400).json({ message: 'Customer is required' });
    if (!delivery_address)   return res.status(400).json({ message: 'Delivery address is required' });

    const delivery_number = await generateDeliveryNumber(conn);
    const status = (rider_name && rider_name.trim()) ? 'assigned' : 'pending';

    const result = await conn.query(`
      INSERT INTO deliveries
        (delivery_number, sale_id, customer_id, delivery_address, delivery_city,
         delivery_phone, rider_name, rider_phone, status, delivery_charges,
         estimated_delivery, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      delivery_number,
      sale_id || null,
      customer_id,
      delivery_address,
      delivery_city   || '',
      delivery_phone  || '',
      rider_name      || '',
      rider_phone     || '',
      status,
      delivery_charges || 0,
      estimated_delivery || null,
      notes || '',
      req.user.user_id,
    ]);

    const newId = Number(result.insertId);
    await conn.commit();

    await logAction(
      req.user.user_id, req.user.username,
      'DELIVERY_CREATED', 'deliveries', newId,
      `Created delivery ${delivery_number} for customer ${customer_id}`,
      req.ip
    );

    res.status(201).json({ message: 'Delivery created', delivery_id: newId, delivery_number });
  } catch (err) {
    await conn.rollback();
    logger.error('createDelivery:', err);
    res.status(500).json({ message: 'Failed to create delivery' });
  } finally {
    conn.release();
  }
};

// PUT /api/deliveries/:id
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT * FROM deliveries WHERE delivery_id = ?`, [id]);
    if (!existing.length) return res.status(404).json({ message: 'Delivery not found' });

    const old = existing[0];
    const {
      delivery_address, delivery_city, delivery_phone,
      rider_name, rider_phone, delivery_charges,
      estimated_delivery, notes, status,
    } = req.body;

    // If rider assigned and status was pending, auto-upgrade to assigned
    let newStatus = status || old.status;
    if (rider_name && rider_name.trim() && old.status === 'pending') {
      newStatus = 'assigned';
    }

    // Set actual_delivery timestamp when delivered
    const actualDelivery = newStatus === 'delivered' && old.status !== 'delivered'
      ? new Date()
      : (newStatus !== 'delivered' ? null : old.actual_delivery);

    await query(`
      UPDATE deliveries SET
        delivery_address = ?, delivery_city = ?, delivery_phone = ?,
        rider_name = ?, rider_phone = ?, delivery_charges = ?,
        estimated_delivery = ?, notes = ?, status = ?, actual_delivery = ?
      WHERE delivery_id = ?
    `, [
      delivery_address   ?? old.delivery_address,
      delivery_city      ?? old.delivery_city,
      delivery_phone     ?? old.delivery_phone,
      rider_name         ?? old.rider_name,
      rider_phone        ?? old.rider_phone,
      delivery_charges   ?? old.delivery_charges,
      estimated_delivery ?? old.estimated_delivery,
      notes              ?? old.notes,
      newStatus,
      actualDelivery,
      id,
    ]);

    await logAction(
      req.user.user_id, req.user.username,
      'DELIVERY_UPDATED', 'deliveries', id,
      `Updated delivery ${old.delivery_number}`,
      req.ip,
      { status: old.status, rider_name: old.rider_name },
      { status: newStatus, rider_name: rider_name ?? old.rider_name }
    );

    res.json({ message: 'Delivery updated' });
  } catch (err) {
    logger.error('updateDelivery:', err);
    res.status(500).json({ message: 'Failed to update delivery' });
  }
};

// PATCH /api/deliveries/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const valid = ['pending', 'assigned', 'dispatched', 'in_transit', 'delivered', 'failed', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const rows = await query(`SELECT * FROM deliveries WHERE delivery_id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ message: 'Delivery not found' });

    const old = rows[0];
    const actualDelivery = status === 'delivered' ? new Date() : old.actual_delivery;

    await query(
      'UPDATE deliveries SET status = ?, actual_delivery = ? WHERE delivery_id = ?',
      [status, actualDelivery, id]
    );

    await logAction(
      req.user.user_id, req.user.username,
      'DELIVERY_STATUS_CHANGED', 'deliveries', id,
      `${old.delivery_number}: ${old.status} → ${status}`,
      req.ip,
      { status: old.status },
      { status }
    );

    res.json({ message: 'Status updated' });
  } catch (err) {
    logger.error('updateStatus:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
};

// DELETE /api/deliveries/:id  (only pending/cancelled can be deleted)
exports.remove = async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM deliveries WHERE delivery_id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Delivery not found' });

    const d = rows[0];
    if (!['pending', 'cancelled'].includes(d.status)) {
      return res.status(400).json({ message: 'Only pending or cancelled deliveries can be deleted' });
    }

    await query('DELETE FROM deliveries WHERE delivery_id = ?', [req.params.id]);

    await logAction(
      req.user.user_id, req.user.username,
      'DELIVERY_DELETED', 'deliveries', req.params.id,
      `Deleted delivery ${d.delivery_number}`,
      req.ip
    );

    res.json({ message: 'Delivery deleted' });
  } catch (err) {
    logger.error('deleteDelivery:', err);
    res.status(500).json({ message: 'Failed to delete delivery' });
  }
};
