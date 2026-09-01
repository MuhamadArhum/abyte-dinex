const logger = require('../config/logger');
const { query } = require('../config/database');

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
    res.status(500).json({ message: err.message });
  }
};

exports.createTable = async (req, res) => {
  await ensureTableSchema();
  try {
    const { table_name, floor = 'Main', capacity = 4 } = req.body;
    if (!table_name || !table_name.trim()) {
      return res.status(400).json({ message: 'Table name is required' });
    }
    const result = await query(
      'INSERT INTO restaurant_tables (table_name, floor, capacity) VALUES (?, ?, ?)',
      [table_name.trim(), floor || 'Main', parseInt(capacity) || 4]
    );
    res.status(201).json({
      table_id: Number(result.insertId),
      table_name: table_name.trim(),
      floor: floor || 'Main',
      capacity: parseInt(capacity) || 4,
      status: 'available',
      has_pending_order: 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { table_name, floor, capacity } = req.body;
    if (!table_name || !table_name.trim()) {
      return res.status(400).json({ message: 'Table name is required' });
    }
    const result = await query(
      'UPDATE restaurant_tables SET table_name = ?, floor = ?, capacity = ? WHERE table_id = ?',
      [table_name.trim(), floor || 'Main', parseInt(capacity) || 4, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }
    res.json({ message: 'Table updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.json({ message: 'Table status updated', status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM restaurant_tables WHERE table_id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }
    res.json({ message: 'Table deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
