/**
 * FLOWTYM RMS — Hook Market Intelligence
 *
 * Hook React qui orchestre le pipeline Market Intelligence à partir :
 *   • des événements du store (useEventsStore)
 *   • des snapshots marché (mock pour l'instant — branché live au LOT 6)
 *   • de la config hôtel (compset size, ville)
 *
 * Mémorise le résultat (lourd) sur les inputs primitifs. À ce stade les
 * snapshots sont synthétiques ; brancher la vraie source via le LOT
 * "Scraping Intelligent Hôtelier" quand disponible.
 */

import { useMemo } from 'react';
import { useEventsStore } from '../store/eventsStore';
import { useConfigStore } from '../store/configStore';
import {
  computeMarketIntelligence,
  type MarketIntelligenceResult,
} from '../services/marketIntelligence';
import { generateParisMarketSnapshots } from '../data/marketSnapshotsMock';

/* ────────────────────────────────────────────────────────────────────────── */
/* CACHE SNAPSHOTS — calcul lourd, on évite de regénérer à chaque render      */
/* ────────────────────────────────────────────────────────────────────────── */

let _snapshotsCache: ReturnType<typeof generateParisMarketSnapshots> | null = null;
function snapshots() {
  if (!_snapshotsCache) {
    _snapshotsCache = generateParisMarketSnapshots('2026-01-01', '2026-12-31');
  }
  return _snapshotsCache;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN HOOK                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export function useMarketIntelligence(): MarketIntelligenceResult {
  const events = useEventsStore((s) => s.events);
  const sources = useEventsStore((s) => s.sources);
  const hotelCity = useConfigStore((s) => s.hotel.city);

  return useMemo(() => {
    return computeMarketIntelligence({
      events: events.filter((e) => e.city.toLowerCase() === (hotelCity ?? 'paris').toLowerCase()),
      sources,
      snapshots: snapshots(),
      compsetSize: 12,
      freshnessHours: 6,
      today: new Date().toISOString().slice(0, 10),
    });
    // events / sources sont déjà des références stables venant du store
  }, [events, sources, hotelCity]);
}
