/**
 * FLOWTYM RMS — Tests helpers d'affichage Événements.
 *
 * Garantit que les helpers consommés par EventsList et EventsHeatmapView ne
 * peuvent JAMAIS jeter d'exception, même sur les entrées dégénérées qui
 * faisaient crasher la page Événement en pilote :
 *   - impact null / undefined
 *   - champs NaN / Infinity
 *   - événement entier null
 *
 * Reproduit l'incident métier qui faisait remonter une TypeError jusqu'à
 * l'ErrorBoundary global et rendait le module Revenue inaccessible.
 */
import { describe, expect, it } from 'vitest';
import type { RMSMarketEvent } from '@/src/types/events';
import { fmtSignedPct, safeImpact, safeScore } from './eventDisplay';

function makeEvent(overrides: Partial<RMSMarketEvent> = {}): RMSMarketEvent {
  return {
    id: 'evt_test',
    name: 'Test',
    category: 'salon',
    status: 'planned',
    city: 'Paris',
    country: 'FR',
    venue: null,
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    impact: {
      occupancy: 10,
      adr: 20,
      revpar: 15,
      confidence: 80,
      level: 'medium',
    },
    estimatedVisitors: 0,
    rmsSynced: false,
    primarySource: 'manual',
    ...overrides,
  } as unknown as RMSMarketEvent;
}

describe('fmtSignedPct — tolérance NaN/null/undefined', () => {
  it('formate un nombre positif avec +', () => {
    expect(fmtSignedPct(5)).toBe('+5%');
  });
  it('formate un nombre négatif sans +', () => {
    expect(fmtSignedPct(-3)).toBe('-3%');
  });
  it('retourne « — » sur null', () => {
    expect(fmtSignedPct(null)).toBe('—');
  });
  it('retourne « — » sur undefined', () => {
    expect(fmtSignedPct(undefined)).toBe('—');
  });
  it('retourne « — » sur NaN (ex. division par 0 amont)', () => {
    expect(fmtSignedPct(Number.NaN)).toBe('—');
  });
  it('retourne « — » sur Infinity', () => {
    expect(fmtSignedPct(Number.POSITIVE_INFINITY)).toBe('—');
  });
  it('option plus=false : pas de signe sur positif', () => {
    expect(fmtSignedPct(5, false)).toBe('5%');
  });
});

describe('safeImpact — tolérance event partiel', () => {
  it('extrait les valeurs nominales', () => {
    const i = safeImpact(makeEvent());
    expect(i).toEqual({ occupancy: 10, adr: 20, revpar: 15, confidence: 80 });
  });

  it('retourne null+0 si event est null', () => {
    const i = safeImpact(null);
    expect(i).toEqual({ occupancy: null, adr: null, revpar: null, confidence: 0 });
  });

  it('retourne null+0 si event est undefined', () => {
    const i = safeImpact(undefined);
    expect(i).toEqual({ occupancy: null, adr: null, revpar: null, confidence: 0 });
  });

  it('retourne null+0 si event.impact est absent', () => {
    const e = makeEvent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (e as any).impact;
    const i = safeImpact(e);
    expect(i.occupancy).toBeNull();
    expect(i.adr).toBeNull();
    expect(i.revpar).toBeNull();
    expect(i.confidence).toBe(0);
  });

  it('retourne null pour les champs NaN', () => {
    const e = makeEvent({
      impact: {
        occupancy: Number.NaN,
        adr: 10,
        revpar: Number.NaN,
        confidence: Number.NaN,
        level: 'low',
      } as unknown as RMSMarketEvent['impact'],
    });
    const i = safeImpact(e);
    expect(i.occupancy).toBeNull();
    expect(i.adr).toBe(10);
    expect(i.revpar).toBeNull();
    expect(i.confidence).toBe(0);
  });

  it('retourne null pour les champs Infinity', () => {
    const e = makeEvent({
      impact: {
        occupancy: Number.POSITIVE_INFINITY,
        adr: Number.NEGATIVE_INFINITY,
        revpar: 0,
        confidence: 50,
        level: 'medium',
      } as unknown as RMSMarketEvent['impact'],
    });
    const i = safeImpact(e);
    expect(i.occupancy).toBeNull();
    expect(i.adr).toBeNull();
    expect(i.revpar).toBe(0);
    expect(i.confidence).toBe(50);
  });
});

describe('safeScore — bornes 0–100', () => {
  it('arrondit à l\'entier', () => {
    expect(safeScore(72.6)).toBe(73);
  });
  it('borne à 100 max', () => {
    expect(safeScore(150)).toBe(100);
  });
  it('borne à 0 min', () => {
    expect(safeScore(-20)).toBe(0);
  });
  it('null → 0', () => {
    expect(safeScore(null)).toBe(0);
  });
  it('undefined → 0', () => {
    expect(safeScore(undefined)).toBe(0);
  });
  it('NaN → 0', () => {
    expect(safeScore(Number.NaN)).toBe(0);
  });
});
