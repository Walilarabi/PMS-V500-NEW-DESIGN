/**
 * FLOWTYM — Onglet « Priorités & Conflits »
 *
 * Sections : KPI, hiérarchie drag&drop, conflits, impact par règle,
 * simulation de priorité, journal des résolutions et bandeau explicatif.
 */
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Layers, Shield, CheckCircle2, Award, Info, TrendingUp, Settings2, BarChart3,
  ArrowDown, Calendar, Tag, Brain, Clock, Activity, Percent, PieChart as PieIcon,
} from 'lucide-react';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import type { Conflict, PriorityLevel, PrioritiesKpis, ResolutionLogEntry, PrioritySimulation } from '@/src/types/revenue/conflicts.types';
import { RuleKpiCard } from './RuleKpiCard';
import { PriorityHierarchy } from './PriorityHierarchy';
import { ConflictResolverPanel } from './ConflictResolverPanel';
import { ConflictDetailModal } from './ConflictDetailModal';
import { cn } from '@/src/lib/utils';

function usePriorityState(): { hierarchy: PriorityLevel[]; conflicts: Conflict[]; log: ResolutionLogEntry[]; kpis: PrioritiesKpis } {
  const snapshot = useSyncExternalStore(
    (cb) => priorityConflictEngine.subscribe(cb),
    () => ({
      h: priorityConflictEngine.hierarchy(),
      c: priorityConflictEngine.conflicts(),
      l: priorityConflictEngine.resolutionLog(),
    }),
    () => ({
      h: priorityConflictEngine.hierarchy(),
      c: priorityConflictEngine.conflicts(),
      l: priorityConflictEngine.resolutionLog(),
    }),
  );
  const kpis = useMemo(() => priorityConflictEngine.kpis(), [snapshot]);
  return { hierarchy: snapshot.h, conflicts: snapshot.c, log: snapshot.l, kpis };
}

function tinyTrend(seed: number, len = 14, base = 50): number[] {
  return Array.from({ length: len }, (_, i) => base + Math.sin((seed + i) * 0.8) * 6 + i * 0.5);
}

const RULE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  market_compression: TrendingUp,
  abnormal_pickup: Brain,
  demand_gap: ArrowDown,
  strategy_active: Settings2,
  pricing_promo: Tag,
  smart_last_minute: Clock,
  ota_mix_optimization: PieIcon,
  anti_cannibalization: Percent,
  rms_anomaly_detection: Activity,
  major_events: Calendar,
};

