/**
 * FLOWTYM RMS — Grille de KPI marché.
 *
 * 8 cartes : tarif moyen / médian / notre tarif / écart / pression /
 * concurrents +chers / concurrents -chers / positionnement.
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Tag, TrendingUp, Building2, TrendingDown, Gauge, Users, Award, Info,
} from 'lucide-react';
import type { KpiDatum, KpiTone } from '../../../data/rms/mockCompetitiveWatchData';
import { useCompetitiveWatchData } from '../../../lib/rms/useCompetitiveWatchData';

const TONE: Record<KpiTone, { iconBg: string; iconColor: string; value: string }> = {
  slate: { iconBg: 'bg-slate-100 dark:bg-slate-700', iconColor: 'text-slate-500 dark:text-slate-300', value: 'text-slate-900 dark:text-slate-50' },
  violet: { iconBg: 'bg-violet-100 dark:bg-violet-900/40', iconColor: 'text-violet-600 dark:text-violet-300', value: 'text-violet-600 dark:text-violet-300' },
  blue: { iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-300', value: 'text-blue-600 dark:text-blue-300' },
  red: { iconBg: 'bg-red-100 dark:bg-red-900/40', iconColor: 'text-red-500 dark:text-red-300', value: 'text-red-500 dark:text-red-300' },
  green: { iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-300', value: 'text-emerald-600 dark:text-emerald-300' },
};

function KpiIcon({ icon, className }: { icon: KpiDatum['icon']; className: string }) {
  switch (icon) {
    case 'tag': return <Tag className={className} />;
    case 'trending-up': return <TrendingUp className={className} />;
    case 'building': return <Building2 className={className} />;
    case 'trending-down': return <TrendingDown className={className} />;
    case 'gauge': return <Gauge className={className} />;
    case 'users': return <Users className={className} />;
    case 'award': return <Award className={className} />;
    default: return null;
  }
}

const KpiCard: React.FC<{ kpi: KpiDatum; index: number }> = ({ kpi, index }) => {
  const tone = TONE[kpi.tone];
  const isText = /[a-zA-Z]/.test(kpi.value.replace('€', '').replace('%', ''));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 * index, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3.5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone.iconBg}`}>
          <KpiIcon icon={kpi.icon} className={`w-4 h-4 ${tone.iconColor}`} />
        </span>
        <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 leading-tight flex items-center gap-1">
          {kpi.label}
          {kpi.tooltip && (
            <span
              title={kpi.tooltip}
              className="inline-flex items-center cursor-help text-amber-500 dark:text-amber-400 shrink-0"
              aria-label={kpi.tooltip}
            >
              <Info className="w-3 h-3" />
            </span>
          )}
        </span>
      </div>
      <div className={`${isText ? 'text-[18px]' : 'text-[26px]'} font-extrabold leading-none ${tone.value}`}>
        {kpi.value}
      </div>
      <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-tight">
        {kpi.sub}
      </div>
    </motion.div>
  );
};

export const MarketKpiGrid: React.FC = () => {
  const { kpiCards } = useCompetitiveWatchData();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
      {kpiCards.map((kpi, i) => (
        <KpiCard key={kpi.id} kpi={kpi} index={i} />
      ))}
    </div>
  );
};
