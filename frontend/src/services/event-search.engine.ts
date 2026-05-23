/**
 * FLOWTYM RMS — Event Search Engine
 *
 * Moteur d'agrégation multi-sources. La version en ligne réelle interrogera
 * les API/scraping listés dans EVENT_SOURCE_LIBRARY ; cette implémentation
 * simule fidèlement le pipeline complet :
 *
 *   1) sélection des sources par ville
 *   2) appel asynchrone à chaque source (en parallèle)
 *   3) normalisation des résultats
 *   4) détection de doublons + fusion intelligente
 *   5) calcul d'impact + niveau
 *   6) renvoi d'un EventSearchResult typé
 *
 * Le code respecte les contraintes du brief :
 *   • asynchrone, non bloquant ;
 *   • gestion des timeouts/erreurs par source ;
 *   • jamais de doublons visibles ;
 *   • historisation des ajouts (action: 'synced').
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

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

/**
 * Simule la requête d'une source — retourne 0..N événements.
 * En production, brancher ici les vrais appels (fetch + parser).
 */
async function querySource(
  source: EventSource,
  q: SearchQueryInput,
): Promise<RMSMarketEvent[]> {
  // simulation : 200-700ms par source
  await sleep(200 + Math.random() * 500);

  // taux d'erreur réaliste sur les méthodes scraping
  if (source.method === 'scraping' && Math.random() < 0.05) {
    throw new Error('Source temporairement indisponible');
  }

  // on prend la base seed et on garde les events liés à cette source
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
 * Lance la recherche complète. Renvoie un EventSearchResult prêt à être
 * mergé dans le store par eventsStore.applySearchResult().
 */
export async function searchEvents(q: SearchQueryInput): Promise<EventSearchResult> {
  const ranAt = new Date().toISOString();
  const sources = EVENT_SOURCE_LIBRARY.filter(
    (s) =>
      s.active &&
      s.city.toLowerCase() === q.city.toLowerCase() &&
      (!q.sourceIds || q.sourceIds.length === 0 || q.sourceIds.includes(s.id)),
  );

  const errors: { sourceId: string; message: string }[] = [];
  const collected: RMSMarketEvent[] = [];

  const results = await Promise.allSettled(sources.map((s) => querySource(s, q)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') collected.push(...r.value);
    else errors.push({ sourceId: sources[i].id, message: String(r.reason?.message ?? r.reason) });
  });

  // dédoublonnage cross-source
  const { deduped, merged } = dedupEvents(collected);

  // recalc niveau / filtrage min impact
  const finalEvents = deduped
    .map((e) => ({ ...e, impact: { ...e.impact, level: scoreToLevel(aggregateImpact(e.impact)) } }))
    .filter((e) =>
      !q.minImpact ? true : IMPACT_LEVEL_ORDER[e.impact.level] >= IMPACT_LEVEL_ORDER[q.minImpact],
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
  };
}
