/**
 * FLOWTYM — Volet latéral gauche de pilotage du planning.
 *
 * Regroupe (comme demandé) les MODES d'affichage et les FILTRES, à gauche du
 * planning. Collapsible. Aucune donnée fictive : les options de filtre sont
 * dérivées des chambres réelles.
 */
import React from 'react';
import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal, Layers } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { PlanningModeBar } from './PlanningModeBar';
import type { PlanningMode } from '@/src/store/planningUiStore';

export interface PlanningPilotagePanelProps {
  collapsed: boolean;
  onToggle: () => void;
  activeMode: PlanningMode;
  onModeChange: (m: PlanningMode) => void;
  floors: number[];
  floorFilter: string;
  onFloorChange: (v: string) => void;
  roomTypes: string[];
  typeFilter: string;
  onTypeChange: (v: string) => void;
  statuses: string[];
  statusFilter: string;
  onStatusChange: (v: string) => void;
}

export function PlanningPilotagePanel({
  collapsed,
  onToggle,
  activeMode,
  onModeChange,
  floors,
  floorFilter,
  onFloorChange,
  roomTypes,
  typeFilter,
  onTypeChange,
  statuses,
  statusFilter,
  onStatusChange,
}: PlanningPilotagePanelProps) {
  return (
    <aside
      className={cn(
        'flex flex-col bg-white border-r border-gray-100 shrink-0 z-40 transition-[width] duration-200 ease-out overflow-hidden',
        collapsed ? 'w-[44px]' : 'w-[210px]',
      )}
      aria-label="Volet de pilotage"
    >
      <div className={cn('h-[44px] flex items-center border-b border-gray-100 shrink-0', collapsed ? 'justify-center' : 'justify-between px-3')}>
        {!collapsed && (
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pilotage</span>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Déployer le pilotage' : 'Réduire le pilotage'}
          aria-label={collapsed ? 'Déployer le volet de pilotage' : 'Réduire le volet de pilotage'}
          aria-pressed={collapsed}
          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center gap-3 py-3 text-gray-300">
          <Layers size={16} />
          <SlidersHorizontal size={16} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
          {/* Modes d'affichage */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-gray-400">
              <Layers size={12} />
              <span className="text-[9px] font-black uppercase tracking-widest">Modes d'affichage</span>
            </div>
            <PlanningModeBar activeMode={activeMode} onChange={onModeChange} orientation="vertical" />
          </div>

          {/* Filtres */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-gray-400">
              <SlidersHorizontal size={12} />
              <span className="text-[9px] font-black uppercase tracking-widest">Filtres</span>
            </div>
            <div className="space-y-2">
              <FilterSelect label="Étage" value={floorFilter} onChange={onFloorChange}
                options={['Tous', ...floors.map((f) => String(f))]}
                render={(o) => (o === 'Tous' ? 'Tous les étages' : `Étage ${o}`)} />
              <FilterSelect label="Type" value={typeFilter} onChange={onTypeChange}
                options={['Tous Types', ...roomTypes]} />
              <FilterSelect label="Statut" value={statusFilter} onChange={onStatusChange}
                options={['Tous Statuts', ...statuses]} />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  render,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  render?: (o: string) => string;
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-gray-700 appearance-none focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
      >
        {options.map((o) => (
          <option key={o} value={o}>{render ? render(o) : o}</option>
        ))}
      </select>
    </label>
  );
}
