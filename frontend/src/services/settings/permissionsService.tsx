/**
 * FLOWTYM — Service de permissions RBAC.
 *
 * Source de vérité unique des rôles : enum Postgres `admin_user_role`
 * (cf. supabase.types.ts → AdminUserRole). Les 6 rôles métier hôteliers :
 *
 *   direction          — propriétaire / direction d'exploitation (tout admin)
 *   reception          — front-office : check-in/out, encaissement, factures
 *   gouvernante        — chef housekeeping : statuts + affectations
 *   femme_de_chambre   — exécution ménage : statut chambres uniquement
 *   maintenance        — déclarations maintenance / OOO
 *   breakfast          — service petit-déjeuner : voit les arrivées du jour
 *
 * Pont entre la matrice RBAC (persistée localStorage + Supabase) et le
 * reste de l'app via `usePermission()` / `hasPermission()`.
 *
 * Niveaux d'accès (croissant) : none < read < write < admin.
 *
 * Mode dev (pas de session auth) → tout est autorisé pour ne pas
 * bloquer le développement local.
 *
 * Rétro-compatibilité : les anciens RoleIds (admin / manager /
 * receptionist / housekeeping / reader) sont acceptés et mappés vers
 * leur équivalent métier — utile pour les mocks du configStore et les
 * éventuelles données legacy en DB ou localStorage.
 */
import React, { useMemo } from 'react';
import { useAuth } from '@/src/domains/auth/AuthContext';

export type AccessLevel = 'none' | 'read' | 'write' | 'admin';

/**
 * Identifiants de rôles RBAC alignés sur l'enum Postgres `admin_user_role`.
 * `direction` joue le rôle de "super-admin" (toutes capabilities = admin,
 * verrouillé côté UI matrix).
 */
export type RoleId =
  | 'direction'
  | 'reception'
  | 'gouvernante'
  | 'femme_de_chambre'
  | 'maintenance'
  | 'breakfast';

export const ACCESS_LEVEL_ORDER: Record<AccessLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

/**
 * Clé localStorage v2 : la matrice v1 utilisait des RoleIds anglais
 * obsolètes (admin/manager/receptionist/...). Migration automatique via
 * une nouvelle clé pour invalider les caches existants chez les users.
 */
const STORAGE_KEY = 'flowtym.roles.permissions.v2';

/** Liste explicite des rôles autres que `direction` (pour itération). */
const OPERATIONAL_ROLES: ReadonlyArray<Exclude<RoleId, 'direction'>> = [
  'reception',
  'gouvernante',
  'femme_de_chambre',
  'maintenance',
  'breakfast',
];

/**
 * Matrice par défaut métier. `direction` reçoit 'admin' partout via
 * `hasPermission` (court-circuit) — pas besoin de la définir ici.
 */
const DEFAULT_PERMISSIONS: Record<RoleId, Record<string, AccessLevel>> = {
  direction: {}, // = 'admin' partout via court-circuit (voir hasPermission)
  reception: {
    res_view: 'admin', res_create: 'admin', res_groups: 'write',
    cli_view: 'admin', cli_export: 'read', cli_merge: 'none',
    rev_view: 'read', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'write', fin_payment: 'write', fin_close: 'none', fin_export: 'none',
    hk_status: 'read', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'none', set_rooms: 'none', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'none',
    set_backups: 'none', set_rgpd: 'none',
  },
  gouvernante: {
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'read', cli_export: 'none', cli_merge: 'none',
    rev_view: 'none', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'none',
    hk_status: 'admin', hk_assign: 'admin', hk_maintain: 'write',
    set_hotel: 'none', set_rooms: 'read', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'none',
    set_backups: 'none', set_rgpd: 'none',
  },
  femme_de_chambre: {
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'none', cli_export: 'none', cli_merge: 'none',
    rev_view: 'none', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'none',
    hk_status: 'write', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'none', set_rooms: 'none', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'none',
    set_backups: 'none', set_rgpd: 'none',
  },
  maintenance: {
    res_view: 'none', res_create: 'none', res_groups: 'none',
    cli_view: 'none', cli_export: 'none', cli_merge: 'none',
    rev_view: 'none', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'none',
    hk_status: 'read', hk_assign: 'none', hk_maintain: 'admin',
    set_hotel: 'none', set_rooms: 'read', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'none',
    set_backups: 'none', set_rgpd: 'none',
  },
  breakfast: {
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'none', cli_export: 'none', cli_merge: 'none',
    rev_view: 'none', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'none',
    hk_status: 'none', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'none', set_rooms: 'none', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'none',
    set_backups: 'none', set_rgpd: 'none',
  },
};

