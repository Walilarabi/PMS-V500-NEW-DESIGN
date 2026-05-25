/**
 * FLOWTYM RMS — Sync Scheduler (logique pure)
 *
 * Helpers purs extraits de `useEventSourcesAutoSync` pour pouvoir les
 * tester sans React. Décide quelles sources doivent être interrogées
 * en fonction de leur fréquence configurée et de leur dernière sync.
 */

import type { EventSource, SyncFrequency } from '../../types/events';

/** Convertit une fréquence métier en intervalle ms. */
export function frequencyToMs(f: SyncFrequency): number {
  switch (f) {
    case 'realtime': return 5 * 60 * 1000;       // 5 min
    case '6h':       return 6 * 3600 * 1000;
    case 'daily':    return 24 * 3600 * 1000;
    case 'weekly':   return 7 * 24 * 3600 * 1000;
    case 'monthly':  return 30 * 24 * 3600 * 1000;
    case 'manual':   return Number.POSITIVE_INFINITY; // jamais auto
  }
}

/**
 * Une source est-elle due pour sync ?
 *   • Si inactive → non
 *   • Si manual → non
 *   • Si lastSyncAt absent → oui (jamais syncée)
 *   • Si lastSyncAt expiré (now - last ≥ window) → oui
 */
export function isDueForSync(source: EventSource, now: number): boolean {
  if (!source.active) return false;
  const windowMs = frequencyToMs(source.syncFrequency);
  if (!Number.isFinite(windowMs)) return false;
  if (!source.lastSyncAt) return true;
  const last = new Date(source.lastSyncAt).getTime();
  if (Number.isNaN(last)) return true;
  return (now - last) >= windowMs;
}

/**
 * Filtre les sources d'une ville qui sont dues pour sync.
 * Renvoie la liste triée par priorité (recommended d'abord).
 */
export function selectSourcesToSync(args: {
  sources: EventSource[];
  city: string;
  now: number;
}): EventSource[] {
  const cityLower = args.city.toLowerCase();
  const due = args.sources.filter(
    (s) => s.city.toLowerCase() === cityLower && isDueForSync(s, args.now),
  );
  const priority: Record<EventSource['priority'], number> = {
    recommended: 0,
    standard: 1,
    optional: 2,
  };
  return [...due].sort((a, b) => priority[a.priority] - priority[b.priority]);
}
