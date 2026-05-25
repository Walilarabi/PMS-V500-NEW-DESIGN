/**
 * FLOWTYM RMS — Tests Market Compression Engine
 *
 * Couvre :
 *   • Pondérations respectées (contributions ≤ poids max)
 *   • Classifications (no_compression → extreme)
 *   • Détection signaux marché
 *   • Inférence clusters affectés
 *   • Batch (compressionWindow)
 */

import { describe, it, expect } from 'vitest';
import {
  computeCompressionWindow,
  computeMarketCompression,
  detectMarketSignals,
} from './market-compression.engine';
import type {
  MarketSnapshot,
  MarketVelocity,
} from '../../types/marketIntelligence';
import { COMPRESSION_WEIGHTS } from '../../types/marketIntelligence';

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

function vel(date: string, overrides: Partial<MarketVelocity> = {}): MarketVelocity {
  return {
    date,
    adrVelocity: 0,
    inventoryDepletionVelocity: 0,
    compressionAcceleration: 0,
    pickupAcceleration: 0,
    medianDelta: { d1: 0, d3: 0, d7: 0, d14: 0, d30: 0 },
    availabilityDelta: { d1: 0, d3: 0, d7: 0, d14: 0, d30: 0 },
    velocityIndex: 0,
    ...overrides,
  };
}

describe('computeMarketCompression — classifications', () => {
  it('classe "no_compression" sur marché calme', () => {
    const c = computeMarketCompression(snap('2026-06-01'));
    expect(c.classification).toBe('no_compression');
    expect(c.score).toBeLessThan(20);
  });

  it('classe au moins "soft" sur diffusion massive de restrictions', () => {
    const c = computeMarketCompression(
      snap('2026-06-01', {
        minStayShare: 1.0,
        flexibleClosedShare: 0.70,
        ctaCtdShare: 0.40,
      }),
    );
    expect(['soft', 'building', 'strong']).toContain(c.classification);
    expect(c.score).toBeGreaterThanOrEqual(20);
  });

  it('classe "extreme" sur marché ultra-tendu', () => {
    const sn = snap('2026-06-01', {
      availability: 0.15,
      minStayShare: 0.85,
      ctaCtdShare: 0.50,
      flexibleClosedShare: 0.70,
      otaClosedShare: 0.40,
      inventoryShrinkShare: 0.50,
    });
    const v = vel('2026-06-01', {
      medianDelta: { d1: 5, d3: 10, d7: 28, d14: 35, d30: 45 },
      availabilityDelta: { d1: -5, d3: -15, d7: -50, d14: -55, d30: -60 },
      pickupAcceleration: 9,
    });
    const c = computeMarketCompression(sn, v);
    expect(c.score).toBeGreaterThanOrEqual(80);
    expect(c.classification).toBe('extreme');
  });
});

describe('computeMarketCompression — pondérations', () => {
  it('chaque contribution respecte son plafond', () => {
    const sn = snap('2026-06-01', {
      availability: 0,
      minStayShare: 1,
      ctaCtdShare: 1,
      flexibleClosedShare: 1,
      otaClosedShare: 1,
      inventoryShrinkShare: 1,
    });
    const v = vel('2026-06-01', {
      medianDelta: { d1: 5, d3: 10, d7: 100, d14: 35, d30: 45 },
      availabilityDelta: { d1: -5, d3: -15, d7: -100, d14: -55, d30: -60 },
      pickupAcceleration: 100,
    });
    const c = computeMarketCompression(sn, v);
    expect(c.contributions.medianLift).toBeLessThanOrEqual(COMPRESSION_WEIGHTS.medianLift);
    expect(c.contributions.availabilityDrop).toBeLessThanOrEqual(COMPRESSION_WEIGHTS.availabilityDrop);
    expect(c.contributions.minStay).toBeLessThanOrEqual(COMPRESSION_WEIGHTS.minStay);
    expect(c.contributions.ctaCtd).toBeLessThanOrEqual(COMPRESSION_WEIGHTS.ctaCtd);
    expect(c.contributions.flexibleClosed).toBeLessThanOrEqual(COMPRESSION_WEIGHTS.flexibleClosed);
    expect(c.contributions.pickupAcceleration).toBeLessThanOrEqual(COMPRESSION_WEIGHTS.pickupAcceleration);
    expect(c.score).toBeLessThanOrEqual(100);
  });

  it('une chute de médiane ne contribue pas (signed)', () => {
    const v = vel('2026-06-01', {
      medianDelta: { d1: 0, d3: 0, d7: -10, d14: 0, d30: 0 },
    });
    const c = computeMarketCompression(snap('2026-06-01'), v);
    expect(c.contributions.medianLift).toBe(0);
  });
});

