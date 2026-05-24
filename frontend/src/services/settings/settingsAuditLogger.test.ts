/**
 * FLOWTYM — Tests de l'audit logger (Phase 3).
 *
 * Couvre :
 *   • inférence de severity à partir de l'action
 *   • persistance localStorage avec rotation
 *   • migration douce des entrées sans severity (legacy)
 *   • formats actor / meta
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));
// Évite le sync Supabase dans les tests (import dynamique)
vi.mock('./settingsPersistence', () => ({ syncAuditEntryToSupabase: vi.fn() }));

import { logAudit, readAudit, clearAudit } from './settingsAuditLogger';

describe('settingsAuditLogger — logAudit', () => {
  beforeEach(() => {
    clearAudit();
  });

  it("génère un id et une date", () => {
    const entry = logAudit({ action: 'user_created', detail: 'Test' });
    expect(entry.id).toMatch(/^audit_/);
    expect(entry.at).toBeTruthy();
    expect(entry.action).toBe('user_created');
  });

  it("infère la severity quand non fournie", () => {
    const e1 = logAudit({ action: 'user_deleted', detail: 'X' });
    expect(e1.severity).toBe('critical');

    const e2 = logAudit({ action: 'rate_plan_imported', detail: 'Y' });
    expect(e2.severity).toBe('info');

    const e3 = logAudit({ action: 'permission_denied', detail: 'Z' });
    expect(e3.severity).toBe('warning');
  });

  it("respecte la severity explicite", () => {
    const e = logAudit({ action: 'user_updated', detail: 'X', severity: 'critical' });
    expect(e.severity).toBe('critical');
  });

  it("conserve l'acteur (userId + email + role)", () => {
    const e = logAudit({
      action: 'role_changed',
      detail: 'Sarah → manager',
      actor: { userId: 'u_1', email: 'sarah@ex.com', role: 'admin' },
    });
    expect(e.actor?.email).toBe('sarah@ex.com');
    expect(e.actor?.role).toBe('admin');
  });

  it("conserve le meta libre", () => {
    const e = logAudit({
      action: 'virtual_room_created',
      meta: { roomTypeCode: 'ADJ', virtualKind: 'adjacent', capacity: 4 },
    });
    expect(e.meta?.roomTypeCode).toBe('ADJ');
    expect(e.meta?.capacity).toBe(4);
  });

  it("le plus récent apparaît en tête de readAudit", () => {
    logAudit({ action: 'user_created', detail: 'A' });
    logAudit({ action: 'user_created', detail: 'B' });
    logAudit({ action: 'user_created', detail: 'C' });
    const entries = readAudit();
    expect(entries[0].detail).toBe('C');
    expect(entries[2].detail).toBe('A');
  });

  it("la rotation FIFO conserve 200 entrées max", () => {
    for (let i = 0; i < 250; i++) {
      logAudit({ action: 'module_inspected', detail: `entry ${i}` });
    }
    const all = readAudit(500);
    expect(all.length).toBeLessThanOrEqual(200);
    // Les dernières insérées sont conservées
    expect(all[0].detail).toBe('entry 249');
  });
});

describe('settingsAuditLogger — readAudit (migration douce)', () => {
  beforeEach(() => {
    clearAudit();
  });

  it("ajoute severity='info' aux anciennes entrées sans le champ", () => {
    // Simule un localStorage rempli par l'ancienne version (pas de severity)
    if (typeof window !== 'undefined') {
      const legacy = [
        { id: 'old1', at: new Date().toISOString(), action: 'diagnostic_run', detail: 'legacy' },
      ];
      window.localStorage.setItem('flowtym.settings.audit', JSON.stringify(legacy));
    }
    const entries = readAudit();
    expect(entries[0].severity).toBe('info');
    expect(entries[0].action).toBe('diagnostic_run');
  });
});