/**
 * Mapping rétro-compat : aliases historiques → RoleId métier.
 * Couvre les RoleIds RBAC v1 et quelques variantes vues dans le code
 * (`owner`, `admin`, `accountant`, etc.). Tout rôle non listé tombe sur
 * `breakfast` (le rôle le plus restreint = principe du moindre privilège).
 */
const ROLE_ALIASES: Record<string, RoleId> = {
  // Nomenclature DB (enum admin_user_role) — identité
  direction: 'direction',
  reception: 'reception',
  gouvernante: 'gouvernante',
  femme_de_chambre: 'femme_de_chambre',
  maintenance: 'maintenance',
  breakfast: 'breakfast',
  // RoleIds RBAC v1 (legacy)
  admin: 'direction',
  manager: 'direction',
  receptionist: 'reception',
  housekeeping: 'gouvernante',
  reader: 'breakfast',
  // Autres aliases observés dans le code
  owner: 'direction',
  accountant: 'reception',
  rms: 'direction',
};

/** Normalise un rôle vers un RoleId métier. Fallback : `breakfast`. */
function normalizeRole(role: string | null | undefined): RoleId {
  if (!role) return 'breakfast';
  const r = role.toLowerCase().trim();
  return ROLE_ALIASES[r] ?? 'breakfast';
}

/** Charge la matrice depuis le localStorage avec fallback sur les defaults. */
export function loadPermissionsMatrix(): Record<RoleId, Record<string, AccessLevel>> {
  if (typeof window === 'undefined') return DEFAULT_PERMISSIONS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERMISSIONS;
    const stored = JSON.parse(raw) as Partial<Record<RoleId, Record<string, AccessLevel>>>;
    const merged = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)) as typeof DEFAULT_PERMISSIONS;
    for (const role of OPERATIONAL_ROLES) {
      if (stored[role]) merged[role] = { ...merged[role], ...stored[role] };
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
  if (normalized === 'direction') return true;
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
  if (normalized === 'direction') return 'admin';
  const matrix = loadPermissionsMatrix();
  return matrix[normalized]?.[capability] ?? 'none';
}

// ─── React hooks & composants ─────────────────────────────────────────────

/**
 * Hook : `usePermission('rev_pricing', 'write')` → boolean.
 * Mode dev : si pas de session (auth non chargée), retourne `true` pour
 * ne pas bloquer le développement local.
 *
 * Toute permission refusée incrémente le compteur `rbac_denied` du
 * service de monitoring (debug / dashboard ops).
 */
export function usePermission(capability: string, requiredLevel: AccessLevel): boolean {
  const auth = useAuth();
  return useMemo(() => {
    if (!auth.session) return true;
    const allowed = hasPermission(auth.session.role, capability, requiredLevel);
    if (!allowed && typeof window !== 'undefined') {
      import('./monitoringService')
        .then((m) =>
          m.captureMetric('rbac_denied', 1, {
            capability,
            requiredLevel,
            role: auth.session?.role ?? 'unknown',
          }),
        )
        .catch(() => { /* silencieux */ });
    }
    return allowed;
  }, [auth.session, capability, requiredLevel]);
}

/** Hook : retourne le rôle effectif du user courant (ou 'direction' en mode dev). */
export function useCurrentRole(): RoleId {
  const auth = useAuth();
  if (!auth.session) return 'direction';
  return normalizeRole(auth.session.role);
}

/**
 * Hook combiné : retourne `{ canRead, canWrite, canAdmin, DeniedBanner }`
 * pour la capability donnée. Le `DeniedBanner` est un composant prêt à
 * être rendu en early-return si `!canRead`. Évite la duplication sur
 * toutes les pages Paramètres.
 */
export function usePagePermission(capability: string): {
  canRead: boolean;
  canWrite: boolean;
  canAdmin: boolean;
  DeniedBanner: React.FC;
} {
  const canRead = usePermission(capability, 'read');
  const canWrite = usePermission(capability, 'write');
  const canAdmin = usePermission(capability, 'admin');
  const DeniedBanner: React.FC = () => (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10">
        <PermissionDeniedBanner capability={capability} required="read" />
      </div>
    </div>
  );
  return { canRead, canWrite, canAdmin, DeniedBanner };
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
  <div
    role="alert"
    aria-live="polite"
    className="rounded-2xl ring-1 ring-amber-100 bg-amber-50/60 px-4 py-3 text-[12.5px] text-amber-800 flex items-start gap-2"
  >
    <svg viewBox="0 0 24 24" className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
