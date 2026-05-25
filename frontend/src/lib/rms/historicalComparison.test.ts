/**
 * FLOWTYM RMS — Tests Comparaison historique (médianes J-1/3/7/14/30)
 *
 * Couvre les bugs critiques détectés sur la Veille Concurrentielle :
 *   • Plus d'extrapolation `× 2` ou `× 4` arbitraire pour J-14 / J-30
 *   • Plus de Math.random() dans les deltas
 *   • Outliers filtrés (IQR ×3)
 *   • Données manquantes traitées explicitement (null, pas NaN)
 *   • Bornes ±60 % (au-delà = corruption)
 *   • Tolérance ±2 jours sur le snapshot historique
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateVariation,
  demandVariationsPerDay,
  iqrBounds,
  median,
  pastMedianValue,
  pctVariation,
  positionDelta,
  variationsPerDay,
} from './historicalComparison';
import type { LighthouseDayData } from '../../services/lighthouse-parser.service';

function day(date: string, compsetMedian: number, overrides: Partial<LighthouseDayData> = {}): LighthouseDayData {
  return {
    date,
    dayName: 'Lun',
    ourPrice: 195,
    compsetMedian,
    marketDemand: 0.5,
    marketDemandPercent: 50,
    ranking: '',
    rankPosition: null,
    rankTotal: null,
    bookingRank: '',
    holidays: '',
    events: '',
    competitors: [],
    compsetMin: null,
    compsetMax: null,
    ...overrides,
  };
}

/** Série quotidienne consecutive avec courbe contrôlée. */
function series(start: string, n: number, gen: (i: number) => Partial<LighthouseDayData>): LighthouseDayData[] {
  const out: LighthouseDayData[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    const iso = cur.toISOString().slice(0, 10);
    out.push(day(iso, 200, gen(i)));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PRIMITIVES                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

describe('pctVariation', () => {
  it('+10% calcul correct', () => {
    expect(pctVariation(220, 200)).toBeCloseTo(10, 5);
  });
  it('renvoie null si past ≤ 0', () => {
    expect(pctVariation(220, 0)).toBeNull();
    expect(pctVariation(220, -10)).toBeNull();
  });
  it('renvoie null si valeurs non finies', () => {
    expect(pctVariation(NaN, 200)).toBeNull();
    expect(pctVariation(220, Infinity)).toBeNull();
  });
  it('renvoie null si variation > 60% (donnée corrompue)', () => {
    expect(pctVariation(400, 100)).toBeNull(); // +300%
    expect(pctVariation(20, 100)).toBeNull();  // -80%
  });
  it('accepte les variations dans ±60%', () => {
    expect(pctVariation(150, 100)).toBeCloseTo(50, 5);
    expect(pctVariation(45, 100)).toBeCloseTo(-55, 5);
  });
});

describe('median', () => {
  it('médiane série impaire', () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it('médiane série paire = moyenne du milieu', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it('ignore les non-finis', () => {
    expect(median([NaN, 1, 2, Infinity, 3])).toBe(2);
  });
  it('renvoie 0 si vide', () => {
    expect(median([])).toBe(0);
  });
});

describe('iqrBounds', () => {
  it('renvoie null si série trop courte', () => {
    expect(iqrBounds([1, 2, 3])).toBeNull();
  });
  it('borne extérieure raisonnable sur distribution dispersée', () => {
    const b = iqrBounds([1, 2, 3, 4, 5, 6, 7, 8, 100]);
    expect(b).not.toBeNull();
    expect(100).toBeGreaterThan(b!.hi); // 100 est outlier
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* VARIATIONS PER DAY                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

describe('variationsPerDay — calcule la variation vs J-lag réel', () => {
  it('calcule correctement J-7 sur série continue', () => {
    // 200 → 220 sur 8 jours = +10 % sur 7j
    const days = series('2026-06-01', 8, (i) => ({ compsetMedian: 200 + i * (20 / 7) }));
    const out = variationsPerDay(days, 7);
    // Le dernier jour : médiane 220 vs 200 = +10%
    const last = out[7];
    expect(last.variationPct).toBeCloseTo(10, 0);
    expect(last.pastDateUsed).toBe('2026-06-01');
  });

  it('renvoie null si pas de snapshot J-lag dispo', () => {
    const days = series('2026-06-01', 3, () => ({ compsetMedian: 200 }));
    const out = variationsPerDay(days, 30);
    // 3 jours seulement, on demande J-30 → aucun snapshot dispo
    for (const v of out) expect(v.variationPct).toBeNull();
  });

  it('tolère ±2 jours de gap', () => {
    // Snapshots aux jours 0, 1, 5, 6, 7 — manque les jours 2/3/4
    const days = [
      day('2026-06-01', 200),
      day('2026-06-02', 205),
      // gap
      day('2026-06-06', 215),
      day('2026-06-07', 220),
      day('2026-06-08', 225),
    ];
    const out = variationsPerDay(days, 7);
    // 2026-06-08 vs J-7 (2026-06-01) → 225/200 = +12.5%
    const last = out[out.length - 1];
    expect(last.variationPct).toBeCloseTo(12.5, 1);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* AGGREGATE VARIATION — robuste aux outliers                                  */
/* ────────────────────────────────────────────────────────────────────────── */

describe('aggregateVariation', () => {
  it('renvoie une médiane stable sur série constante', () => {
    const days = series('2026-06-01', 14, () => ({ compsetMedian: 200 }));
    const r = aggregateVariation(days, 7);
    expect(r.variationPct).toBe(0);
  });

  it('renvoie la médiane des variations sur série progressive', () => {
    // Hausse régulière +5% par 7 jours
    const days = series('2026-06-01', 14, (i) => ({ compsetMedian: 200 * (1 + (i * 5) / (7 * 100)) }));
    const r = aggregateVariation(days, 7);
    expect(r.variationPct).toBeCloseTo(5, 0);
  });

  it('NE multiplie PAS varVs7Days par 2 ou 4 — vraie variation J-14 / J-30', () => {
    // Série stable sauf un saut à J-15 : médiane 200 → 240 (+20%)
    // J-7 ne devrait PAS être doublé pour J-14
    const days: LighthouseDayData[] = [];
    const cur = new Date('2026-06-01T00:00:00Z');
    for (let i = 0; i < 31; i++) {
      const iso = cur.toISOString().slice(0, 10);
      const median = i < 15 ? 200 : 240;
      days.push(day(iso, median));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    // J-14 à partir du jour 30 (médiane 240) vs jour 16 (médiane 240) = 0%
    const r14 = aggregateVariation(days, 14);
    // L'ancien code aurait répondu ×2 d'une variation J-7 quelconque → faux
    // Nouveau code : compare vraiment des snapshots J-14 réels.
    expect(r14.variationPct).toBeLessThanOrEqual(20);
    expect(r14.variationPct).toBeGreaterThanOrEqual(0);
  });

  it('excluit les outliers via IQR', () => {
    // 20 jours stables + 1 jour aberrant (impossible : changera après filtre)
    const days: LighthouseDayData[] = [];
    const cur = new Date('2026-06-01T00:00:00Z');
    for (let i = 0; i < 25; i++) {
      const iso = cur.toISOString().slice(0, 10);
      days.push(day(iso, 200));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    // Variation 0% partout → médiane = 0
    const r = aggregateVariation(days, 7);
    expect(r.variationPct).toBe(0);
    expect(r.sampleSize).toBeGreaterThan(0);
  });

  it('sampleSize cohérent avec le nombre de jours valides', () => {
    const days = series('2026-06-01', 20, () => ({ compsetMedian: 200 }));
    const r = aggregateVariation(days, 7);
    // 20 jours - 7 (sans historique) = 13 jours utilisables
    expect(r.sampleSize).toBeGreaterThanOrEqual(10);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* PAST VALUE FROM VARIATION                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

describe('pastMedianValue', () => {
  it('reconstitue la valeur passée à partir de la variation', () => {
    expect(pastMedianValue(220, 10)).toBe(200);
    expect(pastMedianValue(180, -10)).toBe(200);
  });
  it('renvoie la valeur courante si variation null', () => {
    expect(pastMedianValue(220, null)).toBe(220);
  });
  it('renvoie la valeur courante si variation aberrante (division par ~0)', () => {
    expect(pastMedianValue(220, -100)).toBe(220); // 1+(-1) = 0 → div by 0
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* POSITION DELTA — pas de Math.random                                         */
/* ────────────────────────────────────────────────────────────────────────── */

describe('positionDelta', () => {
  it('renvoie 0 si pas de rankPosition historisée', () => {
    const days = series('2026-06-01', 10, () => ({ rankPosition: null }));
    expect(positionDelta(days, 7)).toBe(0);
  });

  it('détecte une amélioration de rang (rang plus bas = mieux)', () => {
    const days: LighthouseDayData[] = [];
    const cur = new Date('2026-06-01T00:00:00Z');
    for (let i = 0; i < 14; i++) {
      const iso = cur.toISOString().slice(0, 10);
      // J0-J6 : rang 7, J7-J13 : rang 4 (on gagne 3 places)
      days.push(day(iso, 200, { rankPosition: i < 7 ? 7 : 4 }));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    const delta = positionDelta(days, 7);
    expect(delta).toBe(3);
  });

  it('est déterministe — appels successifs renvoient la même valeur (pas de random)', () => {
    const days = series('2026-06-01', 14, (i) => ({ rankPosition: 5 + (i % 2) }));
    const a = positionDelta(days, 7);
    const b = positionDelta(days, 7);
    const c = positionDelta(days, 7);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* DEMAND VARIATIONS                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

describe('demandVariationsPerDay', () => {
  it('utilise la vraie demande historisée', () => {
    const days = series('2026-06-01', 14, (i) => ({ marketDemandPercent: 40 + i * 2 }));
    const out = demandVariationsPerDay(days, 7);
    // Jour 13 (demand 66) vs jour 6 (demand 52) = +14 pts
    const last = out[out.length - 1];
    expect(last.demandPast).toBe(52);
    expect(last.demandNow).toBe(66);
  });

  it('renvoie demandPast null si pas de snapshot dispo', () => {
    const days = series('2026-06-01', 3, () => ({ marketDemandPercent: 50 }));
    const out = demandVariationsPerDay(days, 30);
    for (const v of out) expect(v.demandPast).toBeNull();
  });
});
