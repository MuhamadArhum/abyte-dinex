// Integration tests for /api/auth routes
// Single-tenant: login is just { email, password } against the local `users`
// table — no company_code, no tenant/master DB lookup. authenticate() and
// authController both use query() (see middleware/auth.js, authController.js).

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../services/auditService', () => ({ logAction: jest.fn() }));
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET = 'test-integration-secret-abc123';

const request  = require('supertest');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { query } = require('../../config/database');
const { isBlacklisted, blacklistToken } = require('../../services/tokenBlacklist');
const { logAction } = require('../../services/auditService');
const { buildTestApp } = require('../helpers/testApp');

let app;

beforeAll(() => {
  app = buildTestApp();
});

beforeEach(() => {
  // jest.config has resetMocks:true — resets implementations before each test.
  // authController calls logAction(...).catch(() => {}) fire-and-forget, so the mock must resolve.
  isBlacklisted.mockResolvedValue(false);
  blacklistToken.mockResolvedValue(true);
  logAction.mockResolvedValue(undefined);
});

// ─── POST /api/auth/login ─────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const endpoint = '/api/auth/login';

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post(endpoint).send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown email', async () => {
    query.mockResolvedValueOnce([]); // user not found
    const res = await request(app).post(endpoint).send({
      email: 'nobody@test.com', password: 'pass',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('returns 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    query.mockResolvedValueOnce([{
      user_id: 1, email: 'a@b.com', password_hash: hash, is_active: 1, role_name: 'Cashier',
    }]);
    const res = await request(app).post(endpoint).send({
      email: 'a@b.com', password: 'wrong_password',
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for deactivated user account', async () => {
    const hash = await bcrypt.hash('pass', 10);
    query.mockResolvedValueOnce([{
      user_id: 1, email: 'a@b.com', password_hash: hash, is_active: 0, role_name: 'Cashier',
    }]);
    const res = await request(app).post(endpoint).send({
      email: 'a@b.com', password: 'pass',
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  it('returns 200 with valid JWT on successful login (Admin — no permissions lookup)', async () => {
    const hash = await bcrypt.hash('pass123', 10);
    // Admin login: user lookup only (permissions query is skipped for Admin)
    query.mockResolvedValueOnce([{
      user_id: 1, name: 'Admin User', email: 'admin@test.com', username: 'admin',
      role_name: 'Admin', password_hash: hash, is_active: 1,
    }]);
    const res = await request(app).post(endpoint).send({
      email: 'admin@test.com', password: 'pass123',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('admin@test.com');
    expect(res.body.permissions).toBeNull();
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.user_id).toBe(1);
    expect(decoded.role_name).toBe('Admin');
  });

  it('returns permissions array for a non-Admin role', async () => {
    const hash = await bcrypt.hash('pass', 10);
    query
      .mockResolvedValueOnce([{
        user_id: 7, name: 'Cashier', email: 'c@c.com', username: 'cashier',
        role_name: 'Cashier', password_hash: hash, is_active: 1,
      }])
      .mockResolvedValueOnce([{ module_key: 'sales.pos' }, { module_key: 'sales.returns' }]); // role_permissions
    const res = await request(app).post(endpoint).send({
      email: 'c@c.com', password: 'pass',
    });
    expect(res.status).toBe(200);
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.user_id).toBe(7);
    expect(res.body.permissions).toEqual(expect.arrayContaining(['sales.pos', 'sales.returns', 'sales']));
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
    const fakeUser = { user_id: 1, name: 'Test', email: 'a@b.com', role_name: 'Admin', is_active: 1 };
    const token = jwt.sign({ user_id: 1 }, process.env.JWT_SECRET);
    // Admin: authenticate calls query() once (user lookup), then verify() returns directly (no permission query)
    query.mockResolvedValueOnce([fakeUser]);
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('a@b.com');
    expect(res.body.permissions).toBeNull(); // Admin always gets null (full access)
  });

  it('returns permissions for a non-Admin token', async () => {
    const fakeUser = { user_id: 7, name: 'Cashier', email: 'c@c.com', role_name: 'Cashier', is_active: 1 };
    const token = jwt.sign({ user_id: 7 }, process.env.JWT_SECRET);
    query
      .mockResolvedValueOnce([fakeUser])                    // authenticate: user lookup
      .mockResolvedValueOnce([{ module_key: 'inventory.products' }]); // verify: role_permissions
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.permissions).toEqual(expect.arrayContaining(['inventory.products', 'inventory']));
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('returns 200 and blacklists the token on valid logout', async () => {
    const fakeUser = { user_id: 1, name: 'Test', email: 'a@b.com', role_name: 'Admin', is_active: 1 };
    const token = jwt.sign({ user_id: 1 }, process.env.JWT_SECRET);
    query.mockResolvedValueOnce([fakeUser]);
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
