/**
 * FLOWTYM RMS — Hook Market Intelligence
 *
 * Hook React qui orchestre le pipeline Market Intelligence à partir :
 *   • des événements du store (useEventsStore)
 *   • des snapshots marché — provenant en priorité de :
 *       1) l'import Lighthouse live (useLighthouseStore)
 *       2) sinon l'import Expedia live (useExpediaStore)
 *       3) sinon le mock synthétique cohérent avec les événements seed
 *   • de la config hôtel
 *
 * Le résultat est mémorisé sur les inputs ; le calcul est lourd (pipeline
 * complet en 10 étapes), donc on l'évite à chaque render.
 *
 * Le hook expose aussi la source effective utilisée pour permettre à l'UI
 * d'afficher un badge "Live" / "Démo".
 */

import { useMemo } from 'react';
import { useEventsStore } from '../store/eventsStore';
import { useConfigStore } from '../store/configStore';
import { useLighthouseStore } from '../store/lighthouseStore';
import { useExpediaStore } from '../store/expediaStore';
import {
  computeMarketIntelligence,
  type MarketIntelligenceResult,
} from '../services/marketIntelligence';
import { lighthouseImportToSnapshots } from '../services/marketIntelligence/lighthouse-to-snapshots.adapter';
import {
  buildSegmentedSnapshots,
  classifyCompset,
  compsetDistribution,
  type HotelClassification,
} from '../services/marketIntelligence/compset-clustering.engine';
import { generateParisMarketSnapshots } from '../data/marketSnapshotsMock';
import type { HotelCluster, MarketSnapshot } from '../types/marketIntelligence';

/* ────────────────────────────────────────────────────────────────────────── */
/* CACHE MOCK                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

let _mockSnapshotsCache: MarketSnapshot[] | null = null;
function mockSnapshots(): MarketSnapshot[] {
  if (!_mockSnapshotsCache) {
    _mockSnapshotsCache = generateParisMarketSnapshots('2026-01-01', '2026-12-31');
  }
  return _mockSnapshotsCache;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* DATA SOURCE                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export type MarketIntelligenceSource = 'lighthouse' | 'expedia' | 'mock';

export interface MarketIntelligenceData extends MarketIntelligenceResult {
  /** Source effective utilisée pour les snapshots. */
  source: MarketIntelligenceSource;
  /** Nombre de snapshots traités. */
  snapshotCount: number;
  /** Fraîcheur en heures (depuis le dernier import / capture). */
  freshnessHours: number;
  /** Classification des hôtels du compset (LOT 8). */
  compsetClassifications: Map<string, HotelClassification>;
  /** Distribution agrégée (luxury 3, midscale 5, budget 2…). */
  compsetDistribution: ReturnType<typeof compsetDistribution>;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* MAIN HOOK                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export function useMarketIntelligence(): MarketIntelligenceData {
  const events = useEventsStore((s) => s.events);
  const sources = useEventsStore((s) => s.sources);
  const hotelCity = useConfigStore((s) => s.hotel.city);
  const lighthouse = useLighthouseStore((s) => s.importData);
  const expedia = useExpediaStore((s) => s.importData);

  return useMemo(() => {
    // ─── Détermine la source effective ─────────────────────────────────────
    let source: MarketIntelligenceSource = 'mock';
    let snaps: MarketSnapshot[];
    let freshnessHours = 12;
    let classifications = new Map<string, HotelClassification>();
    let segmentedSnapshots = new Map<HotelCluster, MarketSnapshot[]>();

    if (lighthouse && lighthouse.days.length > 0) {
      snaps = lighthouseImportToSnapshots(lighthouse);
      source = 'lighthouse';
      freshnessHours = computeFreshnessHours(lighthouse.importedAt);
      // Clustering compset + snapshots segmentés
      classifications = classifyCompset({
        hotelNames: lighthouse.competitorNames,
        days: lighthouse.days,
      });
      segmentedSnapshots = buildSegmentedSnapshots({
        days: lighthouse.days,
        classifications,
        capturedAt: lighthouse.importedAt,
      });
    } else if (expedia && expedia.days.length > 0) {
      // Expedia store : conversion en snapshots via l'adapter local.
      snaps = adaptExpediaToSnapshots(expedia);
      source = 'expedia';
      freshnessHours = computeFreshnessHours(expedia.importedAt);
      // (Pas de clustering Expedia pour l'instant — schéma de données
      //  moins riche. Ajouté quand l'adapter Expedia → LighthouseDayData
      //  est complété.)
    } else {
      snaps = mockSnapshots();
      source = 'mock';
      freshnessHours = 12; // fictif
    }

    const result = computeMarketIntelligence({
      events: events.filter((e) =>
        e.city.toLowerCase() === (hotelCity ?? 'paris').toLowerCase(),
      ),
      sources,
      snapshots: snaps,
      segmentedSnapshots: segmentedSnapshots.size > 0 ? segmentedSnapshots : undefined,
      compsetSize: source === 'mock' ? 12 : Math.max(4, classifications.size || 10),
      freshnessHours,
      today: new Date().toISOString().slice(0, 10),
    });

    return {
      ...result,
      source,
      snapshotCount: snaps.length,
      freshnessHours,
      compsetClassifications: classifications,
      compsetDistribution: compsetDistribution(classifications),
    };
  }, [events, sources, hotelCity, lighthouse, expedia]);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function computeFreshnessHours(importedAt: string): number {
  const t = new Date(importedAt).getTime();
  if (Number.isNaN(t)) return 24;
  const diffMs = Date.now() - t;
  return Math.max(0, Math.round(diffMs / 3_600_000));
}

/**
 * Adapter Expedia → MarketSnapshot. On extrait les colonnes communes
 * (date, ourPrice, compset average comme proxy de la médiane, statuts
 * compétiteurs) et on infère les autres champs comme dans l'adapter
 * Lighthouse.
 */
function adaptExpediaToSnapshots(expedia: { days: Array<{
  date: string;
  ourPrice: number | null;
  compsetAverage: number | null;
  marketPressureBroaderPercent: number;
  competitors: Array<{
    hotelName: string;
    price: number | null;
    status: 'available' | 'sold_out' | 'restricted' | 'unknown';
    rawValue: string;
  }>;
}>; importedAt: string }): MarketSnapshot[] {
  return expedia.days
    .filter((d) => d.ourPrice != null && d.ourPrice > 0 && d.compsetAverage != null && d.compsetAverage > 0)
    .map((d) => {
      const known = d.competitors.filter((c) => c.status !== 'unknown');
      const soldOutRatio = known.length === 0 ? 0
        : known.filter((c) => c.status === 'sold_out').length / known.length;
      const restrictedRatio = known.length === 0 ? 0
        : known.filter((c) => c.status === 'restricted').length / known.length;

      return {
        date: d.date,
        capturedAt: expedia.importedAt,
        compsetMedian: d.compsetAverage as number,
        ourPrice: d.ourPrice as number,
        availability: round2(Math.max(0, 1 - soldOutRatio - restrictedRatio * 0.25)),
        minStayShare: round2(Math.min(1, restrictedRatio * 0.6)),
        ctaCtdShare: round2(Math.min(1, restrictedRatio * 0.4)),
        flexibleClosedShare: round2(Math.min(1, restrictedRatio * 0.5)),
        otaClosedShare: round2(Math.min(1, soldOutRatio * 0.3)),
        pickup: Math.max(0, Math.round(8 * (1 + d.marketPressureBroaderPercent / 100))),
        inventoryShrinkShare: round2(Math.min(1, (soldOutRatio + restrictedRatio) * 0.25)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
