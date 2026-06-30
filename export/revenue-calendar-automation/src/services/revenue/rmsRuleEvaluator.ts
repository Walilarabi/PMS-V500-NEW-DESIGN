/**
 * FLOWTYM — Moteur d'évaluation RMS de bout en bout
 *
 * Flux :
 *   1. Collecte du contexte marché
 *   2. Stratégie globale (cadre)
 *   3. Règles tactiques (intentions contextuelles)
 *   4. Détection conflits + résolution par priorité
 *   5. Application garde-fous RMS (couche absolue)
 *   6. Production recommandation finale
 *   7. Push autopilote ou validation humaine
 *   8. Journalisation complète (rollback possible)
 */

import type { MarketContext } from '@/src/types/revenue/tacticalRules.types';
import { tacticalRulesEngine, type RuleEvaluation } from './tacticalRulesEngine';
import { guardrailsEngine, type GuardrailVerdict } from './guardrailsEngine';
import { priorityConflictEngine } from './priorityConflictEngine';
import { rmsAuditLogger } from './rmsAuditLogger';
import { emitRmsEvent } from '@/src/lib/rms/eventBus';
import { pushToAllChannels } from '@/src/services/channel-manager.service';

export interface FinalRecommendation {
  basePrice: number;
  recommendedPrice: number;
  appliedRules: { ruleId: string; ruleName: string; reason: string; magnitude: number }[];
  suppressedRules: { ruleId: string; ruleName: string; reason: string }[];
  guardrails: GuardrailVerdict;
  needsHumanValidation: boolean;
  pushed: boolean;
  explanation: string;
}

export interface EvaluationOptions {
  autopilot: boolean;
  context: MarketContext;
  basePrice: number;
  previousPrice: number;
  date: string;
  /**
   * Mode "prévision" : désactive le journal d'audit et les émissions sur le
   * bus. Utile quand on évalue en boucle pour générer un forecast (30 jours)
   * où chaque log coûterait un appel Supabase qui pourrait échouer en cascade.
   */
  silent?: boolean;
}

