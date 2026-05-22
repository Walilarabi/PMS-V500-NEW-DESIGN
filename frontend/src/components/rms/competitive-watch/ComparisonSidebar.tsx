/**
 * FLOWTYM RMS — Sidebar de comparaison.
 *
 * Deux variantes :
 *   - 'market'      → liste des périodes de comparaison + mini-comparatifs
 *   - 'comparison'  → synthèse comparaison (demande, médiane, écart,
 *                     positionnement, momentum marché)
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Calendar, ChevronDown, ArrowRight, TrendingUp, TrendingDown,
  Activity, LineChart, Target, Flame, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  COMPARE_PERIODS, MINI_COMPARISONS, QUICK_COMPARISON,
  getComparisonData, PAGE_META,
} from '../../../data/rms/mockCompetitiveWatchData';
import type { ComparePeriodKey } from '../../../data/rms/mockCompetitiveWatchData';
import { getMarketMomentum } from '../../../lib/rms/comparisonCalculations';

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.aside
    initial={{ opacity: 0, x: 12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.35, delay: 0.08, ease: 'easeOut' }}
    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4"
  >
    {children}
  </motion.aside>
);

/* ── Variante marché ────────────────────────────────────────────────────── */

const MarketSidebar: React.FC = () => (
  <Card>
    <div className="flex items-start justify-between gap-3 mb-3.5">
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">Comparaison</h3>
        <p className="text-[12px] text-slate-400 dark:text-slate-500">Aujourd'hui vs…</p>
      </div>
      <button
        type="button"
        className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        Comparer par : €
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
    </div>

    {/* Liste des périodes */}
    <div className="space-y-1.5">
      {COMPARE_PERIODS.slice(0, 4).map((p) => {
        const positive = p.delta >= 0;
        return (
          <div
            key={p.key}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-slate-400" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                {p.key === 'hier' ? 'Hier' : p.label.replace('J-', '') + ' jours'}
              </div>
              <div className="text-[11.5px] text-slate-400 dark:text-slate-500">{p.date}</div>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`text-[14px] font-extrabold ${positive ? 'text-red-500' : 'text-emerald-600'}`}
              >
                {positive ? '+' : ''}{p.delta}€
              </div>
              <div
                className={`text-[11px] font-semibold ${positive ? 'text-red-400' : 'text-emerald-500'}`}
              >
                ({positive ? '+' : ''}{p.deltaPct}%)
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* Mini-comparatifs */}
    <div className="grid grid-cols-3 gap-2 mt-3">
      {MINI_COMPARISONS.map((m) => {
        const positive = m.delta >= 0;
        return (
          <div
            key={m.label}
            className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 text-center"
          >
            <div
              className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center mb-1.5 ${
                positive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
              }`}
            >
              {positive
                ? <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                : <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />}
            </div>
            <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-tight mb-0.5">
              {m.label}
            </div>
            <div className={`text-[13px] font-extrabold ${positive ? 'text-red-500' : 'text-emerald-600'}`}>
              {positive ? '+' : ''}{m.delta}€
            </div>
            <div className={`text-[10px] font-semibold ${positive ? 'text-red-400' : 'text-emerald-500'}`}>
              ({positive ? '+' : ''}{m.deltaPct}%)
            </div>
          </div>
        );
      })}
    </div>

    <button
      type="button"
      className="w-full mt-3 h-9 rounded-xl flex items-center justify-center gap-1.5 text-[12.5px] font-bold text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
    >
      Voir toutes les comparaisons
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </Card>
);

/* ── Variante comparaison ───────────────────────────────────────────────── */

const SynthRow: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  children: React.ReactNode;
}> = ({ icon, iconBg, label, children }) => (
  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <div className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  </div>
);

const ComparisonSynthesis: React.FC<{
  period: ComparePeriodKey;
  selectedLabel: string;
}> = ({ period, selectedLabel }) => {
  const periodMeta = COMPARE_PERIODS.find((p) => p.key === period) ?? COMPARE_PERIODS[0];
  const days = getComparisonData(period);
  const day = days.find((d) => d.label === selectedLabel) ?? days[0];

  const demandDelta = day.demandToday - day.demandPast;
  const medianDelta = day.medianToday - day.medianPast;
  const quick = QUICK_COMPARISON.find((q) => q.key === period);
  const positionDelta = quick?.positionDelta ?? 0;
  const pastRank = PAGE_META.rank + positionDelta;
  const momentum = getMarketMomentum(demandDelta);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">
          Synthèse comparaison
        </h3>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
          Aujourd'hui vs {periodMeta.label}
        </span>
      </div>

      <div className="space-y-2">
        {/* Demande du marché */}
        <SynthRow
          icon={<Activity className="w-4 h-4 text-blue-600 dark:text-blue-300" />}
          iconBg="bg-blue-100 dark:bg-blue-900/40"
          label="Demande du marché"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-0.5 text-[13px] font-extrabold text-emerald-600">
              {demandDelta >= 0 ? '+' : ''}{demandDelta}
              {demandDelta >= 0
                ? <ArrowUpRight className="w-3.5 h-3.5" />
                : <ArrowDownRight className="w-3.5 h-3.5" />}
            </span>
            <span className="text-[12px] text-slate-400">→</span>
            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
              {day.demandToday}%
            </span>
          </div>
        </SynthRow>

        {/* Médiane compset */}
        <SynthRow
          icon={<LineChart className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/40"
          label="Médiane compset"
        >
          <div className="flex items-center gap-1.5">
            {medianDelta >= 0
              ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
              {day.medianPast}€ <span className="text-slate-400 font-medium">→</span> {day.medianToday}€
            </span>
          </div>
        </SynthRow>

        {/* Écart vs médiane */}
        <SynthRow
          icon={<TrendingDown className="w-4 h-4 text-red-500 dark:text-red-300" />}
          iconBg="bg-red-100 dark:bg-red-900/40"
          label="Écart vs médiane"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-extrabold text-red-500">-14€</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[12px] font-semibold text-slate-400">(-4.1%)</span>
          </div>
        </SynthRow>

        {/* Positionnement */}
        <SynthRow
          icon={<Target className="w-4 h-4 text-violet-600 dark:text-violet-300" />}
          iconBg="bg-violet-100 dark:bg-violet-900/40"
          label="Positionnement"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-extrabold text-slate-800 dark:text-slate-100">
              #{PAGE_META.rank}
            </span>
            <span className="text-right">
              <span
                className={`text-[12px] font-bold ${
                  positionDelta > 0 ? 'text-emerald-600' : positionDelta < 0 ? 'text-red-500' : 'text-slate-400'
                }`}
              >
                {positionDelta > 0 ? '+' : ''}{positionDelta} place{Math.abs(positionDelta) > 1 ? 's' : ''}
              </span>
              <span className="block text-[10.5px] text-slate-400">
                (vs {periodMeta.label} : #{pastRank})
              </span>
            </span>
          </div>
        </SynthRow>

        {/* Momentum marché */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/10 border border-red-100 dark:border-red-900/30">
          <span className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-red-500" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
              Momentum marché
            </div>
            <div className="text-[14px] font-extrabold" style={{ color: momentum.color }}>
              {momentum.label}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1.5 h-5 rounded-full"
                style={{
                  backgroundColor: i < momentum.intensity ? momentum.color : '#FECACA',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

/* ── Composant exporté ──────────────────────────────────────────────────── */

export interface ComparisonSidebarProps {
  variant: 'market' | 'comparison';
  period: ComparePeriodKey;
  selectedLabel: string;
}

export const ComparisonSidebar: React.FC<ComparisonSidebarProps> = ({
  variant,
  period,
  selectedLabel,
}) => {
  if (variant === 'market') return <MarketSidebar />;
  return <ComparisonSynthesis period={period} selectedLabel={selectedLabel} />;
};
