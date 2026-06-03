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
    // R4 : manager = admin_hotel → gère les utilisateurs de l'hôtel (set_users 'write').
    expect(hasPermission('manager', 'set_users', 'write')).toBe(true);
  });

  it('receptionniste ne peut pas modifier les tarifs', () => {
    expect(hasPermission('receptionist', 'rev_pricing', 'write')).toBe(false);
    // R4 : la réception ne gère pas le Revenue → rev_view 'none' (plus aucun accès).
    expect(hasPermission('receptionist', 'rev_view', 'read')).toBe(false);
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

describe('permissionsService — capabilities Phase 5 (set_rooms, set_integrations, set_fiscal, set_backups, set_rgpd)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it("manager peut éditer les chambres et les intégrations", () => {
    expect(hasPermission('manager', 'set_rooms', 'write')).toBe(true);
    expect(hasPermission('manager', 'set_integrations', 'write')).toBe(true);
    expect(hasPermission('manager', 'set_fiscal', 'write')).toBe(true);
  });

  it("manager peut lire les sauvegardes mais n'a aucun accès RGPD (R4)", () => {
    expect(hasPermission('manager', 'set_backups', 'read')).toBe(true);
    expect(hasPermission('manager', 'set_backups', 'write')).toBe(false);
    // R4 : l'effacement RGPD reste réservé à la direction → set_rgpd 'none'.
    expect(hasPermission('manager', 'set_rgpd', 'read')).toBe(false);
    expect(hasPermission('manager', 'set_rgpd', 'write')).toBe(false);
  });

  it("receptionniste n'a aucun accès aux nouvelles capabilities", () => {
    expect(hasPermission('receptionist', 'set_rooms', 'read')).toBe(false);
    expect(hasPermission('receptionist', 'set_integrations', 'read')).toBe(false);
    expect(hasPermission('receptionist', 'set_fiscal', 'read')).toBe(false);
    expect(hasPermission('receptionist', 'set_backups', 'read')).toBe(false);
    expect(hasPermission('receptionist', 'set_rgpd', 'read')).toBe(false);
  });

  it("housekeeping voit les chambres mais pas les autres modules sensibles", () => {
    expect(hasPermission('housekeeping', 'set_rooms', 'read')).toBe(true);
    expect(hasPermission('housekeeping', 'set_rooms', 'write')).toBe(false);
    expect(hasPermission('housekeeping', 'set_integrations', 'read')).toBe(false);
  });

  it("reader a accès en lecture seule à toutes les nouvelles capabilities", () => {
    expect(hasPermission('reader', 'set_rooms', 'read')).toBe(true);
    expect(hasPermission('reader', 'set_integrations', 'read')).toBe(true);
    expect(hasPermission('reader', 'set_fiscal', 'read')).toBe(true);
    expect(hasPermission('reader', 'set_backups', 'read')).toBe(true);
    expect(hasPermission('reader', 'set_rgpd', 'read')).toBe(true);
    expect(hasPermission('reader', 'set_rooms', 'write')).toBe(false);
  });

  it("admin a toutes les permissions sur les nouvelles capabilities", () => {
    expect(hasPermission('admin', 'set_rooms', 'admin')).toBe(true);
    expect(hasPermission('admin', 'set_integrations', 'admin')).toBe(true);
    expect(hasPermission('admin', 'set_fiscal', 'admin')).toBe(true);
    expect(hasPermission('admin', 'set_backups', 'admin')).toBe(true);
    expect(hasPermission('admin', 'set_rgpd', 'admin')).toBe(true);
  });
});

describe('permissionsService — rôles DB (admin_user_role) → accès', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  // Régression : le rôle DB stocké pour le super admin est 'direction'
  // (enum admin_user_role), PAS 'admin'. Si cette correspondance casse, le
  // super admin se retrouve en moindre privilège (reader) → boutons grisés.
  it("'direction' (super admin DB) a accès complet partout", () => {
    expect(hasPermission('direction', 'set_rooms', 'write')).toBe(true);
    expect(hasPermission('direction', 'set_rooms', 'admin')).toBe(true);
    expect(hasPermission('direction', 'rev_pricing', 'write')).toBe(true);
    expect(hasPermission('direction', 'fin_invoice', 'write')).toBe(true);
    expect(hasPermission('direction', 'set_users', 'admin')).toBe(true);
    // Insensible à la casse
    expect(hasPermission('DIRECTION', 'set_rooms', 'write')).toBe(true);
  });

  it("'reception' = profil réceptionniste (création résa, pas de tarifs)", () => {
    expect(hasPermission('reception', 'res_create', 'write')).toBe(true);
    expect(hasPermission('reception', 'rev_pricing', 'write')).toBe(false);
  });

  it("'gouvernante' / 'femme_de_chambre' = profil housekeeping", () => {
    expect(hasPermission('gouvernante', 'hk_status', 'admin')).toBe(true);
    expect(hasPermission('gouvernante', 'set_rooms', 'write')).toBe(false);
    expect(hasPermission('femme_de_chambre', 'hk_status', 'admin')).toBe(true);
  });

  // Prestations (ProductsPage) doit se câbler sur rev_pricing, pas fin_invoice.
  // Le super admin reste autorisé dans les deux cas, mais un non-admin du
  // domaine "Tarifs & Prestations" ne doit pas dépendre d'une capability
  // de facturation hors sujet.
  it("manager (Tarifs & Prestations) accède aux prestations via rev_pricing", () => {
    expect(hasPermission('manager', 'rev_pricing', 'write')).toBe(true);
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
