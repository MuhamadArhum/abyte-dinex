// Regression test for the P0 bug fixed in registerController.js:
//   closeRegister's "expected balance" formula ignored total_cash_in/total_cash_out
//   (cash movements recorded by addCashMovement), making reconciliation wrong on
//   any shift with a cash-in/cash-out movement.

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../services/auditService', () => ({ logAction: jest.fn().mockResolvedValue(true) }));
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET = 'test-secret-register-reconciliation-32chars';

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

describe('POST /api/register/close (closeRegister)', () => {
  it('includes total_cash_in and total_cash_out in the expected balance', async () => {
    mockAuthLookup();
    const { calls } = makeConn([
      [/SELECT \* FROM cash_registers WHERE status = 'open' FOR UPDATE/, () => [{
        register_id: 5,
        opening_balance: 1000,
        cash_sales_total: 500,
        total_cash_in: 200,
        total_cash_out: 50,
      }]],
      [/SELECT COUNT\(\*\) as cnt FROM sales WHERE status = 'pending'/, () => [{ cnt: 0 }]],
      [/status = 'closed'/, () => ({ affectedRows: 1 })],
    ]);
    // Re-fetch after commit uses the module-level query(), which already
    // consumed one call for auth — queue the second response for it.
    query.mockResolvedValueOnce([{ register_id: 5, status: 'closed' }]);

    const res = await request(app)
      .post('/api/register/close')
      .set(authHeader())
      .send({ closing_balance: 1650 });

    expect(res.status).toBe(200);

    const updateCall = calls.find(c => /status = 'closed'/.test(c.sql));
    expect(updateCall).toBeDefined();
    // params order: [closed_by, closing_balance, expected_balance, difference, close_note, register_id]
    const [, closingBalance, expectedBalance, difference] = updateCall.params;
    expect(closingBalance).toBe(1650);
    // 1000 (opening) + 500 (cash sales) + 200 (cash in) - 50 (cash out) = 1650
    expect(expectedBalance).toBe(1650);
    expect(difference).toBe(0); // closing_balance matches expected exactly — no shortage/overage
  });

  it('flags a real shortage once cash movements are correctly accounted for', async () => {
    mockAuthLookup();
    const { calls } = makeConn([
      [/SELECT \* FROM cash_registers WHERE status = 'open' FOR UPDATE/, () => [{
        register_id: 6,
        opening_balance: 1000,
        cash_sales_total: 500,
        total_cash_in: 0,
        total_cash_out: 300, // cashier paid a supplier out of the till
      }]],
      [/SELECT COUNT\(\*\) as cnt FROM sales WHERE status = 'pending'/, () => [{ cnt: 0 }]],
      [/status = 'closed'/, () => ({ affectedRows: 1 })],
    ]);
    query.mockResolvedValueOnce([{ register_id: 6, status: 'closed' }]);

    // Physically counted drawer correctly reflects the cash_out (1000+500-300=1200)
    const res = await request(app)
      .post('/api/register/close')
      .set(authHeader())
      .send({ closing_balance: 1200 });

    expect(res.status).toBe(200);
    const updateCall = calls.find(c => /status = 'closed'/.test(c.sql));
    const [, , expectedBalance, difference] = updateCall.params;
    expect(expectedBalance).toBe(1200); // would have been wrongly 1500 before the fix
    expect(difference).toBe(0);
  });
});
