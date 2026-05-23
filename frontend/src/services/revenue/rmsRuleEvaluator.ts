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
}

export const rmsRuleEvaluator = {
  /**
   * Évalue la totalité du flux RMS et retourne la recommandation finale.
   */
  evaluate(opts: EvaluationOptions): FinalRecommendation {
    const { context, basePrice, previousPrice, autopilot, date } = opts;

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

    for (const ev of fired) {
      const dominantMagnitude = ev.rule.actions
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
        rmsAuditLogger.log({
          type: 'conflict_resolved',
          actor: ev.rule.name,
          context: date,
          detail: `Suspendue : direction ${direction} ≠ ${directionLock}`,
        });
        continue;
      }
      if (direction && !directionLock) directionLock = direction;

      proposedPrice = proposedPrice * (1 + dominantMagnitude);
      applied.push({
        ruleId: ev.rule.id,
        ruleName: ev.rule.name,
        reason: ev.matchedTriggers.join(' • '),
        magnitude: dominantMagnitude,
      });
      rmsAuditLogger.log({
        type: 'rule_triggered',
        actor: ev.rule.name,
        context: date,
        detail: ev.explanation,
        impact: (proposedPrice - basePrice) * 0.8,
      });
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

    if (pushed) {
      rmsAuditLogger.log({
        type: 'autopilot_push',
        actor: 'Autopilote RMS',
        context: date,
        detail: `Prix poussé : ${finalPrice}€ (base ${basePrice}€)`,
        impact: finalPrice - basePrice,
      });
    }

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
  },

  hierarchy() { return priorityConflictEngine.hierarchy(); },
};
