const { requireModule, calculatePrice, getModuleList, getPlanModules, isModuleAllowed, MODULES } = require('../../../middleware/moduleGuard');

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

// ─── calculatePrice ──────────────────────────────────────────────

describe('calculatePrice', () => {
  it('returns 0 for empty array', () => {
    expect(calculatePrice([])).toBe(0);
  });

  it('returns correct price for a single module', () => {
    expect(calculatePrice(['sales'])).toBe(2250);
    expect(calculatePrice(['inventory'])).toBe(2250);
  });

  it('sums prices for multiple modules', () => {
    expect(calculatePrice(['sales', 'inventory'])).toBe(4500);
  });

  it('counts unique parent modules only', () => {
    expect(calculatePrice(['sales.pos', 'sales.returns', 'inventory'])).toBe(4500);
  });

  it('ignores unknown module keys', () => {
    expect(calculatePrice(['sales', 'nonexistent'])).toBe(2250);
  });

  it('returns 0 when no argument passed', () => {
    expect(calculatePrice()).toBe(0);
  });
});

// ─── getPlanModules ──────────────────────────────────────────────

describe('getPlanModules', () => {
  it('returns sales and inventory for the standard plan', () => {
    expect(getPlanModules('standard')).toEqual(['sales', 'inventory']);
  });

  it('falls back to standard for an unknown plan', () => {
    expect(getPlanModules('unknown')).toEqual(['sales', 'inventory']);
    expect(getPlanModules()).toEqual(['sales', 'inventory']);
  });
});

// ─── isModuleAllowed ─────────────────────────────────────────────

describe('isModuleAllowed', () => {
  it('returns true when modulesEnabled is null/undefined', () => {
    expect(isModuleAllowed(null, 'inventory')).toBe(true);
    expect(isModuleAllowed(undefined, 'inventory')).toBe(true);
  });

  it('returns true when module is in the list', () => {
    expect(isModuleAllowed(['sales', 'inventory'], 'inventory')).toBe(true);
  });

  it('returns false when module is not in the list', () => {
    expect(isModuleAllowed(['sales'], 'inventory')).toBe(false);
  });
});

// ─── getModuleList ───────────────────────────────────────────────

describe('getModuleList', () => {
  it('returns array of module objects', () => {
    const list = getModuleList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(2);
    expect(list[0]).toHaveProperty('key');
    expect(list[0]).toHaveProperty('price');
    expect(list[0]).toHaveProperty('name');
  });

  it('includes exactly the sales and inventory modules', () => {
    const keys = getModuleList().map(m => m.key);
    expect(keys).toContain('sales');
    expect(keys).toContain('inventory');
    expect(keys).not.toContain('accounts');
    expect(keys).not.toContain('hr');
  });

  it('matches the MODULES export', () => {
    expect(Object.keys(MODULES).sort()).toEqual(['inventory', 'sales']);
  });
});
