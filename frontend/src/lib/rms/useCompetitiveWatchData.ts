/**
 * FLOWTYM RMS — Hook unifié pour la Veille Concurrentielle
 *
 * Point d'entrée unique pour tous les composants Veille. Bascule
 * automatiquement entre :
 *   - données calculées sur l'import Lighthouse (si présent)
 *   - données calculées sur l'import Expedia (si présent et choisi)
 *   - Mix intelligent (scoring des concurrents les plus pertinents)
 *   - mock de référence (si aucun import)
 *
 * Garantit qu'AUCUNE donnée hors période sélectionnée n'arrive au composant :
 * applique systématiquement le `applyQualityGate` avec la fenêtre du store
 * de préférences avant tout calcul d'agrégats.
 */

import { useMemo } from 'react';
import { useLighthouseStore } from '../../store/lighthouseStore';
import { useExpediaStore } from '../../store/expediaStore';
import { useEventsStore } from '../../store/eventsStore';
import { useSalonsStore } from '../../store/salonsStore';
import { eventsActiveOn } from '../../services/events-bridge.service';
import {
  useCompetitiveWatchPrefs,
  resolveRangeWindow,
  type CompetitiveRange,
  type CompetitiveSource,
} from '../../store/competitiveWatchPrefsStore';
import {
  buildCompetitiveKpiCards,
  buildMarketMonth,
  buildComparisonData,
  buildComparePeriods,
  buildQuickComparison,
  buildMiniComparisons,
  buildCompsetDistribution,
  buildPageMeta,
} from './lighthouseToCompetitiveWatch';
import { applyQualityGate, summarizeExclusions, type Exclusion } from './competitiveDataQuality';
import { scoreAndSelectCompetitors, type CompetitorScore } from './competitorScoring';
import type {
  LighthouseImport,
  LighthouseDayData,
} from '../../services/lighthouse-parser.service';
import type { ExpediaImport } from '../../services/expedia-parser.service';
import type {
  ComparePeriodKey,
  ComparePeriodMeta,
  ComparisonDay,
  DistributionSegment,
  KpiDatum,
  MarketDay,
  MiniComparison,
  QuickComparisonRow,
} from '../../data/rms/mockCompetitiveWatchData';

/* ───────────────────────────────────────────────────────────────────────── */
/* TYPES                                                                      */
/* ───────────────────────────────────────────────────────────────────────── */

export interface CompetitiveWatchData {
  isLive: boolean;
  source: CompetitiveSource;
  range: CompetitiveRange;
  window: { start: string; end: string; label: string };
  meta: {
    hotelName: string;
    compsetSize: number;
    lastUpdate: string;
    marketPeriodLabel: string;
    comparisonDayLabel: string;
    rank: number;
    rankTotal: number;
  };
  kpiCards: KpiDatum[];
  marketMonth: MarketDay[];
  visibleMarketMonth: MarketDay[];
  getComparisonData: (period: ComparePeriodKey) => ComparisonDay[];
  comparePeriods: ComparePeriodMeta[];
  quickComparison: QuickComparisonRow[];
  miniComparisons: MiniComparison[];
  compsetDistribution: DistributionSegment[];
  compsetHotels: string[];
  /** Provenance et qualité des données — pour le bandeau de traçabilité. */
  trace: {
    /** Source des données affichées. */
    source: CompetitiveSource;
    /** Période affichée (libellé court). */
    periodLabel: string;
    /** Date d'import Lighthouse (ISO). */
    lighthouseImportedAt: string | null;
    /** Date d'import Expedia (ISO). */
    expediaImportedAt: string | null;
    /** Nombre total de concurrents détectés (avant scoring). */
    totalCompetitors: number;
    /** Nombre de concurrents retenus. */
    keptCompetitors: number;
    /** Nombre de jours retenus dans la fenêtre. */
    keptDays: number;
    /** Nombre de jours exclus. */
    excludedDays: number;
    /** Détail des raisons d'exclusion agrégées. */
    exclusionSummary: ReturnType<typeof summarizeExclusions>;
    /** Top concurrents avec leur score (pour Mix). */
    competitorScores: CompetitorScore[];
  };
}

/* ───────────────────────────────────────────────────────────────────────── */
/* PRIVATE HELPERS                                                            */
/* ───────────────────────────────────────────────────────────────────────── */

