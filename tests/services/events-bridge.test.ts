/**
 * FLOWTYM RMS — Events Bridge Service tests.
 *
 * Covers pure functions from events-bridge.service.ts:
 *   - eventsActiveOn: date-range filter + status exclusion
 *   - aggregateEventsForDate: aggregation of active events into AggregatedDayEvents
 *   - eventCellTone: Tailwind CSS class lookup by impact level
 *   - impactLevelLabel: human-readable French label by impact level
 */
import { describe, it, expect } from 'vitest';
import {
  eventsActiveOn,
  aggregateEventsForDate,
  eventCellTone,
  impactLevelLabel,
} from '@/src/services/events-bridge.service';
import type { RMSMarketEvent, EventImpactLevel } from '@/src/types/events';

// ── Test helper ───────────────────────────────────────────────────────────────

function event(overrides: Partial<RMSMarketEvent> = {}): RMSMarketEvent {
  return {
    id: 'ev1',
    name: 'Vivatech',
    city: 'Paris',
    startDate: '2026-06-11',
    endDate: '2026-06-14',
    sources: ['lighthouse'],
    impact: {
      demand: 50,
      adr: 40,
      occupancy: 50,
      pickup: 45,
      revpar: 45,
      compression: 50,
      confidence: 80,
      level: 'medium',
    },
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    influencePrice: 0,
    ...overrides,
  };
}

// aggregateImpact formula replicated for inline expectations:
// compression*0.35 + demand*0.25 + pickup*0.15 + adr*0.10 + occupancy*0.10 + revpar*0.05
// Default impact above → score = 50*0.35 + 50*0.25 + 45*0.15 + 40*0.10 + 50*0.10 + 45*0.05 = 48

// ── eventsActiveOn ─────────────────────────────────────────────────────────────

describe('eventsActiveOn', () => {
  it('returns empty array when no events provided', () => {
    expect(eventsActiveOn([], '2026-06-12')).toEqual([]);
  });

  it('returns event active on a date within its range', () => {
    const ev = event({ startDate: '2026-06-11', endDate: '2026-06-14' });
    const result = eventsActiveOn([ev], '2026-06-12');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ev1');
  });

  it('includes event starting exactly on the date (startDate === date)', () => {
    const ev = event({ startDate: '2026-06-12', endDate: '2026-06-14' });
    const result = eventsActiveOn([ev], '2026-06-12');
    expect(result).toHaveLength(1);
  });

  it('includes event ending exactly on the date (endDate === date)', () => {
    const ev = event({ startDate: '2026-06-10', endDate: '2026-06-12' });
    const result = eventsActiveOn([ev], '2026-06-12');
    expect(result).toHaveLength(1);
  });

  it('excludes event that ends before the date', () => {
    const ev = event({ startDate: '2026-06-10', endDate: '2026-06-11' });
    const result = eventsActiveOn([ev], '2026-06-12');
    expect(result).toHaveLength(0);
  });

  it('excludes event that starts after the date', () => {
    const ev = event({ startDate: '2026-06-13', endDate: '2026-06-15' });
    const result = eventsActiveOn([ev], '2026-06-12');
    expect(result).toHaveLength(0);
  });

  it('excludes archived events even when date is within range', () => {
    const ev = event({ startDate: '2026-06-11', endDate: '2026-06-14', status: 'archived' });
    const result = eventsActiveOn([ev], '2026-06-12');
    expect(result).toHaveLength(0);
  });

  it('excludes cancelled events even when date is within range', () => {
    const ev = event({ startDate: '2026-06-11', endDate: '2026-06-14', status: 'cancelled' });
    const result = eventsActiveOn([ev], '2026-06-12');
    expect(result).toHaveLength(0);
  });

  it('returns only active (non-archived, non-cancelled) events for the date', () => {
    const active1 = event({ id: 'a1', startDate: '2026-06-11', endDate: '2026-06-14', status: 'confirmed' });
    const active2 = event({ id: 'a2', startDate: '2026-06-12', endDate: '2026-06-12', status: 'active' });
    const archived = event({ id: 'ar', startDate: '2026-06-11', endDate: '2026-06-14', status: 'archived' });
    const cancelled = event({ id: 'ca', startDate: '2026-06-11', endDate: '2026-06-14', status: 'cancelled' });
    const result = eventsActiveOn([active1, active2, archived, cancelled], '2026-06-12');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(expect.arrayContaining(['a1', 'a2']));
  });
});

