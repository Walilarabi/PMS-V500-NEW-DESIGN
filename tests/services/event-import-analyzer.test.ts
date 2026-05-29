/**
 * FLOWTYM — Unit tests for analyzeImport (event-import-analyzer.service.ts)
 *
 * Covers:
 *   1. invalid   — missing name AND missing startDate/endDate → skip / not selected
 *   2. update    — exact ID match → confidence 99
 *   3. update+past — matched existing event ended before today → skip / not selected
 *   4. duplicate — same/very-similar name + overlapping dates
 *   5. conflict  — overlaps with HIGH_IMPACT existing event
 *   6. incomplete — valid name/dates but missing city or venue
 *   7. valid     — completely valid new event
 *   8. stats     — report.stats counts each category correctly
 *   9. empty     — empty events list → 0 items, all-zero stats
 */

import { describe, it, expect } from 'vitest';
import { analyzeImport } from '@/src/services/event-import-analyzer.service';
import type { ImportStatus, AutoAction, AnalyzedEvent, ImportAnalysisReport } from '@/src/services/event-import-analyzer.service';
import type { RMSMarketEvent, ImpactScore, EventImpactLevel } from '@/src/types/events';
import type { ParseReport } from '@/src/services/event-excel-parser.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

let _seq = 0;

/** Minimal valid ImpactScore */
function makeImpact(overrides: Partial<ImpactScore> = {}): ImpactScore {
  return {
    demand: 40,
    adr: 30,
    occupancy: 40,
    pickup: 35,
    revpar: 35,
    compression: 30,
    confidence: 80,
    level: 'medium',
    ...overrides,
  };
}

/**
 * Build a fully-valid RMSMarketEvent.
 * All required fields are present by default; pass `overrides` to break them.
 */
function makeEvent(overrides: Partial<RMSMarketEvent> = {}): RMSMarketEvent {
  const id = `ev_test_${++_seq}`;
  return {
    id,
    name: 'Vivatech 2027',
    category: 'salon',
    status: 'confirmed',
    city: 'Paris',
    venue: 'Parc des Expositions',
    country: 'France',
    startDate: '2027-06-10',
    endDate: '2027-06-13',
    impact: makeImpact(),
    influencePrice: 12,
    sources: ['lighthouse'],
    primarySource: 'Lighthouse',
    rmsSynced: false,
    history: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Build a minimal ParseReport wrapping the given events. */
function makeParsed(events: RMSMarketEvent[], overrides: Partial<ParseReport> = {}): ParseReport {
  return {
    fileName: 'test-import.xlsx',
    parsedAt: new Date().toISOString(),
    sheets: ['Sheet1'],
    rows: events.length,
    events,
    warnings: [],
    ...overrides,
  };
}

// Convenience: today's date string in YYYY-MM-DD (mirrors service logic)
const today = new Date().toISOString().slice(0, 10);

// A date clearly in the future
const futureStart = '2028-03-01';
const futureEnd = '2028-03-05';

// A date clearly in the past
const pastEnd = '2020-01-10';
const pastStart = '2020-01-05';

// ── 1. invalid status ─────────────────────────────────────────────────────────

describe('analyzeImport — invalid status', () => {
  it('marks event as invalid when name is missing AND startDate is missing', () => {
    const ev = makeEvent({ name: '', startDate: '' });
    const report = analyzeImport(makeParsed([ev]), []);
    const item = report.items[0];
    expect(item.status).toBe('invalid');
    expect(item.autoAction).toBe('skip');
    expect(item.selected).toBe(false);
  });

  it('marks event as invalid when name is missing AND endDate is missing', () => {
    const ev = makeEvent({ name: 'X', endDate: '' }); // name too short (1 char) + no endDate
    const report = analyzeImport(makeParsed([ev]), []);
    const item = report.items[0];
    expect(item.status).toBe('invalid');
    expect(item.autoAction).toBe('skip');
    expect(item.selected).toBe(false);
  });

  it('marks event as invalid when name < 2 chars AND both dates are missing', () => {
    const ev = makeEvent({ name: 'A', startDate: '', endDate: '' });
    const report = analyzeImport(makeParsed([ev]), []);
    const item = report.items[0];
    expect(item.status).toBe('invalid');
    expect(item.autoAction).toBe('skip');
    expect(item.selected).toBe(false);
  });

  it('marks event as invalid when both startDate and endDate are missing (name is valid)', () => {
    // 2 missing date issues ≥ 2 critical issues → invalid
    const ev = makeEvent({ startDate: '', endDate: '' });
    const report = analyzeImport(makeParsed([ev]), []);
    const item = report.items[0];
    expect(item.status).toBe('invalid');
    expect(item.autoAction).toBe('skip');
    expect(item.selected).toBe(false);
  });

  it('does NOT mark as invalid when only name is too short (only 1 critical issue)', () => {
    const ev = makeEvent({ name: 'X' }); // name too short but dates valid
    const report = analyzeImport(makeParsed([ev]), []);
    // only 1 critical issue → should NOT be invalid
    expect(report.items[0].status).not.toBe('invalid');
  });

  it('does NOT mark as invalid when only startDate is missing (only 1 critical issue)', () => {
    const ev = makeEvent({ startDate: '' });
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].status).not.toBe('invalid');
  });
});