/**
 * Reconstruit un LighthouseImport "filtré" à partir d'un ensemble de jours
 * filtrés par le quality gate. Permet de réutiliser les builders existants
 * (buildMarketMonth, buildComparePeriods, etc.) sans dupliquer leur logique.
 */
function rebuildLighthouseFromFilteredDays(
  data: LighthouseImport,
  filteredDays: LighthouseDayData[]
): LighthouseImport {
  return {
    ...data,
    days: filteredDays,
  };
}

/**
 * Construit un LighthouseImport synthétique à partir d'un import Expedia,
 * pour pouvoir réutiliser les mêmes builders.
 *
 * On ne reconstitue PAS toutes les colonnes Lighthouse (ranking, demande
 * Lighthouse, etc.) — on extrait ce qui est commun aux deux formats :
 * ourPrice, médiane compset, prix concurrents par date.
 */
function expediaAsLighthouse(data: ExpediaImport): LighthouseImport {
  return {
    fileName: data.fileName,
    importedAt: data.importedAt,
    ourHotelName: data.ourHotelName,
    competitorNames: data.competitorNames,
    days: data.days
      .filter((d) => d.ourPrice != null && d.compsetAverage != null)
      .map((d) => ({
        date: d.date,
        dayName: d.dayName,
        ourPrice: d.ourPrice as number,
        compsetMedian: d.compsetAverage as number,
        marketDemand: d.marketPressureBroaderPercent / 100,
        marketDemandPercent: d.marketPressureBroaderPercent,
        ranking: '',
        rankPosition: null,
        rankTotal: null,
        bookingRank: '',
        holidays: '',
        events: '',
        competitors: d.competitors.map((c) => ({
          hotelName: c.hotelName,
          price: c.price,
          status:
            c.status === 'available'
              ? 'available'
              : c.status === 'sold_out'
                ? 'sold_out'
                : 'restricted',
          rawValue: c.rawValue,
        })),
        compsetMin: null,
        compsetMax: null,
      })),
    sheetsFound: [],
    warnings: data.warnings,
  };
}

/**
 * Pour le mode Mix : on prend Lighthouse comme base (plus riche en métadonnées)
 * et on enrichit la liste de concurrents en fusionnant ceux d'Expedia
 * uniquement pour les concurrents retenus par le scoring.
 */
function buildMixedDataset(
  lighthouse: LighthouseImport,
  expedia: ExpediaImport,
  keptNames: Set<string>
): LighthouseImport {
  // Index des prix Expedia par (nom, date)
  const expediaIndex = new Map<string, Map<string, number>>();
  for (const d of expedia.days) {
    for (const c of d.competitors) {
      if (c.price == null || c.status !== 'available') continue;
      const key = c.hotelName.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!expediaIndex.has(key)) expediaIndex.set(key, new Map());
      expediaIndex.get(key)!.set(d.date, c.price);
    }
  }

  // Enrichit chaque jour Lighthouse avec les concurrents Expedia retenus
  const enrichedDays: LighthouseDayData[] = lighthouse.days.map((day) => {
    const existing = new Map(
      day.competitors.map((c) => [c.hotelName.trim().toLowerCase().replace(/\s+/g, ' '), c])
    );
    const merged = [...day.competitors];

    for (const name of keptNames) {
      if (existing.has(name)) continue;
      const price = expediaIndex.get(name)?.get(day.date);
      if (price == null) continue;
      // Restore the original casing from expedia's first occurrence
      const originalName =
        expedia.competitorNames.find(
          (n) => n.trim().toLowerCase().replace(/\s+/g, ' ') === name
        ) ?? name;
      merged.push({
        hotelName: originalName,
        price,
        status: 'available',
        rawValue: String(price),
      });
    }

    return { ...day, competitors: merged };
  });

  return {
    ...lighthouse,
    competitorNames: Array.from(keptNames),
    days: enrichedDays,
  };
}

/* ───────────────────────────────────────────────────────────────────────── */
/* MOCK FALLBACK                                                              */
/* ───────────────────────────────────────────────────────────────────────── */

