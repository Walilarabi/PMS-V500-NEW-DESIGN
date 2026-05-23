/**
 * FLOWTYM — Tableau des règles tactiques
 */
import React, { useMemo, useState } from 'react';
import {
  Shield, Zap, TrendingDown, Crosshair, Calendar, Clock, PieChart, AlertTriangle, Percent, Activity,
  Edit2, MoreHorizontal, BarChart3,
} from 'lucide-react';
import type { TacticalRule, TacticalRuleCategory, TacticalRuleId } from '@/src/types/revenue/tacticalRules.types';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import { cn } from '@/src/lib/utils';

const CATEGORY_LABEL: Record<TacticalRuleCategory, string> = {
  demand: 'Demande',
  pricing: 'Tarification',
  distribution: 'Distribution',
  event: 'Événements',
  protection: 'Protection',
};

const CATEGORY_COLOR: Record<TacticalRuleCategory, string> = {
  demand: 'bg-violet-50 text-violet-700',
  pricing: 'bg-blue-50 text-blue-700',
  distribution: 'bg-amber-50 text-amber-700',
  event: 'bg-rose-50 text-rose-700',
  protection: 'bg-emerald-50 text-emerald-700',
};

const RULE_ICON: Record<TacticalRuleId, React.ComponentType<{ size?: number; className?: string }>> = {
  market_compression: Shield,
  abnormal_pickup: Zap,
  demand_gap: TrendingDown,
  competitive_parity: Crosshair,
  early_bird: Calendar,
  smart_last_minute: Clock,
  ota_mix_optimization: PieChart,
  event_protection: AlertTriangle,
  anti_cannibalization: Percent,
  rms_anomaly_detection: Activity,
};

const PRIORITY_GRADIENT: Record<number, string> = {
  1: 'from-rose-500 to-rose-400',
  2: 'from-orange-500 to-orange-400',
  3: 'from-amber-500 to-amber-400',
  4: 'from-yellow-500 to-yellow-400',
  5: 'from-lime-500 to-lime-400',
  6: 'from-emerald-500 to-emerald-400',
  7: 'from-teal-500 to-teal-400',
  8: 'from-cyan-500 to-cyan-400',
  9: 'from-sky-500 to-sky-400',
  10: 'from-blue-500 to-blue-400',
};

export interface RuleTableProps {
  rules: TacticalRule[];
  onOpenDetail: (rule: TacticalRule) => void;
}

export const RuleTable: React.FC<RuleTableProps> = ({ rules, onOpenDetail }) => {
  const [openMenuId, setOpenMenuId] = useState<TacticalRuleId | null>(null);

  const sorted = useMemo(() => [...rules].sort((a, b) => a.priority - b.priority), [rules]);

  const handleToggle = (rule: TacticalRule) => {
    tacticalRulesEngine.setStatus(rule.id, rule.status === 'active' ? 'paused' : 'active');
  };

  return (
    <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[#FAFAFB] text-[11px] uppercase tracking-wider text-gray-500 border-b border-[#F3F4F6]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Priorité</th>
              <th className="px-4 py-3 text-left font-semibold">Règle</th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Déclencheurs principaux</th>
              <th className="px-4 py-3 text-left font-semibold">Actions principales</th>
              <th className="px-4 py-3 text-right font-semibold">Impact (30j)</th>
              <th className="px-4 py-3 text-center font-semibold">Fréq.</th>
              <th className="px-4 py-3 text-left font-semibold">Confiance IA</th>
              <th className="px-4 py-3 text-center font-semibold">Statut</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((rule) => {
              const Icon = RULE_ICON[rule.id];
              const gradient = PRIORITY_GRADIENT[rule.priority] ?? 'from-gray-500 to-gray-400';
              const active = rule.status === 'active';
              return (
                <tr key={rule.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FBFBFC]">
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[11px] font-bold bg-gradient-to-br',
                      gradient,
                    )}>
                      {rule.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-[#F3F4F6] text-gray-700 shrink-0">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{rule.name}</div>
                        <div className="text-[11px] text-gray-500 truncate">{rule.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-md', CATEGORY_COLOR[rule.category])}>
                      {CATEGORY_LABEL[rule.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[280px]">
                    <div className="truncate" title={rule.triggers.map((t) => t.label).join(', ')}>
                      {rule.triggers.map((t) => t.label).join(', ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[260px]">
                    <div className="truncate" title={rule.actions.map((a) => a.label).join(', ')}>
                      {rule.actions.map((a) => a.label).join(', ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-bold text-emerald-600">+{rule.revenueImpact30d.toLocaleString('fr-FR')}€</div>
                    <div className="text-[11px] text-emerald-600/80">+{rule.revparImpact30d}% RevPAR</div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{rule.triggersCount30d} fois</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-gray-700 w-8">{rule.iaConfidence}%</span>
                      <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden min-w-[60px]">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                          style={{ width: `${rule.iaConfidence}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(rule)}
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
                      <button
                        onClick={() => onOpenDetail(rule)}
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                        title="Voir détail / historique"
                      >
                        <BarChart3 size={14} />
                      </button>
                      <button
                        onClick={() => onOpenDetail(rule)}
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                        title="Modifier"
                      >
                        <Edit2 size={14} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === rule.id ? null : rule.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                          title="Plus d'actions"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {openMenuId === rule.id && (
                          <div
                            className="absolute right-0 top-8 z-10 w-52 bg-white border border-[#F3F4F6] rounded-xl shadow-lg py-1 text-left"
                            onMouseLeave={() => setOpenMenuId(null)}
                          >
                            <MenuItem onClick={() => { onOpenDetail(rule); setOpenMenuId(null); }}>
                              Voir le détail
                            </MenuItem>
                            <MenuItem onClick={() => {
                              tacticalRulesEngine.setStatus(rule.id, 'simulation');
                              setOpenMenuId(null);
                            }}>
                              Simuler avant activation
                            </MenuItem>
                            <MenuItem onClick={() => {
                              tacticalRulesEngine.duplicateRule(rule.id);
                              setOpenMenuId(null);
                            }}>
                              Dupliquer
                            </MenuItem>
                            <MenuItem onClick={() => {
                              exportRuleHistory(rule);
                              setOpenMenuId(null);
                            }}>
                              Exporter historique CSV
                            </MenuItem>
                            <MenuItem
                              onClick={() => {
                                if (window.confirm(`Supprimer la règle « ${rule.name} » ?`)) {
                                  tacticalRulesEngine.removeRule(rule.id);
                                }
                                setOpenMenuId(null);
                              }}
                              tone="danger"
                            >
                              Supprimer
                            </MenuItem>
                          </div>
                        )}
                      </div>
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

function exportRuleHistory(rule: TacticalRule) {
  const lines = [
    ['Date', 'Déclencheur', 'Action', 'Résultat', 'Impact (€)', 'Explication'].join(','),
    ...rule.history.map((h) =>
      [h.date, h.trigger, h.action, h.outcome, h.revenueImpact, `"${h.explanation.replace(/"/g, '""')}"`].join(','),
    ),
  ].join('\n');
  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historique_${rule.id}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const MenuItem: React.FC<{ onClick: () => void; children: React.ReactNode; tone?: 'danger' }> = ({ onClick, children, tone }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50',
      tone === 'danger' ? 'text-rose-600' : 'text-gray-700',
    )}
  >
    {children}
  </button>
);
