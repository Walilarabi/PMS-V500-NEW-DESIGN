/**
 * FLOWTYM — Tests RBAC.
 *
 * Couvre hasPermission, getPermissionLevel et le fallback dev-mode.
 * Les rôles métier suivent l'enum DB `admin_user_role` :
 *   direction, reception, gouvernante, femme_de_chambre, maintenance, breakfast
 *
 * Les anciens RoleIds (admin/manager/receptionist/housekeeping/reader)
 * sont conservés via aliasing (rétro-compat avec mocks legacy + DB) et
 * couverts par un bloc de tests dédié.
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

const STORAGE_KEY = 'flowtym.roles.permissions.v2';

describe('permissionsService — hasPermission (rôles DB)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it('direction a toutes les permissions partout', () => {
    expect(hasPermission('direction', 'set_users', 'admin')).toBe(true);
    expect(hasPermission('direction', 'rev_pricing', 'admin')).toBe(true);
    expect(hasPermission('direction', 'inexistante', 'admin')).toBe(true);
  });

  it("réception peut facturer et encaisser mais pas clôturer", () => {
    expect(hasPermission('reception', 'fin_invoice', 'write')).toBe(true);
    expect(hasPermission('reception', 'fin_payment', 'write')).toBe(true);
    expect(hasPermission('reception', 'fin_close', 'write')).toBe(false);
    expect(hasPermission('reception', 'fin_export', 'read')).toBe(false);
  });

  it("réception ne peut pas modifier les tarifs RMS", () => {
    expect(hasPermission('reception', 'rev_pricing', 'write')).toBe(false);
    expect(hasPermission('reception', 'rev_decisions', 'write')).toBe(false);
    expect(hasPermission('reception', 'rev_view', 'read')).toBe(true);
  });

  it("gouvernante gère statuts + affectations housekeeping", () => {
    expect(hasPermission('gouvernante', 'hk_status', 'admin')).toBe(true);
    expect(hasPermission('gouvernante', 'hk_assign', 'admin')).toBe(true);
    expect(hasPermission('gouvernante', 'hk_maintain', 'write')).toBe(true);
    expect(hasPermission('gouvernante', 'fin_invoice', 'read')).toBe(false);
  });

  it("femme de chambre déclare le statut mais ne distribue pas", () => {
    expect(hasPermission('femme_de_chambre', 'hk_status', 'write')).toBe(true);
    expect(hasPermission('femme_de_chambre', 'hk_assign', 'read')).toBe(false);
    expect(hasPermission('femme_de_chambre', 'res_view', 'read')).toBe(true);
    expect(hasPermission('femme_de_chambre', 'fin_invoice', 'read')).toBe(false);
  });

  it("maintenance gère les tickets OOO uniquement", () => {
    expect(hasPermission('maintenance', 'hk_maintain', 'admin')).toBe(true);
    expect(hasPermission('maintenance', 'hk_status', 'read')).toBe(true);
    expect(hasPermission('maintenance', 'set_rooms', 'read')).toBe(true);
    expect(hasPermission('maintenance', 'hk_assign', 'read')).toBe(false);
    expect(hasPermission('maintenance', 'fin_invoice', 'read')).toBe(false);
  });

  it("breakfast voit les arrivées du jour mais rien d'autre", () => {
    expect(hasPermission('breakfast', 'res_view', 'read')).toBe(true);
    expect(hasPermission('breakfast', 'cli_view', 'read')).toBe(false);
    expect(hasPermission('breakfast', 'fin_invoice', 'read')).toBe(false);
    expect(hasPermission('breakfast', 'hk_status', 'read')).toBe(false);
  });

  it('rôle inconnu = principe du moindre privilège (breakfast)', () => {
    expect(hasPermission('unknown_role', 'set_users', 'write')).toBe(false);
    expect(hasPermission('unknown_role', 'res_view', 'read')).toBe(true); // breakfast voit les res
    expect(hasPermission('unknown_role', 'fin_invoice', 'read')).toBe(false);
  });

  it('rôle null/undefined → breakfast (moindre privilège)', () => {
    expect(hasPermission(null, 'set_users', 'write')).toBe(false);
    expect(hasPermission(undefined, 'fin_invoice', 'read')).toBe(false);
    expect(hasPermission(null, 'res_view', 'read')).toBe(true);
  });

  it('rôle normalisé en lowercase + trimmed', () => {
    expect(hasPermission('  DIRECTION  ', 'set_users', 'admin')).toBe(true);
    expect(hasPermission('Reception', 'fin_invoice', 'write')).toBe(true);
    expect(hasPermission('GOUVERNANTE', 'hk_assign', 'admin')).toBe(true);
  });

  it("respecte les overrides de la matrice persistée en localStorage", () => {
    if (typeof window === 'undefined') return;
    const override = {
      reception: { set_users: 'admin' as const },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(override));
    expect(hasPermission('reception', 'set_users', 'admin')).toBe(true);
  });

  it('ignore les overrides du rôle direction (verrouillé)', () => {
    if (typeof window === 'undefined') return;
    const override = {
      direction: { set_users: 'none' as const },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(override));
    // direction reste admin partout
    expect(hasPermission('direction', 'set_users', 'admin')).toBe(true);
  });
});

describe('permissionsService — hasPermission (rétro-compat aliases legacy)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it("alias 'admin' → direction (tout autorisé)", () => {
    expect(hasPermission('admin', 'set_users', 'admin')).toBe(true);
    expect(hasPermission('admin', 'rev_pricing', 'admin')).toBe(true);
  });

  it("alias 'manager' → direction", () => {
    expect(hasPermission('manager', 'set_users', 'admin')).toBe(true);
    expect(hasPermission('manager', 'fin_close', 'admin')).toBe(true);
  });

  it("alias 'receptionist' → reception", () => {
    expect(hasPermission('receptionist', 'fin_invoice', 'write')).toBe(true);
    expect(hasPermission('receptionist', 'rev_pricing', 'write')).toBe(false);
  });

  it("alias 'housekeeping' → gouvernante", () => {
    expect(hasPermission('housekeeping', 'hk_status', 'admin')).toBe(true);
    expect(hasPermission('housekeeping', 'hk_assign', 'admin')).toBe(true);
  });

  it("alias 'reader' → breakfast", () => {
    expect(hasPermission('reader', 'res_view', 'read')).toBe(true);
    expect(hasPermission('reader', 'set_users', 'read')).toBe(false);
  });

  it("alias 'owner' → direction", () => {
    expect(hasPermission('owner', 'set_users', 'admin')).toBe(true);
  });

  it("alias 'accountant' → reception", () => {
    expect(hasPermission('accountant', 'fin_invoice', 'write')).toBe(true);
  });
});

describe('permissionsService — getPermissionLevel', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it("retourne le niveau exact d'une capability pour un rôle", () => {
    expect(getPermissionLevel('reception', 'fin_invoice')).toBe('write');
    expect(getPermissionLevel('reception', 'rev_pricing')).toBe('none');
    expect(getPermissionLevel('direction', 'set_users')).toBe('admin');
    expect(getPermissionLevel('gouvernante', 'hk_assign')).toBe('admin');
  });

  it("direction retourne 'admin' même pour capabilities non listées", () => {
    expect(getPermissionLevel('direction', 'capability_inventee')).toBe('admin');
  });
});

describe('permissionsService — capabilities Phase 5 (set_rooms, set_integrations, set_fiscal, set_backups, set_rgpd)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it("direction a tous les droits sur les capabilities sensibles", () => {
    expect(hasPermission('direction', 'set_rooms', 'admin')).toBe(true);
    expect(hasPermission('direction', 'set_integrations', 'admin')).toBe(true);
    expect(hasPermission('direction', 'set_fiscal', 'admin')).toBe(true);
    expect(hasPermission('direction', 'set_backups', 'admin')).toBe(true);
    expect(hasPermission('direction', 'set_rgpd', 'admin')).toBe(true);
  });

  it("réception n'a aucun accès aux paramètres système", () => {
    expect(hasPermission('reception', 'set_rooms', 'read')).toBe(false);
    expect(hasPermission('reception', 'set_integrations', 'read')).toBe(false);
    expect(hasPermission('reception', 'set_fiscal', 'read')).toBe(false);
    expect(hasPermission('reception', 'set_backups', 'read')).toBe(false);
    expect(hasPermission('reception', 'set_rgpd', 'read')).toBe(false);
  });

  it("gouvernante voit les chambres mais pas les autres modules sensibles", () => {
    expect(hasPermission('gouvernante', 'set_rooms', 'read')).toBe(true);
    expect(hasPermission('gouvernante', 'set_rooms', 'write')).toBe(false);
    expect(hasPermission('gouvernante', 'set_integrations', 'read')).toBe(false);
  });

  it("maintenance voit les chambres pour OOO", () => {
    expect(hasPermission('maintenance', 'set_rooms', 'read')).toBe(true);
    expect(hasPermission('maintenance', 'set_rooms', 'write')).toBe(false);
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
    expect(m.reception.fin_invoice).toBe('write');
    expect(m.gouvernante.hk_assign).toBe('admin');
    expect(m.breakfast.res_view).toBe('read');
  });

  it("fusionne les overrides sans perdre les capabilities par défaut", () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ reception: { rev_pricing: 'write' } }),
    );
    const m = loadPermissionsMatrix();
    expect(m.reception.rev_pricing).toBe('write');     // overridé
    expect(m.reception.fin_invoice).toBe('write');     // conservé
  });

  it("ignore les overrides du rôle direction (verrouillé)", () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ direction: { set_users: 'none' } }),
    );
    const m = loadPermissionsMatrix();
    // La matrice direction ne contient pas la capability écrasée
    // (court-circuit hasPermission gère le "tout admin")
    expect(m.direction.set_users).toBeUndefined();
  });

  it("ignore les RoleIds inconnus dans le localStorage", () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ legacy_admin: { set_users: 'admin' } }),
    );
    const m = loadPermissionsMatrix();
    // 'legacy_admin' n'est pas un RoleId valide → pas dans la matrice résultante
    expect((m as Record<string, unknown>).legacy_admin).toBeUndefined();
  });
});
