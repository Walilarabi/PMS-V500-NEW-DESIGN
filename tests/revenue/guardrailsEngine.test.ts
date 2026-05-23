/**
 * FLOWTYM — Tests guardrailsEngine
 */
import { describe, it, expect } from 'vitest';
import { guardrailsEngine } from '@/src/services/revenue/guardrailsEngine';
import { subscribeRmsEvent } from '@/src/lib/rms/eventBus';

describe('guardrailsEngine', () => {
  it('contient les 12 garde-fous seedés', () => {
    expect(guardrailsEngine.all().length).toBeGreaterThanOrEqual(12);
  });

  it('bloque un prix sous le plancher', () => {
    const verdict = guardrailsEngine.evaluate({
      price: 90, previousPrice: 100, source: 'rule', context: 'test',
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.finalPrice).toBeGreaterThanOrEqual(110);
    expect(verdict.triggered.some((t) => t.guardrail.id === 'price_floor')).toBe(true);
  });

  it('bloque un prix au-dessus du plafond', () => {
    const verdict = guardrailsEngine.evaluate({
      price: 400, previousPrice: 300, source: 'rule', context: 'test',
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.finalPrice).toBeLessThanOrEqual(350);
  });

  it('ajuste une variation > 15% à la limite autorisée', () => {
    const verdict = guardrailsEngine.evaluate({
      price: 200, previousPrice: 100, source: 'rule', context: 'test',
    });
    // Sans plafond strict à 200, c'est la variation max journalière qui ajuste
    expect(verdict.triggered.some((t) => t.guardrail.id === 'daily_variation_max')).toBe(true);
  });

  it('émet guardrail:blocked sur le bus', () => {
    let received: { guardrailName: string } | null = null;
    const unsub = subscribeRmsEvent('guardrail:blocked', (d) => { received = d; });
    guardrailsEngine.evaluate({ price: 80, previousPrice: 100, source: 'rule', context: 'test-bus' });
    expect(received).not.toBeNull();
    unsub();
  });

  it('upsert + remove modifient le store', () => {
    const before = guardrailsEngine.all().length;
    guardrailsEngine.upsert({
      id: 'test_guardrail_unit' as any,
      name: 'Test plancher',
      category: 'pricing',
      severity: 'blocking',
      condition: 'test',
      threshold: '100€',
      thresholdValue: 100,
      action: 'bloque',
      coverage: { scope: 'all', detail: '100%', percentage: 100 },
      status: 'active',
      blocksCount30d: 0,
      warningsCount30d: 0,
      adjustmentsCount30d: 0,
      averageDeltaLimited: 0,
      history: [],
    });
    expect(guardrailsEngine.all().length).toBe(before + 1);
    guardrailsEngine.remove('test_guardrail_unit');
    expect(guardrailsEngine.all().length).toBe(before);
  });
});
