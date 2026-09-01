// Integration tests for /api/stock-transfers
// Routes: GET /, GET /:id, POST /, PUT /:id/approve, PUT /:id/cancel, GET /stats
//
// ensureStoreInventory() is only called in getAll (GET /).
// create/approve/cancel/getStats do NOT call it.

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../services/auditService', () => ({ logAction: jest.fn() }));
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET     = 'test-secret-transfer';
process.env.DB_NAME        = 'test_db';
process.env.MASTER_DB_NAME = 'test_master';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const { queryDb, query, getConnection, tenantStorage } = require('../../config/database');
const { isBlacklisted } = require('../../services/tokenBlacklist');
const { buildTestApp } = require('../helpers/testApp');

let app;
const adminUser = { user_id: 1, name: 'Admin', email: 'a@a.com', role_name: 'Admin', branch_id: null };
const makeToken = () =>
  jwt.sign({ user_id: 1, tenant_db: 'test_db', modules: [], role_name: 'Admin' }, process.env.JWT_SECRET);
const authHeader = () => ({ Authorization: `Bearer ${makeToken()}` });

const makeConn = () => {
  const conn = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query:    jest.fn(),
    commit:   jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release:  jest.fn(),
  };
  getConnection.mockResolvedValue(conn);
  return conn;
};

beforeAll(() => {
  tenantStorage.run = jest.fn((db, fn) => fn());
  app = buildTestApp();
});

beforeEach(() => {
  tenantStorage.run = jest.fn((db, fn) => fn());
  isBlacklisted.mockResolvedValue(false);
  queryDb.mockResolvedValue([adminUser]);
  query.mockResolvedValue([]);
});

// ─── GET /api/stock-transfers ────────────────────────────────────

describe('GET /api/stock-transfers', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/stock-transfers');
    expect(res.status).toBe(401);
  });

  it('returns 200 with paginated list', async () => {
    // getAll calls: ensureStoreInventory (CREATE TABLE) → COUNT → data
    query
      .mockResolvedValueOnce(undefined)          // CREATE TABLE (ensureStoreInventory — first call only)
      .mockResolvedValueOnce([{ total: 0 }])     // COUNT
      .mockResolvedValueOnce([]);                // data
    const res = await request(app)
      .get('/api/stock-transfers')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });
});

// ─── GET /api/stock-transfers/stats ──────────────────────────────
// (tested early — getStats does NOT call ensureStoreInventory)

describe('GET /api/stock-transfers/stats', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/stock-transfers/stats');
    expect(res.status).toBe(401);
  });

  it('returns total count and by_status breakdown', async () => {
    query.mockResolvedValueOnce([
      { status: 'pending',   count: 3 },
      { status: 'completed', count: 10 },
    ]);
    const res = await request(app)
      .get('/api/stock-transfers/stats')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total', 13);
    expect(Array.isArray(res.body.by_status)).toBe(true);
  });
});

// ─── POST /api/stock-transfers ────────────────────────────────────
// create does NOT call ensureStoreInventory — no extra mock needed

