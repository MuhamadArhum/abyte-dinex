const logger = require('../config/logger');
const { query } = require('../config/database');
const { logAction } = require('../services/auditService');

// GET all sections
exports.getAll = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM sections ORDER BY section_name');
    res.json({ data: rows });
  } catch (err) {
    logger.error('getAll sections error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

// GET section by ID
exports.getById = async (req, res) => {
  try {
    const [row] = await query('SELECT * FROM sections WHERE section_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Section not found' });
    res.json(row);
  } catch (err) {
    logger.error('getById section error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

// CREATE section
exports.create = async (req, res) => {
  try {
    const { section_name, description } = req.body;
    if (!section_name) return res.status(400).json({ message: 'Section name is required' });
    const result = await query(
      'INSERT INTO sections (section_name, description) VALUES (?, ?)',
      [section_name, description || null]
    );
    const newId = Number(result.insertId);
    await logAction(req.user.user_id, req.user.name, 'SECTION_CREATED', 'sections', newId, { section_name }, req.ip);
    res.status(201).json({ message: 'Section created', section_id: newId });
  } catch (err) {
    logger.error('create section error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

// UPDATE section
exports.update = async (req, res) => {
  try {
    const { section_name, description, is_active } = req.body;
    await query(
      'UPDATE sections SET section_name = ?, description = ?, is_active = ? WHERE section_id = ?',
      [section_name, description || null, is_active ?? 1, req.params.id]
    );
    await logAction(req.user.user_id, req.user.name, 'SECTION_UPDATED', 'sections', parseInt(req.params.id), { section_name }, req.ip);
    res.json({ message: 'Section updated' });
  } catch (err) {
    logger.error('update section error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

// DELETE section
exports.remove = async (req, res) => {
  try {
    const [usage] = await query(
      'SELECT COUNT(*) as cnt FROM stock_issues WHERE section_id = ?',
      [req.params.id]
    );
    if (Number(usage.cnt) > 0) {
      return res.status(400).json({ message: 'Cannot delete section with existing stock issues' });
    }
    await query('DELETE FROM sections WHERE section_id = ?', [req.params.id]);
    await logAction(req.user.user_id, req.user.name, 'SECTION_DELETED', 'sections', parseInt(req.params.id), {}, req.ip);
    res.json({ message: 'Section deleted' });
  } catch (err) {
    logger.error('delete section error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};
