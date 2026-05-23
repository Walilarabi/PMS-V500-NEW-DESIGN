/**
 * FLOWTYM — Tableau des garde-fous RMS
 */
import React from 'react';
import {
  Shield, ShieldCheck, ArrowDown, ArrowUp, GitBranch, Activity, Layers,
  AlertCircle, Users, Bed, Globe, Star, Edit2, Copy, MoreHorizontal,
} from 'lucide-react';
import type { Guardrail, GuardrailId } from '@/src/types/revenue/guardrails.types';
import { guardrailsEngine } from '@/src/services/revenue/guardrailsEngine';
import { cn } from '@/src/lib/utils';

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
  const handleToggle = (g: Guardrail) => {
    guardrailsEngine.setStatus(g.id, g.status === 'active' ? 'paused' : 'active');
  };

  return (
    <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[#FAFAFB] text-[11px] uppercase tracking-wider text-gray-500 border-b border-[#F3F4F6]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold w-12">#</th>
              <th className="px-4 py-3 text-left font-semibold">Garde-fou</th>
              <th className="px-4 py-3 text-left font-semibold">Catégorie</th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Condition</th>
              <th className="px-4 py-3 text-left font-semibold">Seuil / Valeur</th>
              <th className="px-4 py-3 text-left font-semibold">Action</th>
              <th className="px-4 py-3 text-left font-semibold">Couverture</th>
              <th className="px-4 py-3 text-center font-semibold">Statut</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {guardrails.map((g, idx) => {
              const Icon = GUARDRAIL_ICON[g.id] ?? Shield;
              const active = g.status === 'active';
              return (
                <tr key={g.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FBFBFC]">
                  <td className="px-4 py-3 text-gray-600 font-semibold">{idx + 1}</td>
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
    </div>
  );
};
