/**
 * FLOWTYM — Onglets de la page Règles tactiques
 */
import React from 'react';
import { cn } from '@/src/lib/utils';
import { useT, type TKey } from '@/src/i18n';

export type TacticalTab = 'rules' | 'guardrails' | 'priorities';

export interface TacticalRulesTabsProps {
  active: TacticalTab;
  onChange: (tab: TacticalTab) => void;
}

const TABS: { id: TacticalTab; key: TKey }[] = [
  { id: 'rules', key: 'rules.tabAutomatic' },
  { id: 'guardrails', key: 'rules.tabGuardrails' },
  { id: 'priorities', key: 'rules.tabPriorities' },
];

export const TacticalRulesTabs: React.FC<TacticalRulesTabsProps> = ({ active, onChange }) => {
  const t = useT();
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
            {t(tab.key)}
            {isActive && (
              <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#8B5CF6] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};
