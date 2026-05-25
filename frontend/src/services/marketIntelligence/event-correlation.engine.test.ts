/**
 * FLOWTYM RMS — Tests Event ↔ Market Correlation Engine
 *
 * Couvre :
 *   • Attribution forte quand la pression apparaît juste avant l'événement
 *   • Attribution faible si la pression existe déjà bien avant
 *   • Dilution quand plusieurs événements coïncident
 *   • Détection signaux observés
 *   • Pré/in-event snapshots
 */

import { describe, it, expect } from 'vitest';
import { correlateEventsWithMarket } from './event-correlation.engine';
import { computeMarketCompression } from './market-compression.engine';
import { computeMarketVelocity } from './market-velocity.engine';
import type {
  EventImpactScore,
  MarketSnapshot,
} from '../../types/marketIntelligence';
import type { RMSMarketEvent, ImpactScore } from '../../types/events';

function snap(date: string, overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    date,
    capturedAt: `${date}T08:00:00Z`,
    compsetMedian: 200,
    ourPrice: 195,
    availability: 0.85,
    minStayShare: 0.05,
    ctaCtdShare: 0.02,
    flexibleClosedShare: 0.05,
    otaClosedShare: 0.01,
    pickup: 8,
    inventoryShrinkShare: 0.02,
    ...overrides,
  };
}

function impact(s: number): EventImpactScore {
  return {
    score: s,
    classification: 'watch',
    breakdown: {
      audience: 10,
      international: 10,
      duration: 5,
      historicAdr: 10,
      historicOccupancy: 10,
      rarity: 5,
      prestige: 2,
    },
    legacyLevel: 'medium',
  };
}

function ev(overrides: Partial<RMSMarketEvent> = {}): RMSMarketEvent {
  const baseImpact: ImpactScore = {
    demand: 20, adr: 15, occupancy: 12, pickup: 15, revpar: 16,
    compression: 60, confidence: 85, level: 'medium',
  };
  return {
    id: 'evt_x',
    name: 'Salon X',
    category: 'salon',
    status: 'active',
    city: 'Paris',
    country: 'FR',
    startDate: '2026-06-15',
    endDate: '2026-06-17',
    impact: baseImpact,
    influencePrice: 8,
    sources: ['s1'],
    primarySource: 'Source A',
    rmsSynced: true,
    history: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Construit une série de snapshots : marché calme avant événement,
 * puis pression croissante pendant.
 */
function buildCalmThenSpikeSeries(startDate: string, eventStart: string, eventEnd: string): MarketSnapshot[] {
  const out: MarketSnapshot[] = [];
  const cur = new Date(`${startDate}T00:00:00Z`);
  const evS = new Date(`${eventStart}T00:00:00Z`);
  const evE = new Date(`${eventEnd}T00:00:00Z`);
  for (let i = 0; i < 30; i++) {
    const d = new Date(cur);
    d.setUTCDate(cur.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (d < evS) {
      // Calme
      out.push(snap(iso, { compsetMedian: 200, availability: 0.85 }));
    } else if (d <= evE) {
      // Spike
      out.push(snap(iso, {
        compsetMedian: 250,
        availability: 0.35,
        minStayShare: 0.50,
        flexibleClosedShare: 0.40,
      }));
    } else {
      // Post
      out.push(snap(iso, { compsetMedian: 205, availability: 0.78 }));
    }
  }
  return out;
}

describe('correlateEventsWithMarket — attribution forte', () => {
  it('attribue fortement si la pression apparaît juste avant l\'événement', () => {
    const event = ev({
      id: 'evt_a',
      startDate: '2026-06-15',
      endDate: '2026-06-17',
    });
    const snaps = buildCalmThenSpikeSeries('2026-06-01', '2026-06-15', '2026-06-17');
    const velMap = new Map();
    const compMap = new Map();
    for (const s of snaps) {
      const v = computeMarketVelocity(snaps, s.date);
      if (v) velMap.set(s.date, v);
      compMap.set(s.date, computeMarketCompression(s, v));
    }
    const out = correlateEventsWithMarket(
      [event],
      snaps,
      compMap,
      velMap,
      new Map([[event.id, impact(75)]]),
    );
    const reaction = out.get(event.id)!;
    expect(reaction.attributionScore).toBeGreaterThanOrEqual(50);
    expect(reaction.observedPressure).toBeGreaterThan(40);
    expect(reaction.preEventSnapshot).not.toBeNull();
    expect(reaction.inEventSnapshot).not.toBeNull();
    expect(reaction.signals.length).toBeGreaterThan(0);
  });
});

describe('correlateEventsWithMarket — attribution faible', () => {
  it('attribue faiblement si le marché reste calme pendant l\'événement', () => {
    const event = ev({
      id: 'evt_flop',
      startDate: '2026-06-15',
      endDate: '2026-06-16',
    });
    // marché calme partout
    const snaps: MarketSnapshot[] = [];
    for (let i = 0; i < 25; i++) {
      const d = new Date(`2026-06-01T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      snaps.push(snap(d.toISOString().slice(0, 10), { compsetMedian: 200, availability: 0.85 }));
    }
    const velMap = new Map();
    const compMap = new Map();
    for (const s of snaps) {
      const v = computeMarketVelocity(snaps, s.date);
      if (v) velMap.set(s.date, v);
      compMap.set(s.date, computeMarketCompression(s, v));
    }
    const out = correlateEventsWithMarket(
      [event],
      snaps,
      compMap,
      velMap,
      new Map([[event.id, impact(70)]]),
    );
    expect(out.get(event.id)!.attributionScore).toBeLessThanOrEqual(40);
  });
});

describe('correlateEventsWithMarket — dilution', () => {
  it('dilue l\'attribution quand 3 événements coïncident', () => {
    const e1 = ev({ id: 'a', startDate: '2026-06-15', endDate: '2026-06-17' });
    const e2 = ev({ id: 'b', startDate: '2026-06-15', endDate: '2026-06-17' });
    const e3 = ev({ id: 'c', startDate: '2026-06-15', endDate: '2026-06-17' });
    const snaps = buildCalmThenSpikeSeries('2026-06-01', '2026-06-15', '2026-06-17');
    const velMap = new Map();
    const compMap = new Map();
    for (const s of snaps) {
      const v = computeMarketVelocity(snaps, s.date);
      if (v) velMap.set(s.date, v);
      compMap.set(s.date, computeMarketCompression(s, v));
    }
    const out = correlateEventsWithMarket(
      [e1, e2, e3],
      snaps,
      compMap,
      velMap,
      new Map([
        [e1.id, impact(70)], [e2.id, impact(70)], [e3.id, impact(70)],
      ]),
    );
    const a = out.get('a')!.attributionScore;
    // Mêmes données mais sans dilution
    const outAlone = correlateEventsWithMarket(
      [e1],
      snaps,
      compMap,
      velMap,
      new Map([[e1.id, impact(70)]]),
    );
    const alone = outAlone.get('a')!.attributionScore;
    expect(a).toBeLessThanOrEqual(alone);
  });
});

describe('correlateEventsWithMarket — événements archivés', () => {
  it('ignore les événements archivés/annulés', () => {
    const e = ev({ id: 'x', status: 'archived' });
    const snaps = buildCalmThenSpikeSeries('2026-06-01', '2026-06-15', '2026-06-17');
    const out = correlateEventsWithMarket([e], snaps, new Map(), new Map(), new Map());
    expect(out.has('x')).toBe(false);
  });
});
