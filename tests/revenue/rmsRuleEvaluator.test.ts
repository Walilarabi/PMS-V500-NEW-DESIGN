/**
 * FLOWTYM — Tests pipeline rmsRuleEvaluator (end-to-end)
 *
 * Valide les 4 scénarios métier :
 *   1. Contexte calme  → règles minimales
 *   2. Compression marché + événement → multi-règles, conflit anti-oscillation
 *   3. Prix < plancher → garde-fou bloque
 *   4. Autopilote ON → push + audit
 */
import { describe, it, expect } from 'vitest';
import { rmsRuleEvaluator } from '@/src/services/revenue/rmsRuleEvaluator';
import { rmsAuditLogger } from '@/src/services/revenue/rmsAuditLogger';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import { subscribeRmsEvent } from '@/src/lib/rms/eventBus';
import type { MarketContext } from '@/src/types/revenue/tacticalRules.types';

const baseCtx: MarketContext = {
  occupancy: 65, pickup24h: 4, pickupAverage: 3, leadTimeDays: 8,
  compsetMedianPrice: 145, ourPrice: 150, marketPressure: 'medium',
  hasMajorEvent: false, daysUntilStay: 7, otaShare: 68,
  cancellationRate: 8, activeStrategy: 'balanced',
};

describe('rmsRuleEvaluator (pipeline complet)', () => {
  it('contexte calme : peu de règles, prix proche de la base', () => {
    const r = rmsRuleEvaluator.evaluate({
      autopilot: false,
      context: { ...baseCtx, occupancy: 50, pickup24h: 2, marketPressure: 'low' },
      basePrice: 150, previousPrice: 148, date: '2026-01-15',
    });
    expect(r.appliedRules.length).toBeLessThanOrEqual(2);
    expect(Math.abs(r.recommendedPrice - r.basePrice)).toBeLessThan(30);
  });

  it('compression + événement : multi-règles, conflit anti-oscillation', () => {
    const r = rmsRuleEvaluator.evaluate({
      autopilot: false,
      context: { ...baseCtx, occupancy: 88, pickup24h: 8, marketPressure: 'high', hasMajorEvent: true, daysUntilStay: 3 },
      basePrice: 160, previousPrice: 155, date: '2026-06-12',
    });
    expect(r.appliedRules.length).toBeGreaterThanOrEqual(2);
    expect(r.recommendedPrice).toBeGreaterThanOrEqual(r.basePrice);
  });

  it('prix < plancher → garde-fou bloquant, finalPrice ramené au plancher', () => {
    const r = rmsRuleEvaluator.evaluate({
      autopilot: false,
      context: { ...baseCtx, occupancy: 30, marketPressure: 'low', activeStrategy: 'defensive' },
      basePrice: 95, previousPrice: 100, date: '2026-02-10',
    });
    expect(r.guardrails.allowed).toBe(false);
    expect(r.recommendedPrice).toBeGreaterThanOrEqual(110);
    expect(r.guardrails.triggered.some((t) => t.guardrail.id === 'price_floor')).toBe(true);
  });

  it('autopilote ON sans blocage → pushed=true et audit logged', () => {
    let pushedEvent: { date: string; finalPrice: number } | null = null;
    const unsub = subscribeRmsEvent('autopilot:pushed', (d) => { pushedEvent = d; });

    const r = rmsRuleEvaluator.evaluate({
      autopilot: true,
      context: { ...baseCtx, occupancy: 75, pickup24h: 5, marketPressure: 'high', hasMajorEvent: true },
      basePrice: 160, previousPrice: 158, date: '2026-06-15',
    });

    expect(r.pushed).toBe(true);
    expect(r.needsHumanValidation).toBe(false);
    expect(pushedEvent).not.toBeNull();

    const pushAudits = rmsAuditLogger.byType('autopilot_push');
    expect(pushAudits.length).toBeGreaterThan(0);
    unsub();
  });

  it('crée un conflit runtime quand deux règles ont des directions opposées', () => {
    const before = priorityConflictEngine.conflicts().length;
    rmsRuleEvaluator.evaluate({
      autopilot: false,
      // Trou de demande veut baisser, Compression marché veut monter
      context: { ...baseCtx, occupancy: 88, pickup24h: 8, marketPressure: 'high', hasMajorEvent: true },
      basePrice: 160, previousPrice: 158, date: '2026-06-20',
    });
    expect(priorityConflictEngine.conflicts().length).toBeGreaterThanOrEqual(before);
  });
});
