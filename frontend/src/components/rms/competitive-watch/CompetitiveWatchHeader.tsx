/**
 * FLOWTYM RMS — En-tête Veille Concurrentielle.
 *
 * Logo + titre · navigateur de date · actions (Exporter / Actualiser) ·
 * indicateur de fraîcheur des données.
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  BarChart3, ChevronLeft, ChevronRight, ChevronDown,
  Calendar, Download, RefreshCw,
} from 'lucide-react';

export interface CompetitiveWatchHeaderProps {
  subtitle: string;
  dateLabel: string;
  lastUpdate: string;
  onPrev?: () => void;
  onNext?: () => void;
}

export const CompetitiveWatchHeader: React.FC<CompetitiveWatchHeaderProps> = ({
  subtitle,
  dateLabel,
  lastUpdate,
  onPrev,
  onNext,
}) => (
  <motion.header
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    className="flex items-center justify-between gap-4 flex-wrap"
  >
    {/* Logo + titre */}
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0">
        <BarChart3 className="w-6 h-6 text-white" strokeWidth={2.4} />
      </div>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold text-slate-900 dark:text-slate-50 leading-tight">
          Veille Concurrentielle
        </h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-tight">
          {subtitle}
        </p>
      </div>
    </div>

    {/* Navigateur de date */}
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Période précédente"
        className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <ChevronLeft className="w-4.5 h-4.5" />
      </button>
      <button
        type="button"
        className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2.5 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <Calendar className="w-4 h-4 text-violet-500" />
        <span className="text-[14px] font-semibold whitespace-nowrap">{dateLabel}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Période suivante"
        className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <ChevronRight className="w-4.5 h-4.5" />
      </button>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 text-[13.5px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <Download className="w-4 h-4" />
        Exporter
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      <button
        type="button"
        className="h-10 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] flex items-center gap-2 text-[13.5px] font-semibold text-white shadow-md shadow-blue-500/25 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Actualiser tarifs
      </button>
      <div className="flex items-center gap-2 pl-1">
        <span className="text-[12.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
          Mis à jour {lastUpdate}
        </span>
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
        </span>
      </div>
    </div>
  </motion.header>
);
