/**
 * FLOWTYM — Tests · Settings Audit Logger.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { logAudit, readAudit, clearAudit } from '@/src/services/settings/settingsAuditLogger';

describe('settingsAuditLogger', () => {
  beforeEach(() => {
    clearAudit();
  });

  it('logAudit ajoute une entrée', () => {
    logAudit({ action: 'diagnostic_run', detail: 'Test 1' });
    const entries = readAudit();
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('diagnostic_run');
    expect(entries[0].detail).toBe('Test 1');
  });

  it('entries triées chronologiquement (plus récent d\'abord)', () => {
    logAudit({ action: 'diagnostic_run', detail: 'A' });
    logAudit({ action: 'alert_resolved', detail: 'B' });
    logAudit({ action: 'config_exported', detail: 'C' });
    const entries = readAudit();
    expect(entries[0].detail).toBe('C');
    expect(entries[2].detail).toBe('A');
  });

  it('chaque entrée a un id unique', () => {
    for (let i = 0; i < 5; i++) {
      logAudit({ action: 'diagnostic_run', detail: `iter ${i}` });
    }
    const entries = readAudit();
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque entrée a un timestamp ISO', () => {
    logAudit({ action: 'diagnostic_run' });
    const [entry] = readAudit();
    expect(() => new Date(entry.at).toISOString()).not.toThrow();
  });

  it('readAudit accepte limite', () => {
    for (let i = 0; i < 10; i++) logAudit({ action: 'diagnostic_run', detail: String(i) });
    expect(readAudit(3).length).toBe(3);
  });

  it('clearAudit vide tout', () => {
    logAudit({ action: 'diagnostic_run' });
    clearAudit();
    expect(readAudit()).toEqual([]);
  });

  it('limite à 200 entrées', () => {
    for (let i = 0; i < 250; i++) logAudit({ action: 'diagnostic_run' });
    expect(readAudit(500).length).toBeLessThanOrEqual(200);
  });
});
