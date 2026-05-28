/**
 * FLOWTYM — Source Weighting Service tests.
 *
 * Covers the core pricing-logic functions (resolve, apply, seasonFromDate)
 * which determine how much Lighthouse / Expedia competitor prices are
 * adjusted upward before being fed into the RMS recommendation engine.
 *
 * The module-level config mutation (upsertRule, setGlobalEnabled, etc.) is
 * tested via the exported `sourceWeighting` object. Each test calls
 * `sourceWeighting.resetDefaults()` in beforeEach to start from a known state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase and settingsPersistence before module import ────────────────

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/src/services/settings/settingsPersistence', () => ({
  syncConfigBlobToSupabase: vi.fn().mockResolvedValue(undefined),
  fetchConfigBlobFromSupabase: vi.fn().mockResolvedValue(null),
}));

// Fake localStorage
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => Object.keys(store).forEach(k => delete store[k]),
});

// ── Import after mocks ────────────────────────────────────────────────────────

import { sourceWeighting, seasonFromDate } from '@/src/services/revenue/sourceWeighting.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  sourceWeighting.resetDefaults();
  Object.keys(store).forEach(k => delete store[k]);
});

// ── seasonFromDate ────────────────────────────────────────────────────────────

describe('seasonFromDate', () => {
  it('returns very_high for June (Vivatech season)', () => {
    expect(seasonFromDate('2026-06-15')).toBe('very_high');
  });

  it('returns very_high for September', () => {
    expect(seasonFromDate('2026-09-01')).toBe('very_high');
  });

  it('returns high for May', () => {
    expect(seasonFromDate('2026-05-20')).toBe('high');
  });

  it('returns low for January', () => {
    expect(seasonFromDate('2026-01-10')).toBe('low');
  });

  it('returns low for February', () => {
    expect(seasonFromDate('2026-02-28')).toBe('low');
  });
});

// ── sourceWeighting.resolve ───────────────────────────────────────────────────

describe('sourceWeighting.resolve — default config', () => {
  it('returns 5% for lighthouse source', () => {
    const result = sourceWeighting.resolve({ source: 'lighthouse' });
    expect(result.percent).toBe(5);
    expect(result.applied).toBe(true);
    expect(result.ruleId).toBe('default_lighthouse');
  });

  it('returns 5% for expedia source', () => {
    const result = sourceWeighting.resolve({ source: 'expedia' });
    expect(result.percent).toBe(5);
    expect(result.applied).toBe(true);
  });

  it('returns 0% for direct source (disabled by default)', () => {
    const result = sourceWeighting.resolve({ source: 'direct' });
    expect(result.percent).toBe(0);
    expect(result.applied).toBe(false);
  });

  it('returns 0% when globalEnabled is false', () => {
    sourceWeighting.setGlobalEnabled(false);
    const result = sourceWeighting.resolve({ source: 'lighthouse' });
    expect(result.percent).toBe(0);
    expect(result.applied).toBe(false);
  });

  it('returns 0% when lighthouse source is disabled', () => {
    sourceWeighting.setSourceEnabled('lighthouse', false);
    const result = sourceWeighting.resolve({ source: 'lighthouse' });
    expect(result.percent).toBe(0);
    expect(result.applied).toBe(false);
  });
});

describe('sourceWeighting.resolve — specificity', () => {
  it('prefers a more specific rule over the general default', () => {
    sourceWeighting.upsertRule({
      id: 'lh_highseason',
      percent: 8,
      source: 'lighthouse',
      channel: null,
      roomTypeCode: null,
      season: 'very_high',
      strategy: null,
      enabled: true,
    });

    // Should pick the specific rule for very_high season
    const specific = sourceWeighting.resolve({ source: 'lighthouse', season: 'very_high' });
    expect(specific.percent).toBe(8);
    expect(specific.ruleId).toBe('lh_highseason');

    // Should still use the default rule for other seasons
    const general = sourceWeighting.resolve({ source: 'lighthouse', season: 'low' });
    expect(general.percent).toBe(5);
    expect(general.ruleId).toBe('default_lighthouse');
  });

  it('returns 0% when no rule matches the scope', () => {
    // Disable the default rules to isolate
    sourceWeighting.upsertRule({
      id: 'default_lighthouse',
      percent: 5,
      source: 'lighthouse',
      channel: 'booking',  // only for booking channel
      roomTypeCode: null,
      season: null,
      strategy: null,
      enabled: true,
    });

    // Resolve without a channel — no rule matches
    const result = sourceWeighting.resolve({ source: 'lighthouse', channel: 'direct' });
    // The 'booking'-scoped rule does not match 'direct' channel
    expect(result.percent).toBe(0);
    expect(result.applied).toBe(false);
  });

  it('ignores disabled rules', () => {
    sourceWeighting.upsertRule({
      id: 'default_lighthouse',
      percent: 5,
      source: 'lighthouse',
      channel: null,
      roomTypeCode: null,
      season: null,
      strategy: null,
      enabled: false,  // disabled
    });

    const result = sourceWeighting.resolve({ source: 'lighthouse' });
    expect(result.percent).toBe(0);
    expect(result.applied).toBe(false);
  });
});

// ── sourceWeighting.apply ─────────────────────────────────────────────────────

describe('sourceWeighting.apply', () => {
  it('inflates a lighthouse price by +5%', () => {
    const result = sourceWeighting.apply(100, { source: 'lighthouse' });
    expect(result.weightedPrice).toBe(105);
    expect(result.percent).toBe(5);
    expect(result.delta).toBe(5);
    expect(result.applied).toBe(true);
  });

  it('applies correct rounding for non-integer results', () => {
    const result = sourceWeighting.apply(101, { source: 'lighthouse' });
    // 101 * 1.05 = 106.05 → rounds to 106
    expect(result.weightedPrice).toBe(106);
  });

  it('returns raw price unchanged for direct source', () => {
    const result = sourceWeighting.apply(200, { source: 'direct' });
    expect(result.weightedPrice).toBe(200);
    expect(result.percent).toBe(0);
    expect(result.delta).toBe(0);
    expect(result.applied).toBe(false);
  });

  it('returns raw price unchanged for zero/negative input', () => {
    const zero = sourceWeighting.apply(0, { source: 'lighthouse' });
    expect(zero.weightedPrice).toBe(0);
    expect(zero.applied).toBe(false);

    const neg = sourceWeighting.apply(-50, { source: 'lighthouse' });
    expect(neg.weightedPrice).toBe(-50);
    expect(neg.applied).toBe(false);
  });

  it('returns raw price unchanged when global weighting disabled', () => {
    sourceWeighting.setGlobalEnabled(false);
    const result = sourceWeighting.apply(200, { source: 'lighthouse' });
    expect(result.weightedPrice).toBe(200);
    expect(result.applied).toBe(false);
  });
});

// ── sourceWeighting.removeRule ────────────────────────────────────────────────

describe('sourceWeighting.removeRule', () => {
  it('removing the only matching rule causes resolve to return 0%', () => {
    sourceWeighting.removeRule('default_lighthouse');
    const result = sourceWeighting.resolve({ source: 'lighthouse' });
    expect(result.percent).toBe(0);
    expect(result.applied).toBe(false);
  });
});
