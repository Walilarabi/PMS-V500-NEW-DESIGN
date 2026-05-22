/**
 * FLOWTYM RMS — Sélecteur de vue Veille Concurrentielle.
 *
 * Contrôle segmenté permettant de basculer entre la vue marché
 * (« Écart des tarifs ») et la vue comparaison dynamique.
 */

import React from 'react';
import { LineChart, GitCompareArrows } from 'lucide-react';

export type CompetitiveView = 'market' | 'comparison';

interface TabDef {
  key: CompetitiveView;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { key: 'market', label: 'Vue marché', icon: <LineChart className="w-4 h-4" /> },
  { key: 'comparison', label: 'Comparaison dynamique', icon: <GitCompareArrows className="w-4 h-4" /> },
];

export interface CompetitiveTabsProps {
  value: CompetitiveView;
  onChange: (view: CompetitiveView) => void;
}

export const CompetitiveTabs: React.FC<CompetitiveTabsProps> = ({ value, onChange }) => (
  <div
    role="tablist"
    aria-label="Vue de la veille concurrentielle"
    className="inline-flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
  >
    {TABS.map((tab) => {
      const active = value === tab.key;
      return (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active}
          type="button"
          onClick={() => onChange(tab.key)}
          className={[
            'h-9 px-4 rounded-xl flex items-center gap-2 text-[13px] font-semibold transition-all duration-200',
            active
              ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
          ].join(' ')}
        >
          {tab.icon}
          {tab.label}
        </button>
      );
    })}
  </div>
);