// ── 2. update status ──────────────────────────────────────────────────────────

describe('analyzeImport — update status', () => {
  it('detects update when imported event id matches an existing event id', () => {
    const existing = makeEvent({ id: 'ev_known_001' });
    const incoming = makeEvent({ id: 'ev_known_001', name: 'Vivatech 2027 Updated' });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    const item = report.items[0];
    expect(item.status).toBe('update');
    expect(item.confidence).toBe(99);
  });

  it('sets existingMatch to the matched existing event', () => {
    const existing = makeEvent({ id: 'ev_known_002' });
    const incoming = makeEvent({ id: 'ev_known_002' });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    expect(report.items[0].existingMatch).toEqual(existing);
  });

  it('sets autoAction to "update" and selected to true when existing event is current/future', () => {
    const existing = makeEvent({ id: 'ev_future_003', endDate: futureEnd });
    const incoming = makeEvent({ id: 'ev_future_003', endDate: futureEnd });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    const item = report.items[0];
    expect(item.autoAction).toBe('update');
    expect(item.selected).toBe(true);
  });

  it('does not match update on a different id', () => {
    const existing = makeEvent({ id: 'ev_aaa' });
    const incoming = makeEvent({ id: 'ev_bbb' }); // different id
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    expect(report.items[0].status).not.toBe('update');
  });
});

// ── 3. update + past event ────────────────────────────────────────────────────

describe('analyzeImport — update + past event', () => {
  it('sets autoAction to "skip" and selected to false when matched existing event is in the past', () => {
    const existing = makeEvent({
      id: 'ev_past_100',
      startDate: pastStart,
      endDate: pastEnd,
    });
    const incoming = makeEvent({ id: 'ev_past_100' });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    const item = report.items[0];
    expect(item.status).toBe('update');
    expect(item.autoAction).toBe('skip');
    expect(item.selected).toBe(false);
  });

  it('includes a past-event warning in issues when existing match is past', () => {
    const existing = makeEvent({ id: 'ev_past_101', startDate: pastStart, endDate: pastEnd });
    const incoming = makeEvent({ id: 'ev_past_101' });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    const item = report.items[0];
    expect(item.issues.length).toBeGreaterThan(0);
    // The service pushes a French message referencing historique
    expect(item.issues.some((i) => i.toLowerCase().includes('passé'))).toBe(true);
  });

  it('still returns status "update" (not invalid) for a past matched event', () => {
    const existing = makeEvent({ id: 'ev_past_102', startDate: pastStart, endDate: pastEnd });
    const incoming = makeEvent({ id: 'ev_past_102' });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    expect(report.items[0].status).toBe('update');
  });
});

// ── 4. duplicate status ───────────────────────────────────────────────────────

