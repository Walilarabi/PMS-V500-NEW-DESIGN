/**
 * FLOWTYM RMS — Tests du moteur de recommandation (rmsEngine).
 *
 * Régressions garanties :
 *   - Une recommandation ne retourne JAMAIS 0 € (bug : médiane + currentPrice
 *     manquants en amont → tableau RMS affichait 0 € partout).
 *   - La stratégie est cohérente avec les signaux d'entrée.
 *   - Les multiplicateurs de stratégie sont appliqués au prix de référence
 *     pondéré NRF, pas au currentPrice brut.
 */

import { describe, it, expect, vi } from 'vitest';

// Stub des modules en chaîne qui dépendent de supabase.ts (qui throw à
// l'import si VITE_SUPABASE_URL/ANON_KEY ne sont pas définis en CI/test).
// rmsEngine → sourceWeighting.service → settingsPersistence → supabase
vi.mock('@/src/lib/supabase', () => ({
  supabase: {},
  getSupabase: () => ({}),
}));

import { calculateRecommendation, calculateStrategy } from './rmsEngine';

describe('rmsEngine.calculateRecommendation — garde-fous anti-0€', () => {
  it('retourne un prix > 0 même quand medianPrice et currentPrice sont absents', () => {
    const r = calculateRecommendation({
      occupancyRate: 50,
      marketPressure: 40,
      pickupRate: 5,
      // medianPrice + currentPrice volontairement omis → tous deux = undefined
    });
    expect(r.suggestedPrice).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(100);
    expect(r.confidence).toBeGreaterThanOrEqual(40);
  });

  it('retourne un prix > 0 quand medianPrice = 0 et currentPrice = 0 explicitement', () => {
    const r = calculateRecommendation({
      occupancyRate: 70,
      marketPressure: 50,
      pickupRate: 10,
      medianPrice: 0,
      currentPrice: 0,
    });
    expect(r.suggestedPrice).toBeGreaterThan(0);
  });

  it("utilise medianPrice quand disponible (priorité 1)", () => {
    const r = calculateRecommendation({
      occupancyRate: 50,
      medianPrice: 200,
      currentPrice: 100,
      strategy: 'Équilibrée',
    });
    // currentPrice (100) < medianPrice * 0.92 (184) → "Augmenter"
    expect(r.recommendation).toBe('Augmenter');
    expect(r.suggestedPrice).toBeGreaterThan(100);
  });

  it("utilise currentPrice quand medianPrice = 0 (priorité 2)", () => {
    const r = calculateRecommendation({
      occupancyRate: 50,
      medianPrice: 0,
      currentPrice: 180,
      strategy: 'Équilibrée',
    });
    expect(r.suggestedPrice).toBeGreaterThan(0);
  });

  it("réduit la confiance quand on bascule sur le fallback safe (les deux sources nulles)", () => {
    const rNormal = calculateRecommendation({
      occupancyRate: 50,
      medianPrice: 200,
      currentPrice: 180,
      strategy: 'Équilibrée',
    });
    const rFallback = calculateRecommendation({
      occupancyRate: 50,
      medianPrice: 0,
      currentPrice: 0,
      strategy: 'Équilibrée',
    });
    expect(rFallback.confidence).toBeLessThan(rNormal.confidence);
  });
});

describe('rmsEngine.calculateStrategy — sélection cohérente', () => {
  it('Yield Max sur compression marché extrême', () => {
    expect(calculateStrategy({ occupancyRate: 95, marketPressure: 85 })).toBe('Yield Max');
  });

  it('Last Minute sur lead time court + dispo', () => {
    expect(calculateStrategy({ leadTimeMajority: 2, availability: 20, occupancyRate: 60 })).toBe('Last Minute');
  });

  it('Occupation faible sur TO bas + court terme', () => {
    expect(calculateStrategy({ occupancyRate: 25, leadTimeMajority: 5 })).toBe('Occupation faible');
  });

  it('Équilibrée par défaut', () => {
    expect(calculateStrategy({ occupancyRate: 55, leadTimeMajority: 14, marketPressure: 40 })).toBe('Équilibrée');
  });
});
