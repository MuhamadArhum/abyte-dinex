// permissionController.js - RBAC permission management
const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');
const cache = require('../services/cacheService');

// GET /api/permissions  → { Manager: [...], Cashier: [...], CustomRole: [...] }
exports.getAllPermissions = async (req, res) => {
  try {
    // Get all non-Admin roles from roles table
    const roleRows = await query("SELECT role_name FROM roles WHERE role_name != 'Admin'");
    // Pre-seed result with empty arrays for every role (even roles with no permissions yet)
    const result = {};
    for (const r of roleRows) result[r.role_name] = [];

    const rows = await query(
      'SELECT role_name, module_key FROM role_permissions WHERE is_allowed = 1 ORDER BY role_name, module_key'
    );
    for (const row of rows) {
      if (result[row.role_name] !== undefined) {
        result[row.role_name].push(row.module_key);
      }
    }
    res.json(result);
  } catch (err) {
    logger.error('getAllPermissions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/permissions/:role  → { role, permissions: [...] }
exports.getPermissionsByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const roleRows = await query("SELECT role_name FROM roles WHERE role_name = ? AND role_name != 'Admin'", [role]);
    if (roleRows.length === 0) {
      return res.status(400).json({ message: 'Invalid role.' });
    }
    const rows = await query(
      'SELECT module_key FROM role_permissions WHERE role_name = ? AND is_allowed = 1',
      [role]
    );
    res.json({ role, permissions: rows.map(r => r.module_key) });
  } catch (err) {
    logger.error('getPermissionsByRole error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/permissions/:role  → { message }   (Admin only)
exports.updatePermissions = async (req, res) => {
  const { role } = req.params;
  const { permissions } = req.body;

  try {
    const roleRows = await query("SELECT role_name FROM roles WHERE role_name = ? AND role_name != 'Admin'", [role]);
    if (roleRows.length === 0) {
      return res.status(400).json({ message: 'Invalid role.' });
    }
  } catch (err) {
    logger.error('updatePermissions role check error:', err);
    return res.status(500).json({ message: 'Server error' });
  }

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ message: 'permissions must be an array of module keys.' });
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Snapshot old permissions BEFORE delete — needed for audit trail
    const oldRows = await conn.query(
      'SELECT module_key FROM role_permissions WHERE role_name = ? AND is_allowed = 1 ORDER BY module_key',
      [role]
    );
    const oldPermissions = oldRows.map(r => r.module_key);

    // Delete all existing permissions for this role
    await conn.query('DELETE FROM role_permissions WHERE role_name = ?', [role]);

    // Insert new permissions
    if (permissions.length > 0) {
      const values = permissions.map(key => [role, key, 1]);
      await conn.batch(
        'INSERT INTO role_permissions (role_name, module_key, is_allowed) VALUES (?, ?, ?)',
        values
      );
    }

    await conn.commit();

    // Audit trail — isolated from main flow so audit failure never rolls back a successful update
    try {
      await logAction(
        req.user.user_id,
        req.user.name,
        'PERMISSIONS_UPDATED',
        'role_permissions',
        role,
        { role },
        req.ip,
        { permissions: oldPermissions },
        { permissions: [...permissions].sort() }
      );
    } catch (auditErr) {
      logger.warn('Audit log failed for PERMISSIONS_UPDATED', { error: auditErr.message, role });
    }

    cache.invalidatePermissions('', role).catch(() => {});
    res.json({ message: `Permissions updated for ${role}` });
  } catch (err) {
    await conn.rollback();
    logger.error('updatePermissions error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};