export const rmsRuleEvaluator = {
  /**
   * Évalue la totalité du flux RMS et retourne la recommandation finale.
   */
  evaluate(opts: EvaluationOptions): FinalRecommendation {
    const { context, basePrice, previousPrice, autopilot, date, silent = false } = opts;

    // 1. Évalue toutes les règles tactiques
    const evaluations: RuleEvaluation[] = tacticalRulesEngine.evaluate(context);
    const fired = evaluations.filter((e) => e.fired);

    // 2. Trie par priorité (1 = plus haute)
    fired.sort((a, b) => a.rule.priority - b.rule.priority);

    // 3. Calcul du prix proposé en cumulant les magnitudes des règles supérieures
    let proposedPrice = basePrice;
    const applied: FinalRecommendation['appliedRules'] = [];
    const suppressed: FinalRecommendation['suppressedRules'] = [];

    let directionLock: 'up' | 'down' | null = null;
    let winningRule: { id: string; name: string; priority: number } | null = null;

    // Seules les actions qui touchent au prix doivent peser sur la
    // proposition tarifaire. Les autres (min_stay, ota_limit, cta, block)
    // sont des actions opérationnelles, pas tarifaires.
    const PRICE_ACTION_TYPES = new Set(['price_up', 'price_down', 'open_promo', 'close_promo']);

    for (const ev of fired) {
      const dominantMagnitude = ev.rule.actions
        .filter((a) => PRICE_ACTION_TYPES.has(a.type))
        .map((a) => a.magnitude ?? 0)
        .reduce((s, x) => s + x, 0);
      const direction = dominantMagnitude > 0 ? 'up' : dominantMagnitude < 0 ? 'down' : null;

      // Priorité supérieure verrouille la direction → règles inférieures
      // contraires sont suspendues (anti-oscillation)
      if (direction && directionLock && direction !== directionLock) {
        suppressed.push({
          ruleId: ev.rule.id,
          ruleName: ev.rule.name,
          reason: `Suspendue par règle de priorité supérieure (direction ${directionLock})`,
        });
        if (!silent) {
          rmsAuditLogger.log({
            type: 'conflict_resolved',
            actor: ev.rule.name,
            context: date,
            detail: `Suspendue : direction ${direction} ≠ ${directionLock}`,
          });
        }
        // Enregistre le conflit runtime dans le moteur de priorités
        if (winningRule && !silent) {
          priorityConflictEngine.recordRuntimeConflict({
            winner: { ...winningRule, intent: directionLock === 'up' ? 'Hausse prix' : 'Baisse prix' },
            suspended: {
              id: ev.rule.id,
              name: ev.rule.name,
              priority: ev.rule.priority,
              intent: direction === 'up' ? 'Hausse prix' : 'Baisse prix',
            },
            impact: Math.round(ev.rule.revenueImpact30d / 30),
            date,
          });
        }
        continue;
      }
      if (direction && !directionLock) {
        directionLock = direction;
        winningRule = { id: ev.rule.id, name: ev.rule.name, priority: ev.rule.priority };
      }

      proposedPrice = proposedPrice * (1 + dominantMagnitude);
      applied.push({
        ruleId: ev.rule.id,
        ruleName: ev.rule.name,
        reason: ev.matchedTriggers.join(' • '),
        magnitude: dominantMagnitude,
      });
      if (!silent) {
        rmsAuditLogger.log({
          type: 'rule_triggered',
          actor: ev.rule.name,
          context: date,
          detail: ev.explanation,
          impact: (proposedPrice - basePrice) * 0.8,
        });
      }
    }

    proposedPrice = Math.round(proposedPrice);

    // 4. Couche garde-fous absolue
    const verdict = guardrailsEngine.evaluate({
      price: proposedPrice,
      previousPrice,
      occupancy: context.occupancy,
      source: autopilot ? 'autopilot' : 'rule',
      context: date,
    });

    const finalPrice = Math.round(verdict.finalPrice);

    // 5. Décision push autopilote / validation humaine
    const blockedByGuardrail = verdict.triggered.some((t) => t.outcome === 'blocked');
    const needsHuman = blockedByGuardrail || !autopilot;
    const pushed = autopilot && !blockedByGuardrail;

    if (pushed && !silent) {
      rmsAuditLogger.log({
        type: 'autopilot_push',
        actor: 'Autopilote RMS',
        context: date,
        detail: `Prix poussé : ${finalPrice}€ (base ${basePrice}€)`,
        impact: finalPrice - basePrice,
      });
      try {
        emitRmsEvent('autopilot:pushed', {
          date,
          basePrice,
          finalPrice,
          appliedRules: applied.map((a) => a.ruleName),
        });
      } catch {/* bus */}
      // Push effectif vers le Channel Manager (asynchrone, non bloquant)
      pushToAllChannels({
        date,
        roomTypeId: 'STD',
        planId: 'BAR',
        price: finalPrice,
      }).catch(() => {/* loggé par le service CM */});
    }

    if (!silent) try {
      emitRmsEvent('recommendation:produced', {
        date,
        basePrice,
        finalPrice,
        needsHumanValidation: needsHuman,
      });
    } catch {/* bus */}

    const explanation = [
      `Base ${basePrice}€`,
      applied.length ? `Règles : ${applied.map((a) => a.ruleName).join(', ')}` : 'Aucune règle déclenchée',
      verdict.triggered.length ? `Garde-fous : ${verdict.triggered.map((t) => t.guardrail.name).join(', ')}` : 'Aucun garde-fou déclenché',
      `Final ${finalPrice}€`,
      pushed ? 'Poussé via autopilote' : needsHuman ? 'En attente de validation humaine' : 'Recommandation prête',
    ].join(' • ');

    return {
      basePrice,
      recommendedPrice: finalPrice,
      appliedRules: applied,
      suppressedRules: suppressed,
      guardrails: verdict,
      needsHumanValidation: needsHuman,
      pushed,
      explanation,
    };
  },

  /** Rollback de la dernière action autopilote pour une date. */
  rollback(date: string) {
    rmsAuditLogger.log({
      type: 'rollback',
      actor: 'Autopilote RMS',
      context: date,
      detail: 'Rollback déclenché manuellement',
    });
    try { emitRmsEvent('autopilot:rollback', { date }); } catch {/* bus */}
  },

  hierarchy() { return priorityConflictEngine.hierarchy(); },
};
