/**
 * FLOWTYM — Panneau des conflits détectés
 */
import React from 'react';
import { TrendingUp, Calendar, ArrowDown, Shield } from 'lucide-react';
import type { Conflict } from '@/src/types/revenue/conflicts.types';
import { cn } from '@/src/lib/utils';

const ICON_FOR_KIND: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  market_compression: TrendingUp,
  early_bird: Calendar,
  smart_last_minute: ArrowDown,
  competitive_parity: Shield,
  price_floor: Shield,
  demand_gap: ArrowDown,
};

const CONFLICT_TYPE_LABEL: Record<string, string> = {
  objective_opposition: 'Opposition d\'objectifs',
  overlap: 'Chevauchement',
  guardrail_blocking: 'Blocage par garde-fou',
  incompatible_promo: 'Promo incompatible',
  ota_parity: 'Parité OTA',
  event_vs_lastminute: 'Événement vs Last minute',
  compression_vs_filling: 'Compression vs Remplissage',
  earlybird_vs_demandgap: 'Early bird vs Trou de demande',
  strategy_vs_tactical: 'Stratégie vs Règle tactique',
  autopilot_vs_human: 'Autopilote vs Validation humaine',
};

const CONFLICT_TYPE_COLOR: Record<string, string> = {
  objective_opposition: 'bg-rose-50 text-rose-700',
  overlap: 'bg-amber-50 text-amber-700',
  guardrail_blocking: 'bg-emerald-50 text-emerald-700',
};

export interface ConflictResolverPanelProps {
  conflicts: Conflict[];
  onOpenDetail: (c: Conflict) => void;
}

export const ConflictResolverPanel: React.FC<ConflictResolverPanelProps> = ({ conflicts, onOpenDetail }) => {
  return (
    <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
        <h4 className="text-[15px] font-bold text-gray-900">Conflits détectés ({conflicts.length})</h4>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[#FAFAFB] text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Conflit entre</th>
              <th className="px-4 py-3 text-left font-semibold">Type de conflit</th>
              <th className="px-4 py-3 text-left font-semibold">Impact potentiel</th>
              <th className="px-4 py-3 text-left font-semibold">Action recommandée</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((c) => (
              <tr key={c.id} className="border-t border-[#F3F4F6]">
                <td className="px-4 py-4">
                  <div className="space-y-2">
                    {c.participants.map((p, i) => {
                      const Icon = ICON_FOR_KIND[String(p.id)] ?? Shield;
                      return (
                        <div key={i} className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-[#F3F4F6] text-gray-700 shrink-0">
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-[13px] truncate">{p.name}</div>
                            <div className="text-[11px] text-gray-500">Priorité {p.priority}</div>
                          </div>
                        </div>
                      );
                    })}
                    {c.participants.length === 2 && (
                      <div className="text-[11px] uppercase tracking-wider text-gray-400 pl-1">vs</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={cn(
                    'inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md',
                    CONFLICT_TYPE_COLOR[c.type] ?? 'bg-gray-50 text-gray-700',
                  )}>
                    {CONFLICT_TYPE_LABEL[c.type] ?? c.type}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className={cn(
                    'font-bold',
                    c.potentialImpact < 0 ? 'text-rose-600' : 'text-emerald-600',
                  )}>
                    {c.potentialImpact > 0 ? '+' : ''}{c.potentialImpact}€
                  </div>
                  <div className="text-[11px] text-gray-500">{c.potentialImpactLabel}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-[13px] text-gray-900 mb-2">{c.recommendedAction}</div>
                  <button
                    onClick={() => onOpenDetail(c)}
                    className="text-[12px] font-semibold text-[#8B5CF6] hover:bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100"
                  >
                    Voir le détail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-[#F3F4F6] text-right">
        <a className="text-[12px] font-semibold text-[#8B5CF6] hover:underline" href="#">
          Voir tout les conflits ↗
        </a>
      </div>
    </div>
  );
};
