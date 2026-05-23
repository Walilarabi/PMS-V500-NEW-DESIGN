/**
 * FLOWTYM RMS — Table de comparaison rapide.
 *
 * Synthèse multi-périodes : demande Δ, médiane Δ, écart vs médiane,
 * positionnement.
 */

import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { ComparePeriodKey } from '../../../data/rms/mockCompetitiveWatchData';
import { useCompetitiveWatchData } from '../../../lib/rms/useCompetitiveWatchData';

interface DeltaCellProps {
  value: number;
  suffix: string;
}

const DeltaCell: React.FC<DeltaCellProps> = ({ value, suffix }) => {
  const color =
    value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-500' : 'text-slate-400';
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-[12.5px] font-bold ${color}`}>
      {value > 0 ? '+' : ''}{value}{suffix}
      <Icon className="w-3.5 h-3.5" />
    </span>
  );
};

export interface QuickComparisonTableProps {
  activePeriod: ComparePeriodKey;
  onSelectPeriod?: (period: ComparePeriodKey) => void;
}

export const QuickComparisonTable: React.FC<QuickComparisonTableProps> = ({
  activePeriod,
  onSelectPeriod,
}) => {
  const { quickComparison: QUICK_COMPARISON } = useCompetitiveWatchData();
  return (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: 0.16, ease: 'easeOut' }}
    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4"
  >
    <h3 className="text-[14.5px] font-bold text-slate-900 dark:text-slate-50 mb-3">
      Comparaison rapide
    </h3>

    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 text-left">
            <th className="pb-2 pr-3 font-semibold">Période</th>
            <th className="pb-2 px-3 font-semibold">Demande Δ</th>
            <th className="pb-2 px-3 font-semibold">Médiane Δ</th>
            <th className="pb-2 px-3 font-semibold whitespace-nowrap">Écart vs médiane</th>
            <th className="pb-2 pl-3 font-semibold">Positionnement</th>
          </tr>
        </thead>
        <tbody>
          {QUICK_COMPARISON.map((row) => {
            const active = row.key === activePeriod;
            return (
              <tr
                key={row.key}
                onClick={() => onSelectPeriod?.(row.key)}
                className={`cursor-pointer transition-colors ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <td className="py-2.5 pr-3 rounded-l-lg">
                  <span
                    className={`text-[12.5px] font-bold ${
                      active
                        ? 'text-blue-600 dark:text-blue-300 underline underline-offset-2'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {row.label}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <DeltaCell value={row.demandDelta} suffix=" pts" />
                </td>
                <td className="py-2.5 px-3">
                  <DeltaCell value={row.medianDelta} suffix="€" />
                </td>
                <td className="py-2.5 px-3">
                  <DeltaCell value={row.gapDelta} suffix="€" />
                </td>
                <td className="py-2.5 pl-3 rounded-r-lg">
                  <span
                    className={`text-[12.5px] font-bold ${
                      row.positionDelta > 0
                        ? 'text-emerald-600'
                        : row.positionDelta < 0
                          ? 'text-red-500'
                          : 'text-slate-400'
                    }`}
                  >
                    {row.positionDelta > 0 ? '+' : ''}{row.positionDelta} place
                    {Math.abs(row.positionDelta) > 1 ? 's' : ''}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </motion.div>
  );
};
