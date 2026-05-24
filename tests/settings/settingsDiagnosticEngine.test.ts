/**
 * FLOWTYM — Tests · Settings Diagnostic Engine.
 *
 * Vérifie que le moteur de diagnostic produit un rapport complet
 * et cohérent à partir des stores réels (mockés via init).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { runDiagnostic } from '@/src/services/settings/settingsDiagnosticEngine';
import { useConfigStore } from '@/src/store/configStore';

describe('settingsDiagnosticEngine', () => {
  beforeEach(() => {
    // Réinitialise localStorage entre tests
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it('produit un rapport complet avec les 6 scores', () => {
    const report = runDiagnostic();
    expect(report.scores.system_health).toBeDefined();
    expect(report.scores.configuration).toBeDefined();
    expect(report.scores.compliance).toBeDefined();
    expect(report.scores.security).toBeDefined();
    expect(report.scores.distribution).toBeDefined();
    expect(report.scores.revenue).toBeDefined();
  });

  it('chaque score est un nombre entre 0 et 100', () => {
    const report = runDiagnostic();
    for (const sc of Object.values(report.scores)) {
      expect(sc.value).toBeGreaterThanOrEqual(0);
      expect(sc.value).toBeLessThanOrEqual(100);
    }
  });

  it('le tier correspond au score', () => {
    const report = runDiagnostic();
    for (const sc of Object.values(report.scores)) {
      if (sc.value >= 85) expect(sc.tier).toBe('excellent');
      else if (sc.value >= 65) expect(sc.tier).toBe('good');
      else if (sc.value >= 40) expect(sc.tier).toBe('attention');
      else expect(sc.tier).toBe('critical');
    }
  });

  it('liste 8 modules clés du PMS', () => {
    const report = runDiagnostic();
    expect(report.modules.length).toBe(8);
    const keys = report.modules.map((m) => m.key);
    expect(keys).toContain('pms_reservations');
    expect(keys).toContain('inventory_planning');
    expect(keys).toContain('rms_revenue');
    expect(keys).toContain('channel_manager');
    expect(keys).toContain('finance_billing');
    expect(keys).toContain('housekeeping');
    expect(keys).toContain('automation_ai');
    expect(keys).toContain('security_backups');
  });

  it('tri des alertes par sévérité (critical d\'abord)', () => {
    const report = runDiagnostic();
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    for (let i = 1; i < report.alerts.length; i++) {
      const prev = order.indexOf(report.alerts[i - 1].severity);
      const cur = order.indexOf(report.alerts[i].severity);
      expect(prev).toBeLessThanOrEqual(cur);
    }
  });

  it('checklist couvre les 8 domaines obligatoires', () => {
    const report = runDiagnostic();
    expect(report.checklist.length).toBe(8);
    const ids = report.checklist.map((d) => d.id);
    expect(ids).toEqual([
      'establishment', 'inventory', 'pricing', 'distribution',
      'finance', 'housekeeping', 'security', 'integrations',
    ]);
  });

  it('configuration guidée à 8 étapes', () => {
    const report = runDiagnostic();
    expect(report.guided.length).toBe(8);
    expect(report.guided[0].index).toBe(1);
    expect(report.guided[7].index).toBe(8);
  });

  it('génère une alerte "no_admin" si aucun admin actif', () => {
    // Sauvegarde + reset users
    const initialUsers = useConfigStore.getState().users;
    useConfigStore.getState().updateUsers([]);
    const report = runDiagnostic();
    const noAdmin = report.alerts.find((a) => a.id === 'no_admin');
    expect(noAdmin).toBeDefined();
    expect(noAdmin?.severity).toBe('critical');
    // Restore
    useConfigStore.getState().updateUsers(initialUsers);
  });

  it('chaque alerte a une PageId cible non vide', () => {
    const report = runDiagnostic();
    for (const a of report.alerts) {
      expect(a.action.target).toBeDefined();
      expect(typeof a.action.target).toBe('string');
      expect(a.action.target.length).toBeGreaterThan(0);
    }
  });

  it('générées-At est une date ISO valide', () => {
    const report = runDiagnostic();
    expect(() => new Date(report.generatedAt).toISOString()).not.toThrow();
  });
});
