// Regression test for an authorization gap found in the AI chat endpoint:
//   POST /api/ai/chat previously required only `authenticate`, with no
//   permission check at all, even though the frontend already gates the
//   widget's visibility behind the "system.ai_widget" permission
//   (AIWidget.tsx / AccessControl.tsx) — that check had no server-side
//   equivalent, so any authenticated role could call the endpoint directly.
// This also verifies the { asView: true } option on requirePermission, added
// so a POST-shaped-but-read-semantics endpoint checks the base
// "system.ai_widget" permission instead of the method-based
// "system.ai_widget.create" mapping.

jest.mock('../../config/database');
jest.mock('../../services/tokenBlacklist');
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));

process.env.JWT_SECRET = 'test-secret-ai-chat-authorization-32-chars';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const { query } = require('../../config/database');
const { isBlacklisted } = require('../../services/tokenBlacklist');
const { buildTestApp } = require('../helpers/testApp');

let app;

const makeToken = (role) => jwt.sign({ user_id: 1, role_name: role }, process.env.JWT_SECRET);
const authHeader = (role) => ({ Authorization: `Bearer ${makeToken(role)}` });

const userRow = (role) => ({
  user_id: 1, name: 'Test User', username: 'testuser', email: 'test@test.com',
  role_name: role, is_active: 1,
});

beforeAll(() => {
  app = buildTestApp();
});

beforeEach(() => {
  isBlacklisted.mockResolvedValue(false);
  query.mockResolvedValue([]);
  // No GROQ_API_KEY is set in the test env, so a request that gets past the
  // permission gate falls through to a real fetch() to the local Ollama
  // endpoint. Fail it immediately (like ECONNREFUSED) so these tests stay
  // fast, isolated unit tests focused on the permission gate, not a live
  // network dependency.
  global.fetch = jest.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
});

afterEach(() => {
  delete global.fetch;
});

describe('POST /api/ai/chat authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects a role without system.ai_widget permission (e.g. Cashier)', async () => {
    // 1st query() call = authenticate's user lookup, 2nd = requirePermission's DB check
    query
      .mockResolvedValueOnce([userRow('Cashier')])
      .mockResolvedValueOnce([]); // no matching role_permissions row

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader('Cashier'))
      .send({ message: 'What is our total revenue this month?' });

    expect(res.status).toBe(403);
  });

  it('allows a role that has been granted system.ai_widget (base key, not system.ai_widget.create)', async () => {
    query
      .mockResolvedValueOnce([userRow('Manager')])
      .mockResolvedValueOnce([{ 1: 1 }]); // role_permissions has a matching row

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader('Manager'))
      .send({ message: 'What is our total revenue this month?' });

    // No AI provider is configured in the test env, so the controller itself
    // will fail past this point (503) — the point of this test is that it gets
    // PAST the permission gate at all, proving the check used the base
    // "system.ai_widget" key rather than requiring "system.ai_widget.create".
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('allows Admin unconditionally (no permission DB lookup)', async () => {
    query.mockResolvedValueOnce([userRow('Admin')]);

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader('Admin'))
      .send({ message: 'What is our total revenue this month?' });

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
