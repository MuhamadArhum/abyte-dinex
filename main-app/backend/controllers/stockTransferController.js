const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

// B-010: Ensure store_inventory table exists (migration v14 handles this, this is a safety net)
let storeInvReady = false;
async function ensureStoreInventory() {
  if (storeInvReady) return;
  try {
    await query(`CREATE TABLE IF NOT EXISTS store_inventory (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      product_id INT NOT NULL,
      available_stock DECIMAL(10,2) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_store_product (store_id, product_id)
    )`);
    storeInvReady = true;
  } catch (_) { storeInvReady = true; }
}

exports.getAll = async (req, res) => {
  await ensureStoreInventory();
  try {
    const { status, store_id, date_from, date_to } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let where = ' WHERE 1=1';
    const params = [];

    if (status) { where += ' AND st.status = ?'; params.push(status); }
    if (store_id) { where += ' AND (st.from_store_id = ? OR st.to_store_id = ?)'; params.push(store_id, store_id); }
    if (date_from) { where += ' AND st.transfer_date >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND st.transfer_date <= ?'; params.push(date_to + ' 23:59:59'); }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM stock_transfers st${where}`, params
    );
    const total = Number(countResult[0].total);

    const data = await query(
      `SELECT st.*,
              fs.store_name as from_store_name, ts.store_name as to_store_name,
              p.product_name, p.barcode, u.name as created_by_name
       FROM stock_transfers st
       JOIN stores fs ON st.from_store_id = fs.store_id
       JOIN stores ts ON st.to_store_id = ts.store_id
       JOIN products p ON st.product_id = p.product_id
       JOIN users u ON st.created_by = u.user_id
       ${where}
       ORDER BY st.transfer_date DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error('Get transfers error:', error);
    res.status(500).json({ message: 'Failed to fetch transfers' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [transfer] = await query(
      `SELECT st.*,
              fs.store_name as from_store_name, ts.store_name as to_store_name,
              p.product_name, u.name as created_by_name
       FROM stock_transfers st
       JOIN stores fs ON st.from_store_id = fs.store_id
       JOIN stores ts ON st.to_store_id = ts.store_id
       JOIN products p ON st.product_id = p.product_id
       JOIN users u ON st.created_by = u.user_id
       WHERE st.transfer_id = ?`,
      [req.params.id]
    );
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    res.json(transfer);
  } catch (error) {
    logger.error('Get transfer error:', error);
    res.status(500).json({ message: 'Failed to fetch transfer' });
  }
};

exports.create = async (req, res) => {
  try {
    const { from_store_id, to_store_id, product_id, quantity, notes } = req.body;
    if (!from_store_id || !to_store_id || !product_id || !quantity) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (from_store_id === to_store_id) {
      return res.status(400).json({ message: 'Source and destination stores must be different' });
    }
    if (quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than 0' });
    }

    // Validate source has stock
    const [sourceStock] = await query(
      'SELECT available_stock FROM store_inventory WHERE store_id = ? AND product_id = ?',
      [from_store_id, product_id]
    );
    if (!sourceStock || sourceStock.available_stock < quantity) {
      return res.status(400).json({ message: `Insufficient stock at source. Available: ${sourceStock?.available_stock || 0}` });
    }

    const result = await query(
      `INSERT INTO stock_transfers (from_store_id, to_store_id, product_id, quantity, status, notes, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [from_store_id, to_store_id, product_id, quantity, notes || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'TRANSFER_CREATED', 'stock_transfer', result.insertId, {
      from_store_id, to_store_id, product_id, quantity
    }, req.ip);

    res.status(201).json({ message: 'Transfer created (pending approval)', transfer_id: result.insertId });
  } catch (error) {
    logger.error('Create transfer error:', error);
    res.status(500).json({ message: 'Failed to create transfer' });
  }
};

exports.approve = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;

    await conn.beginTransaction();

    const [transfer] = await conn.query('SELECT * FROM stock_transfers WHERE transfer_id = ? FOR UPDATE', [id]);
    if (!transfer) { await conn.rollback(); return res.status(404).json({ message: 'Transfer not found' }); }
    if (transfer.status !== 'pending') { await conn.rollback(); return res.status(400).json({ message: 'Only pending transfers can be approved' }); }

    // Check source stock
    const [sourceStock] = await conn.query(
      'SELECT available_stock FROM store_inventory WHERE store_id = ? AND product_id = ? FOR UPDATE',
      [transfer.from_store_id, transfer.product_id]
    );
    if (!sourceStock || sourceStock.available_stock < transfer.quantity) {
      await conn.rollback();
      return res.status(400).json({ message: 'Insufficient stock at source store' });
    }

    // Deduct from source
    await conn.query(
      'UPDATE store_inventory SET available_stock = available_stock - ? WHERE store_id = ? AND product_id = ?',
      [transfer.quantity, transfer.from_store_id, transfer.product_id]
    );

    // Add to destination
    await conn.query(
      'INSERT INTO store_inventory (store_id, product_id, available_stock) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE available_stock = available_stock + ?',
      [transfer.to_store_id, transfer.product_id, transfer.quantity, transfer.quantity]
    );

    // Update transfer status
    await conn.query("UPDATE stock_transfers SET status = 'completed' WHERE transfer_id = ?", [id]);

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'TRANSFER_APPROVED', 'stock_transfer', id, {
      from_store_id: transfer.from_store_id, to_store_id: transfer.to_store_id, quantity: transfer.quantity
    }, req.ip);

    res.json({ message: 'Transfer approved and completed' });
  } catch (error) {
    await conn.rollback();
    logger.error('Approve transfer error:', error);
    res.status(500).json({ message: 'Failed to approve transfer' });
  } finally {
    conn.release();
  }
};

exports.cancel = async (req, res) => {
  try {
    const { id } = req.params;
    const [transfer] = await query('SELECT * FROM stock_transfers WHERE transfer_id = ?', [id]);
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'pending') return res.status(400).json({ message: 'Only pending transfers can be cancelled' });

    await query("UPDATE stock_transfers SET status = 'cancelled' WHERE transfer_id = ?", [id]);
    await logAction(req.user.user_id, req.user.name, 'TRANSFER_CANCELLED', 'stock_transfer', id, {}, req.ip);
    res.json({ message: 'Transfer cancelled' });
  } catch (error) {
    logger.error('Cancel transfer error:', error);
    res.status(500).json({ message: 'Failed to cancel transfer' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT status, COUNT(*) as count
      FROM stock_transfers
      GROUP BY status
    `);
    const total = stats.reduce((sum, s) => sum + Number(s.count), 0);
    res.json({ total, by_status: stats });
  } catch (error) {
    logger.error('Get transfer stats error:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};
