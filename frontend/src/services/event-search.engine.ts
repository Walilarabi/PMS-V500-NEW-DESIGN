/**
 * FLOWTYM RMS — Event Search Engine
 *
 * Moteur d'agrégation multi-sources. La version en ligne réelle interrogera
 * les API/scraping listés dans EVENT_SOURCE_LIBRARY ; cette implémentation
 * simule fidèlement le pipeline complet :
 *
 *   1) identification de la ville de l'hôtel (passée en entrée)
 *   2) sélection des sources actives de cette ville
 *   3) appel asynchrone à chaque source (en parallèle, isolé par try)
 *   4) normalisation des résultats
 *   5) détection de doublons + fusion intelligente
 *   6) calcul d'impact + niveau
 *   7) production d'un EventSearchResult enrichi de stats par source
 *
 * Le code respecte les contraintes du brief :
 *   • asynchrone, non bloquant ;
 *   • gestion des timeouts/erreurs par source (Promise.allSettled) ;
 *   • jamais de doublons visibles ;
 *   • historisation des ajouts (action: 'synced') ;
 *   • jamais de suppression — les événements passés sont préservés
 *     (le store applique seulement les futurs).
 */

import type {
  EventImpactLevel,
  EventSource,
  EventSearchResult,
  RMSMarketEvent,
} from '../types/events';
import { EVENT_SOURCE_LIBRARY, SEED_PARIS_EVENTS } from '../data/eventSourceLibrary';
import { aggregateImpact, dedupEvents, scoreToLevel } from './event-impact.engine';
import { IMPACT_LEVEL_ORDER } from '../types/events';

export interface SearchQueryInput {
  city: string;
  fromDate: string;
  toDate: string;
  sourceIds?: string[];   // si vide → toutes les sources actives
  minImpact?: EventImpactLevel;
}

export interface SourceStats {
  sourceId: string;
  sourceName: string;
  events: number;
  status: 'ok' | 'error';
  message?: string;
}

export interface ExtendedSearchResult extends EventSearchResult {
  perSource: SourceStats[];
}

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

/**
 * Récupère les événements de référence pour une source donnée.
 * En production, brancher ici les vrais appels (fetch + parser) selon
 * `source.method`. Pour Paris, la base seed (52 événements 2026 + 2027)
 * sert de référentiel.
 */
async function querySource(
  source: EventSource,
  q: SearchQueryInput,
): Promise<RMSMarketEvent[]> {
  // Simulated source latency — replace with real fetch() when source APIs are wired
  await sleep(150);

  return SEED_PARIS_EVENTS.filter(
    (e) =>
      e.sources.includes(source.id) &&
      e.city.toLowerCase() === q.city.toLowerCase() &&
      e.endDate >= q.fromDate &&
      e.startDate <= q.toDate,
  ).map((e) => ({
    ...e,
    history: [
      ...e.history,
      { at: new Date().toISOString(), action: 'synced' as const, source: source.name },
    ],
    syncedAt: new Date().toISOString(),
    rmsSynced: true,
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Lance la recherche multi-sources pour la ville et la période données.
 * Renvoie un résultat enrichi : événements normalisés/dédupliqués +
 * statistiques par source (compte d'événements et erreurs).
 */
export async function searchEvents(q: SearchQueryInput): Promise<ExtendedSearchResult> {
  const ranAt = new Date().toISOString();
  const sources = EVENT_SOURCE_LIBRARY.filter(
    (s) =>
      s.active &&
      s.city.toLowerCase() === q.city.toLowerCase() &&
      (!q.sourceIds || q.sourceIds.length === 0 || q.sourceIds.includes(s.id)),
  );

  const errors: { sourceId: string; message: string }[] = [];
  const perSource: SourceStats[] = [];
  const collected: RMSMarketEvent[] = [];

  const results = await Promise.allSettled(sources.map((s) => querySource(s, q)));
  results.forEach((r, i) => {
    const src = sources[i];
    if (r.status === 'fulfilled') {
      collected.push(...r.value);
      perSource.push({ sourceId: src.id, sourceName: src.name, events: r.value.length, status: 'ok' });
    } else {
      const msg = String((r.reason as Error)?.message ?? r.reason);
      errors.push({ sourceId: src.id, message: msg });
      perSource.push({ sourceId: src.id, sourceName: src.name, events: 0, status: 'error', message: msg });
    }
  });

  // dédoublonnage cross-source
  const { deduped, merged } = dedupEvents(collected);

  // recalc niveau / filtrage min impact
  const finalEvents = deduped
    .map((e) => ({
      ...e,
      impact: { ...e.impact, level: scoreToLevel(aggregateImpact(e.impact)) },
    }))
    .filter((e) =>
      !q.minImpact
        ? true
        : IMPACT_LEVEL_ORDER[e.impact.level] >= IMPACT_LEVEL_ORDER[q.minImpact],
    )
    .sort((a, b) => aggregateImpact(b.impact) - aggregateImpact(a.impact));

  return {
    query: {
      city: q.city,
      fromDate: q.fromDate,
      toDate: q.toDate,
      sourceIds: sources.map((s) => s.id),
      minImpact: q.minImpact,
    },
    ranAt,
    events: finalEvents,
    duplicatesMerged: merged,
    sourcesQueried: sources.length,
    errors,
    perSource,
  };
}