// ── aggregateEventsForDate ─────────────────────────────────────────────────────

describe('aggregateEventsForDate', () => {
  it('returns empty/zero aggregate when no events match the date', () => {
    const result = aggregateEventsForDate([], '2026-06-12');
    expect(result).toEqual({
      date: '2026-06-12',
      events: [],
      count: 0,
      level: 'very_low',
      pressure: 0,
      influencePrice: 0,
      label: '',
    });
  });

  it('returns empty aggregate when all events are outside the date range', () => {
    const ev = event({ startDate: '2026-07-01', endDate: '2026-07-05' });
    const result = aggregateEventsForDate([ev], '2026-06-12');
    expect(result.count).toBe(0);
    expect(result.events).toHaveLength(0);
    expect(result.pressure).toBe(0);
    expect(result.level).toBe('very_low');
    expect(result.label).toBe('');
  });

  it('returns single event data correctly', () => {
    // aggregateImpact(default) = 48 → pressure = 48
    const ev = event({
      id: 'ev1',
      name: 'Vivatech',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
    });
    const result = aggregateEventsForDate([ev], '2026-06-12');
    expect(result.date).toBe('2026-06-12');
    expect(result.count).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.level).toBe('medium');
    expect(result.pressure).toBe(48);
    expect(result.label).toBe('Vivatech');
  });

  it('pressure for single event equals its aggregated score (rounded)', () => {
    // aggregateImpact: compression*0.35 + demand*0.25 + pickup*0.15 + adr*0.10 + occupancy*0.10 + revpar*0.05
    // default values: 50*0.35+50*0.25+45*0.15+40*0.10+50*0.10+45*0.05 = 17.5+12.5+6.75+4+5+2.25 = 48
    const ev = event();
    const result = aggregateEventsForDate([ev], '2026-06-12');
    expect(result.pressure).toBe(48);
  });

  it('level equals the max level across all active events', () => {
    const mediumEv = event({
      id: 'ev-medium',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
      impact: { demand: 50, adr: 40, occupancy: 50, pickup: 45, revpar: 45, compression: 50, confidence: 80, level: 'medium' },
    });
    const highEv = event({
      id: 'ev-high',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
      impact: { demand: 70, adr: 70, occupancy: 70, pickup: 70, revpar: 70, compression: 70, confidence: 80, level: 'high' },
    });
    const result = aggregateEventsForDate([mediumEv, highEv], '2026-06-12');
    expect(result.level).toBe('high');
  });

  it('level is hyper_compression when any event has that level', () => {
    const lowEv = event({
      id: 'ev-low',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
      impact: { demand: 10, adr: 10, occupancy: 10, pickup: 10, revpar: 10, compression: 10, confidence: 80, level: 'low' },
    });
    const hyperEv = event({
      id: 'ev-hyper',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
      impact: { demand: 100, adr: 100, occupancy: 100, pickup: 100, revpar: 100, compression: 100, confidence: 80, level: 'hyper_compression' },
    });
    const result = aggregateEventsForDate([lowEv, hyperEv], '2026-06-12');
    expect(result.level).toBe('hyper_compression');
  });

  it('pressure uses attenuated combination 1 - prod(1 - x/100), bounded 0-100', () => {
    // Two default events: score=48 each
    // combined = 1 - (1 - 48/100) * (1 - 48/100) = 1 - 0.52*0.52 = 1 - 0.2704 = 0.7296 → round = 73
    const ev1 = event({ id: 'ev1', startDate: '2026-06-11', endDate: '2026-06-14' });
    const ev2 = event({ id: 'ev2', startDate: '2026-06-11', endDate: '2026-06-14' });
    const result = aggregateEventsForDate([ev1, ev2], '2026-06-12');
    expect(result.pressure).toBe(73);
  });

  it('pressure with two different scores uses correct attenuation formula', () => {
    // Event 1: default score = 48
    // Event 2: all-70 score = 70
    // combined = 1 - (1 - 48/100) * (1 - 70/100) = 1 - 0.52 * 0.30 = 1 - 0.156 = 0.844 → round = 84
    const ev1 = event({
      id: 'ev1',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
    });
    const ev2 = event({
      id: 'ev2',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
      impact: { demand: 70, adr: 70, occupancy: 70, pickup: 70, revpar: 70, compression: 70, confidence: 80, level: 'high' },
    });
    const result = aggregateEventsForDate([ev1, ev2], '2026-06-12');
    expect(result.pressure).toBe(84);
  });

  it('events in result are sorted by descending aggregated score', () => {
    // ev-low: all-20 → aggregateImpact = 20
    // ev-high: all-70 → aggregateImpact = 70
    // sorted desc: [ev-high, ev-low]
    const evLow = event({
      id: 'ev-low',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
      impact: { demand: 20, adr: 20, occupancy: 20, pickup: 20, revpar: 20, compression: 20, confidence: 80, level: 'low' },
    });
    const evHigh = event({
      id: 'ev-high',
      startDate: '2026-06-11',
      endDate: '2026-06-14',
      impact: { demand: 70, adr: 70, occupancy: 70, pickup: 70, revpar: 70, compression: 70, confidence: 80, level: 'high' },
    });
    const result = aggregateEventsForDate([evLow, evHigh], '2026-06-12');
    expect(result.events[0].id).toBe('ev-high');
    expect(result.events[1].id).toBe('ev-low');
  });

  it('label is the event name for a single event', () => {
    const ev = event({ name: 'Roland Garros', startDate: '2026-06-11', endDate: '2026-06-14' });
    const result = aggregateEventsForDate([ev], '2026-06-12');
    expect(result.label).toBe('Roland Garros');
  });

  it('label is count string for multiple events', () => {
    const ev1 = event({ id: 'ev1', name: 'Vivatech', startDate: '2026-06-11', endDate: '2026-06-14' });
    const ev2 = event({ id: 'ev2', name: 'Roland Garros', startDate: '2026-06-11', endDate: '2026-06-14' });
    const result = aggregateEventsForDate([ev1, ev2], '2026-06-12');
    expect(result.label).toBe('2 événements');
  });

  it('label counts only the events active on that date', () => {
    const ev1 = event({ id: 'ev1', name: 'Vivatech', startDate: '2026-06-11', endDate: '2026-06-14' });
    const ev2 = event({ id: 'ev2', name: 'Roland Garros', startDate: '2026-06-11', endDate: '2026-06-14' });
    const ev3 = event({ id: 'ev3', name: 'Other', startDate: '2026-07-01', endDate: '2026-07-05' });
    const result = aggregateEventsForDate([ev1, ev2, ev3], '2026-06-12');
    expect(result.count).toBe(2);
    expect(result.label).toBe('2 événements');
  });

  it('influencePrice is the max across active events (ignoring archived/cancelled)', () => {
    const ev1 = event({ id: 'ev1', startDate: '2026-06-11', endDate: '2026-06-14', influencePrice: 20 });
    const ev2 = event({ id: 'ev2', startDate: '2026-06-11', endDate: '2026-06-14', influencePrice: 35 });
    const result = aggregateEventsForDate([ev1, ev2], '2026-06-12');
    expect(result.influencePrice).toBe(35);
  });

  it('influencePrice is 0 when all events have influencePrice 0', () => {
    const ev = event({ influencePrice: 0, startDate: '2026-06-11', endDate: '2026-06-14' });
    const result = aggregateEventsForDate([ev], '2026-06-12');
    expect(result.influencePrice).toBe(0);
  });

  it('influencePrice falls back to 0 when no active events (Math.max(0, ...empty))', () => {
    const result = aggregateEventsForDate([], '2026-06-12');
    expect(result.influencePrice).toBe(0);
  });
});

