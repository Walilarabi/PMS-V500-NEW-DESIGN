/**
 * FLOWTYM — Hiérarchie des priorités RMS (drag & drop)
 */
import React, { useState } from 'react';
import {
  Shield, Calendar, TrendingUp, Zap, Brain, Tag, Clock, PieChart, Percent, Activity, GripVertical,
} from 'lucide-react';
import type { PriorityLevel } from '@/src/types/revenue/conflicts.types';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import { cn } from '@/src/lib/utils';

const KIND_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  guardrails_absolute: Shield,
  major_events: Calendar,
  market_compression: TrendingUp,
  abnormal_pickup: Zap,
  strategy_active: Brain,
  pricing_promo: Tag,
  smart_last_minute: Clock,
  ota_mix_optimization: PieChart,
  anti_cannibalization: Percent,
  rms_anomaly_detection: Activity,
};

const TYPE_COLOR: Record<string, string> = {
  Protection: 'bg-emerald-50 text-emerald-700',
  Événements: 'bg-rose-50 text-rose-700',
  Demande: 'bg-violet-50 text-violet-700',
  Stratégie: 'bg-blue-50 text-blue-700',
  Commercial: 'bg-amber-50 text-amber-700',
  Remplissage: 'bg-cyan-50 text-cyan-700',
  Distribution: 'bg-pink-50 text-pink-700',
};

export interface PriorityHierarchyProps {
  hierarchy: PriorityLevel[];
}

export const PriorityHierarchy: React.FC<PriorityHierarchyProps> = ({ hierarchy }) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = hierarchy.map((h) => h.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    priorityConflictEngine.reorder(ids);
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F3F4F6]">
        <h4 className="text-[15px] font-bold text-gray-900">Hiérarchie des priorités</h4>
        <p className="text-[12px] text-gray-500 mt-0.5">Ordre d'exécution des règles (1 = plus haute priorité)</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[#FAFAFB] text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold w-10"></th>
              <th className="px-4 py-2.5 text-left font-semibold w-16">Priorité</th>
              <th className="px-4 py-2.5 text-left font-semibold">Règle / Catégorie</th>
              <th className="px-4 py-2.5 text-left font-semibold">Type</th>
              <th className="px-4 py-2.5 text-left font-semibold">Objectif principal</th>
              <th className="px-4 py-2.5 text-left font-semibold">Préemption</th>
            </tr>
          </thead>
          <tbody>
            {hierarchy.map((l) => {
              const Icon = KIND_ICON[l.id] ?? Shield;
              const isOver = overId === l.id;
              return (
                <tr
                  key={l.id}
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onDragOver={(e) => { e.preventDefault(); setOverId(l.id); }}
                  onDragLeave={() => setOverId(null)}
                  onDrop={() => handleDrop(l.id)}
                  className={cn(
                    'border-t border-[#F3F4F6] transition-colors',
                    isOver ? 'bg-violet-50/50' : 'hover:bg-[#FBFBFC]',
                  )}
                >
                  <td className="px-4 py-3 text-gray-400 cursor-grab"><GripVertical size={14} /></td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] text-white text-[11px] font-bold">
                      {l.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-[#F3F4F6] text-gray-700 shrink-0">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{l.name}</div>
                        <div className="text-[11px] text-gray-500 truncate">{l.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-md', TYPE_COLOR[l.type] ?? 'bg-gray-50 text-gray-700')}>
                      {l.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{l.objective}</td>
                  <td className="px-4 py-3 text-gray-700">{l.preemption}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-[#F3F4F6] bg-violet-50/40 text-[12px] text-gray-600 flex items-center gap-2">
        <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 inline-flex items-center justify-center text-[10px] font-bold">i</span>
        Les règles sont évaluées dans cet ordre. Une règle de niveau supérieur peut écraser ou bloquer une règle de niveau inférieur.
      </div>
    </div>
  );
};
