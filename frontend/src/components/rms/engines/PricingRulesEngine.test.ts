/**
 * FLOWTYM RMS — PricingRulesEngine tests.
 *
 * Covers the rate plan / room type differential pricing engine:
 *   - Reference room/plan returns the base price unchanged
 *   - Fixed-amount differentials (positive + negative)
 *   - Percentage differentials (positive + negative)
 *   - Stacked room + plan rules
 *   - getRuleDescription output
 */
import { describe, it, expect } from 'vitest';
import { PricingRulesEngine } from './PricingRulesEngine';
import type { PricingRules } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRules(overrides?: Partial<PricingRules>): PricingRules {
  return {
    referenceRoomTypeId: 'std',
    referencePlanId: 'bar',
    roomRules: [
      { roomTypeId: 'dbl',    diffType: 'fixed',   diffValue: 30  },
      { roomTypeId: 'suite',  diffType: 'percent',  diffValue: 50  },
      { roomTypeId: 'budget', diffType: 'fixed',    diffValue: -20 },
    ],
    planRules: [
      { planId: 'bb',    diffType: 'percent', diffValue: 10  },
      { planId: 'hb',    diffType: 'percent', diffValue: 25  },
      { planId: 'nonref', diffType: 'fixed',  diffValue: -15 },
    ],
    ...overrides,
  };
}

// ── Reference room + plan ─────────────────────────────────────────────────────

describe('PricingRulesEngine — reference room/plan', () => {
  it('returns the base price when room and plan are both references', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.calculatePrice(200, 'std', 'bar')).toBe(200);
  });

  it('isReferenceRoom returns true for reference room', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.isReferenceRoom('std')).toBe(true);
    expect(engine.isReferenceRoom('dbl')).toBe(false);
  });

  it('isReferencePlan returns true for reference plan', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.isReferencePlan('bar')).toBe(true);
    expect(engine.isReferencePlan('bb')).toBe(false);
  });
});

// ── Fixed differential — room ─────────────────────────────────────────────────

describe('PricingRulesEngine — fixed room differential', () => {
  it('adds fixed amount for upgraded room type', () => {
    const engine = new PricingRulesEngine(makeRules());
    // dbl = +30€ from reference, reference plan (bar)
    expect(engine.calculatePrice(200, 'dbl', 'bar')).toBe(230);
  });

  it('subtracts fixed amount for budget room type', () => {
    const engine = new PricingRulesEngine(makeRules());
    // budget = -20€ from reference
    expect(engine.calculatePrice(200, 'budget', 'bar')).toBe(180);
  });

  it('calculateRoomOnlyPrice applies room rule without plan', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.calculateRoomOnlyPrice(200, 'dbl')).toBe(230);
  });

  it('calculateRoomOnlyPrice returns base for reference room', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.calculateRoomOnlyPrice(200, 'std')).toBe(200);
  });
});

// ── Percentage differential — room ───────────────────────────────────────────

describe('PricingRulesEngine — percentage room differential', () => {
  it('applies +50% for suite room type', () => {
    const engine = new PricingRulesEngine(makeRules());
    // suite = +50% → 200 * 1.5 = 300
    expect(engine.calculatePrice(200, 'suite', 'bar')).toBe(300);
  });

  it('rounds to nearest integer', () => {
    const engine = new PricingRulesEngine(makeRules());
    // 101 * 1.5 = 151.5 → rounds to 152
    expect(engine.calculatePrice(101, 'suite', 'bar')).toBe(152);
  });
});

// ── Percentage differential — plan ───────────────────────────────────────────

describe('PricingRulesEngine — plan differential', () => {
  it('applies +10% for bb (breakfast included) plan', () => {
    const engine = new PricingRulesEngine(makeRules());
    // reference room + bb plan → 200 * 1.10 = 220
    expect(engine.calculatePrice(200, 'std', 'bb')).toBe(220);
  });

  it('applies +25% for hb (half-board) plan', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.calculatePrice(200, 'std', 'hb')).toBe(250);
  });

  it('subtracts fixed amount for non-refundable plan', () => {
    const engine = new PricingRulesEngine(makeRules());
    // nonref = -15€ → 200 - 15 = 185
    expect(engine.calculatePrice(200, 'std', 'nonref')).toBe(185);
  });
});

// ── Stacked room + plan ───────────────────────────────────────────────────────

describe('PricingRulesEngine — stacked room + plan differentials', () => {
  it('applies room rule first, then plan rule on the result', () => {
    const engine = new PricingRulesEngine(makeRules());
    // dbl (+30€) → 200 + 30 = 230; then bb (+10%) → 230 * 1.10 = 253
    expect(engine.calculatePrice(200, 'dbl', 'bb')).toBe(253);
  });

  it('suite (50%) + hb (25%) on 200€', () => {
    const engine = new PricingRulesEngine(makeRules());
    // suite: 200 * 1.50 = 300; hb: 300 * 1.25 = 375
    expect(engine.calculatePrice(200, 'suite', 'hb')).toBe(375);
  });

  it('budget (-20€) + nonref (-15€) on 200€', () => {
    const engine = new PricingRulesEngine(makeRules());
    // budget: 200 - 20 = 180; nonref: 180 - 15 = 165
    expect(engine.calculatePrice(200, 'budget', 'nonref')).toBe(165);
  });
});

// ── Unknown room/plan ─────────────────────────────────────────────────────────

describe('PricingRulesEngine — unknown room/plan (no rule)', () => {
  it('returns the base price when room type has no rule', () => {
    const engine = new PricingRulesEngine(makeRules());
    // 'penthouse' not in rules → no room adjustment
    expect(engine.calculatePrice(200, 'penthouse', 'bar')).toBe(200);
  });

  it('returns base+room price when plan has no rule', () => {
    const engine = new PricingRulesEngine(makeRules());
    // dbl +30, unknown plan 'flex' → only room rule applies
    expect(engine.calculatePrice(200, 'dbl', 'flex')).toBe(230);
  });
});

// ── getRuleDescription ────────────────────────────────────────────────────────

describe('PricingRulesEngine — getRuleDescription', () => {
  it('returns "Référence" for reference room and plan', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.getRuleDescription('std', 'bar')).toBe('Référence');
  });

  it('shows fixed room differential with sign', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.getRuleDescription('dbl', 'bar')).toBe('+30€');
  });

  it('shows negative fixed room differential', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.getRuleDescription('budget', 'bar')).toBe('-20€');
  });

  it('shows plan percentage differential', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.getRuleDescription('std', 'bb')).toBe('+10%');
  });

  it('shows both room and plan differentials separated by |', () => {
    const engine = new PricingRulesEngine(makeRules());
    expect(engine.getRuleDescription('dbl', 'bb')).toBe('+30€ | +10%');
  });
});
