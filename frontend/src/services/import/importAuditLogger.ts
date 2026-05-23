/**
 * FLOWTYM — Journal d'audit des imports
 *
 * Trace chaque import (succès / partiel / échec) et conserve la dernière
 * snapshot du store cible, ce qui permet un rollback simple :
 *   - on enregistre l'état "avant"
 *   - le commit applique l'état "après"
 *   - rollback réécrit l'état "avant"
 *
 * Persisté en localStorage. Sans dépendance externe.
 */

import type { ImportResult, ImportSourceId } from './types';

const AUDIT_KEY = 'flowtym_import_audit_log';
const SNAPSHOT_KEY_PREFIX = 'flowtym_import_snapshot_';
const MAX_AUDIT_ROWS = 200;

export interface AuditRow extends ImportResult {}

interface SnapshotEntry {
  source: ImportSourceId;
  rollbackToken: string;
  storeKey: string;        // clé localStorage du store cible
  previousJson: string | null;
  createdAt: string;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function generateId(prefix: string): string {
  // crypto.randomUUID est dispo dans tous les navigateurs cibles 2026
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${uuid}`;
}

/**
 * Lit le journal d'audit complet (le plus récent d'abord).
 */
export function readAuditLog(): AuditRow[] {
  const rows = safeParse<AuditRow[]>(localStorage.getItem(AUDIT_KEY), []);
  return rows;
}

/**
 * Lit les N dernières entrées d'audit.
 */
export function readRecentAudit(limit = 10): AuditRow[] {
  return readAuditLog().slice(0, limit);
}

/**
 * Enregistre une entrée d'audit. Retourne l'entrée écrite.
 */
export function appendAuditEntry(entry: Omit<ImportResult, 'id'>): AuditRow {
  const row: AuditRow = {
    ...entry,
    id: generateId('imp'),
  };

  const rows = readAuditLog();
  rows.unshift(row);
  if (rows.length > MAX_AUDIT_ROWS) rows.length = MAX_AUDIT_ROWS;

  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(rows));
  } catch {
    // Si quota dépassé, on tronque et on retente une fois
    rows.length = Math.min(rows.length, 50);
    try {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(rows));
    } catch {
      // Lecture seule : on abandonne silencieusement
    }
  }
  return row;
}

/**
 * Capture l'état actuel d'un store (référencé par sa clé localStorage)
 * et crée un rollback token. À appeler AVANT d'écrire la nouvelle donnée.
 */
export function captureRollbackSnapshot(args: {
  source: ImportSourceId;
  storeKey: string;
}): string {
  const token = generateId('rb');
  const snapshot: SnapshotEntry = {
    source: args.source,
    rollbackToken: token,
    storeKey: args.storeKey,
    previousJson: localStorage.getItem(args.storeKey),
    createdAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(SNAPSHOT_KEY_PREFIX + token, JSON.stringify(snapshot));
  } catch {
    // Pas bloquant : si on n'a pas pu sauvegarder, le rollback ne sera pas possible
  }
  return token;
}

/**
 * Restaure l'état d'un store depuis un rollback token précédemment capturé.
 * Retourne true si le rollback a effectivement été appliqué.
 */
export function applyRollback(token: string): boolean {
  const raw = localStorage.getItem(SNAPSHOT_KEY_PREFIX + token);
  if (!raw) return false;
  const snap = safeParse<SnapshotEntry | null>(raw, null);
  if (!snap) return false;

  if (snap.previousJson === null) {
    localStorage.removeItem(snap.storeKey);
  } else {
    localStorage.setItem(snap.storeKey, snap.previousJson);
  }
  localStorage.removeItem(SNAPSHOT_KEY_PREFIX + token);
  return true;
}

/**
 * Indique si un rollback est encore possible pour un token donné
 * (utile pour griser un bouton dans l'historique).
 */
export function isRollbackAvailable(token: string | undefined): boolean {
  if (!token) return false;
  return localStorage.getItem(SNAPSHOT_KEY_PREFIX + token) !== null;
}
