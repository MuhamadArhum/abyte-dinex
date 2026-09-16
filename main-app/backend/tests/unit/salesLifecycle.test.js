// Regression tests for the P0 bug fixed in salesController.js:
//   deleteSale/refundSale used to restore stock and never reversed cash-register
//   totals, regardless of whether the sale had actually had stock deducted.
// These tests drive the real routes/controllers through supertest with a mocked
// DB connection, asserting on the *sequence and content* of conn.query() calls —
// a pure-calculation unit test would not catch this class of bug.

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../services/auditService', () => ({ logAction: jest.fn().mockResolvedValue(true) }));
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET = 'test-secret-sales-lifecycle-32-chars-long';

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

const makeToken = (role = 'Admin') => jwt.sign({ user_id: 1, role_name: role }, process.env.JWT_SECRET);
const authHeader = (role = 'Admin') => ({ Authorization: `Bearer ${makeToken(role)}` });
const mockAuthLookup = () => query.mockResolvedValueOnce([adminUser]);

// Builds a mocked transaction connection whose .query() responds based on the SQL
// text it receives, rather than a brittle fixed call-order — matches() are checked
// in order and the first match wins.
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

describe('DELETE /api/sales/:id (deleteSale)', () => {
  it('does NOT restore stock or touch the register for a pending sale (stock was never deducted)', async () => {
    mockAuthLookup();
    const { conn, calls } = makeConn([
      [/SELECT .* FROM sales WHERE sale_id = \? FOR UPDATE/, () => [
        { sale_id: 10, status: 'pending', payment_method: 'cash', total_amount: 500, sale_date: '2024-01-01' },
      ]],
      // Non-empty items — if the status guard were missing, batchUpdateStock
      // would issue real available_stock UPDATEs against this fixture, so this
      // test actually exercises the guard rather than passing vacuously.
      [/SELECT product_id, variant_id, quantity FROM sale_details/, () => [
        { product_id: 1, variant_id: null, quantity: 3 },
      ]],
      [/DELETE FROM sale_details/, () => ({ affectedRows: 1 })],
      [/DELETE FROM sales/, () => ({ affectedRows: 1 })],
    ]);

    const res = await request(app).delete('/api/sales/10').set(authHeader('Admin'));

    expect(res.status).toBe(200);
    const sqlTexts = calls.map(c => c.sql);
    expect(sqlTexts.some(s => /SELECT product_id, variant_id, quantity FROM sale_details/.test(s))).toBe(false);
    expect(sqlTexts.some(s => /available_stock/.test(s))).toBe(false);
    expect(sqlTexts.some(s => /cash_sales_total|card_sales_total/.test(s))).toBe(false);
    expect(conn.commit).toHaveBeenCalled();
  });

  it('restores stock and reverses cash_sales_total for a completed cash sale', async () => {
    mockAuthLookup();
    const { conn, calls } = makeConn([
      [/SELECT .* FROM sales WHERE sale_id = \? FOR UPDATE/, () => [
        { sale_id: 11, status: 'completed', payment_method: 'cash', total_amount: 300, sale_date: new Date('2024-01-02T10:00:00Z') },
      ]],
      [/SELECT product_id, variant_id, quantity FROM sale_details/, () => [
        { product_id: 5, variant_id: null, quantity: 2 },
      ]],
      [/UPDATE inventory SET available_stock/, () => ({ affectedRows: 1 })],
      [/UPDATE products SET stock_quantity/, () => ({ affectedRows: 1 })],
      [/SELECT 1 FROM credit_sales/, () => []], // not a credit sale
      [/SELECT register_id, opened_at FROM cash_registers WHERE status = 'open'/, () => [
        { register_id: 7, opened_at: new Date('2024-01-01T08:00:00Z') }, // register opened before the sale
      ]],
      [/UPDATE cash_registers SET cash_sales_total/, () => ({ affectedRows: 1 })],
      [/DELETE FROM sale_details/, () => ({ affectedRows: 1 })],
      [/DELETE FROM sales/, () => ({ affectedRows: 1 })],
    ]);

    const res = await request(app).delete('/api/sales/11').set(authHeader('Admin'));

    expect(res.status).toBe(200);
    const stockRestore = calls.find(c => /UPDATE inventory SET available_stock/.test(c.sql));
    expect(stockRestore).toBeDefined();
    expect(stockRestore.sql).toContain('+'); // restoring, not deducting

    const registerReversal = calls.find(c => /UPDATE cash_registers SET cash_sales_total/.test(c.sql));
    expect(registerReversal).toBeDefined();
    expect(registerReversal.params).toEqual([300, 7]); // total_amount, register_id — decremented once
    expect(conn.commit).toHaveBeenCalled();
  });

  it('does NOT reverse the register for a completed credit sale (it never touched cash_registers)', async () => {
    mockAuthLookup();
    const { calls } = makeConn([
      [/SELECT .* FROM sales WHERE sale_id = \? FOR UPDATE/, () => [
        { sale_id: 12, status: 'completed', payment_method: 'cash', total_amount: 300, sale_date: new Date('2024-01-02T10:00:00Z') },
      ]],
      [/SELECT product_id, variant_id, quantity FROM sale_details/, () => [
        { product_id: 5, variant_id: null, quantity: 2 },
      ]],
      [/UPDATE inventory SET available_stock/, () => ({ affectedRows: 1 })],
      [/UPDATE products SET stock_quantity/, () => ({ affectedRows: 1 })],
      [/SELECT 1 FROM credit_sales/, () => [{ 1: 1 }]], // IS a credit sale
      [/DELETE FROM sale_details/, () => ({ affectedRows: 1 })],
      [/DELETE FROM sales/, () => ({ affectedRows: 1 })],
    ]);

    const res = await request(app).delete('/api/sales/12').set(authHeader('Admin'));

    expect(res.status).toBe(200);
    expect(calls.some(c => /cash_registers WHERE status = 'open'/.test(c.sql))).toBe(false);
    expect(calls.some(c => /UPDATE cash_registers/.test(c.sql))).toBe(false);
  });
});

