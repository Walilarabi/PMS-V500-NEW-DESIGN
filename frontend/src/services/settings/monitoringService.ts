/**
 * FLOWTYM — Service de monitoring & observabilité (Phase 3).
 *
 * Capture les erreurs runtime et les métriques d'usage (RBAC denied,
 * sync failed, etc.) dans un ring buffer local + propagation Supabase
 * best-effort via le canal audit (severity=critical pour les erreurs).
 *
 * Volontairement minimaliste : pas de dépendance Sentry/Datadog,
 * tout est stocké en localStorage avec rotation à 100 entrées.
 *
 * API :
 *   captureError(error, context?)   → logue + audit critical
 *   captureMetric(name, value, tags?) → compteur cumulatif
 *   readErrorBuffer()                → liste pour SystemHealthPage
 *   readMetrics()                    → snapshot des compteurs
 *   resetMetrics()                   → purge (admin only via UI)
 */

import { logAudit } from './settingsAuditLogger';

const ERROR_KEY = 'flowtym.monitoring.errors';
const METRICS_KEY = 'flowtym.monitoring.metrics';
const MAX_ERRORS = 100;

export interface CapturedError {
  id: string;
  at: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
}

export interface MetricEntry {
  name: string;
  count: number;
  lastAt: string;
  /** Liste des tags les plus récents (max 10 entrées) pour debug. */
  recentTags: Array<{ at: string; tags: Record<string, string | number> }>;
}

type MetricsStore = Record<string, MetricEntry>;

// ─── Errors ───────────────────────────────────────────────────────────────

function loadErrors(): CapturedError[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ERROR_KEY);
    return raw ? (JSON.parse(raw) as CapturedError[]) : [];
  } catch {
    return [];
  }
}

function persistErrors(arr: CapturedError[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ERROR_KEY, JSON.stringify(arr.slice(0, MAX_ERRORS)));
  } catch {
    /* quota */
  }
}

/**
 * Capture une erreur runtime. Toujours non bloquant — utilisable depuis
 * un ErrorBoundary, un catch async, un onError window.
 */
export function captureError(error: Error | unknown, context?: Record<string, unknown>): CapturedError {
  const err = error instanceof Error ? error : new Error(String(error));
  const entry: CapturedError = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    message: err.message,
    stack: err.stack,
    context,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
  const arr = loadErrors();
  arr.unshift(entry);
  persistErrors(arr);

  // Trace dans l'audit (critical) — silencieux si offline
  try {
    logAudit({
      action: 'system_error',
      severity: 'critical',
      detail: err.message.slice(0, 200),
      meta: { ...context, url: entry.url, errorId: entry.id },
    });
  } catch {
    /* ne jamais échouer dans captureError */
  }

  return entry;
}

export function readErrorBuffer(limit = 50): CapturedError[] {
  return loadErrors().slice(0, limit);
}

export function clearErrorBuffer() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ERROR_KEY);
}

// ─── Metrics ──────────────────────────────────────────────────────────────

function loadMetrics(): MetricsStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(METRICS_KEY);
    return raw ? (JSON.parse(raw) as MetricsStore) : {};
  } catch {
    return {};
  }
}

function persistMetrics(m: MetricsStore) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(METRICS_KEY, JSON.stringify(m));
  } catch {
    /* quota */
  }
}

/**
 * Incrémente un compteur métier (rbac_denied, sync_failed, etc.).
 * Les tags servent uniquement à l'inspection — pas d'agrégation par tag.
 */
export function captureMetric(
  name: string,
  value = 1,
  tags?: Record<string, string | number>,
): MetricEntry {
  const store = loadMetrics();
  const existing = store[name];
  const updated: MetricEntry = {
    name,
    count: (existing?.count ?? 0) + value,
    lastAt: new Date().toISOString(),
    recentTags: existing?.recentTags
      ? [{ at: new Date().toISOString(), tags: tags ?? {} }, ...existing.recentTags].slice(0, 10)
      : tags
        ? [{ at: new Date().toISOString(), tags }]
        : [],
  };
  store[name] = updated;
  persistMetrics(store);
  return updated;
}

export function readMetrics(): MetricEntry[] {
  const m = loadMetrics();
  return Object.values(m).sort((a, b) => b.count - a.count);
}

export function resetMetrics() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(METRICS_KEY);
}

// ─── Health check ─────────────────────────────────────────────────────────

export interface HealthSnapshot {
  localStorageSize: number;       // octets utilisés (approximation)
  localStorageItems: number;
  errorCount24h: number;
  errorCountTotal: number;
  topMetrics: MetricEntry[];
  capturedAt: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function getHealthSnapshot(): HealthSnapshot {
  const errors = loadErrors();
  const now = Date.now();
  const errorCount24h = errors.filter((e) => now - new Date(e.at).getTime() < ONE_DAY_MS).length;

  let lsSize = 0;
  let lsItems = 0;
  if (typeof window !== 'undefined') {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      lsItems++;
      lsSize += key.length + (window.localStorage.getItem(key)?.length ?? 0);
    }
  }

  return {
    localStorageSize: lsSize,
    localStorageItems: lsItems,
    errorCount24h,
    errorCountTotal: errors.length,
    topMetrics: readMetrics().slice(0, 5),
    capturedAt: new Date().toISOString(),
  };
}

// ─── Global error handlers ────────────────────────────────────────────────

let _installed = false;

/**
 * Installe les listeners globaux (window.onerror + unhandledrejection)
 * pour capturer toutes les erreurs non rattrapées. Idempotent.
 * À appeler une seule fois au démarrage de l'app (main.tsx).
 */
export function installGlobalErrorHandlers() {
  if (_installed || typeof window === 'undefined') return;
  _installed = true;

  window.addEventListener('error', (e) => {
    captureError(e.error ?? new Error(e.message), {
      source: 'window.onerror',
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    captureError(reason instanceof Error ? reason : new Error(String(reason)), {
      source: 'unhandledrejection',
    });
  });
}