describe('analyzeImport — duplicate status', () => {
  it('detects a duplicate when same name and overlapping dates', () => {
    const existing = makeEvent({
      id: 'ev_existing_dup',
      name: 'Vivatech 2027',
      startDate: '2027-06-10',
      endDate: '2027-06-13',
    });
    // Incoming: different id but identical name + same dates
    const incoming = makeEvent({
      id: 'ev_new_dup',
      name: 'Vivatech 2027',
      startDate: '2027-06-10',
      endDate: '2027-06-13',
    });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    const item = report.items[0];
    expect(item.status).toBe('duplicate');
  });

  it('sets existingMatch on duplicate', () => {
    const existing = makeEvent({
      id: 'ev_existing_dup2',
      name: 'Paris Air Show 2027',
      startDate: '2027-06-19',
      endDate: '2027-06-25',
    });
    const incoming = makeEvent({
      id: 'ev_new_dup2',
      name: 'Paris Air Show 2027',
      startDate: '2027-06-19',
      endDate: '2027-06-25',
    });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    expect(report.items[0].existingMatch).toEqual(existing);
  });

  it('skips duplicate of a past event (autoAction skip, selected false)', () => {
    const existing = makeEvent({
      id: 'ev_past_dup',
      name: 'Roland Garros 2020',
      startDate: '2020-05-24',
      endDate: '2020-06-07',
    });
    const incoming = makeEvent({
      id: 'ev_new_dup3',
      name: 'Roland Garros 2020',
      startDate: '2020-05-24',
      endDate: '2020-06-07',
    });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    const item = report.items[0];
    expect(item.status).toBe('duplicate');
    expect(item.autoAction).toBe('skip');
    expect(item.selected).toBe(false);
  });

  it('pre-selects duplicate of a future event (autoAction update, selected true)', () => {
    const existing = makeEvent({
      id: 'ev_fut_dup',
      name: 'Vivatech 2028',
      startDate: futureStart,
      endDate: futureEnd,
    });
    const incoming = makeEvent({
      id: 'ev_new_fut_dup',
      name: 'Vivatech 2028',
      startDate: futureStart,
      endDate: futureEnd,
    });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    const item = report.items[0];
    expect(item.status).toBe('duplicate');
    expect(item.autoAction).toBe('update');
    expect(item.selected).toBe(true);
  });

  it('does NOT detect duplicate when names differ significantly', () => {
    const existing = makeEvent({ id: 'ev_other', name: 'Cannes Film Festival 2027', startDate: '2027-05-13', endDate: '2027-05-24' });
    const incoming = makeEvent({ id: 'ev_new_diff', name: 'Vivatech 2027', startDate: '2027-06-10', endDate: '2027-06-13' });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    expect(report.items[0].status).not.toBe('duplicate');
  });

  it('does NOT detect duplicate when names match but dates do not overlap', () => {
    const existing = makeEvent({ id: 'ev_yr1', name: 'Vivatech 2026', startDate: '2026-06-11', endDate: '2026-06-14' });
    const incoming = makeEvent({ id: 'ev_yr2', name: 'Vivatech 2027', startDate: '2027-06-10', endDate: '2027-06-13' });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    // Different years + no overlap → should NOT be duplicate
    expect(report.items[0].status).not.toBe('duplicate');
  });
});

// ── 5. conflict status ────────────────────────────────────────────────────────

