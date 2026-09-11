// Integration tests for /api/products routes
// Note: productController AND the authenticate middleware both use `query`
// (single-tenant — no queryDb/tenantStorage). Every authenticated request
// triggers exactly one extra query() call first, for the authenticate
// middleware's user lookup — tests must queue a value for that call before
// queuing values for the controller's own queries.
// Field name: `price` (not `selling_price`) per controller schema

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../services/auditService', () => ({ logAction: jest.fn() }));
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET = 'test-secret-products';

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const { query } = require('../../config/database');
const { isBlacklisted } = require('../../services/tokenBlacklist');
const { buildTestApp } = require('../helpers/testApp');

let app;
const adminUser = { user_id: 1, name: 'Admin', email: 'a@a.com', role_name: 'Admin', is_active: 1 };

const makeToken = (role = 'Admin') =>
  jwt.sign({ user_id: 1, role_name: role }, process.env.JWT_SECRET);

const authHeader = (role = 'Admin') => ({ Authorization: `Bearer ${makeToken(role)}` });

// Queues the authenticate middleware's user lookup response (always the first query() call).
const mockAuthLookup = () => query.mockResolvedValueOnce([adminUser]);

beforeAll(() => {
  app = buildTestApp();
});

beforeEach(() => {
  // resetMocks: true in jest.config resets all implementations before each test
  isBlacklisted.mockResolvedValue(false);
  query.mockResolvedValue([]);
});

// ─── GET /api/products ───────────────────────────────────────────

describe('GET /api/products', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('returns data array without pagination when page/limit not provided', async () => {
    mockAuthLookup();
    query.mockResolvedValueOnce([]); // main SELECT (no page/limit = single query)
    const res = await request(app)
      .get('/api/products')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns paginated response with pagination object when page+limit given', async () => {
    mockAuthLookup();
    query
      .mockResolvedValueOnce([{ total: 50 }]) // COUNT query
      .mockResolvedValueOnce([]);              // data query
    const res = await request(app)
      .get('/api/products?page=2&limit=10')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
    expect(res.body.pagination.total).toBe(50);
    expect(res.body.pagination.totalPages).toBe(5);
  });

  it('includes products in data array', async () => {
    mockAuthLookup();
    const products = [
      { product_id: 1, product_name: 'Chai', price: 50 },
      { product_id: 2, product_name: 'Samosa', price: 30 },
    ];
    query
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce(products);
    const res = await request(app)
      .get('/api/products?page=1&limit=20')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].product_name).toBe('Chai');
  });
});

// ─── GET /api/products/:id ───────────────────────────────────────

describe('GET /api/products/:id', () => {
  it('returns 404 when product does not exist', async () => {
    mockAuthLookup();
    query.mockResolvedValueOnce([]); // product not found
    const res = await request(app)
      .get('/api/products/999')
      .set(authHeader());
    expect(res.status).toBe(404);
  });

  it('returns product data with 200 when found', async () => {
    mockAuthLookup();
    query.mockResolvedValueOnce([{ product_id: 1, product_name: 'Milk', price: 120, has_variants: 0 }]);
    const res = await request(app)
      .get('/api/products/1')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.product_id).toBe(1);
    expect(res.body.product_name).toBe('Milk');
  });
});

// ─── POST /api/products ──────────────────────────────────────────

describe('POST /api/products', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/products').send({ product_name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when product_name is missing', async () => {
    mockAuthLookup();
    const res = await request(app)
      .post('/api/products')
      .set(authHeader())
      .send({ price: 100 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  it('returns 400 when price is missing for finished goods', async () => {
    mockAuthLookup();
    const res = await request(app)
      .post('/api/products')
      .set(authHeader())
      .send({ product_name: 'Test Product' }); // no price
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/price/i);
  });

  it('creates product and returns 201 with product_id', async () => {
    mockAuthLookup();
    // create calls: INSERT products → INSERT inventory
    query
      .mockResolvedValueOnce({ insertId: 42 })  // INSERT products
      .mockResolvedValueOnce({ insertId: 1 });   // INSERT inventory
    const res = await request(app)
      .post('/api/products')
      .set(authHeader())
      .send({ product_name: 'New Product', price: 100, category_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.product_id).toBe(42);
    expect(res.body.message).toMatch(/created/i);
  });

  it('returns 400 when barcode uniqueness is violated (ER_DUP_ENTRY)', async () => {
    mockAuthLookup();
    // Simulate MySQL duplicate key error
    const dupError = new Error('Duplicate entry');
    dupError.code = 'ER_DUP_ENTRY';
    query.mockRejectedValueOnce(dupError);
    const res = await request(app)
      .post('/api/products')
      .set(authHeader())
      .send({ product_name: 'Dupe', price: 50, barcode: 'BARCODE123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/barcode/i);
  });
});

// ─── PUT /api/products/:id ───────────────────────────────────────

describe('PUT /api/products/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/products/1').send({ product_name: 'X' });
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/products/:id ────────────────────────────────────

describe('DELETE /api/products/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/products/1');
    expect(res.status).toBe(401);
  });

  it('returns 400 when product has sales history', async () => {
    mockAuthLookup();
    // delete flow: SELECT sale_details (has rows) → 400
    query.mockResolvedValueOnce([{ sale_detail_id: 99 }]);
    const res = await request(app)
      .delete('/api/products/1')
      .set(authHeader());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sales history/i);
  });

  it('deletes product when no sales history exists', async () => {
    mockAuthLookup();
    // delete flow: SELECT sale_details (empty) → SELECT product → DELETE inventory → DELETE product
    query
      .mockResolvedValueOnce([])                       // no sales history
      .mockResolvedValueOnce([{ product_name: 'X' }]) // product name lookup
      .mockResolvedValueOnce({ affectedRows: 1 })      // DELETE inventory
      .mockResolvedValueOnce({ affectedRows: 1 });     // DELETE product
    const res = await request(app)
      .delete('/api/products/1')
      .set(authHeader());
    expect(res.status).toBe(200);
  });
});
