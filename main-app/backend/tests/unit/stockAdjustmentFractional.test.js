// Regression test for the fractional-quantity fix in stockAdjustmentController.js:
//   quantity_adjusted used to flow from req.body into arithmetic and an INT DB
//   column with no numeric cast at all. Raw materials/semi-finished items are
//   adjusted in fractional quantities (e.g. 2.5 kg) — this must not truncate.

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../services/auditService', () => ({ logAction: jest.fn().mockResolvedValue(true) }));
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET = 'test-secret-stock-adjustment-fractional-32ch';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const { query, getConnection } = require('../../config/database');
const { isBlacklisted } = require('../../services/tokenBlacklist');
const { buildTestApp } = require('../helpers/testApp');

let app;

const adminUser = {
  user_id: 1, name: 'Admin', username: 'admin', email: 'admin@test.com',
  role_name: 'Admin', is_active: 1,
};

const makeToken = () => jwt.sign({ user_id: 1, role_name: 'Admin' }, process.env.JWT_SECRET);
const authHeader = () => ({ Authorization: `Bearer ${makeToken()}` });
const mockAuthLookup = () => query.mockResolvedValueOnce([adminUser]);

function makeConn(responders) {
  const calls = [];
  const conn = {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit:   jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release:  jest.fn(),
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      for (const [pattern, handler] of responders) {
        if (pattern.test(sql)) return typeof handler === 'function' ? handler(params) : handler;
      }
      return [];
    }),
  };
  getConnection.mockResolvedValue(conn);
  return { conn, calls };
}

beforeAll(() => {
  app = buildTestApp();
});

beforeEach(() => {
  isBlacklisted.mockResolvedValue(false);
  query.mockResolvedValue([]);
});

describe('POST /api/stock-adjustments (fractional quantities)', () => {
  it('preserves a fractional quantity_adjusted through the before/after calculation', async () => {
    mockAuthLookup();
    const { calls } = makeConn([
      [/SELECT product_id, product_name, stock_quantity FROM products WHERE product_id = \? FOR UPDATE/, () => [
        { product_id: 5, product_name: 'Flour (kg)', stock_quantity: 10.5 },
      ]],
      [/INSERT INTO stock_adjustments/, () => ({ insertId: 1 })],
      [/UPDATE products SET stock_quantity/, () => ({ affectedRows: 1 })],
      [/SELECT avg_cost FROM inventory/, () => [{ avg_cost: 12.5 }]],
      [/INSERT INTO inventory/, () => ({ affectedRows: 1 })],
    ]);

    const res = await request(app)
      .post('/api/stock-adjustments')
      .set(authHeader())
      .send({ product_id: 5, adjustment_type: 'addition', quantity_adjusted: 2.5 });

    expect(res.status).toBe(201);
    expect(res.body.quantity_before).toBe(10.5);
    expect(res.body.quantity_after).toBe(13); // 10.5 + 2.5, not truncated to an integer

    const insertCall = calls.find(c => /INSERT INTO stock_adjustments/.test(c.sql));
    // params: [product_id, adjustment_type, quantity_before, quantity_adjusted, quantity_after, reason, reference_number, created_by]
    expect(insertCall.params[2]).toBe(10.5);
    expect(insertCall.params[3]).toBe(2.5);
    expect(insertCall.params[4]).toBe(13);
  });

  it('rejects a non-numeric quantity_adjusted instead of coercing it to NaN/0', async () => {
    mockAuthLookup();
    makeConn([]);

    const res = await request(app)
      .post('/api/stock-adjustments')
      .set(authHeader())
      .send({ product_id: 5, adjustment_type: 'addition', quantity_adjusted: 'not-a-number' });

    expect(res.status).toBe(400);
  });

  it('correctly subtracts a fractional quantity for a subtractive adjustment type', async () => {
    mockAuthLookup();
    const { calls } = makeConn([
      [/SELECT product_id, product_name, stock_quantity FROM products WHERE product_id = \? FOR UPDATE/, () => [
        { product_id: 6, product_name: 'Sugar (kg)', stock_quantity: 5.25 },
      ]],
      [/INSERT INTO stock_adjustments/, () => ({ insertId: 2 })],
      [/UPDATE products SET stock_quantity/, () => ({ affectedRows: 1 })],
      [/SELECT avg_cost FROM inventory/, () => [{ avg_cost: 8 }]],
      [/INSERT INTO inventory/, () => ({ affectedRows: 1 })],
    ]);

    const res = await request(app)
      .post('/api/stock-adjustments')
      .set(authHeader())
      .send({ product_id: 6, adjustment_type: 'damage', quantity_adjusted: 1.25 });

    expect(res.status).toBe(201);
    expect(res.body.quantity_after).toBe(4); // 5.25 - 1.25
    const insertCall = calls.find(c => /INSERT INTO stock_adjustments/.test(c.sql));
    expect(insertCall.params[4]).toBe(4);
  });
});
