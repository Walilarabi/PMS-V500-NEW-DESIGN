/**
 * FLOWTYM RMS — Page Veille Concurrentielle.
 *
 * Compose les deux vues de référence :
 *   - Vue marché          → « Écart des tarifs » + sidebar comparaison
 *                           + détail du jour / distribution / compset
 *   - Vue comparaison     → « Comparaison dynamique » + synthèse
 *                           + interprétation IA / focus / comparaison rapide
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CompetitiveWatchLayout } from '../../components/rms/competitive-watch/CompetitiveWatchLayout';
import { CompetitiveWatchHeader } from '../../components/rms/competitive-watch/CompetitiveWatchHeader';
import { LighthouseFiltersBar } from '../../components/rms/competitive-watch/LighthouseFiltersBar';
import { CompetitiveTabs } from '../../components/rms/competitive-watch/CompetitiveTabs';
import type { CompetitiveView } from '../../components/rms/competitive-watch/CompetitiveTabs';
import { MarketKpiGrid } from '../../components/rms/competitive-watch/MarketKpiGrid';
import { MarketMainChart } from '../../components/rms/competitive-watch/MarketMainChart';
import { DynamicComparisonChart } from '../../components/rms/competitive-watch/DynamicComparisonChart';
import { ComparisonSidebar } from '../../components/rms/competitive-watch/ComparisonSidebar';
import { AiInterpretationPanel } from '../../components/rms/competitive-watch/AiInterpretationPanel';
import { QuickComparisonTable } from '../../components/rms/competitive-watch/QuickComparisonTable';
import { DayDetailPanel } from '../../components/rms/competitive-watch/DayDetailPanel';
import {
  PAGE_META, MARKET_SELECTED_DATE, COMPARISON_SELECTED_DATE,
} from '../../data/rms/mockCompetitiveWatchData';
import type { ComparePeriodKey } from '../../data/rms/mockCompetitiveWatchData';

export const CompetitiveWatchPage: React.FC = () => {
  const [view, setView] = useState<CompetitiveView>('market');
  const [period, setPeriod] = useState<ComparePeriodKey>('hier');
  const [marketDay, setMarketDay] = useState<string>(MARKET_SELECTED_DATE);
  const [comparisonDay, setComparisonDay] = useState<string>(COMPARISON_SELECTED_DATE);

  const isMarket = view === 'market';

  return (
    <CompetitiveWatchLayout>
      {/* En-tête */}
      <CompetitiveWatchHeader
        subtitle={
          isMarket
            ? 'Analyse du marché & comparaison tarifaire'
            : 'Analyse & comparaison du marché'
        }
        dateLabel={isMarket ? PAGE_META.marketPeriodLabel : PAGE_META.comparisonDayLabel}
        lastUpdate={PAGE_META.lastUpdate}
      />

      {/* Filtres Lighthouse */}
      <LighthouseFiltersBar />

      {/* Sélecteur de vue */}
      <CompetitiveTabs value={view} onChange={setView} />

      {/* KPI marché */}
      <MarketKpiGrid />

      {/* Contenu selon la vue */}
      <AnimatePresence mode="wait">
        {isMarket ? (
          <motion.div
            key="market"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <MarketMainChart selectedLabel={marketDay} onSelectDay={setMarketDay} />
              </div>
              <div className="w-full lg:w-[340px] shrink-0">
                <ComparisonSidebar variant="market" period={period} selectedLabel={marketDay} />
              </div>
            </div>
            <DayDetailPanel variant="market" period={period} selectedLabel={marketDay} />
          </motion.div>
        ) : (
          <motion.div
            key="comparison"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <DynamicComparisonChart
                  period={period}
                  onPeriodChange={setPeriod}
                  selectedLabel={comparisonDay}
                  onSelectDay={setComparisonDay}
                />
              </div>
              <div className="w-full lg:w-[340px] shrink-0">
                <ComparisonSidebar
                  variant="comparison"
                  period={period}
                  selectedLabel={comparisonDay}
                />
              </div>
            </div>

            {/* Blocs bas de page */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4">
                <AiInterpretationPanel period={period} selectedLabel={comparisonDay} />
              </div>
              <div className="lg:col-span-3">
                <DayDetailPanel
                  variant="comparison"
                  period={period}
                  selectedLabel={comparisonDay}
                />
              </div>
              <div className="lg:col-span-5">
                <QuickComparisonTable activePeriod={period} onSelectPeriod={setPeriod} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CompetitiveWatchLayout>
  );
};

export default CompetitiveWatchPage;
