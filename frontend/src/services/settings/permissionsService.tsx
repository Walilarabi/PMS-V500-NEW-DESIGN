/**
 * FLOWTYM — Service de permissions RBAC (Phase 1.5).
 *
 * Pont entre la matrice RBAC définie dans RolesAccessPage (persistée
 * en localStorage sous "flowtym.roles.permissions") et le reste de
 * l'application. Permet de garder les composants découplés de la page
 * d'admin tout en exposant un hook simple `usePermission()` partout.
 *
 * Niveaux d'accès, du plus faible au plus fort :
 *   none < read < write < admin
 *
 * Un appel `usePermission('rev_pricing', 'write')` renvoie `true` si
 * le rôle courant a au moins le niveau `write` sur la capability
 * `rev_pricing`. Par défaut, en l'absence de session, on retourne
 * `true` (mode dev / pré-auth) — l'app reste utilisable en dev local.
 */
import React, { useMemo } from 'react';
import { useAuth } from '@/src/domains/auth/AuthContext';

export type AccessLevel = 'none' | 'read' | 'write' | 'admin';
export type RoleId = 'admin' | 'manager' | 'receptionist' | 'housekeeping' | 'reader';

export const ACCESS_LEVEL_ORDER: Record<AccessLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

const STORAGE_KEY = 'flowtym.roles.permissions';

/** Matrice par défaut — synchronisée avec RolesAccessPage.DEFAULT_MATRIX. */
const DEFAULT_PERMISSIONS: Record<RoleId, Record<string, AccessLevel>> = {
  admin: {},  // admin = tout, géré par le helper hasPermission ci-dessous
  manager: {
    res_view: 'admin', res_create: 'admin', res_groups: 'write',
    cli_view: 'admin', cli_export: 'write', cli_merge: 'write',
    rev_view: 'admin', rev_decisions: 'admin', rev_pricing: 'admin', rev_autopilot: 'write',
    fin_invoice: 'admin', fin_payment: 'admin', fin_close: 'admin', fin_export: 'admin',
    hk_status: 'read', hk_assign: 'read', hk_maintain: 'read',
    set_hotel: 'write', set_users: 'none', set_api: 'none', set_audit: 'read',
  },
  receptionist: {
    res_view: 'admin', res_create: 'admin', res_groups: 'read',
    cli_view: 'admin', cli_export: 'read', cli_merge: 'none',
    rev_view: 'read', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'write', fin_payment: 'write', fin_close: 'none', fin_export: 'none',
    hk_status: 'read', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'none', set_users: 'none', set_api: 'none', set_audit: 'none',
  },
  housekeeping: {
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'none', cli_export: 'none', cli_merge: 'none',
    rev_view: 'none', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'none',
    hk_status: 'admin', hk_assign: 'write', hk_maintain: 'write',
    set_hotel: 'none', set_users: 'none', set_api: 'none', set_audit: 'none',
  },
  reader: {
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'read', cli_export: 'none', cli_merge: 'none',
    rev_view: 'read', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'read',
    hk_status: 'read', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'read', set_users: 'none', set_api: 'none', set_audit: 'read',
  },
};

/** Normalise un rôle inconnu vers 'reader' (principe du moindre privilège). */
function normalizeRole(role: string | null | undefined): RoleId {
  if (!role) return 'reader';
  const r = role.toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'receptionist') return 'receptionist';
  if (r === 'housekeeping') return 'housekeeping';
  return 'reader';
}

/** Charge la matrice depuis le localStorage avec fallback sur les defaults. */
export function loadPermissionsMatrix(): Record<RoleId, Record<string, AccessLevel>> {
  if (typeof window === 'undefined') return DEFAULT_PERMISSIONS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERMISSIONS;
    const stored = JSON.parse(raw) as Record<RoleId, Record<string, AccessLevel>>;
    const merged = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)) as typeof DEFAULT_PERMISSIONS;
    for (const role of Object.keys(stored) as RoleId[]) {
      if (role === 'admin') continue; // admin verrouillé
      merged[role] = { ...merged[role], ...stored[role] };
    }
    return merged;
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

/**
 * Vérifie si un rôle dispose d'au moins le niveau requis pour une capability.
 * Hors composant React — utilisable dans les services / handlers.
 */
export function hasPermission(
  role: string | null | undefined,
  capability: string,
  requiredLevel: AccessLevel,
): boolean {
  const normalized = normalizeRole(role);
  if (normalized === 'admin') return true;
  const matrix = loadPermissionsMatrix();
  const level = matrix[normalized]?.[capability] ?? 'none';
  return ACCESS_LEVEL_ORDER[level] >= ACCESS_LEVEL_ORDER[requiredLevel];
}

/** Niveau effectif d'un rôle sur une capability donnée. */
export function getPermissionLevel(
  role: string | null | undefined,
  capability: string,
): AccessLevel {
  const normalized = normalizeRole(role);
  if (normalized === 'admin') return 'admin';
  const matrix = loadPermissionsMatrix();
  return matrix[normalized]?.[capability] ?? 'none';
}

// ─── React hooks & composants ─────────────────────────────────────────────

/**
 * Hook : `usePermission('rev_pricing', 'write')` → boolean.
 * Mode dev : si pas de session (auth non chargée), retourne `true` pour
 * ne pas bloquer le développement local.
 */
export function usePermission(capability: string, requiredLevel: AccessLevel): boolean {
  const auth = useAuth();
  return useMemo(() => {
    // Pas de session → mode dev, autoriser tout
    if (!auth.session) return true;
    return hasPermission(auth.session.role, capability, requiredLevel);
  }, [auth.session, capability, requiredLevel]);
}

/** Hook : retourne le rôle effectif du user courant (ou 'admin' en mode dev). */
export function useCurrentRole(): RoleId {
  const auth = useAuth();
  if (!auth.session) return 'admin'; // mode dev
  return normalizeRole(auth.session.role);
}

/**
 * Wrapper React qui n'affiche son contenu que si l'utilisateur courant a
 * la permission requise. Sinon, affiche un fallback (ou rien).
 *
 * Exemple :
 *   <RequirePermission capability="set_users" level="write">
 *     <button>Créer un utilisateur</button>
 *   </RequirePermission>
 */
export const RequirePermission: React.FC<{
  capability: string;
  level: AccessLevel;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ capability, level, fallback = null, children }) => {
  const allowed = usePermission(capability, level);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
};

/**
 * Bandeau standard "accès refusé" — réutilisable pour les vues complètes
 * verrouillées (ex : page Utilisateurs pour un rôle Réception).
 */
export const PermissionDeniedBanner: React.FC<{
  capability: string;
  required: AccessLevel;
}> = ({ capability, required }) => (
  <div className="rounded-2xl ring-1 ring-amber-100 bg-amber-50/60 px-4 py-3 text-[12.5px] text-amber-800 flex items-start gap-2">
    <svg viewBox="0 0 24 24" className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
    <div>
      <div className="font-medium">Accès restreint</div>
      <div className="text-amber-700/90 mt-0.5">
        Votre rôle ne dispose pas du niveau <strong>{required}</strong> requis pour la capability
        <code className="mx-1 px-1 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px]">{capability}</code>.
        Contactez un administrateur.
      </div>
    </div>
  </div>
);

