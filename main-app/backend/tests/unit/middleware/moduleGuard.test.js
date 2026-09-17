const { requireModule } = require('../../../middleware/moduleGuard');

// ─── requireModule ───────────────────────────────────────────────
// Single-tenant: all modules enabled, requireModule is a no-op passthrough.

describe('requireModule middleware', () => {
  let next, res;

  beforeEach(() => {
    next = jest.fn();
    res  = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('passes through when req.modules is empty', () => {
    const req = { modules: [] };
    requireModule('sales')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes through when req.modules is missing', () => {
    const req = {};
    requireModule('inventory')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes through regardless of the requested module', () => {
    const req = { modules: ['sales', 'inventory'] };
    requireModule('sales')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes through for an unknown module name', () => {
    const req = { modules: ['sales'] };
    requireModule('nonexistent_module')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