function emptyData(
  source: CompetitiveSource,
  range: CompetitiveRange,
  window: { start: string; end: string; label: string },
  traceOverrides?: Partial<CompetitiveWatchData['trace']>,
): CompetitiveWatchData {
  return {
    isLive: false,
    source,
    range,
    window,
    meta: { hotelName: '', compsetSize: 0, lastUpdate: '', marketPeriodLabel: window.label, comparisonDayLabel: '', rank: 0, rankTotal: 0 },
    kpiCards: [],
    marketMonth: [],
    visibleMarketMonth: [],
    getComparisonData: () => [],
    comparePeriods: [],
    quickComparison: [],
    miniComparisons: [],
    compsetDistribution: [],
    compsetHotels: [],
    trace: {
      source,
      periodLabel: window.label,
      lighthouseImportedAt: null,
      expediaImportedAt: null,
      totalCompetitors: 0,
      keptCompetitors: 0,
      keptDays: 0,
      excludedDays: 0,
      exclusionSummary: [],
      competitorScores: [],
      ...traceOverrides,
    },
  };
}

/* ───────────────────────────────────────────────────────────────────────── */
/* MAIN HOOK                                                                  */
/* ───────────────────────────────────────────────────────────────────────── */

export function useCompetitiveWatchData(): CompetitiveWatchData {
  const lighthouseData = useLighthouseStore((s) => s.importData);
  const expediaData = useExpediaStore((s) => s.importData);
  const { range, source } = useCompetitiveWatchPrefs();
  // Sources d'événements — toutes fusionnées dans le résultat final (Étape 5)
  const allEvents = useEventsStore((s) => s.events);
  const salons = useSalonsStore((s) => s.importData?.events ?? []);

  const rawData = useMemo<CompetitiveWatchData>(() => {
    const window = resolveRangeWindow(range);

    // Détermine la source effective : si l'utilisateur demande Lighthouse
    // mais que rien n'est importé, on retombe sur Expedia, puis sur le mock.
    const hasLighthouse = !!lighthouseData;
    const hasExpedia = !!expediaData;

    let effectiveSource: CompetitiveSource | 'none' = source;
    if (source === 'lighthouse' && !hasLighthouse) {
      effectiveSource = hasExpedia ? 'expedia' : 'none';
    } else if (source === 'expedia' && !hasExpedia) {
      effectiveSource = hasLighthouse ? 'lighthouse' : 'none';
    } else if (source === 'mix' && !hasLighthouse && !hasExpedia) {
      effectiveSource = 'none';
    }

    if (effectiveSource === 'none') {
      return emptyData(source, range, window);
    }

    // ─── Construction du dataset effectif ─────────────────────────────────

    let baseDataset: LighthouseImport;
    let competitorScores: CompetitorScore[] = [];

    if (effectiveSource === 'expedia') {
      baseDataset = expediaAsLighthouse(expediaData!);
    } else if (effectiveSource === 'mix') {
      // On scorera les concurrents sur les deux sources combinées et on
      // gardera les top N dans le dataset Lighthouse enrichi.
      const ourAvgPrice =
        (lighthouseData?.days ?? []).reduce((s, d) => s + d.ourPrice, 0) /
        Math.max(1, lighthouseData?.days.length ?? 1);

      const medianByDate = new Map<string, number>();
      for (const d of lighthouseData?.days ?? []) {
        medianByDate.set(d.date, d.compsetMedian);
      }

      const windowDays =
        Math.round(
          (+new Date(window.end) - +new Date(window.start)) / (1000 * 60 * 60 * 24)
        ) + 1;

      const selection = scoreAndSelectCompetitors({
        lighthouse: lighthouseData ?? null,
        expedia: expediaData ?? null,
        ourAvgPrice,
        marketMedianByDate: medianByDate,
        windowDays,
      });

      competitorScores = [...selection.selected, ...selection.excluded];

      const keptNames = new Set(
        selection.selected.map((s) => s.name.trim().toLowerCase().replace(/\s+/g, ' '))
      );

      if (lighthouseData && expediaData) {
        baseDataset = buildMixedDataset(lighthouseData, expediaData, keptNames);
      } else if (lighthouseData) {
        baseDataset = lighthouseData;
      } else {
        baseDataset = expediaAsLighthouse(expediaData!);
      }
    } else {
      // 'lighthouse'
      baseDataset = lighthouseData!;
    }

    // ─── Quality gate ────────────────────────────────────────────────────────
    // Deux passes distinctes :
    //  • chartReport  : filterOutliers=false → TOUTES les dates de la fenêtre
    //    apparaissent dans le graphique (marché épuisé, restrictions, LOS inclus).
    //  • kpiReport    : filterOutliers=true  → les outliers sont exclus des
    //    agrégats KPI (médiane, moyenne, gap) pour ne pas biaiser les indicateurs.

    const kpiReport = applyQualityGate(baseDataset, {
      window: { start: window.start, end: window.end },
      filterOutliers: true,
    });

    const chartReport = applyQualityGate(baseDataset, {
      window: { start: window.start, end: window.end },
      filterOutliers: false,
    });

    const filteredDataset = rebuildLighthouseFromFilteredDays(
      baseDataset,
      kpiReport.keptDays
    );

    // Dataset graphique : contient toutes les dates de la fenêtre (outliers inclus)
    const chartDataset = rebuildLighthouseFromFilteredDays(
      baseDataset,
      chartReport.keptDays
    );

    if (chartDataset.days.length === 0) {
      return emptyData(source, range, window, {
        source: effectiveSource as CompetitiveSource,
        lighthouseImportedAt: lighthouseData?.importedAt ?? null,
        expediaImportedAt: expediaData?.importedAt ?? null,
        totalCompetitors: baseDataset.competitorNames.length,
        keptCompetitors: 0,
        keptDays: 0,
        excludedDays: kpiReport.exclusions.length,
        exclusionSummary: summarizeExclusions(kpiReport.exclusions),
        competitorScores,
      });
    }

    // ─── Calcul des datasets enfants ─────────────────────────────────────────
    // marketMonth utilise chartDataset (toutes les dates) ;
    // KPIs, comparaisons et distribution utilisent filteredDataset (sans outliers).

    const marketMonth = buildMarketMonth(chartDataset);

    return {
      isLive: true,
      source: effectiveSource as CompetitiveSource,
      range,
      window,
      meta: buildPageMeta(filteredDataset),
      kpiCards: buildCompetitiveKpiCards(filteredDataset),
      marketMonth,
      // visibleMarketMonth = marketMonth (déjà filtré par la fenêtre)
      visibleMarketMonth: marketMonth,
      getComparisonData: (period) => buildComparisonData(filteredDataset, period),
      comparePeriods: buildComparePeriods(filteredDataset),
      quickComparison: buildQuickComparison(filteredDataset),
      miniComparisons: buildMiniComparisons(filteredDataset),
      compsetDistribution: buildCompsetDistribution(filteredDataset),
      compsetHotels: filteredDataset.competitorNames,
      trace: {
        source: effectiveSource as CompetitiveSource,
        periodLabel: window.label,
        lighthouseImportedAt: lighthouseData?.importedAt ?? null,
        expediaImportedAt: expediaData?.importedAt ?? null,
        totalCompetitors: baseDataset.competitorNames.length,
        keptCompetitors: filteredDataset.competitorNames.length,
        keptDays: kpiReport.totalAfter,
        excludedDays: kpiReport.totalBefore - kpiReport.totalAfter,
        exclusionSummary: summarizeExclusions(kpiReport.exclusions),
        competitorScores,
      },
    };
  }, [lighthouseData, expediaData, range, source]);

  // Enrichissement des jours marché avec les événements de toutes les sources.
  // Fait hors du useMemo principal pour séparer les préoccupations.
  return useMemo<CompetitiveWatchData>(() => {
    const enriched = rawData.marketMonth.map((day) => {
      const fromEvents = eventsActiveOn(allEvents, day.date).map((e) => e.name);
      const fromSalons = salons
        .filter((e) => day.date >= e.startDate && day.date <= e.endDate)
        .map((e) => e.name);
      const fromLighthouse = day.event
        ? day.event.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const merged = [...new Set([...fromEvents, ...fromSalons, ...fromLighthouse])];
      return merged.length > 0 ? { ...day, event: merged.join(', ') } : day;
    });
    return {
      ...rawData,
      marketMonth: enriched,
      visibleMarketMonth: enriched,
    };
  }, [rawData, allEvents, salons]);
}
