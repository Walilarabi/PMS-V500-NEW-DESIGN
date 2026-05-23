/**
 * FLOWTYM — Tests tacticalRulesEngine
 *
 * Couvre :
 *   - évaluation contextuelle
 *   - mutation (setStatus, addRule, removeRule, duplicateRule)
 *   - émission d'événements sur le bus
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import { subscribeRmsEvent } from '@/src/lib/rms/eventBus';
import type { MarketContext, TacticalRule, TacticalRuleId } from '@/src/types/revenue/tacticalRules.types';

const baseCtx: MarketContext = {
  occupancy: 65, pickup24h: 4, pickupAverage: 3, leadTimeDays: 8,
  compsetMedianPrice: 145, ourPrice: 150, marketPressure: 'medium',
  hasMajorEvent: false, daysUntilStay: 7, otaShare: 68,
  cancellationRate: 8, activeStrategy: 'balanced',
};

describe('tacticalRulesEngine', () => {
  it('contient les 10 règles seedées', () => {
    const all = tacticalRulesEngine.all();
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(all.map((r) => r.id)).toContain('market_compression');
    expect(all.map((r) => r.id)).toContain('rms_anomaly_detection');
  });

  it('déclenche les règles attendues en contexte de compression', () => {
    const evals = tacticalRulesEngine.evaluate({
      ...baseCtx,
      occupancy: 88, pickup24h: 8, marketPressure: 'high',
      hasMajorEvent: true, daysUntilStay: 3,
    });
    const fired = evals.filter((e) => e.fired).map((e) => e.rule.id);
    expect(fired).toContain('market_compression');
    expect(fired).toContain('event_protection');
  });

  it('ne déclenche aucune règle prix sur contexte calme', () => {
    const evals = tacticalRulesEngine.evaluate(baseCtx);
    const firedCount = evals.filter((e) => e.fired).length;
    expect(firedCount).toBeLessThanOrEqual(2);
  });

  it('emet tactical-rule:toggled lors d\'un changement de statut', async () => {
    let received: { ruleId: string; status: string } | null = null;
    const unsub = subscribeRmsEvent('tactical-rule:toggled', (d) => { received = d; });
    tacticalRulesEngine.setStatus('market_compression', 'paused');
    expect(received).not.toBeNull();
    expect(received?.ruleId).toBe('market_compression');
    expect(received?.status).toBe('paused');
    tacticalRulesEngine.setStatus('market_compression', 'active'); // restore
    unsub();
  });

  it('addRule + removeRule modifient le store', () => {
    const before = tacticalRulesEngine.all().length;
    const rule: TacticalRule = {
      id: 'test_rule_unit' as TacticalRuleId,
      name: 'Test', description: 'Unit', category: 'demand',
      priority: 99, status: 'simulation',
      triggers: [{ label: 't', metric: 'occupancy', operator: '>', threshold: 50 }],
      actions: [{ label: 'a', type: 'price_up', magnitude: 0.05 }],
      connectivity: [], iaConfidence: 70,
      revenueImpact30d: 0, revparImpact30d: 0,
      triggersCount30d: 0, successCount: 0, adjustedCount: 0, blockedCount: 0,
      history: [],
    };
    tacticalRulesEngine.addRule(rule);
    expect(tacticalRulesEngine.all().length).toBe(before + 1);
    tacticalRulesEngine.removeRule('test_rule_unit');
    expect(tacticalRulesEngine.all().length).toBe(before);
  });

  it('duplicateRule crée une copie en simulation', () => {
    tacticalRulesEngine.duplicateRule('market_compression');
    const all = tacticalRulesEngine.all();
    const copy = all.find((r) => r.name.includes('(copie)'));
    expect(copy).toBeDefined();
    expect(copy?.status).toBe('simulation');
    if (copy) tacticalRulesEngine.removeRule(copy.id);
  });
});
