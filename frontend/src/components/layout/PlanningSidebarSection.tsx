/**
 * FLOWTYM — Section contextuelle du Planning dans la sidebar principale.
 *
 * Rendue UNIQUEMENT lorsque la page Planning est active, sous les items de
 * navigation (maquette). Regroupe les MODES D'AFFICHAGE et les FILTRES — sans
 * créer un second volet latéral. L'état est partagé via planningUiStore et
 * appliqué par PlanningViewLive ; les options de filtre dérivent des chambres
 * réelles (TanStack Query mis en cache, aucun double fetch).
 */
import React from 'react';
import { LayoutGrid, TrendingUp, Sparkles, Users, Wrench, Layers, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useRooms } from '@/src/domains/hotel/hooks';
import { usePlanningUiStore, type PlanningMode } from '@/src/store/planningUiStore';

const MODES: { key: PlanningMode; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'occupation', label: 'Occupation', icon: LayoutGrid },
  { key: 'revenue', label: 'Revenue', icon: TrendingUp },
  { key: 'housekeeping', label: 'Ménage', icon: Sparkles },
  { key: 'groupe', label: 'Groupe', icon: Users },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
];

const STATUSES = ['Arrivées', 'Départs', 'Occupées', 'Libres', 'Ménage'];

export function PlanningSidebarSection({ isCollapsed }: { isCollapsed: boolean }) {
  const activeMode = usePlanningUiStore((s) => s.activeMode);
  const setActiveMode = usePlanningUiStore((s) => s.setActiveMode);
  const floorFilter = usePlanningUiStore((s) => s.floorFilter);
  const setFloorFilter = usePlanningUiStore((s) => s.setFloorFilter);
  const typeFilter = usePlanningUiStore((s) => s.typeFilter);
  const setTypeFilter = usePlanningUiStore((s) => s.setTypeFilter);
  const statusFilter = usePlanningUiStore((s) => s.statusFilter);
  const setStatusFilter = usePlanningUiStore((s) => s.setStatusFilter);

  const rooms = useRooms().data ?? [];

  const floors = React.useMemo(
    () => Array.from(new Set(rooms.map((r) => r.floor).filter((f) => f != null)))
      .sort((a, b) => (a as number) - (b as number)) as number[],
    [rooms],
  );
  const roomTypes = React.useMemo(
    () => Array.from(new Set(rooms.map((r) => r.type).filter(Boolean))).sort() as string[],
    [rooms],
  );
  const roomScales = React.useMemo(
    () => Array.from(new Set(rooms.map((r) => r.category).filter(Boolean))).sort() as string[],
    [rooms],
  );

  // Sidebar repliée : pictogrammes discrets, sans contrôles (évite l'écrasement).
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-3 pt-3 mt-1 border-t border-gray-100 text-gray-300">
        <Layers size={16} aria-hidden="true" />
        <SlidersHorizontal size={16} aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      {/* Modes d'affichage */}
      <div className="pt-3 mt-1 border-t border-gray-100">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1.5">
          Modes d'affichage
        </p>
        <div className="space-y-0.5" role="tablist" aria-label="Mode d'affichage du planning">
          {MODES.map(({ key, label, icon: Icon }) => {
            const active = key === activeMode;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveMode(key)}
                className={cn(
                  'relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-semibold transition-all text-left',
                  active ? 'bg-[#8B5CF6]/8 text-[#8B5CF6]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                )}
              >
                <Icon size={16} className={cn('shrink-0', active && 'text-[#8B5CF6]')} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtres */}
      <div className="pt-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1.5">
          Filtres
        </p>
        <div className="space-y-2 px-1">
          <FilterSelect label="Étage" value={floorFilter} onChange={setFloorFilter}>
            <option value="Tous">Tous les étages</option>
            {floors.map((f) => (
              <option key={f} value={String(f)}>Étage {f}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Type" value={typeFilter} onChange={setTypeFilter}>
            <option>Tous Types</option>
            {roomScales.length > 0 && (
              <optgroup label="Catégories">
                {roomScales.map((s) => <option key={s} value={s}>{s}</option>)}
              </optgroup>
            )}
            {roomTypes.length > 0 && (
              <optgroup label="Modèles">
                {roomTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </optgroup>
            )}
          </FilterSelect>

          <FilterSelect label="Statut" value={statusFilter} onChange={setStatusFilter}>
            <option>Tous Statuts</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
        </div>
      </div>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Filtre ${label}`}
        className="mt-0.5 w-full bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px] font-semibold text-gray-700 appearance-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]/40 outline-none transition-all cursor-pointer"
      >
        {children}
      </select>
    </label>
  );
}
