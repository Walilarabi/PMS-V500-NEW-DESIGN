/**
 * FLOWTYM — Tableau des garde-fous RMS
 */
import React from 'react';
import {
  Shield, ShieldCheck, ArrowDown, ArrowUp, GitBranch, Activity, Layers,
  AlertCircle, Users, Bed, Globe, Star, Edit2, Copy, MoreHorizontal, Search, Trash2,
} from 'lucide-react';
import type { Guardrail, GuardrailId } from '@/src/types/revenue/guardrails.types';
import { guardrailsEngine } from '@/src/services/revenue/guardrailsEngine';
import { cn } from '@/src/lib/utils';
import { useDataTable } from './useDataTable';
import { SortableHeader } from './SortableHeader';
import { TablePagination } from './TablePagination';

const CATEGORY_LABEL: Record<string, string> = {
  pricing: 'Tarification',
  availability: 'Disponibilité',
  restriction: 'Restrictions',
  distribution: 'Distribution',
  quality: 'Qualité',
};

const CATEGORY_COLOR: Record<string, string> = {
  pricing: 'bg-blue-50 text-blue-700',
  availability: 'bg-violet-50 text-violet-700',
  restriction: 'bg-amber-50 text-amber-700',
  distribution: 'bg-emerald-50 text-emerald-700',
  quality: 'bg-rose-50 text-rose-700',
};

const SEVERITY_COLOR: Record<string, string> = {
  blocking: 'bg-rose-50 text-rose-700 border-rose-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  auto_adjust: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const SEVERITY_LABEL: Record<string, string> = {
  blocking: 'Bloquant',
  warning: 'Avertissement',
  auto_adjust: 'Ajustement',
};

const GUARDRAIL_ICON: Record<GuardrailId, React.ComponentType<{ size?: number; className?: string }>> = {
  price_floor: Shield,
  price_ceiling: ShieldCheck,
  daily_variation_max: ArrowUp,
  weekly_variation_max: ArrowDown,
  adr_minimum: Activity,
  revpar_minimum: Activity,
  min_stay_events: Layers,
  max_stay_events: Layers,
  group_adr_protection: Users,
  occupancy_max: Bed,
  ota_parity: Globe,
  reputation_protection: Star,
};

export interface GuardrailTableProps {
  guardrails: Guardrail[];
  onEdit: (g: Guardrail) => void;
}

export const GuardrailTable: React.FC<GuardrailTableProps> = ({ guardrails, onEdit }) => {
  const table = useDataTable<Guardrail>(guardrails, {
    pageSize: 10,
    searchFields: [
      (g) => g.name,
      (g) => g.condition,
      (g) => g.threshold,
      (g) => g.action,
      (g) => g.category,
      (g) => g.coverage.detail,
    ],
  });

  const handleToggle = (g: Guardrail) => {
    guardrailsEngine.setStatus(g.id, g.status === 'active' ? 'paused' : 'active');
  };

  return (
    <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F3F4F6] flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={table.search}
            onChange={(e) => table.setSearch(e.target.value)}
            placeholder="Rechercher dans les garde-fous (nom, condition, seuil…)"
            className="w-full pl-8 pr-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
          />
        </div>
        <span className="text-[11px] text-gray-500">
          {table.totalRows} garde-fou{table.totalRows > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[#FAFAFB] text-[11px] uppercase tracking-wider text-gray-500 border-b border-[#F3F4F6]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold w-12">#</th>
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  label="Garde-fou"
                  active={table.sortKey === 'name'}
                  dir={table.sortDir}
                  onClick={() => table.toggleSort('name', (g) => g.name)}
                />
              </th>
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  label="Catégorie"
                  active={table.sortKey === 'category'}
                  dir={table.sortDir}
                  onClick={() => table.toggleSort('category', (g) => g.category)}
                />
              </th>
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  label="Type"
                  active={table.sortKey === 'severity'}
                  dir={table.sortDir}
                  onClick={() => table.toggleSort('severity', (g) => g.severity)}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">Condition</th>
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  label="Seuil / Valeur"
                  active={table.sortKey === 'threshold'}
                  dir={table.sortDir}
                  onClick={() => table.toggleSort('threshold', (g) => g.thresholdValue)}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">Action</th>
              <th className="px-4 py-3 text-left font-semibold">Couverture</th>
              <th className="px-4 py-3 text-center">
                <SortableHeader
                  label="Statut"
                  active={table.sortKey === 'status'}
                  dir={table.sortDir}
                  align="center"
                  onClick={() => table.toggleSort('status', (g) => g.status)}
                />
              </th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.visible.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                  Aucun garde-fou ne correspond à la recherche
                </td>
              </tr>
            )}
            {table.visible.map((g, idx) => {
              const Icon = GUARDRAIL_ICON[g.id] ?? Shield;
              const active = g.status === 'active';
              const globalIdx = (table.page - 1) * table.pageSize + idx + 1;
              return (
                <tr key={g.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FBFBFC]">
                  <td className="px-4 py-3 text-gray-600 font-semibold">{globalIdx}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-[#F3F4F6] text-gray-700 shrink-0">
                        <Icon size={16} />
                      </div>
                      <span className="font-semibold text-gray-900 truncate">{g.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-md', CATEGORY_COLOR[g.category])}>
                      {CATEGORY_LABEL[g.category] ?? g.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-md border', SEVERITY_COLOR[g.severity])}>
                      {SEVERITY_LABEL[g.severity]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[300px]">
                    <div className="truncate" title={g.condition}>{g.condition}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-semibold">{g.threshold}</td>
                  <td className="px-4 py-3 text-gray-700">{g.action}</td>
                  <td className="px-4 py-3 text-gray-700">{g.coverage.detail}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(g)}
                      className={cn(
                        'relative w-9 h-5 rounded-full transition-colors',
                        active ? 'bg-[#8B5CF6]' : 'bg-gray-300',
                      )}
                      aria-label={active ? 'Désactiver' : 'Activer'}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                          active ? 'translate-x-[18px]' : 'translate-x-[2px]',
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-gray-500">
                      <button onClick={() => onEdit(g)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Modifier">
                        <Edit2 size={14} />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100" title="Dupliquer">
                        <Copy size={14} />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100" title="Plus">
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={table.page}
        totalPages={table.totalPages}
        totalRows={table.totalRows}
        pageSize={table.pageSize}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
      />
    </div>
  );
};
