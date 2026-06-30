/**
 * FLOWTYM — Paramètres · Rôles & Permissions (RBAC).
 *
 * Matrice de contrôle d'accès par rôle. Chaque rôle (admin, manager,
 * réception, housekeeping, lecteur) reçoit des permissions par
 * domaine fonctionnel (réservations, finance, RMS, paramètres, etc.)
 * avec 4 niveaux : Aucun / Lecture / Écriture / Admin.
 *
 * Phase 1 : persistance localStorage avec garde-fous (admin =
 * permissions verrouillées à "admin" partout). Phase 2 : application
 * réelle via middleware backend + RLS Supabase.
 *
 * Le décompte des comptes par rôle est lu en temps réel depuis
 * useConfigStore.users — alimente le score Sécurité du Control Center.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  UserCheck, Save, RotateCcw, CheckCircle2, Lock, AlertCircle, ShieldCheck, Info,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore } from '@/src/store/configStore';
import { useAuditLogger } from '@/src/hooks/settings/useAuditLogger';
import { usePermission, PermissionDeniedBanner } from '@/src/services/settings/permissionsService';
import { syncPermissionsMatrixToSupabase } from '@/src/services/settings/settingsPersistence';

const STORAGE_KEY = 'flowtym.roles.permissions';

type AccessLevel = 'none' | 'read' | 'write' | 'admin';

const ACCESS_LABEL: Record<AccessLevel, string> = {
  none: 'Aucun',
  read: 'Lecture',
  write: 'Écriture',
  admin: 'Admin',
};

const ACCESS_TONE: Record<AccessLevel, string> = {
  none: 'bg-slate-100 text-slate-500 ring-slate-200',
  read: 'bg-sky-50 text-sky-700 ring-sky-200',
  write: 'bg-violet-50 text-violet-700 ring-violet-200',
  admin: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const ACCESS_ORDER: AccessLevel[] = ['none', 'read', 'write', 'admin'];

type RoleId = 'admin' | 'manager' | 'receptionist' | 'housekeeping' | 'reader';

const ROLES: { id: RoleId; label: string; description: string; locked?: boolean }[] = [
  { id: 'admin',        label: 'Administrateur', description: 'Accès complet à tous les modules — permissions verrouillées sur Admin.', locked: true },
  { id: 'manager',      label: 'Manager',        description: 'Direction d\'exploitation : Revenue, Finance, Réservations.' },
  { id: 'receptionist', label: 'Réception',      description: 'Check-in / check-out, encaissements, gestion clients.' },
  { id: 'housekeeping', label: 'Housekeeping',   description: 'Statuts chambres, maintenance, objets trouvés.' },
  { id: 'reader',       label: 'Lecteur',        description: 'Accès en lecture seule (rapport, KPIs).' },
];

interface Capability {
  id: string;
  label: string;
  description: string;
}

interface CapabilityGroup {
  id: string;
  label: string;
  capabilities: Capability[];
}

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: 'reservations',
    label: 'Réservations',
    capabilities: [
      { id: 'res_view',   label: 'Voir les réservations',     description: 'Liste, fiche détail, historique.' },
      { id: 'res_create', label: 'Créer / modifier',          description: 'Ajouter, éditer, annuler des réservations.' },
      { id: 'res_groups', label: 'Groupes & allotements',     description: 'Gérer les blocages groupes.' },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    capabilities: [
      { id: 'cli_view',   label: 'Fiches clients',            description: 'Cardex, sociétés, historique séjours.' },
      { id: 'cli_export', label: 'Export données RGPD',       description: 'Droit d\'accès / portabilité.' },
      { id: 'cli_merge',  label: 'Fusion / suppression',      description: 'Dédoublonnage, droit à l\'oubli.' },
    ],
  },
  {
    id: 'revenue',
    label: 'Revenue & RMS',
    capabilities: [
      { id: 'rev_view',     label: 'Dashboard RMS',           description: 'Consultation KPI, tableau Pro.' },
      { id: 'rev_decisions',label: 'Accepter / refuser recos',description: 'Valider les recommandations tarifaires.' },
      { id: 'rev_pricing',  label: 'Modifier le calendrier',  description: 'Édition directe des tarifs.' },
      { id: 'rev_autopilot',label: 'Autopilote',              description: 'Activer/désactiver le push automatique.' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    capabilities: [
      { id: 'fin_invoice',  label: 'Facturer',                description: 'Émettre / modifier des factures.' },
      { id: 'fin_payment',  label: 'Encaissements',           description: 'Saisir / refunder paiements.' },
      { id: 'fin_close',    label: 'Clôture journalière',     description: 'Verrouiller la journée comptable.' },
      { id: 'fin_export',   label: 'Export comptable',        description: 'FEC, journaux, balances.' },
    ],
  },
  {
    id: 'housekeeping',
    label: 'Housekeeping',
    capabilities: [
      { id: 'hk_status',    label: 'Statuts chambres',        description: 'Marquer propre / sale / inspectée.' },
      { id: 'hk_assign',    label: 'Affectations personnel',  description: 'Distribuer les chambres au personnel.' },
      { id: 'hk_maintain',  label: 'Maintenance & OOO',       description: 'Déclarer hors service, ouvrir tickets.' },
    ],
  },
  {
    id: 'settings',
    label: 'Paramètres',
    capabilities: [
      { id: 'set_hotel',        label: 'Informations établissement', description: 'Éditer le profil hôtel.' },
      { id: 'set_rooms',        label: 'Chambres & inventaire',      description: 'Typologies, chambres physiques, étages.' },
      { id: 'set_users',        label: 'Utilisateurs & rôles',       description: 'CRUD comptes + permissions.' },
      { id: 'set_api',          label: 'API & Webhooks',             description: 'Créer / révoquer des clés.' },
      { id: 'set_integrations', label: 'Intégrations & OTAs',        description: 'Partenaires de connectivité, channel managers.' },
      { id: 'set_fiscal',       label: 'Fiscalité',                  description: 'Paramétrage fiscal + clôture.' },
      { id: 'set_audit',        label: 'Audit / Logs',               description: 'Consulter le journal d\'audit.' },
      { id: 'set_backups',      label: 'Sauvegardes',                description: 'Lancer / restaurer une sauvegarde.' },
      { id: 'set_rgpd',         label: 'RGPD',                       description: 'Exports portabilité, droit à l\'oubli.' },
    ],
  },
];

type PermissionsMatrix = Record<RoleId, Record<string, AccessLevel>>;

const DEFAULT_MATRIX: PermissionsMatrix = {
  admin: Object.fromEntries(
    CAPABILITY_GROUPS.flatMap((g) => g.capabilities.map((c) => [c.id, 'admin' as AccessLevel])),
  ) as Record<string, AccessLevel>,
  manager: {
    res_view: 'admin', res_create: 'admin', res_groups: 'write',
    cli_view: 'admin', cli_export: 'write', cli_merge: 'write',
    rev_view: 'admin', rev_decisions: 'admin', rev_pricing: 'admin', rev_autopilot: 'write',
    fin_invoice: 'admin', fin_payment: 'admin', fin_close: 'admin', fin_export: 'admin',
    hk_status: 'read', hk_assign: 'read', hk_maintain: 'read',
    set_hotel: 'write', set_rooms: 'write', set_users: 'none', set_api: 'none',
    set_integrations: 'write', set_fiscal: 'write', set_audit: 'read',
    set_backups: 'read', set_rgpd: 'read',
  },
  receptionist: {
    res_view: 'admin', res_create: 'admin', res_groups: 'read',
    cli_view: 'admin', cli_export: 'read', cli_merge: 'none',
    rev_view: 'read', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'write', fin_payment: 'write', fin_close: 'none', fin_export: 'none',
    hk_status: 'read', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'none', set_rooms: 'none', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'none',
    set_backups: 'none', set_rgpd: 'none',
  },
  housekeeping: {
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'none', cli_export: 'none', cli_merge: 'none',
    rev_view: 'none', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'none',
    hk_status: 'admin', hk_assign: 'write', hk_maintain: 'write',
    set_hotel: 'none', set_rooms: 'read', set_users: 'none', set_api: 'none',
    set_integrations: 'none', set_fiscal: 'none', set_audit: 'none',
    set_backups: 'none', set_rgpd: 'none',
  },
  reader: {
    res_view: 'read', res_create: 'none', res_groups: 'none',
    cli_view: 'read', cli_export: 'none', cli_merge: 'none',
    rev_view: 'read', rev_decisions: 'none', rev_pricing: 'none', rev_autopilot: 'none',
    fin_invoice: 'none', fin_payment: 'none', fin_close: 'none', fin_export: 'read',
    hk_status: 'read', hk_assign: 'none', hk_maintain: 'none',
    set_hotel: 'read', set_rooms: 'read', set_users: 'none', set_api: 'none',
    set_integrations: 'read', set_fiscal: 'read', set_audit: 'read',
    set_backups: 'read', set_rgpd: 'read',
  },
};

function loadMatrix(): PermissionsMatrix {
  if (typeof window === 'undefined') return DEFAULT_MATRIX;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MATRIX;
    const stored = JSON.parse(raw) as PermissionsMatrix;
    // Merge avec defaults pour gérer les nouvelles capabilities ajoutées
    const merged: PermissionsMatrix = JSON.parse(JSON.stringify(DEFAULT_MATRIX));
    for (const role of Object.keys(stored) as RoleId[]) {
      if (role === 'admin') continue; // jamais override
      merged[role] = { ...merged[role], ...stored[role] };
    }
    return merged;
  } catch { return DEFAULT_MATRIX; }
}

function saveMatrix(m: PermissionsMatrix) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}

export const RolesAccessPage: React.FC = () => {
  const users = useConfigStore((s) => s.users);
  const [matrix, setMatrix] = useState<PermissionsMatrix>(() => loadMatrix());
  const [dirty, setDirty] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleId>('manager');
  const [toast, setToast] = useState<string | null>(null);

  // RBAC — la gestion fine des permissions est réservée à l'admin (set_users = admin)
  const canRead = usePermission('set_users', 'read');
  const canEditMatrix = usePermission('set_users', 'admin');
  const audit = useAuditLogger();

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function setAccess(role: RoleId, capId: string, level: AccessLevel) {
    if (role === 'admin') return; // verrouillé
    if (!canEditMatrix) return; // RBAC : lecture seule
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [capId]: level } }));
    setDirty(true);
  }

  function saveAll() {
    saveMatrix(matrix);
    setDirty(false);
    audit({
      action: 'permission_changed',
      module: 'security_backups',
      detail: 'Matrice RBAC mise à jour',
      meta: { roles: Object.keys(matrix).filter((r) => r !== 'admin') },
    });
    // Sync best-effort vers Supabase (RLS limite aux admins)
    void syncPermissionsMatrixToSupabase(matrix);
    notify('Permissions enregistrées');
  }

  function resetRole(role: RoleId) {
    if (role === 'admin') return;
    if (!confirm(`Réinitialiser le rôle "${ROLES.find((r) => r.id === role)?.label}" à ses permissions par défaut ?`)) return;
    setMatrix((m) => ({ ...m, [role]: { ...DEFAULT_MATRIX[role] } }));
    setDirty(true);
  }

  // Comptes par rôle (lus en temps réel depuis useConfigStore)
  const usersByRole = useMemo(() => {
    const m = new Map<RoleId, number>();
    users.forEach((u) => {
      if (!u.active) return;
      const r = (u.role === 'admin' || u.role === 'manager' || u.role === 'receptionist' || u.role === 'housekeeping') ? u.role : 'reader';
      m.set(r as RoleId, (m.get(r as RoleId) ?? 0) + 1);
    });
    return m;
  }, [users]);

  const activeRoleConfig = ROLES.find((r) => r.id === activeRole)!;
  const isLocked = !!activeRoleConfig.locked;

  if (!canRead) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50/60">
        <div className="w-full px-6 pt-6 pb-10">
          <PermissionDeniedBanner capability="set_users" required="read" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Sécurité & Administration</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Rôles & permissions</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Matrice RBAC — qui peut faire quoi sur quel module. Le principe de moindre privilège
                guide la configuration par défaut.
              </p>
            </div>
          </div>
          <button
            onClick={() => canEditMatrix && saveAll()}
            disabled={!dirty || !canEditMatrix}
            title={!canEditMatrix ? 'Permission requise : set_users (admin)' : undefined}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" /> Enregistrer
          </button>
        </header>

        {/* Bandeau verrouillage admin */}
        <section className="rounded-2xl ring-1 ring-violet-100 bg-violet-50/40 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-[12.5px] text-slate-700">
            <strong className="text-slate-900">Principe de séparation des privilèges :</strong> le rôle
            Administrateur a accès en mode Admin à toutes les capacités (verrouillé). Pour confier des
            tâches précises sans donner tout pouvoir, utilisez les autres rôles.
          </div>
        </section>

        {/* Layout 2 col : rôles à gauche, matrice à droite */}
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* Liste des rôles */}
          <aside className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden self-start">
            <header className="px-4 py-2.5 border-b border-slate-100 text-[12px] font-semibold text-slate-900">
              Rôles ({ROLES.length})
            </header>
            <ul className="divide-y divide-slate-50">
              {ROLES.map((r) => {
                const count = usersByRole.get(r.id) ?? 0;
                const isActive = r.id === activeRole;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setActiveRole(r.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left flex items-start gap-2 transition-colors',
                        isActive ? 'bg-violet-50/60' : 'hover:bg-slate-50',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('text-[13px] font-semibold', isActive ? 'text-violet-700' : 'text-slate-900')}>
                            {r.label}
                          </span>
                          {r.locked && <Lock className="w-3 h-3 text-slate-400" />}
                        </div>
                        <div className="text-[10.5px] text-slate-500 line-clamp-2 mt-0.5">{r.description}</div>
                      </div>
                      <span className={cn(
                        'shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[10.5px] font-semibold',
                        count > 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400',
                      )}>
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Matrice de permissions */}
          <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
            <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
                  {activeRoleConfig.label}
                  {isLocked && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Verrouillé
                    </span>
                  )}
                </h2>
                <p className="text-[11.5px] text-slate-500 mt-0.5">{activeRoleConfig.description}</p>
              </div>
              {!isLocked && (
                <button
                  onClick={() => resetRole(activeRole)}
                  className="px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Réinitialiser ce rôle
                </button>
              )}
            </header>

            <div className="divide-y divide-slate-100">
              {CAPABILITY_GROUPS.map((g) => (
                <div key={g.id}>
                  <div className="px-5 py-2 bg-slate-50/60 text-[10.5px] uppercase tracking-wider font-semibold text-slate-500">
                    {g.label}
                  </div>
                  <ul>
                    {g.capabilities.map((c) => {
                      const current = matrix[activeRole][c.id] ?? 'none';
                      return (
                        <li key={c.id} className="px-5 py-2.5 flex items-center gap-4 hover:bg-slate-50/60">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] font-medium text-slate-900">{c.label}</div>
                            <div className="text-[11px] text-slate-500">{c.description}</div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0" role="radiogroup" aria-label={c.label}>
                            {ACCESS_ORDER.map((lvl) => (
                              <button
                                key={lvl}
                                disabled={isLocked}
                                onClick={() => setAccess(activeRole, c.id, lvl)}
                                className={cn(
                                  'px-2 py-1 text-[11px] font-semibold ring-1 transition-all',
                                  lvl === 'none' && 'rounded-l-md',
                                  lvl === 'admin' && 'rounded-r-md',
                                  current === lvl
                                    ? ACCESS_TONE[lvl] + ' ring-inset z-10'
                                    : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50',
                                  isLocked && 'cursor-not-allowed opacity-60',
                                )}
                                title={ACCESS_LABEL[lvl]}
                              >
                                {ACCESS_LABEL[lvl]}
                              </button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Légende */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-4">
          <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-2.5">Légende des niveaux</h3>
          <div className="grid gap-2 md:grid-cols-4">
            {ACCESS_ORDER.map((lvl) => (
              <div key={lvl} className="flex items-start gap-2">
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md ring-1 ring-inset text-[11px] font-semibold', ACCESS_TONE[lvl])}>
                  {ACCESS_LABEL[lvl]}
                </span>
                <div className="text-[11.5px] text-slate-600">
                  {lvl === 'none' && 'Module invisible / inaccessible'}
                  {lvl === 'read' && 'Consultation uniquement (read-only)'}
                  {lvl === 'write' && 'Création / modification autorisée'}
                  {lvl === 'admin' && 'Tous droits dont suppression et config'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Phase 2 info */}
        <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong>Phase 2 :</strong> application réelle des permissions via middleware backend + RLS
            Supabase. Phase 1 = configuration et audit, les contrôles d'accès ne sont pas encore
            appliqués côté serveur.
          </div>
        </div>

        {dirty && (
          <div className="rounded-xl ring-1 ring-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-800 font-medium inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Modifications non enregistrées — pensez à sauvegarder.
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}
      </div>
    </div>
  );
};
