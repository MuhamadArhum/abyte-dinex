// Integration tests for /api/auth routes

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../services/auditService', () => ({ logAction: jest.fn() }));
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET     = 'test-integration-secret-abc123';
process.env.DB_NAME        = 'test_db';
process.env.MASTER_DB_NAME = 'test_master';

const request  = require('supertest');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { queryDb, tenantStorage } = require('../../config/database');
const { isBlacklisted, blacklistToken } = require('../../services/tokenBlacklist');
const { buildTestApp } = require('../helpers/testApp');

let app;

beforeAll(() => {
  tenantStorage.run = jest.fn((db, fn) => fn());
  app = buildTestApp();
});

beforeEach(() => {
  // jest.config has resetMocks:true — resets implementations before each test
  // Re-initialize needed default behaviors
  tenantStorage.run = jest.fn((db, fn) => fn());
  isBlacklisted.mockResolvedValue(false);
  blacklistToken.mockResolvedValue(true);
});

// ─── POST /api/auth/login ─────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const endpoint = '/api/auth/login';

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post(endpoint).send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown company code', async () => {
    queryDb.mockResolvedValueOnce([]); // tenant not found
    const res = await request(app).post(endpoint).send({
      company_code: 'unknown', email: 'a@b.com', password: 'pass',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/company code/i);
  });

  it('returns 403 for suspended tenant', async () => {
    queryDb.mockResolvedValueOnce([{ tenant_id: 1, db_name: 'test_db', is_active: 0 }]);
    const res = await request(app).post(endpoint).send({
      company_code: 'abc', email: 'a@b.com', password: 'pass',
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/suspended/i);
  });

  it('returns 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    queryDb
      .mockResolvedValueOnce([{ tenant_id: 1, db_name: 'test_db', is_active: 1 }])
      .mockResolvedValueOnce([{ modules_enabled: '[]' }])
      .mockResolvedValueOnce([{ user_id: 1, email: 'a@b.com', password_hash: hash, is_active: 1, role_name: 'Cashier', branch_id: null }]);
    const res = await request(app).post(endpoint).send({
      company_code: 'abc', email: 'a@b.com', password: 'wrong_password',
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for deactivated user account', async () => {
    const hash = await bcrypt.hash('pass', 10);
    queryDb
      .mockResolvedValueOnce([{ tenant_id: 1, db_name: 'test_db', is_active: 1 }])
      .mockResolvedValueOnce([{ modules_enabled: '[]' }])
      .mockResolvedValueOnce([{ user_id: 1, email: 'a@b.com', password_hash: hash, is_active: 0, role_name: 'Cashier', branch_id: null }]);
    const res = await request(app).post(endpoint).send({
      company_code: 'abc', email: 'a@b.com', password: 'pass',
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  it('returns 200 with valid JWT on successful login (Admin, no branch)', async () => {
    const hash = await bcrypt.hash('pass123', 10);
    // Admin login: tenant → modules → user (3 calls; Admin skips permissions + no branch)
    queryDb
      .mockResolvedValueOnce([{ tenant_id: 1, db_name: 'test_db', is_active: 1 }])
      .mockResolvedValueOnce([{ modules_enabled: '["sales","inventory"]' }])
      .mockResolvedValueOnce([{
        user_id: 1, name: 'Admin User', email: 'admin@test.com', username: 'admin',
        role_name: 'Admin', password_hash: hash, is_active: 1, branch_id: null,
      }]);
    const res = await request(app).post(endpoint).send({
      company_code: 'abc', email: 'admin@test.com', password: 'pass123',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('admin@test.com');
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.modules).toEqual(['sales', 'inventory']);
  });

  it('JWT contains branch_id for branch user (Cashier with branch)', async () => {
    const hash = await bcrypt.hash('pass', 10);
    // Cashier login: tenant → modules → user → permissions → branch name (5 calls)
    queryDb
      .mockResolvedValueOnce([{ tenant_id: 2, db_name: 'test_db', is_active: 1 }])
      .mockResolvedValueOnce([{ modules_enabled: '[]' }])
      .mockResolvedValueOnce([{
        user_id: 7, name: 'Cashier', email: 'c@c.com', username: 'cashier',
        role_name: 'Cashier', password_hash: hash, is_active: 1, branch_id: 1,
      }])
      .mockResolvedValueOnce([])                           // permissions (non-Admin)
      .mockResolvedValueOnce([{ store_name: 'Branch A' }]); // branch name
    const res = await request(app).post(endpoint).send({
      company_code: 'xyz', email: 'c@c.com', password: 'pass',
    });
    expect(res.status).toBe(200);
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.user_id).toBe(7);
    expect(decoded.branch_id).toBe(1);
    expect(res.body.user.branch_name).toBe('Branch A');
  });
});

// ─── GET /api/auth/verify ─────────────────────────────────────────

describe('GET /api/auth/verify', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/verify');
    expect(res.status).toBe(401);
  });

  it('returns 401 with blacklisted token', async () => {
    isBlacklisted.mockResolvedValue(true);
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer some-blacklisted-token');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user data for valid token (Admin — no permission DB call)', async () => {
    const fakeUser = { user_id: 1, name: 'Test', email: 'a@b.com', role_name: 'Admin', branch_id: null };
    const token = jwt.sign({ user_id: 1, tenant_db: 'test_db', modules: ['sales'] }, process.env.JWT_SECRET);
    // Admin: authenticate calls queryDb once (user lookup), then verify returns directly (no permission/branch queries)
    queryDb.mockResolvedValueOnce([fakeUser]);
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('a@b.com');
    expect(res.body.permissions).toBeNull(); // Admin always gets null (full access)
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('returns 200 and blacklists the token on valid logout', async () => {
    const fakeUser = { user_id: 1, name: 'Test', email: 'a@b.com', role_name: 'Admin', branch_id: null };
    const token = jwt.sign({ user_id: 1, tenant_db: 'test_db', modules: [] }, process.env.JWT_SECRET);
    queryDb.mockResolvedValueOnce([fakeUser]);
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(blacklistToken).toHaveBeenCalledWith(token);
  });
});

// ─── GET /api/ping ────────────────────────────────────────────────

describe('GET /api/ping', () => {
  it('returns 200 without auth (public endpoint)', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
