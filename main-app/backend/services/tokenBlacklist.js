// =============================================================
// tokenBlacklist.js - Database-backed Token Revocation
// Tokens added on logout are stored in DB with expiry.
// Survives server restarts. Works across multiple instances.
// Falls back to in-memory if DB is unavailable.
// =============================================================

const { query } = require('../config/database');
const logger    = require('../config/logger');

// Phase 4: single-tenant — token_blacklist is in the single DB.
const q = (sql, params) => query(sql, params);

// In-memory fallback (used if DB table not ready yet)
const memoryFallback = new Set();

// Ensure the blacklist table exists (called once at startup)
async function ensureTable() {
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        token_hash  VARCHAR(64)  NOT NULL UNIQUE,
        expires_at  DATETIME     NOT NULL,
        created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_expires (expires_at),
        INDEX idx_hash    (token_hash)
      )
    `);
    await q('DELETE FROM token_blacklist WHERE expires_at < NOW()');
  } catch (err) {
    logger.warn('[TokenBlacklist] Could not create/clean table, using memory fallback', { error: err.message });
  }
}

// SHA-256 hash of token so we don't store raw JWTs in DB
function hashToken(token) {
  const { createHash } = require('crypto');
  return createHash('sha256').update(token).digest('hex');
}

// Parse JWT expiry without verifying (token already verified by auth middleware)
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    if (payload.exp) return new Date(payload.exp * 1000);
  } catch {}
  // Default: expire 24h from now if we can't parse
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

async function blacklistToken(token) {
  const hash      = hashToken(token);
  const expiresAt = getTokenExpiry(token);

  try {
    await q(
      'INSERT IGNORE INTO token_blacklist (token_hash, expires_at) VALUES (?, ?)',
      [hash, expiresAt]
    );
  } catch (err) {
    logger.warn('[TokenBlacklist] DB insert failed, using memory fallback', { error: err.message });
    memoryFallback.add(hash);
  }
}

async function isBlacklisted(token) {
  const hash = hashToken(token);

  // Check memory fallback first (fast)
  if (memoryFallback.has(hash)) return true;

  try {
    const rows = await q(
      'SELECT 1 FROM token_blacklist WHERE token_hash = ? AND expires_at > NOW() LIMIT 1',
      [hash]
    );
    return rows.length > 0;
  } catch (err) {
    logger.warn('[TokenBlacklist] DB check failed, treating as blacklisted for safety', { error: err.message });
    // Fail-closed: on DB error deny the request to prevent revoked tokens from slipping through
    return true;
  }
}

// Periodic cleanup — call from server startup (every 1 hour)
async function cleanExpired() {
  try {
    const result = await q('DELETE FROM token_blacklist WHERE expires_at < NOW()');
    if (result.affectedRows > 0) {
      logger.info('[TokenBlacklist] Cleaned expired tokens', { count: result.affectedRows });
    }
  } catch (err) {
    logger.warn('[TokenBlacklist] Cleanup failed', { error: err.message });
  }
}

module.exports = { blacklistToken, isBlacklisted, ensureTable, cleanExpired };
