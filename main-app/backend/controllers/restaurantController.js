const logger = require('../config/logger');
const { query } = require('../config/database');
const { logAction } = require('../services/auditService');

let tableSchemaEnsured = false;
async function ensureTableSchema() {
  if (tableSchemaEnsured) return;
  tableSchemaEnsured = true;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS restaurant_tables (
        table_id INT PRIMARY KEY AUTO_INCREMENT,
        table_name VARCHAR(50) NOT NULL,
        floor VARCHAR(50) DEFAULT 'Main',
        capacity INT DEFAULT 4,
        status ENUM('available','occupied','needs_cleaning') DEFAULT 'available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) { /* already exists */ }
}

exports.getTables = async (req, res) => {
  await ensureTableSchema();
  try {
    const tables = await query(
      `SELECT t.*,
        (SELECT COUNT(*) FROM sales s WHERE s.table_id = t.table_id AND s.status = 'pending') AS has_pending_order
       FROM restaurant_tables t
       ORDER BY t.floor, t.table_name`
    );
    res.json(tables);
  } catch (err) {
    logger.error('Error in getTables:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createTable = async (req, res) => {
  await ensureTableSchema();
  try {
    const { table_name, floor = 'Main', capacity = 4 } = req.body;
    if (!table_name || !table_name.trim()) {
      return res.status(400).json({ message: 'Table name is required' });
    }
    const parsedCapacity = parseInt(capacity);
    if (!parsedCapacity || parsedCapacity <= 0) {
      return res.status(400).json({ message: 'Capacity must be a positive integer' });
    }
    const result = await query(
      'INSERT INTO restaurant_tables (table_name, floor, capacity) VALUES (?, ?, ?)',
      [table_name.trim(), floor || 'Main', parsedCapacity]
    );
    await logAction(req.user.user_id, req.user.name, 'TABLE_CREATED', 'restaurant_tables', Number(result.insertId), { table_name: table_name.trim(), floor: floor || 'Main', capacity: parsedCapacity }, req.ip);
    res.status(201).json({
      table_id: Number(result.insertId),
      table_name: table_name.trim(),
      floor: floor || 'Main',
      capacity: parsedCapacity,
      status: 'available',
      has_pending_order: 0,
    });
  } catch (err) {
    logger.error('Error in createTable:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { table_name, floor, capacity } = req.body;
    if (!table_name || !table_name.trim()) {
      return res.status(400).json({ message: 'Table name is required' });
    }
    const parsedCapacity = parseInt(capacity);
    if (!parsedCapacity || parsedCapacity <= 0) {
      return res.status(400).json({ message: 'Capacity must be a positive integer' });
    }
    const result = await query(
      'UPDATE restaurant_tables SET table_name = ?, floor = ?, capacity = ? WHERE table_id = ?',
      [table_name.trim(), floor || 'Main', parsedCapacity, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }
    await logAction(req.user.user_id, req.user.name, 'TABLE_UPDATED', 'restaurant_tables', parseInt(id), { table_name: table_name.trim(), floor: floor || 'Main', capacity: parsedCapacity }, req.ip);
    res.json({ message: 'Table updated' });
  } catch (err) {
    logger.error('Error in updateTable:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['available', 'needs_cleaning'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use available or needs_cleaning.' });
    }
    const result = await query(
      'UPDATE restaurant_tables SET status = ? WHERE table_id = ?',
      [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }
    await logAction(req.user.user_id, req.user.name, 'TABLE_STATUS_CHANGED', 'restaurant_tables', parseInt(id), { status }, req.ip);
    res.json({ message: 'Table status updated', status });
  } catch (err) {
    logger.error('Error in updateStatus:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM restaurant_tables WHERE table_id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }
    await logAction(req.user.user_id, req.user.name, 'TABLE_DELETED', 'restaurant_tables', parseInt(id), {}, req.ip);
    res.json({ message: 'Table deleted' });
  } catch (err) {
    logger.error('Error in deleteTable:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
