/**
 * FLOWTYM RMS — Pipeline Monitoring Service
 *
 * Mesure les performances et la santé du pipeline Market Intelligence :
 *   • temps d'exécution par étape
 *   • taux d'erreur (Supabase, scraping, parsing)
 *   • freshness des données
 *   • détection de régressions (latence inhabituelle)
 *
 * Le service stocke un historique glissant en mémoire (60 derniers runs)
 * exploitable par le hook `usePipelineHealth`. Aucun side effect réseau.
 *
 * Utilisation :
 *   const stop = startPipelineRun('full');
 *   ... pipeline work ...
 *   stop({ snapshotCount: 365, alertsGenerated: 12 });
 *
 *   // ailleurs : usePipelineHealth() pour les métriques agrégées
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* TYPES                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export type PipelineStage =
  | 'full'
  | 'enrichment'
  | 'reliability'
  | 'impact_score'
  | 'velocity'
  | 'compression'
  | 'correlation'
  | 'prediction'
  | 'confidence'
  | 'recommendations'
  | 'supabase_sync';

export type PipelineStatus = 'ok' | 'degraded' | 'failed';

export interface PipelineRun {
  id: string;
  stage: PipelineStage;
  startedAt: string;       // ISO
  durationMs: number;
  status: PipelineStatus;
  /** Métriques additionnelles (snapshotCount, recoCount, etc.) */
  metrics?: Record<string, number | string>;
  /** Message d'erreur si status = failed */
  error?: string;
}

export interface PipelineHealthSnapshot {
  runs: PipelineRun[];
  /** Taux d'erreur sur les 60 derniers runs. */
  errorRate: number;
  /** Durée médiane d'un run "full" (ms). */
  medianFullDurationMs: number;
  /** Durée du dernier run "full" — pour comparaison "vs médiane". */
  lastFullDurationMs: number | null;
  /** Heure du dernier run réussi. */
  lastSuccessAt: string | null;
  /** Heure du dernier échec (info débug). */
  lastFailureAt: string | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* STATE                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

const MAX_RUNS = 60;
const subscribers = new Set<() => void>();
const runs: PipelineRun[] = [];
let counter = 0;

function notify() {
  for (const fn of subscribers) {
    try { fn(); } catch (e) { console.error('[pipeline-monitoring] subscriber failed', e); }
  }
}

function recordRun(run: PipelineRun): void {
  runs.unshift(run);
  if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
  notify();
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PUBLIC API                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface StopOptions {
  status?: PipelineStatus;
  metrics?: Record<string, number | string>;
  error?: string;
}

/**
 * Démarre un run pipeline et renvoie une fonction `stop()` qui enregistre
 * la durée et les métriques.
 */
export function startPipelineRun(stage: PipelineStage): (opts?: StopOptions) => PipelineRun {
  const startedAt = new Date().toISOString();
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const id = `run_${Date.now()}_${counter++}`;
  return (opts) => {
    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const durationMs = Math.round(t1 - t0);
    const run: PipelineRun = {
      id,
      stage,
      startedAt,
      durationMs,
      status: opts?.status ?? 'ok',
      metrics: opts?.metrics,
      error: opts?.error,
    };
    recordRun(run);
    return run;
  };
}

/**
 * Enregistre un run "one-shot" (déjà mesuré ailleurs).
 */
export function logPipelineRun(run: Omit<PipelineRun, 'id'>): PipelineRun {
  const withId: PipelineRun = { ...run, id: `run_${Date.now()}_${counter++}` };
  recordRun(withId);
  return withId;
}

/**
 * Snapshot agrégé de la santé pipeline.
 */
export function getPipelineHealth(): PipelineHealthSnapshot {
  const fullRuns = runs.filter((r) => r.stage === 'full');
  const fullSuccessful = fullRuns.filter((r) => r.status === 'ok').map((r) => r.durationMs);
  const sortedDurations = [...fullSuccessful].sort((a, b) => a - b);
  const median = sortedDurations.length === 0 ? 0 :
    sortedDurations[Math.floor(sortedDurations.length / 2)];

  const failedRuns = runs.filter((r) => r.status === 'failed');
  const errorRate = runs.length === 0 ? 0 : failedRuns.length / runs.length;

  const lastFull = fullRuns[0] ?? null;
  const lastSuccess = runs.find((r) => r.status === 'ok') ?? null;
  const lastFailure = failedRuns[0] ?? null;

  return {
    runs: [...runs],
    errorRate,
    medianFullDurationMs: median,
    lastFullDurationMs: lastFull ? lastFull.durationMs : null,
    lastSuccessAt: lastSuccess ? lastSuccess.startedAt : null,
    lastFailureAt: lastFailure ? lastFailure.startedAt : null,
  };
}

/**
 * Abonnement aux changements de santé. Retourne `unsubscribe`.
 */
export function subscribePipelineHealth(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

/**
 * Vidage (utile pour les tests + reset utilisateur).
 */
export function resetPipelineMonitoring(): void {
  runs.length = 0;
  counter = 0;
  notify();
}

/* ────────────────────────────────────────────────────────────────────────── */
/* RETRY HELPER (utile pour Supabase)                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Wrapper retry avec backoff exponentiel.
 *
 * @param fn       fonction à exécuter (peut être async)
 * @param maxAttempts nombre max de tentatives (défaut 3)
 * @param baseDelay  délai initial en ms (défaut 500)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // 500, 1000, 2000
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  throw lastErr;
}