describe('analyzeImport — conflict status', () => {
  it.each<EventImpactLevel>(['high', 'critical', 'hyper_compression'])(
    'detects conflict when overlapping with HIGH_IMPACT level "%s"',
    (level) => {
      const existing = makeEvent({
        id: 'ev_high',
        name: 'Big Conference 2027',
        startDate: '2027-09-01',
        endDate: '2027-09-05',
        impact: makeImpact({ level }),
      });
      const incoming = makeEvent({
        id: 'ev_incoming_conflict',
        name: 'Small Event 2027',
        startDate: '2027-09-03',
        endDate: '2027-09-07',
      });
      const report = analyzeImport(makeParsed([incoming]), [existing]);
      const item = report.items[0];
      expect(item.status).toBe('conflict');
      expect(item.autoAction).toBe('review');
      expect(item.selected).toBe(true);
      expect(item.confidence).toBe(88);
    },
  );

  it('sets existingMatch to the conflicting event', () => {
    const existing = makeEvent({
      id: 'ev_conflict_match',
      name: 'Critical Event',
      startDate: '2027-09-01',
      endDate: '2027-09-05',
      impact: makeImpact({ level: 'critical' }),
    });
    const incoming = makeEvent({
      id: 'ev_incoming_c2',
      name: 'New Event',
      startDate: '2027-09-02',
      endDate: '2027-09-04',
    });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    expect(report.items[0].existingMatch).toEqual(existing);
  });

  it('does NOT detect conflict when overlapping event has low/medium impact', () => {
    const lowImpact = makeEvent({
      id: 'ev_low',
      name: 'Low Impact Event',
      startDate: '2027-09-01',
      endDate: '2027-09-05',
      impact: makeImpact({ level: 'low' }),
    });
    const incoming = makeEvent({
      id: 'ev_new_c3',
      name: 'Another Event',
      startDate: '2027-09-03',
      endDate: '2027-09-06',
    });
    const report = analyzeImport(makeParsed([incoming]), [lowImpact]);
    expect(report.items[0].status).not.toBe('conflict');
  });

  it('does NOT flag conflict against itself (same id)', () => {
    // If the incoming event has the same id as the high-impact existing, it
    // should be treated as update, not conflict.
    const existing = makeEvent({
      id: 'ev_self',
      name: 'Self High',
      startDate: '2027-09-01',
      endDate: '2027-09-05',
      impact: makeImpact({ level: 'critical' }),
    });
    const incoming = makeEvent({
      id: 'ev_self',
      name: 'Self High Updated',
      startDate: '2027-09-01',
      endDate: '2027-09-05',
    });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    // Exact ID match → update, conflict exclusion applies
    expect(report.items[0].status).toBe('update');
  });

  it('includes the conflicting event name in issues', () => {
    const existing = makeEvent({
      id: 'ev_named_conflict',
      name: 'Hyper Event',
      startDate: '2027-09-01',
      endDate: '2027-09-05',
      impact: makeImpact({ level: 'hyper_compression' }),
    });
    const incoming = makeEvent({
      id: 'ev_new_c4',
      name: 'New Small Event',
      startDate: '2027-09-02',
      endDate: '2027-09-04',
    });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    const item = report.items[0];
    expect(item.issues.some((i) => i.includes('Hyper Event'))).toBe(true);
  });
});

// ── 6. incomplete status ──────────────────────────────────────────────────────

describe('analyzeImport — incomplete status', () => {
  it('marks event as incomplete when city is missing', () => {
    const ev = makeEvent({ city: '' });
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].status).toBe('incomplete');
  });

  it('marks event as incomplete when venue is missing', () => {
    const ev = makeEvent({ venue: undefined });
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].status).toBe('incomplete');
  });

  it('sets autoAction to "review" for incomplete events', () => {
    const ev = makeEvent({ city: '' });
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].autoAction).toBe('review');
  });

  it('sets selected to true for incomplete events', () => {
    const ev = makeEvent({ venue: undefined });
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].selected).toBe(true);
  });

  it('sets confidence to 60 for incomplete events', () => {
    const ev = makeEvent({ city: '' });
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].confidence).toBe(60);
  });

  it('adds an issue describing missing location', () => {
    const ev = makeEvent({ city: '' });
    const report = analyzeImport(makeParsed([ev]), []);
    const item = report.items[0];
    expect(item.issues.length).toBeGreaterThan(0);
  });
});

// ── 7. valid status ───────────────────────────────────────────────────────────

