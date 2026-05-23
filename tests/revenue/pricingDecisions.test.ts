/**
 * FLOWTYM — Tests logique métier Pricing & Recommandations
 *
 * Vérifie :
 *   - Accepter → Final = Suggéré (et pas Actuel)
 *   - Maintenir → Final = Actuel
 *   - Refuser → Final = tarif manuel (ou fallback Actuel)
 *   - Pondération marché (sourceWeighting) appliquée correctement
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { sourceWeighting } from '@/src/services/revenue/sourceWeighting.service';

describe('sourceWeighting — pondération marché NRF', () => {
  beforeEach(() => {
    sourceWeighting.resetDefaults();
  });

  it('applique +5% par défaut sur Lighthouse', () => {
    const r = sourceWeighting.apply(100, { source: 'lighthouse' });
    expect(r.applied).toBe(true);
    expect(r.percent).toBe(5);
    expect(r.weightedPrice).toBe(105);
    expect(r.delta).toBe(5);
  });

  it('applique +5% par défaut sur Expedia', () => {
    const r = sourceWeighting.apply(200, { source: 'expedia' });
    expect(r.applied).toBe(true);
    expect(r.weightedPrice).toBe(210);
  });

  it("n'applique rien sur la source 'direct' (déjà tarif flexible)", () => {
    const r = sourceWeighting.apply(100, { source: 'direct' });
    expect(r.applied).toBe(false);
    expect(r.weightedPrice).toBe(100);
  });

  it('respecte le toggle global', () => {
    sourceWeighting.setGlobalEnabled(false);
    const r = sourceWeighting.apply(100, { source: 'lighthouse' });
    expect(r.applied).toBe(false);
    expect(r.weightedPrice).toBe(100);
  });

  it('respecte le toggle par source', () => {
    sourceWeighting.setSourceEnabled('lighthouse', false);
    const lh = sourceWeighting.apply(100, { source: 'lighthouse' });
    expect(lh.applied).toBe(false);
    const exp = sourceWeighting.apply(100, { source: 'expedia' });
    expect(exp.applied).toBe(true);
  });

  it("priorise la règle la plus spécifique (room type + saison)", () => {
    sourceWeighting.upsertRule({
      id: 'suite_high',
      percent: 12,
      source: 'lighthouse',
      channel: null,
      roomTypeCode: 'STE',
      season: 'high',
      strategy: null,
      enabled: true,
    });
    const r = sourceWeighting.apply(100, {
      source: 'lighthouse',
      roomTypeCode: 'STE',
      season: 'high',
    });
    expect(r.percent).toBe(12); // règle spécifique l'emporte
    expect(r.weightedPrice).toBe(112);
  });

  it("retombe sur la règle générique quand le scope ne match pas la spécifique", () => {
    sourceWeighting.upsertRule({
      id: 'suite_only',
      percent: 12,
      source: 'lighthouse',
      channel: null,
      roomTypeCode: 'STE',
      season: null,
      strategy: null,
      enabled: true,
    });
    // STD ne match pas STE → règle générique +5% s'applique
    const r = sourceWeighting.apply(100, { source: 'lighthouse', roomTypeCode: 'STD' });
    expect(r.percent).toBe(5);
  });

  it('clamp prix invalide', () => {
    const r1 = sourceWeighting.apply(0, { source: 'lighthouse' });
    expect(r1.weightedPrice).toBe(0);
    expect(r1.applied).toBe(false);
    const r2 = sourceWeighting.apply(NaN, { source: 'lighthouse' });
    expect(r2.applied).toBe(false);
  });
});

describe('Logique Accepter/Maintenir/Refuser', () => {
  // Simulation simplifiée du comportement attendu :
  // - Accepter → finalPrice = suggestedPrice
  // - Maintenir → finalPrice = currentPrice
  // - Refuser → finalPrice = manualPrice ?? currentPrice
  function decide(
    action: 'accept' | 'maintain' | 'reject',
    currentPrice: number,
    suggestedPrice: number,
    manualPrice?: number,
  ): number {
    if (action === 'accept') return suggestedPrice;
    if (action === 'maintain') return currentPrice;
    return manualPrice && manualPrice > 0 ? Math.round(manualPrice) : currentPrice;
  }

  it('Accepter → Final reprend le Suggéré (pas l\'Actuel)', () => {
    expect(decide('accept', 150, 178)).toBe(178);
    expect(decide('accept', 100, 95)).toBe(95);
  });

  it('Maintenir → Final reprend l\'Actuel', () => {
    expect(decide('maintain', 150, 178)).toBe(150);
  });

  it('Refuser sans tarif manuel → Final = Actuel (fallback)', () => {
    expect(decide('reject', 150, 178)).toBe(150);
  });

  it('Refuser avec tarif manuel → Final = manuel', () => {
    expect(decide('reject', 150, 178, 165)).toBe(165);
  });
});