describe('POST /api/stock-transfers', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/stock-transfers')
      .set(authHeader())
      .send({ from_store_id: 1 }); // missing to_store, product, quantity
    expect(res.status).toBe(400);
  });

  it('returns 400 when from_store and to_store are the same', async () => {
    const res = await request(app)
      .post('/api/stock-transfers')
      .set(authHeader())
      .send({ from_store_id: 1, to_store_id: 1, product_id: 1, quantity: 5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/different/i);
  });

  it('returns 400 when quantity is 0', async () => {
    const res = await request(app)
      .post('/api/stock-transfers')
      .set(authHeader())
      .send({ from_store_id: 1, to_store_id: 2, product_id: 1, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when quantity is negative', async () => {
    const res = await request(app)
      .post('/api/stock-transfers')
      .set(authHeader())
      .send({ from_store_id: 1, to_store_id: 2, product_id: 1, quantity: -5 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when source has no stock entry', async () => {
    // create: SELECT available_stock (no row found)
    query.mockResolvedValueOnce([]); // no stock entry
    const res = await request(app)
      .post('/api/stock-transfers')
      .set(authHeader())
      .send({ from_store_id: 1, to_store_id: 2, product_id: 1, quantity: 10 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient/i);
  });

  it('returns 400 when source has insufficient stock', async () => {
    // create: SELECT available_stock (3 < 50)
    query.mockResolvedValueOnce([{ available_stock: 3 }]);
    const res = await request(app)
      .post('/api/stock-transfers')
      .set(authHeader())
      .send({ from_store_id: 1, to_store_id: 2, product_id: 1, quantity: 50 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient/i);
  });

  it('creates transfer with pending status when stock is sufficient', async () => {
    // create: SELECT available_stock (100 >= 10) → INSERT
    query
      .mockResolvedValueOnce([{ available_stock: 100 }])
      .mockResolvedValueOnce({ insertId: 7 });
    const res = await request(app)
      .post('/api/stock-transfers')
      .set(authHeader())
      .send({ from_store_id: 1, to_store_id: 2, product_id: 1, quantity: 10 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('transfer_id', 7);
    expect(res.body.message).toMatch(/pending/i);
  });
});

// ─── PUT /api/stock-transfers/:id/approve ────────────────────────

describe('PUT /api/stock-transfers/:id/approve', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/stock-transfers/1/approve');
    expect(res.status).toBe(401);
  });

  it('returns 404 when transfer not found', async () => {
    const conn = makeConn();
    conn.query.mockResolvedValueOnce([]); // not found
    const res = await request(app)
      .put('/api/stock-transfers/999/approve')
      .set(authHeader());
    expect(res.status).toBe(404);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('returns 400 when transfer is not pending', async () => {
    const conn = makeConn();
    conn.query.mockResolvedValueOnce([{
      transfer_id: 1, status: 'completed',
      from_store_id: 1, to_store_id: 2, product_id: 1, quantity: 10,
    }]);
    const res = await request(app)
      .put('/api/stock-transfers/1/approve')
      .set(authHeader());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pending/i);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('returns 400 when stock is insufficient at approval time', async () => {
    const conn = makeConn();
    conn.query
      .mockResolvedValueOnce([{ transfer_id: 1, status: 'pending', from_store_id: 1, to_store_id: 2, product_id: 1, quantity: 100 }])
      .mockResolvedValueOnce([{ available_stock: 5 }]);
    const res = await request(app)
      .put('/api/stock-transfers/1/approve')
      .set(authHeader());
    expect(res.status).toBe(400);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('approves: deducts source, adds destination, commits transaction', async () => {
    const conn = makeConn();
    conn.query
      .mockResolvedValueOnce([{ transfer_id: 1, status: 'pending', from_store_id: 1, to_store_id: 2, product_id: 1, quantity: 10 }])
      .mockResolvedValueOnce([{ available_stock: 50 }])
      .mockResolvedValueOnce({ affectedRows: 1 })  // deduct source
      .mockResolvedValueOnce({ affectedRows: 1 })  // add destination
      .mockResolvedValueOnce({ affectedRows: 1 }); // update status
    const res = await request(app)
      .put('/api/stock-transfers/1/approve')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });
});

// ─── PUT /api/stock-transfers/:id/cancel ────────────────────────

describe('PUT /api/stock-transfers/:id/cancel', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/stock-transfers/1/cancel');
    expect(res.status).toBe(401);
  });

  it('returns 404 when transfer not found', async () => {
    query.mockResolvedValueOnce([]); // not found
    const res = await request(app)
      .put('/api/stock-transfers/999/cancel')
      .set(authHeader());
    expect(res.status).toBe(404);
  });

  it('returns 400 when transfer is already completed', async () => {
    query.mockResolvedValueOnce([{ transfer_id: 1, status: 'completed' }]);
    const res = await request(app)
      .put('/api/stock-transfers/1/cancel')
      .set(authHeader());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pending/i);
  });

  it('cancels a pending transfer', async () => {
    query
      .mockResolvedValueOnce([{ transfer_id: 1, status: 'pending' }])
      .mockResolvedValueOnce({ affectedRows: 1 }); // UPDATE
    const res = await request(app)
      .put('/api/stock-transfers/1/cancel')
      .set(authHeader());
    expect(res.status).toBe(200);
  });
});
