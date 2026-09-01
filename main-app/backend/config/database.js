// =============================================================
// database.js - Single-Tenant MariaDB Connection Manager
//
// Phase 4: Multi-tenant AsyncLocalStorage routing removed.
// One DB, one pool, one company.
//
// query(sql, params)         — standard query (all controllers)
// queryDb(db, sql, params)   — legacy compat, db param ignored
// getConnection()            — raw connection for transactions
// =============================================================

const mariadb = require('mariadb');
const fs      = require('fs');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'abyte_pos';

const isRemote = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';

let sslConfig = {};
if (isRemote) {
  if (process.env.DB_SSL_CA) {
    try {
      sslConfig = { ssl: { ca: fs.readFileSync(process.env.DB_SSL_CA), rejectUnauthorized: true } };
    } catch (e) {
      console.error('[DB SSL] CA cert file not found at:', process.env.DB_SSL_CA, '— SSL certificate verification DISABLED.');
      sslConfig = { ssl: { rejectUnauthorized: false } };
    }
  } else {
    console.warn('[DB SSL] DB_SSL_CA is not set for a remote database — SSL certificate verification is DISABLED.');
    sslConfig = { ssl: { rejectUnauthorized: false } };
  }
}

const pool = mariadb.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT) || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         DB_NAME,
  connectionLimit:  10,
  idleTimeout:      60000,
  acquireTimeout:   30000,
  connectTimeout:   10000,
  bigIntAsNumber:   true,
  insertIdAsNumber: true,
  decimalAsNumber:  true,
  ...sslConfig,
});

// --- query(sql, params) ---
// Standard query function used by ALL controllers.
async function query(sql, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

// --- queryDb(dbName, sql, params) ---
// Backward-compatible wrapper — dbName is ignored in single-tenant.
// Auth middleware and migration service still call this signature.
async function queryDb(_dbName, sql, params) {
  return query(sql, params);
}

// --- getConnection() ---
// Returns a raw connection for transactions (BEGIN/COMMIT/ROLLBACK).
async function getConnection() {
  return pool.getConnection();
}

// --- closeAllPools() ---
// Gracefully drains the pool. Called during SIGTERM shutdown.
async function closeAllPools() {
  await pool.end().catch(() => {});
}

// Returns the current DB name — single-tenant always uses DB_NAME
function getCurrentDb() {
  return DB_NAME;
}

module.exports = { query, queryDb, getConnection, closeAllPools, getCurrentDb };
