// =============================================================
// auth.js - Authentication & Authorization Middleware
//
// Phase 4: Multi-tenant routing removed. Single DB, no tenantStorage.
// =============================================================

const jwt    = require('jsonwebtoken');
const logger = require('../config/logger');
const { query } = require('../config/database');
const { isBlacklisted } = require('../services/tokenBlacklist');
const cache  = require('../services/cacheService');

// --- authenticate ---
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    if (await isBlacklisted(token)) {
      return res.status(401).json({ message: 'Token has been revoked. Please login again.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    const rows = await query(
      'SELECT user_id, username, name, email, role_id, role_name, is_active FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (rows[0].is_active === 0) {
      return res.status(401).json({ message: 'Account has been deactivated. Please contact your administrator.' });
    }

    req.user    = rows[0];
    req.modules = []; // all modules enabled in single-tenant; kept for frontend compat

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// --- authorize ---
// Hardcoded role check for admin-only routes.
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role_name)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// --- requirePermission ---
// Dynamic permission check from role_permissions table.
// Admin always passes. All other roles checked against DB.
const METHOD_ACTION = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

const _checkPermDb = async (roleName, moduleKey, parts, action) => {
  if (parts.length === 2 && action) {
    const subKey = `${moduleKey}.${action}`;
    const rows = await query(
      'SELECT 1 FROM role_permissions WHERE role_name = ? AND module_key = ? AND is_allowed = 1 LIMIT 1',
      [roleName, subKey]
    );
    return rows.length > 0;
  }
  if (parts.length >= 3) {
    const rows = await query(
      'SELECT 1 FROM role_permissions WHERE role_name = ? AND module_key = ? AND is_allowed = 1 LIMIT 1',
      [roleName, moduleKey]
    );
    return rows.length > 0;
  }
  const rows = await query(
    'SELECT 1 FROM role_permissions WHERE role_name = ? AND (module_key = ? OR module_key LIKE ?) AND is_allowed = 1 LIMIT 1',
    [roleName, moduleKey, `${moduleKey}.%`]
  );
  return rows.length > 0;
};

const requirePermission = (moduleKey) => async (req, res, next) => {
  if (req.user.role_name === 'Admin') return next();
  try {
    const parts      = moduleKey.split('.');
    const action     = METHOD_ACTION[req.method];
    const effectiveKey = (parts.length === 2 && action) ? `${moduleKey}.${action}` : moduleKey;
    const cacheKey   = `perm:${req.user.role_name}:${effectiveKey}`;

    let allowed = await cache.get(cacheKey);
    if (allowed === null) {
      allowed = await _checkPermDb(req.user.role_name, moduleKey, parts, action);
      await cache.set(cacheKey, allowed, cache.TTL.PERMISSION);
    }

    if (!allowed) return res.status(403).json({ message: 'Access denied' });
    next();
  } catch (err) {
    logger.error('Permission check error', { error: err.message });
    return res.status(500).json({ message: 'Server error' });
  }
};

// --- requireSuperAdmin ---
// Kept as a stub — single-tenant has no master DB super_admins table.
// Routes that used this now require only Admin role.
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role_name === 'Admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};

module.exports = { authenticate, authorize, requirePermission, requireSuperAdmin };
