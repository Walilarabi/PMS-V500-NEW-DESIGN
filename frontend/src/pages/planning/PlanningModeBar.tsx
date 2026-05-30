/**
 * FLOWTYM — Sélecteur de mode d'affichage du planning (maquette #9).
 *
 * 5 modes appliquant un style/filtre côté client (sans rechargement) :
 *   Occupation · Revenue · Housekeeping · Groupe · Maintenance.
 * L'état est persisté dans planningUiStore.
 */
import React from 'react';
import { LayoutGrid, TrendingUp, Sparkles, Users, Wrench } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { PlanningMode } from '@/src/store/planningUiStore';

const MODES: { key: PlanningMode; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'occupation', label: 'Occupation', icon: LayoutGrid },
  { key: 'revenue', label: 'Revenue', icon: TrendingUp },
  { key: 'housekeeping', label: 'Ménage', icon: Sparkles },
  { key: 'groupe', label: 'Groupe', icon: Users },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
];

export function PlanningModeBar({
  activeMode,
  onChange,
  orientation = 'horizontal',
}: {
  activeMode: PlanningMode;
  onChange: (mode: PlanningMode) => void;
  orientation?: 'horizontal' | 'vertical';
}) {
  const vertical = orientation === 'vertical';
  return (
    <div
      className={cn(
        'bg-gray-50 p-1 rounded-xl border border-gray-100',
        vertical ? 'flex flex-col gap-0.5' : 'flex items-center',
      )}
      role="tablist"
      aria-label="Mode d'affichage du planning"
    >
      {MODES.map(({ key, label, icon: Icon }) => {
        const active = key === activeMode;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'flex items-center gap-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all',
              vertical ? 'px-3 py-2 w-full' : 'px-3 py-1.5',
              active ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <Icon size={13} />
            <span className={vertical ? 'inline' : 'hidden xl:inline'}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
