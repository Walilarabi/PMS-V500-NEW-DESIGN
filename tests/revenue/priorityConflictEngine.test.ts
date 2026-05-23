/**
 * FLOWTYM — Tests priorityConflictEngine
 */
import { describe, it, expect } from 'vitest';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import { subscribeRmsEvent } from '@/src/lib/rms/eventBus';

describe('priorityConflictEngine', () => {
  it('contient une hiérarchie de 10 niveaux', () => {
    expect(priorityConflictEngine.hierarchy().length).toBeGreaterThanOrEqual(10);
  });

  it('garde-fous sont toujours en priorité 1', () => {
    expect(priorityConflictEngine.hierarchy()[0].kind).toBe('guardrail');
  });

  it('reorder met à jour les priorités et émet priority:reordered', () => {
    let received: { orderedIds: string[] } | null = null;
    const unsub = subscribeRmsEvent('priority:reordered', (d) => { received = d; });

    const original = priorityConflictEngine.hierarchy().map((h) => h.id);
    const reordered = [original[1], original[0], ...original.slice(2)];
    priorityConflictEngine.reorder(reordered);

    expect(received).not.toBeNull();
    expect(priorityConflictEngine.hierarchy()[0].id).toBe(original[1]);

    priorityConflictEngine.reorder(original); // restore
    unsub();
  });

  it('recordRuntimeConflict ajoute un conflit dédupliqué', () => {
    const before = priorityConflictEngine.conflicts().length;
    const winner = { id: 'rule_a', name: 'Rule A', priority: 1, intent: 'up' };
    const suspended = { id: 'rule_b', name: 'Rule B', priority: 5, intent: 'down' };
    priorityConflictEngine.recordRuntimeConflict({
      winner, suspended, impact: 500, date: '2026-01-01',
    });
    priorityConflictEngine.recordRuntimeConflict({
      winner, suspended, impact: 300, date: '2026-01-02',
    });
    // Dédupliqué → +1 seul
    expect(priorityConflictEngine.conflicts().length).toBe(before + 1);
    // Impact agrégé : 500 + 300 = 800
    const c = priorityConflictEngine.conflicts().find((x) => x.id === 'rule_a__vs__rule_b');
    expect(c?.potentialImpact).toBe(800);
  });

  it('resolveConflict ajoute une entrée au journal et émet conflict:resolved', () => {
    let received: { conflictId: string } | null = null;
    const unsub = subscribeRmsEvent('conflict:resolved', (d) => { received = d; });
    const c = priorityConflictEngine.conflicts()[0];
    if (c) priorityConflictEngine.resolveConflict(c.id, 'apply_recommendation');
    expect(received?.conflictId).toBe(c?.id);
    unsub();
  });
});
