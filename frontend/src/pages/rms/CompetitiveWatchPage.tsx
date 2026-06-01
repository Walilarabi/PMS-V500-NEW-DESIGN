/**
 * FLOWTYM RMS — Page Veille Concurrentielle.
 *
 * Compose les deux vues de référence :
 *   - Vue marché          → « Écart des tarifs » + sidebar comparaison
 *                           + détail du jour / distribution / compset
 *   - Vue comparaison     → « Comparaison dynamique » + synthèse
 *                           + interprétation IA / focus / comparaison rapide
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
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
import { DataSourceTraceBar } from '../../components/rms/competitive-watch/DataSourceTraceBar';
import {
  COMPARISON_SELECTED_DATE,
} from '../../data/rms/mockCompetitiveWatchData';
import type { ComparePeriodKey } from '../../data/rms/mockCompetitiveWatchData';
import { useCompetitiveWatchData } from '../../lib/rms/useCompetitiveWatchData';
import { useCompetitiveWatchPrefs } from '../../store/competitiveWatchPrefsStore';

export const CompetitiveWatchPage: React.FC = () => {
  const [view, setView] = useState<CompetitiveView>('market');
  const [period, setPeriod] = useState<ComparePeriodKey>('hier');
  const [marketDay, setMarketDay] = useState<string>('');
  const [comparisonDay, setComparisonDay] = useState<string>(COMPARISON_SELECTED_DATE);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { meta, visibleMarketMonth } = useCompetitiveWatchData();
  const shiftMonth = useCompetitiveWatchPrefs((s) => s.shiftMonth);
  const isMarket = view === 'market';

  useEffect(() => {
    if (marketDay === '' && visibleMarketMonth.length > 0) {
      setMarketDay(visibleMarketMonth[0].label);
    }
  }, [visibleMarketMonth, marketDay]);

  return (
    <CompetitiveWatchLayout>
      {/* En-tête */}
      <CompetitiveWatchHeader
        subtitle={
          isMarket
            ? 'Analyse du marché & comparaison tarifaire'
            : 'Analyse & comparaison du marché'
        }
        dateLabel={isMarket ? meta.marketPeriodLabel : meta.comparisonDayLabel}
        lastUpdate={meta.lastUpdate}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
      />

      {/* Bandeau de traçabilité — source / période / dernier import / exclusions */}
      <DataSourceTraceBar />

      {/* Contrôles : période + nav + source + reset */}
      <LighthouseFiltersBar />

      {/* Sélecteur de vue + repli du volet droit */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <CompetitiveTabs value={view} onChange={setView} />
        <button
          type="button"
          onClick={() => setSidebarCollapsed((c) => !c)}
          aria-pressed={sidebarCollapsed}
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-2 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
        >
          {sidebarCollapsed ? (
            <>
              <PanelRightOpen className="w-4 h-4" />
              Afficher le volet
            </>
          ) : (
            <>
              <PanelRightClose className="w-4 h-4" />
              Replier le volet
            </>
          )}
        </button>
      </div>

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
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              <div className="flex-1 min-w-0 w-full">
                <MarketMainChart selectedLabel={marketDay} onSelectDay={setMarketDay} />
              </div>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="w-full lg:w-[340px] shrink-0"
                >
                  <ComparisonSidebar variant="market" period={period} selectedLabel={marketDay} />
                </motion.div>
              )}
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
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              <div className="flex-1 min-w-0 w-full">
                <DynamicComparisonChart
                  period={period}
                  onPeriodChange={setPeriod}
                  selectedLabel={comparisonDay}
                  onSelectDay={setComparisonDay}
                />
              </div>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="w-full lg:w-[340px] shrink-0"
                >
                  <ComparisonSidebar
                    variant="comparison"
                    period={period}
                    selectedLabel={comparisonDay}
                  />
                </motion.div>
              )}
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
