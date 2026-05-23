/**
 * FLOWTYM — Onglets de la page Règles tactiques
 */
import React from 'react';
import { cn } from '@/src/lib/utils';

export type TacticalTab = 'rules' | 'guardrails' | 'priorities';

export interface TacticalRulesTabsProps {
  active: TacticalTab;
  onChange: (tab: TacticalTab) => void;
}

const TABS: { id: TacticalTab; label: string }[] = [
  { id: 'rules', label: 'Règles Automatiques' },
  { id: 'guardrails', label: 'Garde-fous RMS' },
  { id: 'priorities', label: 'Priorités & Conflits' },
];

export const TacticalRulesTabs: React.FC<TacticalRulesTabsProps> = ({ active, onChange }) => {
  return (
    <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-6">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-4 pb-3 pt-2 text-[14px] font-semibold transition-colors',
              isActive ? 'text-[#8B5CF6]' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#8B5CF6] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};