describe('analyzeImport — valid status', () => {
  it('marks a fully-specified new event as valid', () => {
    const ev = makeEvent();
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].status).toBe('valid');
  });

  it('sets autoAction to "import" for valid events', () => {
    const ev = makeEvent();
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].autoAction).toBe('import');
  });

  it('sets selected to true for valid events', () => {
    const ev = makeEvent();
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].selected).toBe(true);
  });

  it('sets confidence to at least 75 for valid events', () => {
    const ev = makeEvent({ impact: makeImpact({ confidence: 50 }) });
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].confidence).toBeGreaterThanOrEqual(75);
  });

  it('uses the event impact confidence when it is above 75', () => {
    const ev = makeEvent({ impact: makeImpact({ confidence: 95 }) });
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].confidence).toBe(95);
  });

  it('returns no issues for a valid event', () => {
    const ev = makeEvent();
    const report = analyzeImport(makeParsed([ev]), []);
    expect(report.items[0].issues).toHaveLength(0);
  });
});

// ── 8. stats ──────────────────────────────────────────────────────────────────

describe('analyzeImport — stats', () => {
  it('correctly counts one of each status', () => {
    // invalid: no name, no startDate
    const invalid = makeEvent({ name: '', startDate: '' });

    // update (future): same id as existing
    const existing_update = makeEvent({ id: 'ev_stat_upd', endDate: futureEnd });
    const update = makeEvent({ id: 'ev_stat_upd', endDate: futureEnd });

    // duplicate: same name + overlapping dates, different id
    const existing_dup = makeEvent({ id: 'ev_stat_dup', name: 'Dup Event Stat', startDate: '2027-07-01', endDate: '2027-07-05' });
    const duplicate = makeEvent({ id: 'ev_stat_dup_new', name: 'Dup Event Stat', startDate: '2027-07-01', endDate: '2027-07-05' });

    // conflict: overlaps high-impact existing
    const existing_conflict = makeEvent({
      id: 'ev_stat_conf',
      name: 'Critical Stat Event',
      startDate: '2027-08-01',
      endDate: '2027-08-10',
      impact: makeImpact({ level: 'critical' }),
    });
    const conflict = makeEvent({
      id: 'ev_stat_conf_new',
      name: 'New Conflict Stat',
      startDate: '2027-08-03',
      endDate: '2027-08-07',
    });

    // incomplete: missing venue — use a name that won't collide with other existing events
    const incomplete = makeEvent({
      name: 'Stats Incomplete Event',
      startDate: '2027-09-01',
      endDate: '2027-09-05',
      venue: undefined,
    });

    // valid: all good — use a name that won't collide with any existing event
    const valid = makeEvent({
      name: 'Stats Valid New Event',
      startDate: '2027-11-01',
      endDate: '2027-11-05',
    });

    const events = [invalid, update, duplicate, conflict, incomplete, valid];
    const existingEvents = [existing_update, existing_dup, existing_conflict];

    const report = analyzeImport(makeParsed(events), existingEvents);

    expect(report.stats.invalid).toBe(1);
    expect(report.stats.update).toBe(1);
    expect(report.stats.duplicate).toBe(1);
    expect(report.stats.conflict).toBe(1);
    expect(report.stats.incomplete).toBe(1);
    expect(report.stats.valid).toBe(1);
  });

  it('sums all stats to the total number of events', () => {
    const events = [makeEvent(), makeEvent(), makeEvent()];
    const report = analyzeImport(makeParsed(events), []);
    const total = Object.values(report.stats).reduce((a, b) => a + b, 0);
    expect(total).toBe(events.length);
  });

  it('stats keys cover all expected ImportStatus values', () => {
    const report = analyzeImport(makeParsed([]), []);
    const keys = Object.keys(report.stats).sort();
    expect(keys).toEqual(['conflict', 'duplicate', 'incomplete', 'invalid', 'update', 'valid']);
  });
});

// ── 9. empty input ────────────────────────────────────────────────────────────

