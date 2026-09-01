const { requireModule, calculatePrice, getModuleList, getPlanModules, isModuleAllowed, MODULES } = require('../../../middleware/moduleGuard');

// ─── requireModule ───────────────────────────────────────────────

describe('requireModule middleware', () => {
  let next, res;

  beforeEach(() => {
    next = jest.fn();
    res  = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('passes through when req.modules is empty (single-client mode)', () => {
    const req = { modules: [] };
    requireModule('sales')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes through when req.modules is missing', () => {
    const req = {};
    requireModule('hr')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows access when module is in req.modules', () => {
    const req = { modules: ['sales', 'inventory'] };
    requireModule('sales')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks access when module is NOT in req.modules', () => {
    const req = { modules: ['sales', 'inventory'] };
    requireModule('hr')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      upgrade_required: true,
      module: 'hr',
    }));
  });

  it('returns module price in 403 response', () => {
    const req = { modules: ['sales'] };
    requireModule('accounts')(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      price: MODULES.accounts.price,
    }));
  });

  it('handles unknown module name gracefully', () => {
    const req = { modules: ['sales'] };
    requireModule('nonexistent_module')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      price: null,
    }));
  });
});

// ─── calculatePrice ──────────────────────────────────────────────

describe('calculatePrice', () => {
  it('returns 0 for empty array', () => {
    expect(calculatePrice([])).toBe(0);
  });

  it('returns correct price for single module', () => {
    expect(calculatePrice(['sales'])).toBe(2250);
    expect(calculatePrice(['accounts'])).toBe(2999);
    expect(calculatePrice(['hr'])).toBe(2999);
  });

  it('sums prices for multiple modules', () => {
    expect(calculatePrice(['sales', 'inventory'])).toBe(4500);
    expect(calculatePrice(['sales', 'inventory', 'accounts', 'hr'])).toBe(10498);
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
  it('returns sales and inventory for basic plan', () => {
    expect(getPlanModules('basic')).toEqual(['sales', 'inventory']);
  });

  it('returns all four modules for enterprise plan', () => {
    expect(getPlanModules('enterprise')).toEqual(['sales', 'inventory', 'accounts', 'hr']);
  });

  it('falls back to basic for unknown plan', () => {
    expect(getPlanModules('unknown')).toEqual(['sales', 'inventory']);
  });
});

// ─── isModuleAllowed ─────────────────────────────────────────────

describe('isModuleAllowed', () => {
  it('returns true when modulesEnabled is null/undefined', () => {
    expect(isModuleAllowed(null, 'hr')).toBe(true);
    expect(isModuleAllowed(undefined, 'hr')).toBe(true);
  });

  it('returns true when module is in the list', () => {
    expect(isModuleAllowed(['sales', 'hr'], 'hr')).toBe(true);
  });

  it('returns false when module is not in the list', () => {
    expect(isModuleAllowed(['sales', 'inventory'], 'hr')).toBe(false);
  });
});

// ─── getModuleList ───────────────────────────────────────────────

describe('getModuleList', () => {
  it('returns array of module objects', () => {
    const list = getModuleList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(4);
    expect(list[0]).toHaveProperty('key');
    expect(list[0]).toHaveProperty('price');
    expect(list[0]).toHaveProperty('name');
  });

  it('includes all expected modules', () => {
    const keys = getModuleList().map(m => m.key);
    expect(keys).toContain('sales');
    expect(keys).toContain('inventory');
    expect(keys).toContain('accounts');
    expect(keys).toContain('hr');
  });
});
