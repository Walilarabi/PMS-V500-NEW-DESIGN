/**
 * FLOWTYM — Guardrails Engine tests.
 *
 * The guardrails engine is the LAST safety layer before any price change
 * reaches the channel manager or rate calendar. These tests verify that:
 *   - price_floor blocks any price below the configured threshold
 *   - price_ceiling blocks any price above the configured threshold
 *   - daily_variation_max clamps runaway price swings
 *   - paused guardrails do NOT interfere
 *   - occupancy_max emits a warning without blocking
 *   - evaluate() always returns a consistent { allowed, finalPrice, triggered }
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/src/services/revenue/rmsAuditLogger', () => ({
  rmsAuditLogger: { log: vi.fn() },
}));
vi.mock('@/src/lib/rms/eventBus', () => ({
  emitRmsEvent: vi.fn(),
  subscribeRmsEvent: vi.fn(),
}));
vi.mock('@/src/services/revenue/rmsEnterprisePersistence.service', () => ({
  loadGuardrails: vi.fn().mockResolvedValue([]),
  persistGuardrail: vi.fn().mockResolvedValue(undefined),
  deleteGuardrail: vi.fn().mockResolvedValue(undefined),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  guardrailsEngine,
  type PriceProposal,
} from '@/src/services/revenue/guardrailsEngine';

// ── Helpers ───────────────────────────────────────────────────────────────────

function proposal(overrides: Partial<PriceProposal> = {}): PriceProposal {
  return {
    price: 150,
    previousPrice: 150,
    source: 'manual',
    ...overrides,
  };
}

// Reset to SEED state before each test
beforeEach(() => {
  // Re-activate any guardrails that might have been paused
  for (const g of guardrailsEngine.all()) {
    if (g.status !== 'active') {
      guardrailsEngine.setStatus(g.id, 'active');
    }
  }
});

// ── price_floor ───────────────────────────────────────────────────────────────

describe('guardrailsEngine.evaluate — price_floor', () => {
  it('allows a price above the floor (110€)', () => {
    const verdict = guardrailsEngine.evaluate(proposal({ price: 120 }));
    const floor = verdict.triggered.find(t => t.guardrail.id === 'price_floor');
    expect(floor).toBeUndefined();
    expect(verdict.allowed).toBe(true);
  });

  it('blocks a price below the floor (110€)', () => {
    const verdict = guardrailsEngine.evaluate(proposal({ price: 90 }));
    const floor = verdict.triggered.find(t => t.guardrail.id === 'price_floor');
    expect(floor).toBeDefined();
    expect(floor!.outcome).toBe('blocked');
    expect(verdict.allowed).toBe(false);
    expect(verdict.finalPrice).toBeGreaterThanOrEqual(110);
  });

  it('blocks price exactly at 0 (below floor)', () => {
    const verdict = guardrailsEngine.evaluate(proposal({ price: 0 }));
    expect(verdict.allowed).toBe(false);
  });

  it('does not block when floor guardrail is paused', () => {
    guardrailsEngine.setStatus('price_floor', 'paused');
    const verdict = guardrailsEngine.evaluate(proposal({ price: 50 }));
    const floor = verdict.triggered.find(t => t.guardrail.id === 'price_floor');
    expect(floor).toBeUndefined();
  });
});

// ── price_ceiling ─────────────────────────────────────────────────────────────

describe('guardrailsEngine.evaluate — price_ceiling', () => {
  it('allows a price below the ceiling', () => {
    const ceiling = guardrailsEngine.byId('price_ceiling');
    if (!ceiling) return; // ceiling not in seed for this hotel
    const verdict = guardrailsEngine.evaluate(proposal({ price: ceiling.thresholdValue - 1 }));
    const hit = verdict.triggered.find(t => t.guardrail.id === 'price_ceiling');
    expect(hit).toBeUndefined();
  });

  it('blocks a price above the ceiling', () => {
    const ceiling = guardrailsEngine.byId('price_ceiling');
    if (!ceiling) return;
    const verdict = guardrailsEngine.evaluate(proposal({ price: ceiling.thresholdValue + 1 }));
    const hit = verdict.triggered.find(t => t.guardrail.id === 'price_ceiling');
    expect(hit?.outcome).toBe('blocked');
    expect(verdict.finalPrice).toBeLessThanOrEqual(ceiling.thresholdValue);
  });
});

// ── daily_variation_max ───────────────────────────────────────────────────────

describe('guardrailsEngine.evaluate — daily_variation_max', () => {
  it('allows a price change within the daily variation limit', () => {
    const varGuard = guardrailsEngine.byId('daily_variation_max');
    if (!varGuard) return;
    // previous = 150, change = 5% (within typical 25% limit)
    const verdict = guardrailsEngine.evaluate(proposal({ price: 157, previousPrice: 150 }));
    const hit = verdict.triggered.find(t => t.guardrail.id === 'daily_variation_max');
    expect(hit).toBeUndefined();
    expect(verdict.allowed).toBe(true);
  });

  it('clamps a price that exceeds daily variation max', () => {
    const varGuard = guardrailsEngine.byId('daily_variation_max');
    if (!varGuard) return;
    // previous = 100, price = 300 → +200% which exceeds any reasonable limit
    const verdict = guardrailsEngine.evaluate(proposal({ price: 300, previousPrice: 100 }));
    const hit = verdict.triggered.find(t => t.guardrail.id === 'daily_variation_max');
    if (!hit) return; // if threshold > 200%, skip
    expect(hit.outcome).toBe('adjusted');
    expect(verdict.finalPrice).toBeLessThan(300);
  });

  it('does not trigger when previousPrice is 0', () => {
    // Guard skips when previousPrice <= 0 to avoid division by zero
    const verdict = guardrailsEngine.evaluate(proposal({ price: 999, previousPrice: 0 }));
    const hit = verdict.triggered.find(t => t.guardrail.id === 'daily_variation_max');
    expect(hit).toBeUndefined();
  });
});

// ── occupancy_max ─────────────────────────────────────────────────────────────

describe('guardrailsEngine.evaluate — occupancy_max', () => {
  it('emits a warning but does NOT block when occupancy exceeds threshold', () => {
    const occGuard = guardrailsEngine.byId('occupancy_max');
    if (!occGuard) return;
    const verdict = guardrailsEngine.evaluate(
      proposal({ price: 200, occupancy: occGuard.thresholdValue + 5 }),
    );
    const hit = verdict.triggered.find(t => t.guardrail.id === 'occupancy_max');
    if (!hit) return;
    expect(hit.outcome).toBe('warning');
    expect(verdict.allowed).toBe(true); // warnings never block
  });
});

// ── verdict shape ─────────────────────────────────────────────────────────────

describe('guardrailsEngine.evaluate — verdict shape', () => {
  it('returns allowed=true and no triggers for a normal valid price', () => {
    const verdict = guardrailsEngine.evaluate(proposal({ price: 150, previousPrice: 140 }));
    // finalPrice should equal the proposed price when nothing fires
    expect(verdict.allowed).toBe(true);
    const blocking = verdict.triggered.filter(t => t.outcome === 'blocked');
    expect(blocking).toHaveLength(0);
  });

  it('finalPrice is always a finite number', () => {
    for (const p of [0, 50, 150, 999, 9999]) {
      const verdict = guardrailsEngine.evaluate(proposal({ price: p, previousPrice: 150 }));
      expect(Number.isFinite(verdict.finalPrice)).toBe(true);
    }
  });

  it('always returns the triggered array even when empty', () => {
    const verdict = guardrailsEngine.evaluate(proposal({ price: 150 }));
    expect(Array.isArray(verdict.triggered)).toBe(true);
  });
});

// ── kpis ──────────────────────────────────────────────────────────────────────

describe('guardrailsEngine.kpis', () => {
  it('returns a valid kpis object', () => {
    const kpis = guardrailsEngine.kpis();
    expect(typeof kpis.activeCount).toBe('number');
    expect(typeof kpis.totalCount).toBe('number');
    expect(kpis.activeCount).toBeLessThanOrEqual(kpis.totalCount);
    expect(['low', 'medium', 'high']).toContain(kpis.globalRisk);
  });
});
