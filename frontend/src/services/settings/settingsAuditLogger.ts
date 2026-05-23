/**
 * FLOWTYM — Settings Audit Logger.
 *
 * Trace les actions structurantes du Control Center (diagnostic lancé,
 * alerte résolue, export config) dans un journal local persistant.
 * Permet de retracer qui a déclenché quoi (RM, admin, autopilote).
 */

import type { ModuleKey } from '@/src/types/settings/diagnostic';

const STORAGE_KEY = 'flowtym.settings.audit';
const MAX_ENTRIES = 200;

export type AuditAction =
  | 'diagnostic_run'
  | 'alert_resolved'
  | 'alert_dismissed'
  | 'config_exported'
  | 'dashboard_customized'
  | 'module_inspected'
  | 'guided_step_resumed';

export interface AuditEntry {
  id: string;
  at: string;
  action: AuditAction;
  module?: ModuleKey;
  detail?: string;
  userId?: string | null;
}

function load(): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AuditEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist(arr: AuditEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, MAX_ENTRIES)));
  } catch {/* quota */}
}

export function logAudit(entry: Omit<AuditEntry, 'id' | 'at'>): AuditEntry {
  const full: AuditEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const arr = load();
  arr.unshift(full);
  persist(arr);
  return full;
}

export function readAudit(limit = 50): AuditEntry[] {
  return load().slice(0, limit);
}

export function clearAudit() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
