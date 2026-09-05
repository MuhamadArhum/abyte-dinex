// Unit / integration tests for /api/credit-sales routes
// Controller: creditSaleController.js
// Route file: routes/creditSaleRoutes.js
//
// create() uses getConnection() for a transaction.
// getAll() uses Promise.all([query, query]).

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../services/auditService', () => ({ logAction: jest.fn() }));
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET     = 'test-secret-credit-sale-32-chars-long';
process.env.DB_NAME        = 'test_db';
process.env.MASTER_DB_NAME = 'test_master';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const { queryDb, query, getConnection, tenantStorage } = require('../../config/database');
const { isBlacklisted } = require('../../services/tokenBlacklist');
const { buildTestApp } = require('../helpers/testApp');

let app;

const adminUser = {
  user_id: 1, name: 'Admin', email: 'admin@test.com',
  role_name: 'Admin', branch_id: null, is_active: 1,
};

const makeToken = (role = 'Admin') =>
  jwt.sign({ user_id: 1, tenant_db: 'test_db', modules: [], role_name: role }, process.env.JWT_SECRET);

const authHeader = (role = 'Admin') => ({ Authorization: `Bearer ${makeToken(role)}` });

// Build a mock DB connection suitable for transaction-based operations
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
  // jest.config resetMocks:true resets all implementations before each test
  tenantStorage.run = jest.fn((db, fn) => fn());
  isBlacklisted.mockResolvedValue(false);
  queryDb.mockResolvedValue([adminUser]);
  query.mockResolvedValue([]);
});

// ─── GET /api/credit-sales ───────────────────────────────────────

describe('GET /api/credit-sales', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/credit-sales');
    expect(res.status).toBe(401);
  });

  it('returns paginated credit sales list', async () => {
    const fakeSales = [
      { credit_sale_id: 1, customer_name: 'Alice', total_amount: 5000, balance_due: 3000, status: 'partial' },
      { credit_sale_id: 2, customer_name: 'Bob',   total_amount: 2000, balance_due: 2000, status: 'pending' },
    ];
    // getAll uses Promise.all([query(data), query(count)])
    query
      .mockResolvedValueOnce(fakeSales)          // main SELECT
      .mockResolvedValueOnce([{ total: 2 }]);    // COUNT query
    const res = await request(app)
      .get('/api/credit-sales')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ total: 2, page: 1 });
  });

  it('returns 500 when database throws', async () => {
    query.mockRejectedValueOnce(new Error('DB connection lost'));
    const res = await request(app)
      .get('/api/credit-sales')
      .set(authHeader());
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  });
});

// ─── POST /api/credit-sales ──────────────────────────────────────

describe('POST /api/credit-sales', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/credit-sales')
      .send({ sale_id: 1, customer_id: 2, total_amount: 5000, due_date: '2026-10-01' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    // Missing due_date
    const res = await request(app)
      .post('/api/credit-sales')
      .set(authHeader())
      .send({ sale_id: 1, customer_id: 2, total_amount: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('returns 400 for walk-in customer (customer_id === 1)', async () => {
    const res = await request(app)
      .post('/api/credit-sales')
      .set(authHeader())
      .send({ sale_id: 1, customer_id: 1, total_amount: 5000, due_date: '2026-10-01' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/walk-in/i);
  });

  it('returns 404 when referenced sale does not exist', async () => {
    // First query: validate sale → not found
    query.mockResolvedValueOnce([]); // sale not found
    const res = await request(app)
      .post('/api/credit-sales')
      .set(authHeader())
      .send({ sale_id: 999, customer_id: 2, total_amount: 5000, due_date: '2026-10-01' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/sale not found/i);
  });

  it('returns 404 when customer does not exist', async () => {
    // First query: validate sale → found; second: validate customer → not found
    query
      .mockResolvedValueOnce([{ sale_id: 1, total_amount: 5000 }]) // sale exists
      .mockResolvedValueOnce([]);                                   // customer not found
    const res = await request(app)
      .post('/api/credit-sales')
      .set(authHeader())
      .send({ sale_id: 1, customer_id: 99, total_amount: 5000, due_date: '2026-10-01' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/customer not found/i);
  });

  it('creates credit sale successfully and returns 201 with credit_sale_id', async () => {
    const conn = makeConn();

    // Pre-transaction queries (validate sale + customer)
    query
      .mockResolvedValueOnce([{ sale_id: 1, total_amount: 5000 }])       // sale exists
      .mockResolvedValueOnce([{ customer_id: 2, customer_name: 'Alice' }]); // customer exists

    // Transaction queries via conn.query
    conn.query
      .mockResolvedValueOnce({ insertId: 42 }); // INSERT credit_sales

    const res = await request(app)
      .post('/api/credit-sales')
      .set(authHeader())
      .send({ sale_id: 1, customer_id: 2, total_amount: 5000, paid_amount: 0, due_date: '2026-10-01' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/created/i);
    expect(res.body.credit_sale_id).toBe(42);
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it('creates credit sale with partial initial payment and inserts credit_payment row', async () => {
    const conn = makeConn();

    query
      .mockResolvedValueOnce([{ sale_id: 1, total_amount: 5000 }])
      .mockResolvedValueOnce([{ customer_id: 2, customer_name: 'Bob' }]);

    conn.query
      .mockResolvedValueOnce({ insertId: 55 })  // INSERT credit_sales
      .mockResolvedValueOnce({ insertId: 10 }); // INSERT credit_payments (initial payment)

    const res = await request(app)
      .post('/api/credit-sales')
      .set(authHeader())
      .send({ sale_id: 1, customer_id: 2, total_amount: 5000, paid_amount: 2000, due_date: '2026-10-01' });

    expect(res.status).toBe(201);
    expect(res.body.credit_sale_id).toBe(55);
    // conn.query should have been called twice: INSERT sale + INSERT payment
    expect(conn.query).toHaveBeenCalledTimes(2);
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it('returns 500 and rolls back transaction when DB throws inside transaction', async () => {
    const conn = makeConn();

    query
      .mockResolvedValueOnce([{ sale_id: 1, total_amount: 5000 }])
      .mockResolvedValueOnce([{ customer_id: 2, customer_name: 'Charlie' }]);

    conn.query.mockRejectedValueOnce(new Error('Deadlock detected'));

    const res = await request(app)
      .post('/api/credit-sales')
      .set(authHeader())
      .send({ sale_id: 1, customer_id: 2, total_amount: 5000, due_date: '2026-10-01' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });
});
