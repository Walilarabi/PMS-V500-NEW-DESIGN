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
import {
  KPI_CARDS as MOCK_KPI_CARDS,
  MARKET_MONTH as MOCK_MARKET_MONTH,
  getVisibleMarketMonth as mockGetVisibleMarketMonth,
  getComparisonData as mockGetComparisonData,
  COMPARE_PERIODS as MOCK_COMPARE_PERIODS,
  QUICK_COMPARISON as MOCK_QUICK_COMPARISON,
  MINI_COMPARISONS as MOCK_MINI_COMPARISONS,
  COMPSET_DISTRIBUTION as MOCK_COMPSET_DISTRIBUTION,
  COMPSET_HOTELS as MOCK_COMPSET_HOTELS,
  PAGE_META as MOCK_PAGE_META,
  type ComparePeriodKey,
  type ComparePeriodMeta,
  type ComparisonDay,
  type DistributionSegment,
  type KpiDatum,
  type MarketDay,
  type MiniComparison,
  type QuickComparisonRow,
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

/**
 * Construit un dataset mock qui respecte la fenêtre temporelle demandée.
 *
 * Le mock de référence (MARKET_MONTH) couvre juin 2026 (30 jours). Pour les
 * ranges 7/15/30/60/90 jours glissants, on génère des jours synthétiques en
 * rebouclant sur le pool de référence et en ajustant la date pour rester dans
 * la fenêtre. Les valeurs (ourPrice, médiane, écarts) sont préservées —
 * seules les dates / labels sont décalés.
 */
function buildMockMarketDays(
  windowStart: string,
  windowEnd: string,
): typeof MOCK_MARKET_MONTH {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const days = Math.round((+end - +start) / 86_400_000) + 1;
  if (days <= 0) return [];

  const pool = MOCK_MARKET_MONTH;
  if (pool.length === 0) return [];

  const result: typeof MOCK_MARKET_MONTH = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = date.toISOString().slice(0, 10);
    const template = pool[i % pool.length];
    result.push({
      ...template,
      date: iso,
      label: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    });
  }
  return result;
}

function mockData(
  source: CompetitiveSource,
  range: CompetitiveRange,
  window: { start: string; end: string; label: string }
): CompetitiveWatchData {
  // Génère un dataset respectant la fenêtre demandée (7/15/30/60/90/mois)
  const days = buildMockMarketDays(window.start, window.end);
  const visibleDays = days.length > 0 ? days : MOCK_MARKET_MONTH;

  return {
    isLive: false,
    source,
    range,
    window,
    meta: MOCK_PAGE_META,
    kpiCards: MOCK_KPI_CARDS,
    marketMonth: visibleDays,
    visibleMarketMonth: visibleDays,
    getComparisonData: mockGetComparisonData,
    comparePeriods: MOCK_COMPARE_PERIODS,
    quickComparison: MOCK_QUICK_COMPARISON,
    miniComparisons: MOCK_MINI_COMPARISONS,
    compsetDistribution: MOCK_COMPSET_DISTRIBUTION,
    compsetHotels: MOCK_COMPSET_HOTELS,
    trace: {
      source,
      periodLabel: window.label,
      lighthouseImportedAt: null,
      expediaImportedAt: null,
      totalCompetitors: MOCK_COMPSET_HOTELS.length,
      keptCompetitors: MOCK_COMPSET_HOTELS.length,
      keptDays: visibleDays.length,
      excludedDays: 0,
      exclusionSummary: [],
      competitorScores: [],
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

  return useMemo<CompetitiveWatchData>(() => {
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
      return mockData(source, range, window);
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

    // ─── Quality gate : filtre la fenêtre temporelle + dédup + outliers ────

    const qualityReport = applyQualityGate(baseDataset, {
      window: { start: window.start, end: window.end },
      filterOutliers: true,
    });

    const filteredDataset = rebuildLighthouseFromFilteredDays(
      baseDataset,
      qualityReport.keptDays
    );

    // Sécurité : si tout est filtré, on retombe sur le mock pour ne pas
    // afficher un graphique vide qui ressemblerait à un bug.
    if (filteredDataset.days.length === 0) {
      const mockFallback = mockData(source, range, window);
      return {
        ...mockFallback,
        // On garde la traçabilité pour signaler "rien dans la fenêtre"
        trace: {
          ...mockFallback.trace,
          source: effectiveSource as CompetitiveSource,
          lighthouseImportedAt: lighthouseData?.importedAt ?? null,
          expediaImportedAt: expediaData?.importedAt ?? null,
          totalCompetitors: baseDataset.competitorNames.length,
          keptCompetitors: 0,
          keptDays: 0,
          excludedDays: qualityReport.exclusions.length,
          exclusionSummary: summarizeExclusions(qualityReport.exclusions),
          competitorScores,
        },
      };
    }

    // ─── Calcul des datasets enfants depuis le dataset filtré ──────────────

    const marketMonth = buildMarketMonth(filteredDataset);

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
        keptDays: qualityReport.totalAfter,
        excludedDays: qualityReport.totalBefore - qualityReport.totalAfter,
        exclusionSummary: summarizeExclusions(qualityReport.exclusions),
        competitorScores,
      },
    };
  }, [lighthouseData, expediaData, range, source]);
}
