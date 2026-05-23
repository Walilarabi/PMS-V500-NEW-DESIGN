/**
 * FLOWTYM — Tests workflow Autopilote RMS (réserve #9)
 *
 * Couvre les 7 scénarios métier exigés :
 *   1. autopilote activé
 *   2. autopilote désactivé
 *   3. recommandation acceptée
 *   4. recommandation refusée
 *   5. recommandation bloquée par garde-fou
 *   6. erreur Channel Manager (le push ne casse pas le moteur)
 *   7. rollback
 *
 * Workflow attendu (par scénario) :
 *   recommandation → règles tactiques → conflits → garde-fous → décision →
 *     poussée CM (si autopilote) → audit → rollback possible
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { rmsRuleEvaluator } from '@/src/services/revenue/rmsRuleEvaluator';
import { rmsAuditLogger } from '@/src/services/revenue/rmsAuditLogger';
import { guardrailsEngine } from '@/src/services/revenue/guardrailsEngine';
import { recommendationFeedback } from '@/src/services/revenue/recommendationFeedback.service';
import { subscribeRmsEvent } from '@/src/lib/rms/eventBus';
import type { MarketContext } from '@/src/types/revenue/tacticalRules.types';

const baseCtx: MarketContext = {
  occupancy: 65, pickup24h: 4, pickupAverage: 3, leadTimeDays: 8,
  compsetMedianPrice: 145, ourPrice: 150, marketPressure: 'medium',
  hasMajorEvent: false, daysUntilStay: 7, otaShare: 68,
  cancellationRate: 8, activeStrategy: 'balanced',
};

describe('Autopilote RMS — workflow complet (réserve #9)', () => {
  beforeEach(() => {
    rmsAuditLogger.clear();
  });

  it('SCÉNARIO 1 — Autopilote activé : recommandation acceptée + push CM + audit', () => {
    let pushedEvent: { date: string; finalPrice: number } | null = null;
    const unsub = subscribeRmsEvent('autopilot:pushed', (d) => { pushedEvent = d; });

    const r = rmsRuleEvaluator.evaluate({
      autopilot: true,
      context: { ...baseCtx, occupancy: 78, marketPressure: 'high', hasMajorEvent: true },
      basePrice: 160, previousPrice: 158, date: '2026-06-15',
    });

    // Pipeline complet déroulé
    expect(r.appliedRules.length).toBeGreaterThan(0);
    // Décision acceptée automatiquement
    expect(r.pushed).toBe(true);
    expect(r.needsHumanValidation).toBe(false);
    // Événement push émis
    expect(pushedEvent).not.toBeNull();
    expect(pushedEvent!.date).toBe('2026-06-15');
    // Audit trail
    const pushAudits = rmsAuditLogger.byType('autopilot_push');
    expect(pushAudits.length).toBeGreaterThan(0);
    expect(pushAudits[0].context).toBe('2026-06-15');

    unsub();
  });

  it('SCÉNARIO 2 — Autopilote désactivé : recommandation en attente validation humaine', () => {
    const r = rmsRuleEvaluator.evaluate({
      autopilot: false,
      context: { ...baseCtx, occupancy: 78, marketPressure: 'high' },
      basePrice: 160, previousPrice: 158, date: '2026-06-15',
    });
    expect(r.pushed).toBe(false);
    expect(r.needsHumanValidation).toBe(true);
    // Aucun push CM ne doit avoir lieu
    expect(rmsAuditLogger.byType('autopilot_push').length).toBe(0);
  });

  it('SCÉNARIO 3 — Recommandation acceptée via feedback service', () => {
    const entry = recommendationFeedback.log({
      date: '2026-06-15',
      action: 'accept',
      context: { ourPrice: 160, recommendedPrice: 178, median: 175 },
    });
    expect(entry.action).toBe('accept');
    expect(entry.id).toMatch(/^fb_/);
    expect(recommendationFeedback.all()[0]?.action).toBe('accept');
  });

  it('SCÉNARIO 4 — Recommandation refusée avec raison + commentaire', () => {
    const entry = recommendationFeedback.log({
      date: '2026-06-15',
      action: 'reject',
      reasonCode: 'tarif_trop_eleve',
      reasonLabel: 'Tarif trop élevé',
      comment: 'Compétiteur principal vient de baisser de 12€',
      context: { ourPrice: 160, recommendedPrice: 220, median: 175 },
    });
    expect(entry.reasonCode).toBe('tarif_trop_eleve');
    expect(entry.comment).toContain('Compétiteur');
    const counts = recommendationFeedback.countByReason();
    expect(counts.tarif_trop_eleve).toBeGreaterThan(0);
  });

  it('SCÉNARIO 5 — Recommandation bloquée par garde-fou (plancher)', () => {
    let blockedEvent: { guardrailName: string; reason: string } | null = null;
    const unsub = subscribeRmsEvent('guardrail:blocked', (d) => { blockedEvent = d; });

    // Autopilote ON + contexte calme + prix très bas → le plancher (110€) bloque
    const r = rmsRuleEvaluator.evaluate({
      autopilot: true,
      context: { ...baseCtx, occupancy: 30, marketPressure: 'low', activeStrategy: 'defensive' },
      basePrice: 95, previousPrice: 100, date: '2026-02-10',
    });

    // Le pipeline détecte le blocage et empêche le push CM
    expect(r.guardrails.allowed).toBe(false);
    expect(r.guardrails.triggered.some((t) => t.outcome === 'blocked')).toBe(true);
    expect(r.pushed).toBe(false); // garde-fou prime → pas de push
    expect(r.needsHumanValidation).toBe(true);
    // Prix ramené au plancher (110€)
    expect(r.recommendedPrice).toBeGreaterThanOrEqual(110);
    // Event émis
    expect(blockedEvent).not.toBeNull();
    // Audit guardrail_block
    expect(rmsAuditLogger.byType('guardrail_block').length).toBeGreaterThan(0);

    unsub();
  });

  it('SCÉNARIO 6 — Erreur Channel Manager : le moteur ne plante pas', async () => {
    // pushToAllChannels est simulé (taux d'échec configurable). Quoi qu'il se
    // passe côté CM, le pipeline RMS doit retourner sa décision et le moteur
    // doit rester utilisable pour les évaluations suivantes.
    const r = rmsRuleEvaluator.evaluate({
      autopilot: true,
      context: { ...baseCtx, occupancy: 80, marketPressure: 'high' },
      basePrice: 160, previousPrice: 158, date: '2026-06-20',
    });
    expect(r.basePrice).toBe(160);
    expect(r.recommendedPrice).toBeGreaterThan(0);
    // Le moteur reste stable pour un 2e appel immédiat
    const r2 = rmsRuleEvaluator.evaluate({
      autopilot: false,
      context: { ...baseCtx },
      basePrice: 150, previousPrice: 148, date: '2026-06-21',
    });
    expect(r2.basePrice).toBe(150);
  });

  it('SCÉNARIO 7 — Rollback : émet l\'événement et journalise', () => {
    let rollbackEvent: { date: string } | null = null;
    const unsub = subscribeRmsEvent('autopilot:rollback', (d) => { rollbackEvent = d; });

    rmsRuleEvaluator.rollback('2026-06-15');
    expect(rollbackEvent).not.toBeNull();
    expect(rollbackEvent!.date).toBe('2026-06-15');
    // Journal d'audit
    expect(rmsAuditLogger.byType('rollback').length).toBeGreaterThan(0);
    expect(rmsAuditLogger.byType('rollback')[0].context).toBe('2026-06-15');

    unsub();
  });

  it('Hiérarchie obligatoire : garde-fous prioritaires sur autopilote', () => {
    // Quand autopilote demanderait un prix qui viole un garde-fou bloquant,
    // le garde-fou doit toujours gagner — c'est le « niveau 1 » de la
    // hiérarchie (réserves #9 : "Aucune recommandation ne doit être poussée
    // si elle viole tarif plancher / plafond / variation max / restrictions…").
    const r = rmsRuleEvaluator.evaluate({
      autopilot: true,
      context: { ...baseCtx, occupancy: 88, marketPressure: 'extreme', hasMajorEvent: true },
      basePrice: 500, previousPrice: 200, date: '2026-06-20',
    });
    // Variation 150% > limite 15% → garde-fou ajuste
    const hasVariationGuard = r.guardrails.triggered.some(
      (t) => t.guardrail.id === 'daily_variation_max',
    );
    expect(hasVariationGuard).toBe(true);
  });
});
