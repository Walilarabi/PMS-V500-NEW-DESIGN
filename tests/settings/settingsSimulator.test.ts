/**
 * FLOWTYM — Tests · Settings Alert Simulator.
 */
import { describe, it, expect } from 'vitest';
import { simulateAlertFix, simulateCombined } from '@/src/services/settings/settingsSimulator';
import type { ConfigAlert } from '@/src/types/settings/diagnostic';

function makeAlert(overrides: Partial<ConfigAlert> = {}): ConfigAlert {
  return {
    id: 'test',
    severity: 'high',
    module: 'inventory_planning',
    title: 'Test',
    description: 'Test',
    action: { label: 'Corriger', target: 'settings_floors' },
    status: 'open',
    detectedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('settingsSimulator', () => {
  it('renvoie un impact connu pour alerte enregistrée', () => {
    const sim = simulateAlertFix(makeAlert({ id: 'rooms_no_floor' }));
    expect(sim.deltas.configuration).toBe(12);
    expect(sim.effort).toBe('court');
    expect(sim.narrative).toContain('Chambres avec étage');
  });

  it('booste sécurité pour admin_no_2fa', () => {
    const sim = simulateAlertFix(makeAlert({ id: 'admin_no_2fa', module: 'security_backups' }));
    expect(sim.deltas.security).toBe(20);
  });

  it('fallback générique pour alerte inconnue', () => {
    const sim = simulateAlertFix(makeAlert({ id: 'unknown_xyz', severity: 'critical', module: 'rms_revenue' }));
    expect(sim.deltas.revenue).toBeGreaterThan(0);
  });

  it('systemHealthDelta = moyenne /5 des deltas', () => {
    const sim = simulateAlertFix(makeAlert({ id: 'no_channels', module: 'channel_manager' }));
    const sum = Object.values(sim.deltas).reduce((s, v) => s + (v ?? 0), 0);
    expect(sim.systemHealthDelta).toBe(Math.round(sum / 5));
  });

  it('simulateCombined cumule plusieurs alertes', () => {
    const alerts = [
      makeAlert({ id: 'rooms_no_floor' }),
      makeAlert({ id: 'admin_no_2fa', module: 'security_backups' }),
    ];
    const sim = simulateCombined(alerts);
    expect(sim.deltas.configuration).toBe(12);
    expect(sim.deltas.security).toBe(20);
    expect(sim.systemHealthDelta).toBeGreaterThan(0);
  });

  it('effort scales avec le nombre d\'alertes', () => {
    expect(simulateCombined([makeAlert()]).effort).toBe('court');
    expect(simulateCombined([makeAlert(), makeAlert()]).effort).toBe('moyen');
    expect(simulateCombined([makeAlert(), makeAlert(), makeAlert(), makeAlert()]).effort).toBe('long');
  });

  it('narrative non vide', () => {
    const sim = simulateAlertFix(makeAlert({ id: 'no_admin' }));
    expect(sim.narrative.length).toBeGreaterThan(10);
  });
});
