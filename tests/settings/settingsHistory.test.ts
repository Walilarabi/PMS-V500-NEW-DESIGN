/**
 * FLOWTYM — Tests · Settings History (run history + resolved alerts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordRun, getHistory, getTrend,
  markResolved, isResolved, clearResolved,
  fingerprintAlert,
} from '@/src/services/settings/settingsHistory';
import { runDiagnostic } from '@/src/services/settings/settingsDiagnosticEngine';

describe('settingsHistory', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
    clearResolved();
  });

  describe('recordRun + getHistory', () => {
    it('historise un run de diagnostic', () => {
      const report = runDiagnostic();
      recordRun(report);
      const history = getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[history.length - 1].scores.system_health).toBe(report.scores.system_health.value);
    });

    it('déduplique les runs identiques < 30s', () => {
      const report = runDiagnostic();
      recordRun(report);
      recordRun(report);
      recordRun(report);
      const history = getHistory();
      expect(history.length).toBe(1);
    });

    it('limite l\'historique à 30 runs', () => {
      // simule 35 runs avec scores variables pour ne pas être dédupliqués
      for (let i = 0; i < 35; i++) {
        const r = runDiagnostic();
        // Modifie l'horodatage pour casser la dédup
        recordRun({ ...r, generatedAt: new Date(Date.now() - (35 - i) * 60_000).toISOString() });
      }
      const history = getHistory();
      expect(history.length).toBeLessThanOrEqual(30);
    });
  });

  describe('getTrend', () => {
    it('retourne une série padded à la longueur demandée', () => {
      const report = runDiagnostic();
      recordRun(report);
      const trend = getTrend('system_health', 12);
      expect(trend.length).toBe(12);
    });

    it('retourne tableau vide si aucun run', () => {
      const trend = getTrend('system_health', 12);
      expect(trend).toEqual([]);
    });
  });

  describe('resolved alerts', () => {
    it('mémorise et lit une résolution', () => {
      const fp = fingerprintAlert('Titre', 'Description');
      markResolved('alert_1', 'resolved', fp);
      expect(isResolved('alert_1', fp)).toBe(true);
    });

    it('invalide la résolution si fingerprint change', () => {
      const fp1 = fingerprintAlert('Titre', 'Description');
      markResolved('alert_1', 'resolved', fp1);
      const fp2 = fingerprintAlert('Titre', 'Description modifiée');
      expect(isResolved('alert_1', fp2)).toBe(false);
    });

    it('clearResolved purge tout', () => {
      const fp = fingerprintAlert('Titre', 'Description');
      markResolved('alert_1', 'resolved', fp);
      clearResolved();
      expect(isResolved('alert_1', fp)).toBe(false);
    });
  });

  describe('fingerprintAlert', () => {
    it('même contenu → même fingerprint', () => {
      const fp1 = fingerprintAlert('Titre', 'Description');
      const fp2 = fingerprintAlert('Titre', 'Description');
      expect(fp1).toBe(fp2);
    });

    it('contenu différent → fingerprint différent', () => {
      const fp1 = fingerprintAlert('Titre A', 'Description');
      const fp2 = fingerprintAlert('Titre B', 'Description');
      expect(fp1).not.toBe(fp2);
    });
  });
});
