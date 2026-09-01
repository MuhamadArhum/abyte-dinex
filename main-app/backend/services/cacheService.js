// cacheService.js - Unified cache layer (Redis with in-memory fallback)
// Redis is optional: install with `npm install redis` and set REDIS_URL in .env
// Without Redis, falls back to a TTL-aware in-memory cache automatically.

const logger = require('../config/logger');

// ── In-memory fallback ─────────────────────────────────────────────────────
class MemoryCache {
  constructor() {
    this._store = new Map();
    setInterval(() => this._evict(), 60 * 1000).unref();
  }

  _evict() {
    const now = Date.now();
    for (const [k, v] of this._store) {
      if (v.exp && now > v.exp) this._store.delete(k);
    }
  }

  async get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (entry.exp && Date.now() > entry.exp) { this._store.delete(key); return null; }
    return entry.value;
  }

  async set(key, value, ttlSec) {
    this._store.set(key, { value, exp: ttlSec ? Date.now() + ttlSec * 1000 : null });
  }

  async del(key) { this._store.delete(key); }

  async delPattern(pattern) {
    const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    for (const k of this._store.keys()) {
      if (re.test(k)) this._store.delete(k);
    }
  }

  isRedis() { return false; }
}

// ── Redis adapter ──────────────────────────────────────────────────────────
class RedisCache {
  constructor(client) { this._client = client; }

  async get(key) {
    const val = await this._client.get(key);
    return val ? JSON.parse(val) : null;
  }

  async set(key, value, ttlSec) {
    const opts = ttlSec ? { EX: ttlSec } : {};
    await this._client.set(key, JSON.stringify(value), opts);
  }

  async del(key) { await this._client.del(key); }

  async delPattern(pattern) {
    let cursor = 0;
    do {
      const res = await this._client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = res.cursor;
      if (res.keys.length > 0) await this._client.del(res.keys);
    } while (cursor !== 0);
  }

  isRedis() { return true; }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
let _cache = null;

async function _init() {
  if (_cache) return _cache;

  if (process.env.REDIS_URL) {
    try {
      const { createClient } = require('redis');
      const client = createClient({ url: process.env.REDIS_URL });
      client.on('error', (err) => logger.warn('[CacheService] Redis error, staying connected', { error: err.message }));
      await client.connect();
      _cache = new RedisCache(client);
      logger.info('[CacheService] Redis connected');
      return _cache;
    } catch (err) {
      logger.warn('[CacheService] Redis unavailable, falling back to in-memory cache', { error: err.message });
    }
  }

  _cache = new MemoryCache();
  logger.info('[CacheService] Using in-memory cache');
  return _cache;
}

// Initialise eagerly (non-blocking — errors fall back silently)
_init().catch(() => { _cache = new MemoryCache(); });

function _getCache() { return _cache || (_cache = new MemoryCache()); }

// ── Public API ─────────────────────────────────────────────────────────────
const TTL = {
  PERMISSION:  5 * 60,   // 5 min  — per-role permission lookups
  SETTINGS:    10 * 60,  // 10 min — store/company settings
  DASHBOARD:   2 * 60,   // 2 min  — dashboard aggregate stats
  LOOKUP:      15 * 60,  // 15 min — categories, tax rates, roles (rarely change)
};

exports.TTL = TTL;

exports.get = (key) => _getCache().get(key);

exports.set = (key, value, ttlSec = TTL.SETTINGS) => _getCache().set(key, value, ttlSec);

exports.del = (key) => _getCache().del(key);

exports.delPattern = (pattern) => _getCache().delPattern(pattern);

// Invalidate all permission entries for a tenant's role (call after role_permissions changes)
exports.invalidatePermissions = (tenantDb, roleName) =>
  _getCache().delPattern(`perm:${tenantDb}:${roleName}:*`);

// Invalidate all permission entries for an entire tenant (e.g. after bulk import)
exports.invalidateTenantPermissions = (tenantDb) =>
  _getCache().delPattern(`perm:${tenantDb}:*`);

// Invalidate settings for a tenant
exports.invalidateSettings = (tenantDb) =>
  _getCache().del(`settings:${tenantDb}`);

exports.isRedis = () => _getCache().isRedis();