export const PrioritiesConflictsTab: React.FC = () => {
  const { hierarchy, conflicts, log, kpis } = usePriorityState();
  const [openConflict, setOpenConflict] = useState<Conflict | null>(null);

  // Simulation state
  const [simRule, setSimRule] = useState(hierarchy.find((h) => h.kind === 'rule')?.id ?? 'smart_last_minute');
  const [simFrom, setSimFrom] = useState(7);
  const [simTo, setSimTo] = useState(4);
  const [simResult, setSimResult] = useState<PrioritySimulation | null>(null);

  useEffect(() => {
    const r = hierarchy.find((h) => h.id === simRule);
    if (r) setSimFrom(r.priority);
  }, [simRule, hierarchy]);

  const runSimulation = () => {
    setSimResult(priorityConflictEngine.simulate(simRule, simTo));
  };

  const impactByRule = useMemo(() => {
    return [...tacticalRulesEngine.all()]
      .sort((a, b) => b.revenueImpact30d - a.revenueImpact30d)
      .slice(0, 5);
  }, []);

  const totalRuleImpact = impactByRule.reduce((s, r) => s + r.revenueImpact30d, 0);

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <RuleKpiCard
          label="Hiérarchie active"
          value={kpis.activeLevels}
          hint="Niveaux de priorité"
          icon={Layers}
          iconColor="text-violet-500"
        />
        <RuleKpiCard
          label="Conflits détectés"
          value={kpis.conflictsDetected}
          hint="Nécessitent une action"
          icon={Shield}
          iconColor="text-rose-500"
        />
        <RuleKpiCard
          label="Conflits résolus auto."
          value={kpis.autoResolved30d}
          hint="Ce mois-ci"
          icon={CheckCircle2}
          iconColor="text-emerald-500"
        />
        <RuleKpiCard
          label="Règle prioritaire actuelle"
          value={<span className="text-[18px]">{kpis.topRuleName}</span>}
          hint={`Priorité ${kpis.topRulePriority}`}
          icon={Award}
          iconColor="text-amber-500"
        />
        <RuleKpiCard
          label="Impact revenu (30j)"
          value={`+${kpis.revenue30d.toLocaleString('fr-FR')}€`}
          hint="Grâce à la hiérarchie"
          trend={tinyTrend(11, 14, 50)}
          trendColor="#10B981"
        />
      </div>

      {/* Hiérarchie + Conflits */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PriorityHierarchy hierarchy={hierarchy} />
        <ConflictResolverPanel conflicts={conflicts} onOpenDetail={setOpenConflict} />
      </div>

      {/* Impact + Simulation + Journal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Impact par règle */}
        <section className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-5">
          <h4 className="text-[15px] font-bold text-gray-900 mb-1">Impact par règle (30 derniers jours)</h4>
          <table className="w-full text-[13px] mt-3">
            <thead className="text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left font-semibold pb-2">Règle</th>
                <th className="text-right font-semibold pb-2">Impact revenu</th>
                <th className="text-right font-semibold pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {impactByRule.map((r) => {
                const Icon = RULE_ICONS[r.id] ?? TrendingUp;
                const pct = totalRuleImpact > 0 ? (r.revenueImpact30d / totalRuleImpact) * 100 : 0;
                return (
                  <tr key={r.id} className="border-t border-[#F3F4F6]">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="text-[#8B5CF6]" />
                        <span className="font-semibold text-gray-900">{r.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-600">
                      +{r.revenueImpact30d.toLocaleString('fr-FR')}€
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${pct}%` }} />
                        </div>
                        <BarChart3 size={13} className="text-gray-400" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-right mt-3">
            <a className="text-[12px] font-semibold text-[#8B5CF6] hover:underline" href="#">
              Voir le rapport complet ↗
            </a>
          </div>
        </section>

        {/* Simulation */}
        <section className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-5">
          <h4 className="text-[15px] font-bold text-gray-900">Simulation de priorité</h4>
          <p className="text-[12px] text-gray-500 mt-0.5 mb-4">Testez l'impact d'un changement de priorité</p>

          <div className="space-y-3">
            <Field label="Déplacer la règle">
              <select
                value={simRule}
                onChange={(e) => setSimRule(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              >
                {hierarchy.filter((h) => h.kind === 'rule').map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="De la position">
                <select
                  value={simFrom}
                  onChange={(e) => setSimFrom(Number(e.target.value))}
                  className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                >
                  {hierarchy.map((h) => (
                    <option key={h.priority} value={h.priority}>{h.priority} (Actuelle)</option>
                  ))}
                </select>
              </Field>
              <Field label="Vers la position">
                <select
                  value={simTo}
                  onChange={(e) => setSimTo(Number(e.target.value))}
                  className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                >
                  {hierarchy.map((h) => (
                    <option key={h.priority} value={h.priority}>{h.priority}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div>
              <div className="text-[12px] uppercase tracking-wider font-semibold text-gray-500 mb-2">Impact estimé</div>
              <div className="grid grid-cols-3 gap-2">
                <Tile
                  label="RevPAR"
                  value={`${(simResult?.estimatedRevpar ?? 1420) > 0 ? '+' : ''}${(simResult?.estimatedRevpar ?? 1420)}€`}
                  tone="positive"
                />
                <Tile
                  label="ADR"
                  value={`+${(simResult?.estimatedAdr ?? 2.3).toFixed(1)}%`}
                  tone="positive"
                />
                <Tile
                  label="Taux d'occupation"
                  value={`+${(simResult?.estimatedOccupancy ?? 1.8).toFixed(1)} pt`}
                  tone="positive"
                />
              </div>
            </div>

            <button
              onClick={runSimulation}
              className="w-full mt-2 px-4 py-2 text-[13px] font-semibold text-white bg-[#8B5CF6] rounded-xl hover:bg-[#7C3AED] shadow-sm"
            >
              Simuler le changement
            </button>
          </div>
        </section>

        {/* Journal */}
        <section className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-5">
          <h4 className="text-[15px] font-bold text-gray-900 mb-1">Journal des résolutions</h4>
          <ul className="space-y-3 mt-3">
            {log.slice(0, 4).map((l) => {
              const isPending = l.status === 'pending';
              return (
                <li key={l.id} className="flex items-start gap-3 pb-3 border-b border-[#F3F4F6] last:border-0 last:pb-0">
                  <div className={cn(
                    'p-1.5 rounded-full shrink-0 mt-0.5',
                    isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                  )}>
                    {isPending ? <Info size={12} /> : <CheckCircle2 size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900">{l.title}</div>
                    <div className="text-[11px] text-gray-500">
                      {isPending ? 'En attente d\'action' : 'Résolu automatiquement'} ·{' '}
                      {new Date(l.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-gray-500">
                      {isPending ? 'Action requise' : 'Priorité appliquée'}
                    </div>
                    <div className={cn(
                      'text-[12px] font-semibold mt-0.5',
                      isPending ? 'text-amber-700' : 'text-gray-900',
                    )}>
                      {l.outcome}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="text-right mt-3">
            <a className="text-[12px] font-semibold text-[#8B5CF6] hover:underline" href="#">Voir l'historique complet ↗</a>
          </div>
        </section>
      </div>

      {/* Bandeau */}
      <div className="bg-violet-50/50 border border-violet-100 rounded-2xl px-5 py-4 flex items-center gap-3">
        <Info size={16} className="text-violet-600 shrink-0" />
        <p className="text-[13px] text-gray-700">
          La hiérarchie garantit une exécution cohérente et prévisible des règles.
          En cas de conflit, la règle avec la priorité la plus élevée l'emporte.
        </p>
      </div>

      <ConflictDetailModal conflict={openConflict} onClose={() => setOpenConflict(null)} />
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-1 block">{label}</label>
    {children}
  </div>
);

const Tile: React.FC<{ label: string; value: string; tone?: 'positive' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => (
  <div className={cn('rounded-xl p-3', tone === 'positive' ? 'bg-emerald-50' : 'bg-[#FAFAFB]')}>
    <div className={cn('text-[10px] uppercase tracking-wider', tone === 'positive' ? 'text-emerald-700/70' : 'text-gray-500')}>{label}</div>
    <div className={cn('text-[15px] font-bold mt-0.5', tone === 'positive' ? 'text-emerald-700' : 'text-gray-900')}>{value}</div>
  </div>
);

export const PrioritiesConflictsTabHeaderActions: React.FC = () => (
  <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-gray-700 text-[13px] font-semibold hover:bg-gray-50 shadow-sm">
    <Settings2 size={16} />
    Configurer les priorités
  </button>
);
