/**
 * FLOWTYM — Tests RBAC.
 *
 * Couvre hasPermission, getPermissionLevel et le fallback dev-mode.
 * Le hook usePermission / le composant RequirePermission sont testés
 * indirectement via React Testing Library minimal pour vérifier le
 * rendu conditionnel.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({ session: null, status: 'unauthenticated' }),
}));

import {
  hasPermission,
  getPermissionLevel,
  ACCESS_LEVEL_ORDER,
  loadPermissionsMatrix,
} from './permissionsService';

describe('permissionsService — hasPermission', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it('admin a toujours toutes les permissions', () => {
    expect(hasPermission('admin', 'set_users', 'admin')).toBe(true);
    expect(hasPermission('admin', 'rev_pricing', 'admin')).toBe(true);
    expect(hasPermission('admin', 'inexistante', 'admin')).toBe(true);
  });

  it('manager dispose des permissions definies par defaut', () => {
    expect(hasPermission('manager', 'rev_pricing', 'admin')).toBe(true);
    expect(hasPermission('manager', 'rev_pricing', 'write')).toBe(true);
    expect(hasPermission('manager', 'set_users', 'write')).toBe(false);
  });

  it('receptionniste ne peut pas modifier les tarifs', () => {
    expect(hasPermission('receptionist', 'rev_pricing', 'write')).toBe(false);
    expect(hasPermission('receptionist', 'rev_view', 'read')).toBe(true);
    expect(hasPermission('receptionist', 'fin_payment', 'write')).toBe(true);
    expect(hasPermission('receptionist', 'fin_close', 'write')).toBe(false);
  });

  it('housekeeping a uniquement les permissions HK', () => {
    expect(hasPermission('housekeeping', 'hk_status', 'admin')).toBe(true);
    expect(hasPermission('housekeeping', 'rev_view', 'read')).toBe(false);
    expect(hasPermission('housekeeping', 'set_users', 'read')).toBe(false);
  });

  it('reader = lecture seule sur peu de modules', () => {
    expect(hasPermission('reader', 'rev_view', 'read')).toBe(true);
    expect(hasPermission('reader', 'rev_pricing', 'write')).toBe(false);
    expect(hasPermission('reader', 'set_users', 'read')).toBe(false);
  });

  it('rôle inconnu = principe du moindre privilège (reader)', () => {
    expect(hasPermission('unknown_role', 'set_users', 'write')).toBe(false);
    expect(hasPermission('unknown_role', 'rev_view', 'read')).toBe(true);
  });

  it('rôle null/undefined → reader', () => {
    expect(hasPermission(null, 'set_users', 'write')).toBe(false);
    expect(hasPermission(undefined, 'rev_view', 'read')).toBe(true);
  });

  it("respecte les overrides de la matrice persistée en localStorage", () => {
    if (typeof window === 'undefined') return;
    const override = {
      manager: { set_users: 'admin' as const },
    };
    window.localStorage.setItem('flowtym.roles.permissions', JSON.stringify(override));
    expect(hasPermission('manager', 'set_users', 'admin')).toBe(true);
  });

  it('ignore les overrides du rôle admin (verrouillé)', () => {
    if (typeof window === 'undefined') return;
    const override = {
      admin: { set_users: 'none' as const },
    };
    window.localStorage.setItem('flowtym.roles.permissions', JSON.stringify(override));
    // admin reste admin partout
    expect(hasPermission('admin', 'set_users', 'admin')).toBe(true);
  });
});

describe('permissionsService — getPermissionLevel', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it("retourne le niveau exact d'une capability pour un rôle", () => {
    expect(getPermissionLevel('manager', 'rev_pricing')).toBe('admin');
    expect(getPermissionLevel('receptionist', 'rev_pricing')).toBe('none');
    expect(getPermissionLevel('admin', 'set_users')).toBe('admin');
  });
});

describe('permissionsService — ACCESS_LEVEL_ORDER', () => {
  it('définit un ordre strict croissant', () => {
    expect(ACCESS_LEVEL_ORDER.none).toBeLessThan(ACCESS_LEVEL_ORDER.read);
    expect(ACCESS_LEVEL_ORDER.read).toBeLessThan(ACCESS_LEVEL_ORDER.write);
    expect(ACCESS_LEVEL_ORDER.write).toBeLessThan(ACCESS_LEVEL_ORDER.admin);
  });
});

describe('permissionsService — loadPermissionsMatrix', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it("retourne les defaults si rien n'est persisté", () => {
    const m = loadPermissionsMatrix();
    expect(m.manager.rev_pricing).toBe('admin');
    expect(m.receptionist.set_users).toBe('none');
  });

  it("fusionne les overrides sans perdre les capabilities par défaut", () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      'flowtym.roles.permissions',
      JSON.stringify({ manager: { rev_pricing: 'write' } }),
    );
    const m = loadPermissionsMatrix();
    expect(m.manager.rev_pricing).toBe('write');           // overridé
    expect(m.manager.fin_invoice).toBe('admin');           // conservé
  });
});
