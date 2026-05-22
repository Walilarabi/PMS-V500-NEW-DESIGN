/**
 * FLOWTYM RMS — Barre de filtres Lighthouse.
 *
 * 8 filtres déroulants (tarif, canal, device, LOS, pax, chambre, pension,
 * compset) + bouton « Réinitialiser filtres ».
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  ChevronDown, Tag, Globe, Moon, User, BedDouble,
  UtensilsCrossed, Users, RotateCcw,
} from 'lucide-react';
import { LIGHTHOUSE_FILTERS } from '../../../data/rms/mockCompetitiveWatchData';
import type { FilterDef } from '../../../data/rms/mockCompetitiveWatchData';

function FilterIcon({ icon }: { icon: FilterDef['icon'] }) {
  const cls = 'w-4 h-4 text-slate-500 dark:text-slate-400';
  switch (icon) {
    case 'tag': return <Tag className={cls} />;
    case 'globe': return <Globe className={cls} />;
    case 'moon': return <Moon className={cls} />;
    case 'user': return <User className={cls} />;
    case 'bed': return <BedDouble className={cls} />;
    case 'utensils': return <UtensilsCrossed className={cls} />;
    case 'compset': return <Users className={cls} />;
    case 'booking':
      return (
        <span className="w-4 h-4 rounded-[5px] bg-[#1E293B] dark:bg-slate-200 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-extrabold text-white dark:text-slate-900 leading-none">B</span>
        </span>
      );
    default: return null;
  }
}

const FilterPill: React.FC<{ filter: FilterDef }> = ({ filter }) => (
  <button
    type="button"
    className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
  >
    <FilterIcon icon={filter.icon} />
    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
      {filter.value}
    </span>
    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
  </button>
);

export const LighthouseFiltersBar: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
    className="flex items-center justify-between gap-3 flex-wrap"
  >
    <div className="flex items-center gap-2.5 flex-wrap">
      {LIGHTHOUSE_FILTERS.map((filter) => (
        <FilterPill key={filter.id} filter={filter} />
      ))}
    </div>
    <button
      type="button"
      className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
    >
      <RotateCcw className="w-4 h-4" />
      Réinitialiser filtres
    </button>
  </motion.div>
);
