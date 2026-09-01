// Tests for sales calculation business logic extracted from salesController

const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// ─── round2 ──────────────────────────────────────────────────────

describe('round2 (2-decimal rounding)', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(2.555)).toBe(2.56);
  });

  it('handles whole numbers', () => {
    expect(round2(10)).toBe(10);
    expect(round2(0)).toBe(0);
  });

  it('handles very small floating point numbers', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('handles negative numbers', () => {
    expect(round2(-1.005)).toBe(-1);
  });
});

// ─── Sale total calculation ───────────────────────────────────────

describe('sale total calculation (server-side recalculation logic)', () => {
  const calcTotal = ({ subTotal, taxPercent = 0, additionalPercent = 0, discount = 0, bundleDiscount = 0 }) => {
    const taxAmt        = round2(subTotal * taxPercent / 100);
    const additionalAmt = round2(subTotal * additionalPercent / 100);
    return round2(Math.max(0, subTotal + taxAmt + additionalAmt - discount - bundleDiscount));
  };

  it('calculates total with no tax or discount', () => {
    expect(calcTotal({ subTotal: 1000 })).toBe(1000);
  });

  it('applies tax correctly', () => {
    expect(calcTotal({ subTotal: 1000, taxPercent: 17 })).toBe(1170);
  });

  it('applies discount', () => {
    expect(calcTotal({ subTotal: 1000, discount: 100 })).toBe(900);
  });

  it('applies bundle discount', () => {
    expect(calcTotal({ subTotal: 1000, bundleDiscount: 50 })).toBe(950);
  });

  it('applies tax and discount together', () => {
    expect(calcTotal({ subTotal: 1000, taxPercent: 10, discount: 50 })).toBe(1050);
  });

  it('floors at 0 when discount exceeds total', () => {
    expect(calcTotal({ subTotal: 100, discount: 500 })).toBe(0);
  });

  it('applies additional charges', () => {
    expect(calcTotal({ subTotal: 1000, additionalPercent: 5 })).toBe(1050);
  });

  it('all together: tax + additional + discount + bundle', () => {
    const result = calcTotal({ subTotal: 1000, taxPercent: 10, additionalPercent: 5, discount: 100, bundleDiscount: 50 });
    // 1000 + 100 (tax) + 50 (additional) - 100 - 50 = 1000
    expect(result).toBe(1000);
  });
});

// ─── Tax validation bounds ────────────────────────────────────────

describe('tax_percent validation', () => {
  const validateTaxPct = (tax_percent) => {
    const val = parseFloat(tax_percent) || 0;
    if (val < 0 || val > 100) return { valid: false, message: 'Tax percent must be between 0 and 100' };
    return { valid: true, value: val };
  };

  it('accepts 0', ()  => expect(validateTaxPct(0).valid).toBe(true));
  it('accepts 17',()  => expect(validateTaxPct(17).valid).toBe(true));
  it('accepts 100',() => expect(validateTaxPct(100).valid).toBe(true));
  it('rejects -1',()  => expect(validateTaxPct(-1).valid).toBe(false));
  it('rejects 101',() => expect(validateTaxPct(101).valid).toBe(false));
  it('treats non-numeric string as 0', () => expect(validateTaxPct('abc').value).toBe(0));
});

// ─── Subtotal from items ──────────────────────────────────────────

describe('subtotal from cart items', () => {
  const calcSubtotal = (items) =>
    round2(items.reduce((sum, item) => sum + round2(item.unit_price * item.quantity), 0));

  it('returns 0 for empty items', () => {
    expect(calcSubtotal([])).toBe(0);
  });

  it('calculates subtotal for single item', () => {
    expect(calcSubtotal([{ unit_price: 100, quantity: 3 }])).toBe(300);
  });

  it('calculates subtotal for multiple items', () => {
    const items = [
      { unit_price: 100, quantity: 2 },
      { unit_price: 50,  quantity: 4 },
    ];
    expect(calcSubtotal(items)).toBe(400);
  });

  it('handles decimal prices', () => {
    expect(calcSubtotal([{ unit_price: 10.5, quantity: 2 }])).toBe(21);
  });
});

// ─── Change calculation ───────────────────────────────────────────

describe('change due calculation', () => {
  const calcChange = (amountPaid, total) => round2(Math.max(0, amountPaid - total));

  it('returns change when overpaid', () => {
    expect(calcChange(500, 350)).toBe(150);
  });

  it('returns 0 when exact amount paid', () => {
    expect(calcChange(350, 350)).toBe(0);
  });

  it('returns 0 when underpaid (credit scenario)', () => {
    expect(calcChange(100, 350)).toBe(0);
  });
});
