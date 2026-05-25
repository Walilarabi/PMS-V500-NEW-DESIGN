/**
 * FLOWTYM RMS — Tests Market Velocity Engine
 *
 * Couvre :
 *   • buildDeltaSet (médiane et disponibilité)
 *   • pctDelta et pointsDelta
 *   • computeVelocityIndex (pondérations)
 *   • computeMarketVelocity (tolérance gaps, manquants)
 *   • computeVelocityWindow (batch)
 */

import { describe, it, expect } from 'vitest';
import {
  buildDeltaSet,
  computeMarketVelocity,
  computeVelocityIndex,
  computeVelocityWindow,
  pctDelta,
  pointsDelta,
} from './market-velocity.engine';
import type { MarketSnapshot } from '../../types/marketIntelligence';

function snap(date: string, overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    date,
    capturedAt: `${date}T08:00:00Z`,
    compsetMedian: 200,
    ourPrice: 195,
    availability: 0.8,
    minStayShare: 0.05,
    ctaCtdShare: 0.02,
    flexibleClosedShare: 0.05,
    otaClosedShare: 0.01,
    pickup: 8,
    inventoryShrinkShare: 0.02,
    ...overrides,
  };
}

/** Génère N snapshots quotidiens consécutifs à partir d'une date donnée. */
function series(start: string, gen: (i: number) => Partial<MarketSnapshot>): MarketSnapshot[] {
  const out: MarketSnapshot[] = [];
  for (let i = 0; i < 32; i++) {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(snap(d.toISOString().slice(0, 10), gen(i)));
  }
  return out;
}

describe('pctDelta / pointsDelta', () => {
  it('pctDelta calcule correctement', () => {
    expect(pctDelta(220, 200)).toBeCloseTo(10, 5);
    expect(pctDelta(180, 200)).toBeCloseTo(-10, 5);
    expect(pctDelta(200, 0)).toBe(0); // protection division par zéro
  });

  it('pointsDelta multiplie par 100', () => {
    expect(pointsDelta(0.8, 0.6)).toBeCloseTo(20, 5);
    expect(pointsDelta(0.5, 0.8)).toBeCloseTo(-30, 5);
  });
});

describe('buildDeltaSet', () => {
  it('calcule les deltas J-1, J-3, J-7 sur la médiane', () => {
    const snaps = series('2026-06-01', (i) => ({ compsetMedian: 200 + i * 5 }));
    const index = new Map(snaps.map((s) => [s.date, s]));
    const current = snaps[20]; // 2026-06-21
    const delta = buildDeltaSet(index, current, (s) => s.compsetMedian, 'percent');
    // J-1 : médiane 200 + 19*5 = 295 → current = 300 → delta = 5/295 ≈ 1.7 %
    expect(delta.d1).toBeCloseTo(((300 - 295) / 295) * 100, 1);
    // J-7 : médiane 200 + 13*5 = 265 → current = 300 → delta = 35/265 ≈ 13.2 %
    expect(delta.d7).toBeCloseTo(((300 - 265) / 265) * 100, 1);
  });

  it('renvoie 0 si pas de référence antérieure', () => {
    const snaps = [snap('2026-06-01', { compsetMedian: 200 })];
    const index = new Map(snaps.map((s) => [s.date, s]));
    const delta = buildDeltaSet(index, snaps[0], (s) => s.compsetMedian);
    expect(delta.d1).toBe(0);
    expect(delta.d30).toBe(0);
  });

  it('tolère un gap de 1-2 jours dans la série', () => {
    // Pas de snapshot à J-2, mais un à J-3 — doit utiliser le J-3
    const snaps = [
      snap('2026-06-01', { compsetMedian: 200 }),
      // gap à 2026-06-02 et 2026-06-03
      snap('2026-06-04', { compsetMedian: 220 }),
    ];
    const index = new Map(snaps.map((s) => [s.date, s]));
    const delta = buildDeltaSet(index, snaps[1], (s) => s.compsetMedian);
    expect(delta.d3).toBeCloseTo(10, 5);
  });
});

describe('computeVelocityIndex', () => {
  it('renvoie 0 sur un marché stable', () => {
    expect(
      computeVelocityIndex({
        adrDelta7d: 0,
        availabilityDelta7d: 0,
        compressionAcceleration: 0,
        pickupAcceleration: 0,
      }),
    ).toBe(0);
  });

  it('renvoie 100 sur un marché ultra-volatile', () => {
    expect(
      computeVelocityIndex({
        adrDelta7d: 30,
        availabilityDelta7d: 50,
        compressionAcceleration: 6,
        pickupAcceleration: 12,
      }),
    ).toBe(100);
  });

  it('utilise la valeur absolue (chute = volatilité aussi)', () => {
    const up = computeVelocityIndex({
      adrDelta7d: 15,
      availabilityDelta7d: 0,
      compressionAcceleration: 0,
      pickupAcceleration: 0,
    });
    const down = computeVelocityIndex({
      adrDelta7d: -15,
      availabilityDelta7d: 0,
      compressionAcceleration: 0,
      pickupAcceleration: 0,
    });
    expect(up).toBe(down);
  });
});

describe('computeMarketVelocity', () => {
  it('renvoie null sur série vide', () => {
    expect(computeMarketVelocity([], '2026-06-01')).toBeNull();
  });

  it('renvoie null si la date cible n\'est pas dans la série', () => {
    const snaps = [snap('2026-06-01')];
    expect(computeMarketVelocity(snaps, '2026-06-15')).toBeNull();
  });

  it('détecte une vélocité forte sur une hausse de médiane rapide', () => {
    // 200 → 280 en 7 jours = +40 %
    const snaps = series('2026-06-01', (i) => {
      const median = i < 15 ? 200 : 200 + (i - 14) * 8;
      return { compsetMedian: median };
    });
    const v = computeMarketVelocity(snaps, '2026-06-22'); // i=21 → 256
    expect(v).not.toBeNull();
    expect(v!.medianDelta.d7).toBeGreaterThan(15);
    expect(v!.adrVelocity).toBeGreaterThan(0);
    expect(v!.velocityIndex).toBeGreaterThan(30);
  });

  it('détecte une chute disponibilité', () => {
    const snaps = series('2026-06-01', (i) => {
      const avail = i < 10 ? 0.85 : 0.85 - (i - 9) * 0.05;
      return { availability: Math.max(0.1, avail) };
    });
    const v = computeMarketVelocity(snaps, '2026-06-18');
    expect(v).not.toBeNull();
    expect(v!.availabilityDelta.d7).toBeLessThan(0);
    expect(v!.inventoryDepletionVelocity).toBeGreaterThan(0);
  });
});

describe('computeVelocityWindow', () => {
  it('indexe par date dans la fenêtre demandée', () => {
    const snaps = series('2026-06-01', () => ({}));
    const out = computeVelocityWindow(snaps, '2026-06-10', '2026-06-15');
    expect(out.size).toBe(6);
    expect(out.has('2026-06-10')).toBe(true);
    expect(out.has('2026-06-15')).toBe(true);
  });
});
