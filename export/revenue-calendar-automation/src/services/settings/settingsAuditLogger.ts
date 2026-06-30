/**
 * FLOWTYM — Settings Audit Logger (Phase 3).
 *
 * Trace les actions structurantes du Control Center (diagnostic lancé,
 * alerte résolue, export config, mutations CRUD critiques) dans un
 * journal local persistant + Supabase best-effort.
 *
 * Schéma enrichi en Phase 3 :
 *   • severity : info / warning / critical (filtrable côté UI)
 *   • actor    : userId + email (lu depuis useAuth.session)
 *   • meta     : payload structuré libre (id entité touchée, diff)
 *
 * Les entrées sont gardées 200 max en local (rotation FIFO) et
 * synchronisées vers la table settings_audit_log côté Supabase.
 */

import type { ModuleKey } from '@/src/types/settings/diagnostic';

const STORAGE_KEY = 'flowtym.settings.audit';
const MAX_ENTRIES = 200;

export type AuditAction =
  // Phase 1 — diagnostic & alertes
  | 'diagnostic_run'
  | 'alert_resolved'
  | 'alert_dismissed'
  | 'config_exported'
  | 'dashboard_customized'
  | 'module_inspected'
  | 'guided_step_resumed'
  // Phase 3 — mutations CRUD critiques
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'role_changed'
  | 'permission_changed'
  | 'permission_denied'
  | 'virtual_room_created'
  | 'virtual_room_deleted'
  | 'rate_plan_imported'
  | 'rate_plan_integrated'
  | 'event_source_added'
  | 'event_source_removed'
  | 'partner_added'
  | 'partner_removed'
  | 'hotel_switched'
  | 'system_error';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditActor {
  userId: string | null;
  email: string | null;
  role: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  action: AuditAction;
  severity: AuditSeverity;
  module?: ModuleKey;
  detail?: string;
  actor?: AuditActor;
  /** Données structurées libres (id de l'entité touchée, diff, etc.). */
  meta?: Record<string, unknown>;
  /** Champ legacy : conservé pour compat ascendante (non utilisé en Phase 3+). */
  userId?: string | null;
}

const DEFAULT_SEVERITY: Record<AuditAction, AuditSeverity> = {
  diagnostic_run: 'info',
  alert_resolved: 'info',
  alert_dismissed: 'info',
  config_exported: 'info',
  dashboard_customized: 'info',
  module_inspected: 'info',
  guided_step_resumed: 'info',
  user_created: 'warning',
  user_updated: 'info',
  user_deleted: 'critical',
  role_changed: 'critical',
  permission_changed: 'critical',
  permission_denied: 'warning',
  virtual_room_created: 'info',
  virtual_room_deleted: 'warning',
  rate_plan_imported: 'info',
  rate_plan_integrated: 'warning',
  event_source_added: 'info',
  event_source_removed: 'info',
  partner_added: 'warning',
  partner_removed: 'warning',
  hotel_switched: 'info',
  system_error: 'critical',
};

function load(): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AuditEntry[];
    // Migration douce : ajouter severity aux anciennes entrées
    return Array.isArray(arr)
      ? arr.map((e) => ({ ...e, severity: e.severity ?? DEFAULT_SEVERITY[e.action] ?? 'info' }))
      : [];
  } catch {
    return [];
  }
}

function persist(arr: AuditEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota */
  }
}

/**
 * Enregistre une entrée d'audit. Tout est optionnel sauf `action`.
 * La sévérité est inférée si non fournie. Le sync Supabase est
 * best-effort (non bloquant, ne lève jamais).
 */
export function logAudit(entry: Omit<AuditEntry, 'id' | 'at' | 'severity'> & { severity?: AuditSeverity }): AuditEntry {
  const full: AuditEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
    at: new Date().toISOString(),
    severity: entry.severity ?? DEFAULT_SEVERITY[entry.action] ?? 'info',
  };
  const arr = load();
  arr.unshift(full);
  persist(arr);

  // Sync Supabase best-effort (import dynamique pour éviter cycle)
  if (typeof window !== 'undefined') {
    import('./settingsPersistence')
      .then((m) => m.syncAuditEntryToSupabase?.(full))
      .catch(() => { /* offline ok */ });
  }

  return full;
}

export function readAudit(limit = 50): AuditEntry[] {
  return load().slice(0, limit);
}

export function clearAudit() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

// ─── Labels & tones pour les vues UI ──────────────────────────────────────

export const ACTION_LABEL: Record<AuditAction, string> = {
  diagnostic_run: 'Diagnostic lancé',
  alert_resolved: 'Alerte résolue',
  alert_dismissed: 'Alerte écartée',
  config_exported: 'Configuration exportée',
  dashboard_customized: 'Tableau personnalisé',
  module_inspected: 'Module inspecté',
  guided_step_resumed: 'Étape config reprise',
  user_created: 'Utilisateur créé',
  user_updated: 'Utilisateur modifié',
  user_deleted: 'Utilisateur supprimé',
  role_changed: 'Rôle modifié',
  permission_changed: 'Permission modifiée',
  permission_denied: 'Permission refusée',
  virtual_room_created: 'Chambre virtuelle créée',
  virtual_room_deleted: 'Chambre virtuelle supprimée',
  rate_plan_imported: 'Plans tarifaires importés',
  rate_plan_integrated: 'Plans tarifaires intégrés',
  event_source_added: 'Source événements ajoutée',
  event_source_removed: 'Source événements supprimée',
  partner_added: 'Partenaire ajouté',
  partner_removed: 'Partenaire supprimé',
  hotel_switched: 'Hôtel basculé',
  system_error: 'Erreur système',
};

export const SEVERITY_TONE: Record<AuditSeverity, string> = {
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  critical: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  info: 'Info',
  warning: 'Attention',
  critical: 'Critique',
};
