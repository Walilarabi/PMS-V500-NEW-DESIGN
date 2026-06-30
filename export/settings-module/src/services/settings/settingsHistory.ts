/**
 * FLOWTYM — Historique des diagnostics Control Center.
 *
 * Persiste les N derniers runs du moteur de diagnostic pour produire
 * de vraies sparklines de tendance par dimension de score (au lieu
 * du snapshot statique des 5 scores de la sortie actuelle).
 *
 * Persiste également les alertes résolues / écartées pour qu'elles
 * ne réapparaissent pas à chaque rerun.
 */

import type {
  DiagnosticReport,
  ScoreCardId,
  AlertStatus,
} from '@/src/types/settings/diagnostic';

const HISTORY_KEY = 'flowtym.settings.history';
const RESOLVED_KEY = 'flowtym.settings.resolved';
const MAX_RUNS = 30;

export interface HistoryRun {
  at: string;
  scores: Record<ScoreCardId, number>;
  alertsTotal: number;
  alertsCritical: number;
}

export interface ResolvedEntry {
  alertId: string;
  status: AlertStatus;
  at: string;
  /** Hash de description pour invalider si l'alerte revient avec un contenu différent. */
  fingerprint: string;
}

// ─── Runs ────────────────────────────────────────────────────────────────

function loadRuns(): HistoryRun[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const arr = raw ? (JSON.parse(raw) as HistoryRun[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveRuns(runs: HistoryRun[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(runs.slice(-MAX_RUNS)));
  } catch {/* quota */}
}

/**
 * Enregistre un nouveau snapshot du rapport. On déduplique : si le run
 * précédent date de moins de 30 secondes ET a strictement les mêmes
 * scores, on remplace plutôt que d'ajouter (évite la pollution).
 */
export function recordRun(report: DiagnosticReport) {
  const runs = loadRuns();
  const newRun: HistoryRun = {
    at: report.generatedAt,
    scores: {
      system_health: report.scores.system_health.value,
      configuration: report.scores.configuration.value,
      compliance: report.scores.compliance.value,
      security: report.scores.security.value,
      distribution: report.scores.distribution.value,
      revenue: report.scores.revenue.value,
    },
    alertsTotal: report.alerts.length,
    alertsCritical: report.alerts.filter((a) => a.severity === 'critical').length,
  };
  const last = runs[runs.length - 1];
  if (
    last &&
    Date.now() - new Date(last.at).getTime() < 30_000 &&
    JSON.stringify(last.scores) === JSON.stringify(newRun.scores) &&
    last.alertsTotal === newRun.alertsTotal
  ) {
    runs[runs.length - 1] = newRun;
  } else {
    runs.push(newRun);
  }
  saveRuns(runs);
}

export function getHistory(): HistoryRun[] {
  return loadRuns();
}

/**
 * Renvoie la série des N derniers scores pour une dimension donnée.
 * Si l'historique est plus court que `n`, on left-pad avec la 1re valeur
 * pour que la sparkline ait une longueur stable visuellement.
 */
export function getTrend(scoreId: ScoreCardId, n = 12): number[] {
  const runs = loadRuns();
  if (runs.length === 0) return [];
  const tail = runs.slice(-n).map((r) => r.scores[scoreId]);
  while (tail.length < n) tail.unshift(tail[0]);
  return tail;
}

// ─── Alertes résolues ────────────────────────────────────────────────────

function loadResolved(): Record<string, ResolvedEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RESOLVED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ResolvedEntry>) : {};
  } catch { return {}; }
}

function saveResolved(map: Record<string, ResolvedEntry>) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(RESOLVED_KEY, JSON.stringify(map)); } catch {/* quota */}
}

function fingerprintOf(title: string, description: string): string {
  // Hash léger non-crypto — sert juste à invalider quand le texte change.
  let h = 5381;
  const s = `${title}|${description}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function markResolved(id: string, status: AlertStatus, fingerprint: string) {
  const map = loadResolved();
  map[id] = { alertId: id, status, fingerprint, at: new Date().toISOString() };
  saveResolved(map);
}

export function isResolved(id: string, fingerprint: string): boolean {
  const map = loadResolved();
  const entry = map[id];
  return !!entry && entry.status === 'resolved' && entry.fingerprint === fingerprint;
}

export function fingerprintAlert(title: string, description: string): string {
  return fingerprintOf(title, description);
}

export function clearResolved() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(RESOLVED_KEY);
}

export function listResolved(): ResolvedEntry[] {
  return Object.values(loadResolved()).sort((a, b) => b.at.localeCompare(a.at));
}
