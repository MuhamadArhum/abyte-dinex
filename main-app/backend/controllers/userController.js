// =============================================================
// userController.js - User Management Controller
// Handles CRUD operations for system users (Admin, Manager, Cashier).
// Only Admin users can access these endpoints.
// Used by: /api/users routes
// =============================================================

const logger = require('../config/logger');
const bcrypt = require('bcryptjs');          // Library to hash passwords before storing
const { query } = require('../config/database');  // Database query helper
const { logAction } = require('../services/auditService');

// Ensure required columns exist for older tenant DBs that predate schema updates
let columnsEnsured = false;
async function ensureColumns() {
  if (columnsEnsured) return;
  columnsEnsured = true;
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_name VARCHAR(50) NOT NULL DEFAULT 'Cashier'`);
  } catch (e) {
    // Columns already exist or DB doesn't support IF NOT EXISTS — safe to ignore
  }
}

// --- Get All Users ---
// Returns a list of all users with their roles, ordered by newest first.
// Used on the User Management page to display the users table.
exports.getAll = async (req, res) => {
  try {
    await ensureColumns();

    let sql = `SELECT u.user_id, u.username, u.name, u.email, u.role_id, u.role_name as role,
                      u.created_at
               FROM users u
               WHERE u.is_active = 1`;
    const params = [];

    sql += ' ORDER BY u.created_at DESC';
    const rows = await query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Create New User ---
// Creates a new user account with a hashed password.
// Only Admin can create users (enforced by route middleware).
// Validates: all fields required, password min 8 chars, email must be unique.
exports.create = async (req, res) => {
  try {
    const { username, name, email, password, role_id } = req.body;

    // Validate all required fields are present
    if (!username || !name || !email || !password || !role_id) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Enforce minimum password length
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check if the email is already taken by another user
    const existing = await query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Look up role_name for the denormalized column
    const roleRow = await query('SELECT role_name FROM roles WHERE role_id = ?', [role_id]);
    const role_name = roleRow.length > 0 ? roleRow[0].role_name : 'Cashier';

    const result = await query(
      'INSERT INTO users (username, name, email, password_hash, role_id, role_name) VALUES (?, ?, ?, ?, ?, ?)',
      [username, name, email, password_hash, role_id, role_name]
    );

    const newUserId = Number(result.insertId);
    await logAction(req.user.user_id, req.user.name, 'USER_CREATED', 'user', newUserId, { username, name, email, role_id }, req.ip);

    // Return success with the new user's ID
    res.status(201).json({ message: 'User created', user_id: newUserId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Existing User ---
// Updates user details (name, email, role). Password is optional.
// If password is provided, it gets hashed before saving.
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, name, email, password, role_id } = req.body;

    const existing = await query('SELECT user_id, role_name FROM users WHERE user_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build update dynamically - only update provided fields
    const updates = [];
    const params = [];

    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }

    let resolvedRoleName = existing[0].role_name;
    if (role_id !== undefined) {
      updates.push('role_id = ?');
      params.push(role_id);
      // Also update the denormalized role_name
      const roleRow = await query('SELECT role_name FROM roles WHERE role_id = ?', [role_id]);
      if (roleRow.length > 0) {
        resolvedRoleName = roleRow[0].role_name;
        updates.push('role_name = ?');
        params.push(resolvedRoleName);
      }
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      updates.push('password_hash = ?');
      params.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);

    await logAction(req.user.user_id, req.user.name, 'USER_UPDATED', 'user', parseInt(id), { name, email }, req.ip);

    res.json({ message: 'User updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Delete User ---
// Soft-deletes a user by setting is_active = 0.
// History (sales, vouchers, etc.) remains intact with original user reference.
exports.remove = async (req, res) => {
  try {
    await ensureColumns();
    const { id } = req.params;

    const existing = await query('SELECT user_id FROM users WHERE user_id = ? AND is_active = 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    await query('UPDATE users SET is_active = 0 WHERE user_id = ?', [id]);

    await logAction(req.user.user_id, req.user.name, 'USER_DELETED', 'user', parseInt(id), {}, req.ip);

    res.json({ message: 'User deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get All Roles ---
exports.getRoles = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM roles ORDER BY role_id');
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Create Role ---
exports.createRole = async (req, res) => {
  try {
    const { role_name } = req.body;
    if (!role_name || !role_name.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }
    const name = role_name.trim();
    const existing = await query('SELECT role_id FROM roles WHERE role_name = ?', [name]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Role already exists' });
    }
    const result = await query('INSERT INTO roles (role_name) VALUES (?)', [name]);
    await logAction(req.user.user_id, req.user.name, 'ROLE_CREATED', 'roles', result.insertId, { role_name: name }, req.ip);
    res.status(201).json({ message: 'Role created', role_id: result.insertId, role_name: name });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Delete Role ---
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const [role] = await query('SELECT * FROM roles WHERE role_id = ?', [id]);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    const PROTECTED = ['Admin'];
    if (PROTECTED.includes(role.role_name)) {
      return res.status(400).json({ message: `Cannot delete built-in role "${role.role_name}"` });
    }
    // Unassign users from this role before deleting
    await query('UPDATE users SET role_id = NULL, role_name = NULL WHERE role_id = ?', [id]);
    await query('DELETE FROM role_permissions WHERE role_name = ?', [role.role_name]);
    await query('DELETE FROM roles WHERE role_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'ROLE_DELETED', 'roles', parseInt(id), { role_name: role.role_name }, req.ip);
    res.json({ message: 'Role deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
