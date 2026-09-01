// =============================================================
// authController.js - Single-Tenant Authentication
//
// Phase 4: company_code removed. Single DB, no master DB lookup.
// =============================================================

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { query }     = require('../config/database');
const { logAction } = require('../services/auditService');
const { blacklistToken } = require('../services/tokenBlacklist');
const logger            = require('../config/logger');
const emailService      = require('../services/emailService');

// --- Login ---
// POST /api/auth/login
// Body: { email, password }
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const rows = await query(
      'SELECT user_id, username, name, email, role_name, is_active, password_hash FROM users WHERE email = ?',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user     = rows[0];
    const isMatch  = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.is_active === 0) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact admin.' });
    }

    const token = jwt.sign(
      {
        user_id:   user.user_id,
        username:  user.username,
        role_name: user.role_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Fetch role permissions (null = Admin full access)
    let permissions = null;
    if (user.role_name !== 'Admin') {
      const permRows = await query(
        'SELECT module_key FROM role_permissions WHERE role_name = ? AND is_allowed = 1',
        [user.role_name]
      );
      const keys    = permRows.map(r => r.module_key);
      const parents = keys.map(k => k.split('.')[0]);
      permissions   = [...new Set([...keys, ...parents])];
    }

    // Audit log (fire-and-forget)
    logAction(user.user_id, user.username, 'USER_LOGIN', 'user', user.user_id, { email }, req.ip).catch(() => {});

    res.json({
      token,
      user: {
        user_id:   user.user_id,
        username:  user.username,
        name:      user.name,
        email:     user.email,
        role_name: user.role_name,
      },
      permissions,
      modules: [], // all modules enabled; empty array → hasModule() returns true
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Verify Token ---
// GET /api/auth/verify
exports.verify = async (req, res) => {
  try {
    let permissions = null;
    if (req.user.role_name !== 'Admin') {
      const permRows = await query(
        'SELECT module_key FROM role_permissions WHERE role_name = ? AND is_allowed = 1',
        [req.user.role_name]
      );
      const keys    = permRows.map(r => r.module_key);
      const parents = keys.map(k => k.split('.')[0]);
      permissions   = [...new Set([...keys, ...parents])];
    }

    res.json({
      user: {
        user_id:   req.user.user_id,
        username:  req.user.username,
        name:      req.user.name,
        email:     req.user.email,
        role_name: req.user.role_name,
      },
      permissions,
      modules: [],
    });
  } catch (err) {
    logger.error('Verify error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Own Profile ---
// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { name, email, current_password, new_password } = req.body;

    const rows = await query(
      'SELECT user_id, username, name, email, role_name, is_active, password_hash FROM users WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = rows[0];

    const updates = [];
    const params  = [];

    if (name && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (email && email.trim()) {
      const conflict = await query(
        'SELECT user_id FROM users WHERE email = ? AND user_id != ?',
        [email.trim(), userId]
      );
      if (conflict.length > 0) return res.status(400).json({ message: 'Email already in use by another account' });
      updates.push('email = ?');
      params.push(email.trim());
    }

    if (new_password) {
      if (!current_password) return res.status(400).json({ message: 'Current password is required to set a new password' });
      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
      if (new_password.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
      const hash = await bcrypt.hash(new_password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    if (updates.length === 0) return res.status(400).json({ message: 'No changes provided' });

    params.push(userId);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);

    const [updated] = await query(
      'SELECT user_id, username, name, email, role_name FROM users WHERE user_id = ?',
      [userId]
    );

    logAction(userId, user.username, 'PROFILE_UPDATED', 'user', userId, { name, email }, req.ip).catch(() => {});

    res.json({ message: 'Profile updated successfully', user: updated });
  } catch (err) {
    logger.error('Profile update error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Forgot Password ---
// POST /api/auth/forgot-password
// Body: { email }
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const rows = await query(
      'SELECT user_id, name FROM users WHERE email = ? AND is_active = 1',
      [email.trim().toLowerCase()]
    );

    if (rows.length > 0) {
      const user      = rows[0];
      const rawToken  = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires   = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await query(
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?',
        [tokenHash, expires, user.user_id]
      );

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetLink   = `${frontendUrl}/reset-password?token=${rawToken}`;

      await emailService.sendPasswordReset({ to: email.trim(), name: user.name, resetLink });
    }

    // Always return success — never reveal if email exists
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    logger.error('forgotPassword error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Reset Password ---
// POST /api/auth/reset-password
// Body: { token, password }
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const rows = await query(
      'SELECT user_id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE user_id = ?',
      [hash, rows[0].user_id]
    );

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    logger.error('resetPassword error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Logout ---
// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      blacklistToken(token);

      logAction(req.user.user_id, req.user.username, 'USER_LOGOUT', 'user', req.user.user_id, {}, req.ip).catch(() => {});
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
