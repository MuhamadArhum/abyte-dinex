// parsePagination is a local function in several controllers — test the pattern directly
const parsePagination = (page, limit) => {
  const pageNum  = parseInt(page)  || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  const p        = Math.max(1, pageNum);
  const l        = Math.max(1, limitNum);
  return { page: p, limit: l, offset: (p - 1) * l };
};

describe('parsePagination', () => {
  it('uses defaults when no args supplied', () => {
    const r = parsePagination(undefined, undefined);
    expect(r).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('parses valid page and limit', () => {
    const r = parsePagination('3', '10');
    expect(r).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('calculates offset correctly for page > 1', () => {
    const r = parsePagination(5, 25);
    expect(r.offset).toBe(100);
  });

  it('clamps limit to 100 maximum', () => {
    const r = parsePagination(1, 500);
    expect(r.limit).toBe(100);
  });

  it('clamps page to minimum 1', () => {
    const r = parsePagination(-5, 10);
    expect(r.page).toBe(1);
    expect(r.offset).toBe(0);
  });

  it('clamps page 0 to 1', () => {
    const r = parsePagination(0, 20);
    expect(r.page).toBe(1);
  });

  it('handles non-numeric strings gracefully', () => {
    const r = parsePagination('abc', 'xyz');
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
    expect(r.offset).toBe(0);
  });

  it('parses numeric values passed as numbers', () => {
    const r = parsePagination(2, 50);
    expect(r.page).toBe(2);
    expect(r.limit).toBe(50);
    expect(r.offset).toBe(50);
  });
});