describe('detectMarketSignals', () => {
  it('émet "median_lift" sur hausse médiane', () => {
    const v = vel('2026-06-01', {
      medianDelta: { d1: 2, d3: 5, d7: 18, d14: 22, d30: 25 },
    });
    const signals = detectMarketSignals(snap('2026-06-01'), v);
    const lift = signals.find((s) => s.code === 'median_lift');
    expect(lift).toBeDefined();
    expect(lift!.intensity).toBeGreaterThan(50);
    expect(lift!.detail).toContain('médiane');
  });

  it('émet "min_stay_spread" si Min Stay ≥ 30 %', () => {
    const signals = detectMarketSignals(snap('2026-06-01', { minStayShare: 0.62 }), null);
    const ms = signals.find((s) => s.code === 'min_stay_spread');
    expect(ms).toBeDefined();
    expect(ms!.detail).toContain('62%');
  });

  it('n\'émet pas de signal si tout est calme', () => {
    const signals = detectMarketSignals(snap('2026-06-01'), vel('2026-06-01'));
    expect(signals.length).toBe(0);
  });

  it('émet plusieurs signaux sur un marché tendu', () => {
    const sn = snap('2026-06-01', {
      minStayShare: 0.55,
      flexibleClosedShare: 0.40,
      otaClosedShare: 0.25,
      inventoryShrinkShare: 0.30,
    });
    const v = vel('2026-06-01', {
      medianDelta: { d1: 3, d3: 8, d7: 15, d14: 20, d30: 25 },
      availabilityDelta: { d1: -3, d3: -8, d7: -20, d14: -25, d30: -30 },
      pickupAcceleration: 5,
    });
    const signals = detectMarketSignals(sn, v);
    const codes = new Set(signals.map((s) => s.code));
    expect(codes.has('median_lift')).toBe(true);
    expect(codes.has('availability_drop')).toBe(true);
    expect(codes.has('min_stay_spread')).toBe(true);
    expect(codes.has('flex_closure')).toBe(true);
    expect(codes.has('ota_closure')).toBe(true);
    expect(codes.has('inventory_shrink')).toBe(true);
    expect(codes.has('pickup_burst')).toBe(true);
  });
});

describe('computeMarketCompression — clusters affectés', () => {
  it('détecte upscale/midscale sur Min Stay diffusé', () => {
    const c = computeMarketCompression(snap('2026-06-01', { minStayShare: 0.40 }));
    expect(c.affectedClusters).toContain('upscale');
    expect(c.affectedClusters).toContain('midscale');
  });

  it('détecte luxury sur fermeture flexibles', () => {
    const c = computeMarketCompression(snap('2026-06-01', { flexibleClosedShare: 0.35 }));
    expect(c.affectedClusters).toContain('luxury');
  });
});

describe('computeCompressionWindow', () => {
  it('compute pour chaque snapshot', () => {
    const snaps = [snap('2026-06-01'), snap('2026-06-02'), snap('2026-06-03')];
    const velMap = new Map([
      ['2026-06-01', vel('2026-06-01')],
      ['2026-06-02', vel('2026-06-02')],
      ['2026-06-03', vel('2026-06-03')],
    ]);
    const out = computeCompressionWindow(snaps, velMap);
    expect(out.size).toBe(3);
    expect(out.get('2026-06-01')?.classification).toBe('no_compression');
  });
});
