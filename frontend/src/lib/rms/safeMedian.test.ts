/**
 * FLOWTYM RMS — Tests de la médiane robuste.
 *
 * Couvre les cas du bug Phase 4 :
 *   • exclusion des hôtels fermés / sold out / unavailable
 *   • exclusion des tarifs ≤ 0 / null / NaN
 *   • détection des outliers (Tukey 1.5×IQR)
 *   • clamp anti-division-par-zéro dans safePastValueFromVariation
 *   • fallback "Indisponible" si dataset vide
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));

import {
  computeSafeCompsetMedian,
  safePastValueFromVariation,
} from './safeMedian';

describe('computeSafeCompsetMedian — cas nominal', () => {
  it('calcule la médiane sur 3 hôtels valides', () => {
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 100 },
      { id: 'h2', price: 150 },
      { id: 'h3', price: 200 },
    ]);
    expect(r.median).toBe(150);
    expect(r.sampleSize).toBe(3);
    expect(r.totalCandidates).toBe(3);
    expect(r.excluded).toHaveLength(0);
  });

  it('calcule la médiane pour un nombre pair (moyenne des 2 milieux)', () => {
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 100 },
      { id: 'h2', price: 200 },
    ]);
    expect(r.median).toBe(150);
  });
});

describe('computeSafeCompsetMedian — exclusions', () => {
  it('exclut les hôtels fermés (status=closed)', () => {
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 100, status: 'open' },
      { id: 'h2', price: 999, status: 'closed' },
      { id: 'h3', price: 200, status: 'open' },
    ]);
    expect(r.median).toBe(150); // (100 + 200) / 2
    expect(r.sampleSize).toBe(2);
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0].reason).toContain('closed');
  });

  it('exclut les états sold_out / épuisé / indisponible', () => {
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 100 },
      { id: 'h2', price: 999, status: 'sold_out' },
      { id: 'h3', price: 999, status: 'épuisé' },
      { id: 'h4', price: 999, status: 'indisponible' },
      { id: 'h5', price: 200 },
    ]);
    expect(r.sampleSize).toBe(2);
    expect(r.excluded).toHaveLength(3);
  });

  it('exclut available=false même si prix valide', () => {
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 100, available: true },
      { id: 'h2', price: 999, available: false },
      { id: 'h3', price: 200 },
    ]);
    expect(r.median).toBe(150);
    expect(r.sampleSize).toBe(2);
  });

  it('exclut les tarifs ≤ 0 / null / NaN / Infinity', () => {
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 100 },
      { id: 'h2', price: 0 },
      { id: 'h3', price: -50 },
      { id: 'h4', price: null },
      { id: 'h5', price: undefined },
      { id: 'h6', price: NaN },
      { id: 'h7', price: Infinity },
      { id: 'h8', price: 200 },
    ]);
    expect(r.median).toBe(150);
    expect(r.sampleSize).toBe(2);
    expect(r.excluded.length).toBeGreaterThanOrEqual(5);
  });

  it("exclut les tarifs sous le plancher 50€ (suspect d'erreur d'import)", () => {
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 100 },
      { id: 'h2', price: 10 },
      { id: 'h3', price: 200 },
    ]);
    expect(r.median).toBe(150);
    expect(r.excluded).toHaveLength(1);
  });

  it("exclut les tarifs au-dessus de 100 000€ ('no bid')", () => {
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 100 },
      { id: 'h2', price: 200_000 },
      { id: 'h3', price: 200 },
    ]);
    expect(r.median).toBe(150);
    expect(r.excluded[0].reason).toContain('>100000€');
  });
});

describe('computeSafeCompsetMedian — fallback Indisponible', () => {
  it("retourne null + reason si tous les hôtels sont exclus", () => {
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 999, status: 'closed' },
      { id: 'h2', price: 0 },
      { id: 'h3', price: null },
    ]);
    expect(r.median).toBeNull();
    expect(r.sampleSize).toBe(0);
    expect(r.reason).toBe('all_excluded');
  });

  it('retourne null + reason si dataset vide', () => {
    const r = computeSafeCompsetMedian([]);
    expect(r.median).toBeNull();
    expect(r.reason).toBe('no_competitors');
  });
});

describe('computeSafeCompsetMedian — anti-aberrants (Tukey)', () => {
  it('exclut les outliers extrêmes via Tukey 1.5×IQR', () => {
    // 7 valeurs normales serrées + 1 aberrante (200x supérieur)
    // → IQR petit, l'aberrant tombe loin au-delà de Q3 + 1.5×IQR
    const r = computeSafeCompsetMedian([
      { id: 'h1', price: 100 },
      { id: 'h2', price: 105 },
      { id: 'h3', price: 110 },
      { id: 'h4', price: 115 },
      { id: 'h5', price: 120 },
      { id: 'h6', price: 125 },
      { id: 'h7', price: 130 },
      { id: 'h8', price: 50_000 }, // aberrant
    ]);
    expect(r.median).toBeLessThan(150); // sans l'outlier
    expect(r.excluded.some((e) => e.reason.includes('outlier'))).toBe(true);
  });

  it("peut désactiver le filtre outliers via options", () => {
    const r = computeSafeCompsetMedian(
      [
        { id: 'h1', price: 100 },
        { id: 'h2', price: 110 },
        { id: 'h3', price: 120 },
        { id: 'h4', price: 130 },
        { id: 'h5', price: 5000 },
      ],
      { excludeOutliers: false },
    );
    expect(r.sampleSize).toBe(5); // outlier conservé
  });
});

describe('computeSafeCompsetMedian — logger callback', () => {
  it('appelle le logger fourni avec le résultat', () => {
    const calls: unknown[] = [];
    computeSafeCompsetMedian(
      [{ id: 'h1', price: 100 }],
      { logger: (msg, ctx) => calls.push({ msg, ctx }) },
    );
    expect(calls).toHaveLength(1);
  });
});

describe('safePastValueFromVariation', () => {
  it('calcule correctement pour une variation positive', () => {
    expect(safePastValueFromVariation(220, 10)).toBe(200); // 220 / 1.1
  });

  it('calcule correctement pour une variation négative raisonnable', () => {
    expect(safePastValueFromVariation(180, -10)).toBe(200); // 180 / 0.9
  });

  it('clamp variation ≥ -99% (empêche division par zéro)', () => {
    const v = safePastValueFromVariation(100, -100);
    expect(v).toBeGreaterThan(0);
    expect(Number.isFinite(v!)).toBe(true);
  });

  it('clamp variation très négative (-200%) → reste positif', () => {
    const v = safePastValueFromVariation(100, -200);
    expect(v).toBeGreaterThan(0);
  });

  it('retourne null si current ≤ 0', () => {
    expect(safePastValueFromVariation(0, 10)).toBeNull();
    expect(safePastValueFromVariation(-50, 10)).toBeNull();
  });

  it('retourne null si variation invalide', () => {
    expect(safePastValueFromVariation(100, null)).toBeNull();
    expect(safePastValueFromVariation(100, undefined)).toBeNull();
    expect(safePastValueFromVariation(100, NaN)).toBeNull();
  });
});
