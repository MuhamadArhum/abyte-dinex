// =============================================================
// auditController.js - Audit Log Controller
// Returns and exports the system audit trail (who did what and when).
// Admin/Manager only.
// Used by: /api/audit routes
// =============================================================

const logger = require('../config/logger');
const { query } = require('../config/database');

// Build WHERE clause from query params (shared by getLogs and exportLogs)
function buildWhereClause(queryParams) {
  const { action, entity_type, user_id, date_start, date_end, search } = queryParams;
  let sql = ' WHERE 1=1';
  const params = [];

  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  if (entity_type) {
    sql += ' AND entity_type = ?';
    params.push(entity_type);
  }
  if (user_id) {
    sql += ' AND user_id = ?';
    params.push(user_id);
  }
  if (date_start) {
    sql += ' AND created_at >= ?';
    params.push(date_start);
  }
  if (date_end) {
    sql += ' AND created_at <= ?';
    params.push(date_end + ' 23:59:59');
  }
  if (search) {
    sql += ' AND (user_name LIKE ? OR action LIKE ? OR entity_type LIKE ? OR details LIKE ? OR ip_address LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  return { sql, params };
}

exports.getLogs = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const where = buildWhereClause(req.query);

    const countResult = await query(`SELECT COUNT(*) as total FROM audit_logs${where.sql}`, where.params);
    const total = Number(countResult[0].total);

    const offset = (page - 1) * limit;
    const logs = await query(
      `SELECT * FROM audit_logs${where.sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...where.params, limit, offset]
    );

    res.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

exports.exportLogs = async (req, res) => {
  try {
    const where = buildWhereClause(req.query);
    const logs = await query(
      `SELECT * FROM audit_logs${where.sql} ORDER BY created_at DESC LIMIT 10000`,
      where.params
    );

    // Build CSV
    const header = 'Date,User,Action,Entity Type,Entity ID,Details,IP Address';
    const escapeCSV = (val) => {
      if (val == null) return '';
      const s = String(val).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };
    const rows = logs.map(l =>
      [
        new Date(l.created_at).toLocaleString(),
        escapeCSV(l.user_name),
        escapeCSV(l.action),
        escapeCSV(l.entity_type),
        l.entity_id || '',
        escapeCSV(l.details),
        escapeCSV(l.ip_address)
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    logger.error('Export audit logs error:', error);
    res.status(500).json({ message: 'Failed to export audit logs' });
  }
};

exports.getLogById = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM audit_logs WHERE log_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Log not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    logger.error('Get audit log error:', error);
    res.status(500).json({ message: 'Failed to fetch audit log' });
  }
};

exports.getActions = async (req, res) => {
  try {
    const rows = await query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
    res.json(rows.map(r => r.action));
  } catch (error) {
    logger.error('Get audit actions error:', error);
    res.status(500).json({ message: 'Failed to fetch actions' });
  }
};