describe('analyzeImport — empty input', () => {
  it('returns 0 items for empty events list', () => {
    const report = analyzeImport(makeParsed([]), []);
    expect(report.items).toHaveLength(0);
  });

  it('returns all-zero stats for empty events list', () => {
    const report = analyzeImport(makeParsed([]), []);
    for (const count of Object.values(report.stats)) {
      expect(count).toBe(0);
    }
  });

  it('preserves fileName from ParseReport', () => {
    const report = analyzeImport(makeParsed([], { fileName: 'my-file.xlsx' }), []);
    expect(report.fileName).toBe('my-file.xlsx');
  });

  it('preserves sheets from ParseReport', () => {
    const report = analyzeImport(makeParsed([], { sheets: ['Sheet1', 'Sheet2'] }), []);
    expect(report.sheets).toEqual(['Sheet1', 'Sheet2']);
  });

  it('preserves totalRows from ParseReport', () => {
    const report = analyzeImport(makeParsed([], { rows: 42 }), []);
    expect(report.totalRows).toBe(42);
  });

  it('preserves warnings from ParseReport', () => {
    const report = analyzeImport(makeParsed([], { warnings: ['warn1'] }), []);
    expect(report.warnings).toEqual(['warn1']);
  });

  it('sets analyzedAt to a non-empty ISO string', () => {
    const report = analyzeImport(makeParsed([]), []);
    expect(report.analyzedAt).toBeTruthy();
    expect(() => new Date(report.analyzedAt)).not.toThrow();
  });
});

// ── 10. Edge cases ────────────────────────────────────────────────────────────

describe('analyzeImport — edge cases', () => {
  it('handles multiple events in a single report correctly', () => {
    const ev1 = makeEvent(); // valid
    const ev2 = makeEvent({ name: '', startDate: '' }); // invalid
    const report = analyzeImport(makeParsed([ev1, ev2]), []);
    expect(report.items).toHaveLength(2);
    expect(report.items.filter((i) => i.status === 'valid')).toHaveLength(1);
    expect(report.items.filter((i) => i.status === 'invalid')).toHaveLength(1);
  });

  it('does not mutate the input ParseReport events array', () => {
    const ev = makeEvent();
    const events = [ev];
    const parsed = makeParsed(events);
    analyzeImport(parsed, []);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]).toBe(ev);
  });

  it('update check takes priority over duplicate detection', () => {
    // An event that shares both id AND name+dates with an existing event
    // should be classified as "update", not "duplicate"
    const existing = makeEvent({ id: 'ev_priority', name: 'Priority Event', startDate: '2027-05-01', endDate: '2027-05-05' });
    const incoming = makeEvent({ id: 'ev_priority', name: 'Priority Event', startDate: '2027-05-01', endDate: '2027-05-05' });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    expect(report.items[0].status).toBe('update');
  });

  it('update check takes priority over conflict detection', () => {
    // Same id + overlapping with a high-impact event that is the same event
    // → should be "update" not "conflict"
    const existing = makeEvent({
      id: 'ev_upd_over_conf',
      name: 'High Impact Own Event',
      startDate: '2027-05-01',
      endDate: '2027-05-05',
      impact: makeImpact({ level: 'critical' }),
    });
    const incoming = makeEvent({ id: 'ev_upd_over_conf', startDate: '2027-05-01', endDate: '2027-05-05' });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    expect(report.items[0].status).toBe('update');
  });

  it('conflict takes priority over incomplete (conflict detected first)', () => {
    // Missing venue BUT also overlaps with high-impact existing event
    const existing = makeEvent({
      id: 'ev_conf_inc',
      name: 'Critical Existing',
      startDate: '2027-10-01',
      endDate: '2027-10-10',
      impact: makeImpact({ level: 'critical' }),
    });
    const incoming = makeEvent({
      id: 'ev_inc_incoming',
      name: 'New Incomplete',
      venue: undefined, // incomplete
      startDate: '2027-10-03',
      endDate: '2027-10-07',
    });
    const report = analyzeImport(makeParsed([incoming]), [existing]);
    // The service checks conflict before incomplete → should be conflict
    expect(report.items[0].status).toBe('conflict');
  });
});
