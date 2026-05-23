/**
 * FLOWTYM — Tests Central Pricing Engine
 *
 * Vérifie qu'une décision prise dans un module est immédiatement
 * visible et identique dans tous les autres.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { centralPricingEngine } from '@/src/services/revenue/centralPricingEngine.service';

const DATE = '2026-05-28';

describe('centralPricingEngine — source de vérité unique', () => {
  beforeEach(() => centralPricingEngine.clear());

  it('getOrSeed crée un record neuf en mode pending', () => {
    const r = centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    expect(r.date).toBe(DATE);
    expect(r.currentPrice).toBe(200);
    expect(r.suggestedPrice).toBe(459);
    expect(r.finalPrice).toBeNull();
    expect(r.status).toBe('pending');
    expect(r.history).toHaveLength(1);
  });

  it('getOrSeed idempotent : ne crée pas en double', () => {
    centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    expect(centralPricingEngine.all()).toHaveLength(1);
  });

  it('getOrSeed met à jour le suggested si pending et nouvelle valeur', () => {
    centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    const r2 = centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 470 });
    expect(r2.suggestedPrice).toBe(470);
    expect(r2.history.length).toBeGreaterThan(1);
  });

  it('accept depuis Veille : visible identique dans RMS table', () => {
    // Veille crée et accepte
    centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    const accepted = centralPricingEngine.accept(DATE, { source: 'veille' });
    expect(accepted?.status).toBe('accepted');
    expect(accepted?.finalPrice).toBe(459);
    expect(accepted?.source).toBe('veille');

    // RMS table lit la même chose
    const fromTable = centralPricingEngine.get(DATE);
    expect(fromTable?.status).toBe('accepted');
    expect(fromTable?.finalPrice).toBe(459);
  });

  it('reject avec tarif manuel : Final = manuel partout', () => {
    centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    const rejected = centralPricingEngine.reject(DATE, {
      source: 'veille',
      manualPrice: 420,
      reason: 'Tarif trop élevé',
      comment: 'Compset moins agressif',
    });
    expect(rejected?.status).toBe('rejected');
    expect(rejected?.finalPrice).toBe(420);
    expect(rejected?.reason).toBe('Tarif trop élevé');
    expect(rejected?.comment).toBe('Compset moins agressif');
  });

  it('maintain depuis RMS table : Final = currentPrice', () => {
    centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    const m = centralPricingEngine.maintain(DATE, { source: 'rms-table' });
    expect(m?.status).toBe('maintained');
    expect(m?.finalPrice).toBe(200);
  });

  it('historique conservé : create → accept → ré-accept (idempotent)', () => {
    centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    centralPricingEngine.accept(DATE, { source: 'veille' });
    centralPricingEngine.accept(DATE, { source: 'rms-table' });
    const r = centralPricingEngine.get(DATE);
    expect(r?.history.length).toBeGreaterThanOrEqual(3);
    expect(r?.source).toBe('rms-table'); // dernier qui a écrit
  });

  it('subscribe notifie les listeners à chaque mutation', () => {
    let count = 0;
    const unsub = centralPricingEngine.subscribe(() => { count++; });
    centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    centralPricingEngine.accept(DATE, { source: 'veille' });
    expect(count).toBeGreaterThanOrEqual(2);
    unsub();
  });

  it('kpis agrège correctement', () => {
    centralPricingEngine.getOrSeed('2026-05-28', { current: 200, suggested: 459 });
    centralPricingEngine.getOrSeed('2026-05-29', { current: 200, suggested: 250 });
    centralPricingEngine.getOrSeed('2026-05-30', { current: 200, suggested: 300 });
    centralPricingEngine.accept('2026-05-28', { source: 'veille' });
    centralPricingEngine.reject('2026-05-29', { source: 'rms-table', manualPrice: 220 });
    centralPricingEngine.maintain('2026-05-30', { source: 'calendar' });

    const k = centralPricingEngine.kpis();
    expect(k.total).toBe(3);
    expect(k.accepted).toBe(1);
    expect(k.rejected).toBe(1);
    expect(k.maintained).toBe(1);
    expect(k.pending).toBe(0);
    // Impact = (459-200) + (220-200) + (200-200) = 259 + 20 + 0 = 279
    expect(k.revenueImpact).toBe(279);
  });

  it('cas typique du brief utilisateur : 459€ identique partout', () => {
    // Veille accepte 459€ pour le 28/05
    centralPricingEngine.getOrSeed(DATE, { current: 200, suggested: 459 });
    centralPricingEngine.accept(DATE, { source: 'veille' });

    // Tableau RMS lit
    const fromRmsTable = centralPricingEngine.get(DATE);
    // Analyse RM lit
    const fromAnalyse = centralPricingEngine.get(DATE);
    // Recommandations RM lit
    const fromReco = centralPricingEngine.get(DATE);
    // Calendrier lit
    const fromCalendar = centralPricingEngine.get(DATE);

    // Tous voient le même prix final
    expect(fromRmsTable?.finalPrice).toBe(459);
    expect(fromAnalyse?.finalPrice).toBe(459);
    expect(fromReco?.finalPrice).toBe(459);
    expect(fromCalendar?.finalPrice).toBe(459);
    // Tous voient le même statut
    expect(fromRmsTable?.status).toBe('accepted');
    expect(fromAnalyse?.status).toBe('accepted');
    expect(fromReco?.status).toBe('accepted');
    expect(fromCalendar?.status).toBe('accepted');
  });
});