describe('POST /api/sales/:id/refund (refundSale)', () => {
  it('rejects refunding a pending sale (stock was never deducted)', async () => {
    mockAuthLookup();
    const { calls } = makeConn([
      [/SELECT .* FROM sales WHERE sale_id = \? FOR UPDATE/, () => [
        { sale_id: 20, status: 'pending', payment_method: 'cash', total_amount: 500, sale_date: '2024-01-01' },
      ]],
    ]);

    const res = await request(app).post('/api/sales/20/refund').set(authHeader('Admin'));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only completed sales can be refunded/i);
    expect(calls.some(c => /available_stock/.test(c.sql))).toBe(false);
  });

  it('rejects refunding an already-refunded sale', async () => {
    mockAuthLookup();
    makeConn([
      [/SELECT .* FROM sales WHERE sale_id = \? FOR UPDATE/, () => [
        { sale_id: 21, status: 'refunded', payment_method: 'cash', total_amount: 500, sale_date: '2024-01-01' },
      ]],
    ]);

    const res = await request(app).post('/api/sales/21/refund').set(authHeader('Admin'));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already refunded/i);
  });

  it('restores stock and reverses card_sales_total for a completed card sale', async () => {
    mockAuthLookup();
    const { calls } = makeConn([
      [/SELECT .* FROM sales WHERE sale_id = \? FOR UPDATE/, () => [
        { sale_id: 22, status: 'completed', payment_method: 'card', total_amount: 750, sale_date: new Date('2024-01-02T10:00:00Z') },
      ]],
      [/SELECT product_id, variant_id, quantity FROM sale_details/, () => [
        { product_id: 9, variant_id: null, quantity: 1 },
      ]],
      [/UPDATE inventory SET available_stock/, () => ({ affectedRows: 1 })],
      [/UPDATE products SET stock_quantity/, () => ({ affectedRows: 1 })],
      [/SELECT 1 FROM credit_sales/, () => []],
      [/SELECT register_id, opened_at FROM cash_registers WHERE status = 'open'/, () => [
        { register_id: 3, opened_at: new Date('2024-01-01T08:00:00Z') },
      ]],
      [/UPDATE cash_registers SET card_sales_total/, () => ({ affectedRows: 1 })],
      [/UPDATE sales SET status = "refunded"/, () => ({ affectedRows: 1 })],
    ]);

    const res = await request(app).post('/api/sales/22/refund').set(authHeader('Admin'));

    expect(res.status).toBe(200);
    const registerReversal = calls.find(c => /UPDATE cash_registers SET card_sales_total/.test(c.sql));
    expect(registerReversal).toBeDefined();
    expect(registerReversal.params).toEqual([750, 3]);
  });

  it('does NOT reverse register totals when the sale predates the currently open register', async () => {
    mockAuthLookup();
    const { calls } = makeConn([
      [/SELECT .* FROM sales WHERE sale_id = \? FOR UPDATE/, () => [
        { sale_id: 23, status: 'completed', payment_method: 'cash', total_amount: 400, sale_date: new Date('2024-01-01T08:00:00Z') },
      ]],
      [/SELECT product_id, variant_id, quantity FROM sale_details/, () => [
        { product_id: 4, variant_id: null, quantity: 1 },
      ]],
      [/UPDATE inventory SET available_stock/, () => ({ affectedRows: 1 })],
      [/UPDATE products SET stock_quantity/, () => ({ affectedRows: 1 })],
      [/SELECT 1 FROM credit_sales/, () => []],
      // Register opened AFTER the sale's own date — belongs to a later shift, must not be touched
      [/SELECT register_id, opened_at FROM cash_registers WHERE status = 'open'/, () => [
        { register_id: 99, opened_at: new Date('2024-01-02T08:00:00Z') },
      ]],
      [/UPDATE sales SET status = "refunded"/, () => ({ affectedRows: 1 })],
    ]);

    const res = await request(app).post('/api/sales/23/refund').set(authHeader('Admin'));

    expect(res.status).toBe(200);
    expect(calls.some(c => /UPDATE cash_registers SET (cash|card)_sales_total/.test(c.sql))).toBe(false);
  });
});