// ── eventCellTone ─────────────────────────────────────────────────────────────

describe('eventCellTone', () => {
  it('returns different tone objects for each of the 6 levels', () => {
    const levels: EventImpactLevel[] = ['very_low', 'low', 'medium', 'high', 'critical', 'hyper_compression'];
    const tones = levels.map((l) => eventCellTone(l));
    // All must be distinct — check bg classes differ
    const bgs = tones.map((t) => t.bg);
    const uniqueBgs = new Set(bgs);
    expect(uniqueBgs.size).toBe(6);
  });

  it('hyper_compression returns fuchsia classes', () => {
    const tone = eventCellTone('hyper_compression');
    expect(tone.bg).toContain('fuchsia');
    expect(tone.text).toContain('fuchsia');
    expect(tone.ring).toContain('fuchsia');
    expect(tone.dot).toContain('fuchsia');
  });

  it('critical returns rose classes', () => {
    const tone = eventCellTone('critical');
    expect(tone.bg).toContain('rose');
    expect(tone.text).toContain('rose');
    expect(tone.ring).toContain('rose');
    expect(tone.dot).toContain('rose');
  });

  it('high returns orange classes', () => {
    const tone = eventCellTone('high');
    expect(tone.bg).toContain('orange');
    expect(tone.text).toContain('orange');
    expect(tone.ring).toContain('orange');
    expect(tone.dot).toContain('orange');
  });

  it('medium returns amber classes', () => {
    const tone = eventCellTone('medium');
    expect(tone.bg).toContain('amber');
    expect(tone.text).toContain('amber');
    expect(tone.ring).toContain('amber');
    expect(tone.dot).toContain('amber');
  });

  it('low returns emerald classes', () => {
    const tone = eventCellTone('low');
    expect(tone.bg).toContain('emerald');
    expect(tone.text).toContain('emerald');
    expect(tone.ring).toContain('emerald');
    expect(tone.dot).toContain('emerald');
  });

  it('very_low returns slate (default) classes', () => {
    const tone = eventCellTone('very_low');
    expect(tone.bg).toContain('slate');
    expect(tone.text).toContain('slate');
    expect(tone.ring).toContain('slate');
    expect(tone.dot).toContain('slate');
  });

  it('returns an object with bg, text, ring, and dot keys', () => {
    const tone = eventCellTone('medium');
    expect(tone).toHaveProperty('bg');
    expect(tone).toHaveProperty('text');
    expect(tone).toHaveProperty('ring');
    expect(tone).toHaveProperty('dot');
  });
});

// ── impactLevelLabel ───────────────────────────────────────────────────────────

describe('impactLevelLabel', () => {
  it('returns French label for very_low', () => {
    expect(impactLevelLabel('very_low')).toBe('Impact Très faible');
  });

  it('returns French label for low', () => {
    expect(impactLevelLabel('low')).toBe('Impact Faible');
  });

  it('returns French label for medium', () => {
    expect(impactLevelLabel('medium')).toBe('Impact Moyen');
  });

  it('returns French label for high', () => {
    expect(impactLevelLabel('high')).toBe('Impact Fort');
  });

  it('returns French label for critical', () => {
    expect(impactLevelLabel('critical')).toBe('Impact Critique');
  });

  it('returns French label for hyper_compression', () => {
    expect(impactLevelLabel('hyper_compression')).toBe('Hyper Compression');
  });
});
