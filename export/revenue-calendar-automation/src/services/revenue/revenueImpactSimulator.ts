/**
 * FLOWTYM — Simulateur d'impact revenu
 * Estime l'effet d'une règle, d'un garde-fou ou d'un changement de priorité.
 */

import type { TacticalRule, MarketContext } from '@/src/types/revenue/tacticalRules.types';

export interface SimulationOutput {
  revparDelta: number;
  adrDelta: number;
  occupancyDelta: number;
  revenueDelta: number;
  daysImpacted: number;
  confidence: number;
}

export const revenueImpactSimulator = {
  simulateRule(rule: TacticalRule, ctx: MarketContext): SimulationOutput {
    const intensity = rule.actions.reduce((s, a) => s + Math.abs(a.magnitude ?? 0.05), 0);
    const triggered = rule.triggers.length;
    const base = rule.iaConfidence / 100;
    const revparDelta = Math.round(intensity * 100 * base * (ctx.marketPressure === 'high' ? 1.3 : 1));
    return {
      revparDelta,
      adrDelta: Number((intensity * (rule.category === 'pricing' ? 3 : 1)).toFixed(1)),
      occupancyDelta: Number((intensity * (rule.category === 'demand' ? 2 : 0.5)).toFixed(1)),
      revenueDelta: Math.round(revparDelta * 80 * triggered),
      daysImpacted: rule.triggersCount30d,
      confidence: rule.iaConfidence,
    };
  },

  simulatePriorityChange(_ruleId: string, from: number, to: number): SimulationOutput {
    const delta = from - to;
    return {
      revparDelta: Math.round(delta * 280),
      adrDelta: Number((delta * 0.6).toFixed(1)),
      occupancyDelta: Number((delta * 0.4).toFixed(1)),
      revenueDelta: Math.round(delta * 1420),
      daysImpacted: 30,
      confidence: 84,
    };
  },
};
