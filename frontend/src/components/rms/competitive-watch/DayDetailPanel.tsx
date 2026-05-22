/**
 * FLOWTYM RMS — Détail du jour.
 *
 * Deux variantes :
 *   - 'market'      → « Détail du jour » : 6 indicateurs + distribution +
 *                     compset analysé
 *   - 'comparison'  → « Focus » : mini-tableau Hier / Aujourd'hui / Écart
 */

import React from 'react';
import { motion } from 'motion/react';
import { Info, ArrowUp } from 'lucide-react';
import {
  getVisibleMarketMonth, COMPSET_HOTELS, PAGE_META,
  getComparisonData, COMPARE_PERIODS,
} from '../../../data/rms/mockCompetitiveWatchData';
import type { ComparePeriodKey } from '../../../data/rms/mockCompetitiveWatchData';
import { getDemandColor } from '../../../lib/rms/marketDemandRules';
import { DEMAND_BANDS } from '../../../lib/rms/chartColors';
import { CompsetDistributionBar } from './CompsetDistributionBar';

/* ── Variante marché ────────────────────────────────────────────────────── */

interface StatCellProps {
  label: string;
  value: string;
  valueColor?: string;
  sub?: React.ReactNode;
  info?: boolean;
}

const StatCell: React.FC<StatCellProps> = ({ label, value, valueColor, sub, info }) => (
  <div className="px-4 py-1 first:pl-0">
    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
      {label}
      {info && <Info className="w-3 h-3" />}
    </div>
    <div
      className="text-[20px] font-extrabold leading-tight mt-1"
      style={{ color: valueColor ?? 'inherit' }}
    >
      {value}
    </div>
    {sub && <div className="text-[11px] font-semibold mt-0.5">{sub}</div>}
  </div>
);

const EmptyDetail: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
    Aucune donnée à afficher pour la période sélectionnée.
  </div>
);

const MarketDetail: React.FC<{ selectedLabel: string }> = ({ selectedLabel }) => {
  const visible = getVisibleMarketMonth();
  const day = visible.find((d) => d.label === selectedLabel) ?? visible[0];
  if (!day) return <EmptyDetail />;
  const gap = day.ourPrice - day.median;
  const gapPct = ((gap / day.median) * 100).toFixed(1);
  const demandColor = getDemandColor(day.demand);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-5"
    >
      <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50 mb-4">
        Détail du jour <span className="text-slate-400 font-semibold">- {day.label} 2026</span>
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 6 indicateurs */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-y-3 divide-slate-100 dark:divide-slate-800">
          <StatCell label="Notre tarif" value={`${day.ourPrice}€`} valueColor="#2563EB" />
          <StatCell label="Tarif médian compset" value={`${day.median}€`} valueColor="#16A34A" info />
          <StatCell label="Tarif moyen compset" value={`${day.mean}€`} info />
          <StatCell
            label="Écart vs médiane"
            value={`${gap >= 0 ? '+' : ''}${gap}€`}
            valueColor="#EF4444"
            sub={<span className="text-red-400">({gapPct}%)</span>}
          />
          <div className="px-4 py-1">
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Demande du marché
            </div>
            <div className="text-[20px] font-extrabold leading-tight mt-1" style={{ color: demandColor }}>
              {day.demand}%
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${day.demand}%`, backgroundColor: demandColor }}
              />
            </div>
          </div>
          <StatCell
            label="Positionnement"
            value={`#${PAGE_META.rank} / ${PAGE_META.rankTotal}`}
            sub={<span className="text-slate-400">Bas de marché</span>}
          />
        </div>

        {/* Distribution */}
        <div className="lg:col-span-5 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-5">
          <CompsetDistributionBar />
        </div>
      </div>

      {/* Compset analysé */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-x-4 gap-y-2 flex-wrap">
        <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
          Compset analysé ({COMPSET_HOTELS.length} hôtels)
        </span>
        {COMPSET_HOTELS.map((hotel, i) => (
          <span key={hotel} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: DEMAND_BANDS[i % DEMAND_BANDS.length].color }}
            />
            <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {hotel}
            </span>
          </span>
        ))}
      </div>
    </motion.div>
  );
};

/* ── Variante comparaison (Focus) ───────────────────────────────────────── */

const FocusDetail: React.FC<{ period: ComparePeriodKey; selectedLabel: string }> = ({
  period,
  selectedLabel,
}) => {
  const periodMeta = COMPARE_PERIODS.find((p) => p.key === period) ?? COMPARE_PERIODS[0];
  const days = getComparisonData(period);
  const day = days.find((d) => d.label === selectedLabel) ?? days[0];
  if (!day) return <EmptyDetail />;

  const demandDelta = day.demandToday - day.demandPast;
  const medianDelta = day.medianToday - day.medianPast;

  const rows = [
    {
      label: 'Demande marché',
      past: `${day.demandPast}%`,
      today: `${day.demandToday}%`,
      delta: `${demandDelta >= 0 ? '+' : ''}${demandDelta} pts`,
      positive: demandDelta >= 0,
    },
    {
      label: 'Médiane compset',
      past: `${day.medianPast}€`,
      today: `${day.medianToday}€`,
      delta: `${medianDelta >= 0 ? '+' : ''}${medianDelta}€`,
      positive: medianDelta >= 0,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4"
    >
      <h3 className="text-[14.5px] font-bold text-slate-900 dark:text-slate-50 mb-3">
        Focus <span className="text-slate-400 font-semibold">– {day.label} 2026</span>
      </h3>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            <th className="text-left pb-2 font-semibold" />
            <th className="text-center pb-2 font-semibold">{periodMeta.label}</th>
            <th className="text-center pb-2 font-semibold">Aujourd'hui</th>
            <th className="text-center pb-2 font-semibold">Écart</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-3 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">
                {row.label}
              </td>
              <td className="py-3 text-center text-[14px] font-bold text-slate-400 dark:text-slate-500">
                {row.past}
              </td>
              <td className="py-3 text-center text-[15px] font-extrabold text-slate-900 dark:text-slate-100">
                {row.today}
              </td>
              <td className="py-3 text-center">
                <span
                  className={`inline-flex items-center gap-0.5 text-[13px] font-extrabold ${
                    row.positive ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {row.delta}
                  <ArrowUp
                    className={`w-3.5 h-3.5 ${row.positive ? '' : 'rotate-180'}`}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
};

/* ── Composant exporté ──────────────────────────────────────────────────── */

export interface DayDetailPanelProps {
  variant: 'market' | 'comparison';
  period: ComparePeriodKey;
  selectedLabel: string;
}

export const DayDetailPanel: React.FC<DayDetailPanelProps> = ({
  variant,
  period,
  selectedLabel,
}) => {
  if (variant === 'market') return <MarketDetail selectedLabel={selectedLabel} />;
  return <FocusDetail period={period} selectedLabel={selectedLabel} />;
};
