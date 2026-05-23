/**
 * FLOWTYM RMS — Hook unifié pour la Veille Concurrentielle
 *
 * Point d'entrée unique pour tous les composants Veille. Bascule
 * automatiquement entre :
 *   - les données calculées depuis le store Lighthouse (si import présent)
 *   - les données mock de référence (si aucun import)
 *
 * Le contrat des champs renvoyés est identique à celui du module mock, ce qui
 * permet aux composants existants de migrer un par un en remplaçant leur
 * import par un appel au hook.
 */

import { useMemo } from 'react';
import { useLighthouseStore } from '../../store/lighthouseStore';
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

export interface CompetitiveWatchData {
  /** True si les données proviennent d'un import Lighthouse réel. */
  isLive: boolean;
  /** Nom de l'hôtel + métadonnées (titre, période, ranking compset). */
  meta: {
    hotelName: string;
    compsetSize: number;
    lastUpdate: string;
    marketPeriodLabel: string;
    comparisonDayLabel: string;
    rank: number;
    rankTotal: number;
  };
  /** 8 cartes KPI de l'en-tête. */
  kpiCards: KpiDatum[];
  /** Jours du mois marché — chart principal. */
  marketMonth: MarketDay[];
  /** Liste filtrée selon la règle d'affichage (mois courant / futur). */
  visibleMarketMonth: MarketDay[];
  /** Génère la série de comparaison aujourd'hui vs passé pour une période. */
  getComparisonData: (period: ComparePeriodKey) => ComparisonDay[];
  /** Métadonnées des 5 périodes de comparaison. */
  comparePeriods: ComparePeriodMeta[];
  /** Tableau « Comparaison rapide » (4 lignes). */
  quickComparison: QuickComparisonRow[];
  /** Mini-comparatifs additionnels (sidebar). */
  miniComparisons: MiniComparison[];
  /** Répartition des prix compset en 6 tiers. */
  compsetDistribution: DistributionSegment[];
  /** Liste des hôtels du compset. */
  compsetHotels: string[];
}

export function useCompetitiveWatchData(): CompetitiveWatchData {
  const lighthouseData = useLighthouseStore((s) => s.importData);

  return useMemo<CompetitiveWatchData>(() => {
    if (!lighthouseData) {
      // Fallback mock (comportement historique)
      return {
        isLive: false,
        meta: MOCK_PAGE_META,
        kpiCards: MOCK_KPI_CARDS,
        marketMonth: MOCK_MARKET_MONTH,
        visibleMarketMonth: mockGetVisibleMarketMonth(),
        getComparisonData: mockGetComparisonData,
        comparePeriods: MOCK_COMPARE_PERIODS,
        quickComparison: MOCK_QUICK_COMPARISON,
        miniComparisons: MOCK_MINI_COMPARISONS,
        compsetDistribution: MOCK_COMPSET_DISTRIBUTION,
        compsetHotels: MOCK_COMPSET_HOTELS,
      };
    }

    // Live : recalculé à chaque mutation du store
    const marketMonth = buildMarketMonth(lighthouseData);

    return {
      isLive: true,
      meta: buildPageMeta(lighthouseData),
      kpiCards: buildCompetitiveKpiCards(lighthouseData),
      marketMonth,
      visibleMarketMonth: marketMonth, // toutes les dates de l'import sont visibles
      getComparisonData: (period) => buildComparisonData(lighthouseData, period),
      comparePeriods: buildComparePeriods(lighthouseData),
      quickComparison: buildQuickComparison(lighthouseData),
      miniComparisons: buildMiniComparisons(lighthouseData),
      compsetDistribution: buildCompsetDistribution(lighthouseData),
      compsetHotels: lighthouseData.competitorNames,
    };
  }, [lighthouseData]);
}
