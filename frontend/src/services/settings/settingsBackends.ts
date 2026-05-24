/**
 * FLOWTYM — Client des Edge Functions backend Paramètres.
 *
 * Wrap les appels HTTP vers les 3 Edge Functions (trigger-backup,
 * revoke-session, api-key-create). Gestion uniforme des erreurs et
 * du token d'auth.
 *
 * Best-effort : si Supabase indisponible (offline, env non configuré),
 * retourne `{ ok: false, error: 'offline' }` sans lever.
 */
import { supabase } from '@/src/lib/supabase';

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function callFunction<T>(name: string, body: unknown): Promise<Result<T>> {
  try {
    const { data, error } = await supabase.functions.invoke<T>(name, { body });
    if (error) {
      return { ok: false, error: error.message, status: (error as { status?: number }).status };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'offline' };
  }
}

// ─── trigger-backup ───────────────────────────────────────────────────────

export interface BackupScheduleResponse {
  runId: string;
  scope: 'full' | 'daily' | 'critical';
  status: 'scheduled' | 'running';
  scheduledAt: string;
  message: string;
}

export function triggerBackup(scope: 'full' | 'daily' | 'critical' = 'daily') {
  return callFunction<BackupScheduleResponse>('trigger-backup', { scope });
}

// ─── revoke-session ───────────────────────────────────────────────────────

export interface RevokeSessionResponse {
  revoked: boolean;
  scope: 'others' | 'global';
  userId: string;
  revokedAt: string;
}

export function revokeOtherSessions() {
  return callFunction<RevokeSessionResponse>('revoke-session', { scope: 'others' });
}

export function revokeAllSessions() {
  return callFunction<RevokeSessionResponse>('revoke-session', { scope: 'all' });
}

// ─── api-key-create ───────────────────────────────────────────────────────

export interface ApiKeyCreateResponse {
  id: string;
  label: string;
  prefix: string;
  secret: string;          // visible une seule fois
  scopes: string[];
  createdAt: string;
  warning: string;
}

export function createApiKey(label: string, scopes: string[]) {
  return callFunction<ApiKeyCreateResponse>('api-key-create', { label, scopes });
}
