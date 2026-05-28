/**
 * FLOWTYM — Event Impact Engine tests.
 *
 * Covers pure functions from event-impact.engine.ts:
 *   - scoreToLevel: impact level derivation
 *   - aggregateImpact: weighted score aggregation
 *   - findDuplicates: duplicate event detection across sources
 *   - dedupEvents: dedup pipeline
 *   - daysBetween: date utility
 */
import { describe, it, expect } from 'vitest';
import {
  scoreToLevel,
  aggregateImpact,
  findDuplicates,
  dedupEvents,
  daysBetween,
} from '@/src/services/event-impact.engine';
import type { ImpactScore, RMSMarketEvent } from '@/src/types/events';

// ── Helpers ───────────────────────────────────────────────────────────────────

function impact(overrides: Partial<ImpactScore> = {}): ImpactScore {
  return {
    demand: 50, adr: 40, occupancy: 50, pickup: 45,
    revpar: 45, compression: 50, confidence: 80,
    level: 'medium',
    ...overrides,
  };
}

let _idSeq = 0;
function event(
  name: string,
  startDate: string,
  endDate: string,
  city = 'Paris',
  overrides: Partial<RMSMarketEvent> = {}
): RMSMarketEvent {
  return {
    id: `ev_${++_idSeq}`,
    name,
    city,
    startDate,
    endDate,
    sources: ['lighthouse'],
    impact: impact(),
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── scoreToLevel ──────────────────────────────────────────────────────────────

describe('scoreToLevel', () => {
  it('returns very_low for score < 15', () => {
    expect(scoreToLevel(0)).toBe('very_low');
    expect(scoreToLevel(14)).toBe('very_low');
  });

  it('returns low for score in [15, 35)', () => {
    expect(scoreToLevel(15)).toBe('low');
    expect(scoreToLevel(34)).toBe('low');
  });

  it('returns medium for score in [35, 60)', () => {
    expect(scoreToLevel(35)).toBe('medium');
    expect(scoreToLevel(59)).toBe('medium');
  });

  it('returns high for score in [60, 80)', () => {
    expect(scoreToLevel(60)).toBe('high');
    expect(scoreToLevel(79)).toBe('high');
  });

  it('returns critical for score in [80, 95)', () => {
    expect(scoreToLevel(80)).toBe('critical');
    expect(scoreToLevel(94)).toBe('critical');
  });

  it('returns hyper_compression for score >= 95', () => {
    expect(scoreToLevel(95)).toBe('hyper_compression');
    expect(scoreToLevel(100)).toBe('hyper_compression');
  });
});

// ── aggregateImpact ───────────────────────────────────────────────────────────

describe('aggregateImpact', () => {
  it('returns 0 for all-zero impact', () => {
    const zero = impact({ demand: 0, adr: 0, occupancy: 0, pickup: 0, revpar: 0, compression: 0 });
    expect(aggregateImpact(zero)).toBe(0);
  });

  it('returns 100 for all-100 impact', () => {
    const full = impact({ demand: 100, adr: 100, occupancy: 100, pickup: 100, revpar: 100, compression: 100 });
    expect(aggregateImpact(full)).toBe(100);
  });

  it('compression weight dominates — high compression drives high score', () => {
    const highCompression = impact({ demand: 10, adr: 10, occupancy: 10, pickup: 10, revpar: 10, compression: 100 });
    const highDemand = impact({ demand: 100, adr: 10, occupancy: 10, pickup: 10, revpar: 10, compression: 10 });
    expect(aggregateImpact(highCompression)).toBeGreaterThan(aggregateImpact(highDemand));
  });

  it('is bounded to [0, 100]', () => {
    const score = aggregateImpact(impact());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ── findDuplicates ────────────────────────────────────────────────────────────

describe('findDuplicates', () => {
  it('returns empty array for single event', () => {
    const groups = findDuplicates([event('Vivatech', '2026-06-11', '2026-06-14')]);
    expect(groups).toHaveLength(0);
  });

  it('detects exact same event name from two sources as duplicate', () => {
    const ev1 = event('Vivatech', '2026-06-11', '2026-06-14', 'Paris', { sources: ['lighthouse'] });
    const ev2 = event('Vivatech', '2026-06-11', '2026-06-14', 'Paris', { sources: ['expedia'] });
    const groups = findDuplicates([ev1, ev2]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('does not detect events with different names as duplicates', () => {
    const ev1 = event('Vivatech', '2026-06-11', '2026-06-14');
    const ev2 = event('Paris Air Show', '2026-06-11', '2026-06-14');
    const groups = findDuplicates([ev1, ev2]);
    expect(groups).toHaveLength(0);
  });

  it('does not detect non-overlapping events as duplicates even if same name', () => {
    const ev1 = event('Vivatech', '2026-06-11', '2026-06-14');
    const ev2 = event('Vivatech', '2026-09-01', '2026-09-04'); // different dates
    const groups = findDuplicates([ev1, ev2]);
    expect(groups).toHaveLength(0);
  });

  it('groups 3 duplicates together', () => {
    const ev1 = event('Roland Garros', '2026-05-24', '2026-06-07');
    const ev2 = event('Roland Garros', '2026-05-24', '2026-06-07');
    const ev3 = event('Roland Garros', '2026-05-24', '2026-06-07');
    const groups = findDuplicates([ev1, ev2, ev3]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('returns empty for empty array', () => {
    expect(findDuplicates([])).toHaveLength(0);
  });
});

// ── dedupEvents ───────────────────────────────────────────────────────────────

describe('dedupEvents', () => {
  it('returns unchanged list when no duplicates', () => {
    const ev1 = event('Vivatech', '2026-06-11', '2026-06-14');
    const ev2 = event('Paris Air Show', '2026-06-15', '2026-06-20');
    const { deduped, merged } = dedupEvents([ev1, ev2]);
    expect(deduped).toHaveLength(2);
    expect(merged).toBe(0);
  });

  it('reduces 2 duplicate events to 1 merged event', () => {
    const ev1 = event('Vivatech', '2026-06-11', '2026-06-14', 'Paris', { sources: ['lighthouse'] });
    const ev2 = event('Vivatech', '2026-06-11', '2026-06-14', 'Paris', { sources: ['expedia'] });
    const { deduped, merged } = dedupEvents([ev1, ev2]);
    expect(deduped).toHaveLength(1);
    expect(merged).toBe(1);
  });

  it('merged event combines sources from both duplicates', () => {
    const ev1 = event('Vivatech', '2026-06-11', '2026-06-14', 'Paris', { sources: ['lighthouse'] });
    const ev2 = event('Vivatech', '2026-06-11', '2026-06-14', 'Paris', { sources: ['expedia'] });
    const { deduped } = dedupEvents([ev1, ev2]);
    expect(deduped[0].sources).toContain('lighthouse');
    expect(deduped[0].sources).toContain('expedia');
  });

  it('handles empty input', () => {
    const { deduped, merged } = dedupEvents([]);
    expect(deduped).toHaveLength(0);
    expect(merged).toBe(0);
  });
});

// ── daysBetween ───────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns 1 for same start and end date', () => {
    expect(daysBetween('2026-06-15', '2026-06-15')).toBe(1);
  });

  it('returns 3 for a 3-day event (inclusive)', () => {
    expect(daysBetween('2026-06-11', '2026-06-13')).toBe(3);
  });

  it('returns correct count for month boundary', () => {
    expect(daysBetween('2026-05-30', '2026-06-02')).toBe(4);
  });

  it('always returns at least 1', () => {
    // In case start > end somehow
    expect(daysBetween('2026-06-15', '2026-06-10')).toBeGreaterThanOrEqual(1);
  });
});
