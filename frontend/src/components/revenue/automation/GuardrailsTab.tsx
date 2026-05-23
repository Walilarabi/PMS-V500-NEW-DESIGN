/**
 * FLOWTYM — Onglet « Garde-fous RMS »
 *
 * Affiche : KPI, filtres par catégorie, tableau des garde-fous, hiérarchie,
 * couverture globale (donut), derniers blocages et bandeau sécurité.
 */
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Plus, ShieldCheck, Shield, AlertCircle, Calendar, TrendingDown,
  LayoutGrid, Info,
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { guardrailsEngine } from '@/src/services/revenue/guardrailsEngine';
import type { Guardrail, GuardrailCategory, GuardrailsKpis } from '@/src/types/revenue/guardrails.types';
import { RuleKpiCard } from './RuleKpiCard';
import { GuardrailTable } from './GuardrailTable';
import { GuardrailModal } from './GuardrailModal';
import { cn } from '@/src/lib/utils';

const CATEGORY_FILTERS: { id: 'all' | GuardrailCategory; label: string }[] = [
  { id: 'all', label: 'Tous les garde-fous' },
  { id: 'pricing', label: 'Tarification' },
  { id: 'availability', label: 'Disponibilité' },
  { id: 'restriction', label: 'Restrictions' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'quality', label: 'Qualité & Réputation' },
];

function useGuardrails(): Guardrail[] {
  useSyncExternalStore(
    (cb) => guardrailsEngine.subscribe(cb),
    () => guardrailsEngine.version(),
    () => guardrailsEngine.version(),
  );
  return guardrailsEngine.all();
}

function tinyTrend(seed: number, len = 14, base = 12): number[] {
  return Array.from({ length: len }, (_, i) => base + Math.sin((seed + i) * 0.7) * 4 + i * 0.4);
}

export const GuardrailsTab: React.FC = () => {
  const guardrails = useGuardrails();
  const [filter, setFilter] = useState<'all' | GuardrailCategory>('all');
  const [editing, setEditing] = useState<Guardrail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [kpis, setKpis] = useState<GuardrailsKpis>(() => guardrailsEngine.kpis());

  useEffect(() => {
    setKpis(guardrailsEngine.kpis());
  }, [guardrails]);

  const filtered = guardrails.filter((g) => (filter === 'all' ? true : g.category === filter));

  const allBlocks = useMemo(
    () =>
      guardrails
        .flatMap((g) => g.history.map((h) => ({ ...h, name: g.name, requested: g.action, limit: g.threshold })))
        .sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))
        .slice(0, 4),
    [guardrails],
  );

  const hierarchy = guardrailsEngine.hierarchy();

  const coverageData = [
    { name: 'Couvertes', value: kpis.totalDates - kpis.uncoveredDates, color: '#8B5CF6' },
    { name: 'Non couvertes', value: kpis.uncoveredDates, color: '#F87171' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <RuleKpiCard
          label="Garde-fous actifs"
          value={
            <span>
              {kpis.activeCount}
              <span className="text-gray-400 text-[18px] font-semibold"> / {kpis.totalCount}</span>
            </span>
          }
          hint="Tous les garde-fous sont actifs"
          icon={ShieldCheck}
          iconColor="text-emerald-500"
        />
        <RuleKpiCard
          label="Règles bloquantes (30j)"
          value={kpis.blocksCount30d}
          hint="Ajustements bloqués"
          trend={tinyTrend(2, 14, 30)}
          trendColor="#F59E0B"
        />
        <RuleKpiCard
          label="Risque global"
          value={kpis.globalRisk === 'low' ? 'Faible' : kpis.globalRisk === 'medium' ? 'Modéré' : 'Élevé'}
          hint="Niveau de risque maîtrisé"
          icon={Shield}
          iconColor={kpis.globalRisk === 'low' ? 'text-emerald-500' : 'text-rose-500'}
        />
        <RuleKpiCard
          label="Événements protégés"
          value={kpis.protectedEvents}
          hint="Périodes couvertes"
          icon={Calendar}
          iconColor="text-violet-500"
        />
        <RuleKpiCard
          label="Écart moyen limité"
          value={`${kpis.averageDeltaLimited.toFixed(1)}%`}
          hint="Vs seuils définis"
          trend={tinyTrend(7, 14, 35)}
          trendColor="#10B981"
        />
      </div>

      {/* Filtres */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORY_FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'text-[13px] font-semibold px-3.5 py-1.5 rounded-xl transition-colors',
                  isActive
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
                    : 'bg-white border border-[#E5E7EB] text-gray-600 hover:bg-gray-50',
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-gray-600 hover:bg-gray-50">
          <LayoutGrid size={14} />
          Filtres
        </button>
      </div>

      {/* Tableau */}
      <GuardrailTable
        guardrails={filtered}
        onEdit={(g) => {
          setEditing(g);
          setModalOpen(true);
        }}
      />

      {/* 3 cartes : hiérarchie, couverture, derniers blocages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hiérarchie */}
        <section className="bg-white rounded-2xl border border-[#F3F4F6] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <h4 className="text-[15px] font-bold text-gray-900 mb-4">Hiérarchie & Priorité des garde-fous</h4>
          <ul className="space-y-3">
            {hierarchy.map((h) => (
              <li key={h.priority} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                  {h.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-gray-900">{h.label}</div>
                  <div className="text-[11px] text-gray-500">{h.description}</div>
                </div>
                <span className="text-[11px] font-semibold text-[#8B5CF6] bg-violet-50 px-2 py-0.5 rounded-md">
                  Priorité {h.priority}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Couverture */}
        <section className="bg-white rounded-2xl border border-[#F3F4F6] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <h4 className="text-[15px] font-bold text-gray-900 mb-4">Couverture globale</h4>
          <div className="flex items-center gap-4">
            <div className="relative w-40 h-40 shrink-0">
              <PieChart width={160} height={160}>
                <Pie
                  data={coverageData}
                  cx={80}
                  cy={80}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {coverageData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-gray-900">{kpis.globalCoverage}%</div>
                <div className="text-[11px] text-gray-500">des dates<br />couvertes</div>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-[12px]">
              <Legend color="#A78BFA" label="Total dates de l'année" value={kpis.totalDates.toString()} />
              <Legend color="#8B5CF6" label="Dates couvertes par au moins un garde-fou" value={`${kpis.totalDates - kpis.uncoveredDates} (98%)`} />
              <Legend color="#F87171" label="Dates sans garde-fou" value={`${kpis.uncoveredDates} (2%)`} />
            </div>
          </div>
          <div className="mt-4 bg-[#FAFAFB] border border-[#F3F4F6] rounded-xl px-3 py-2 text-[12px] text-gray-600 flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0 text-gray-400" />
            <span>Toutes les dates critiques sont protégées par au moins un garde-fou bloquant.</span>
          </div>
        </section>

        {/* Derniers blocages */}
        <section className="bg-white rounded-2xl border border-[#F3F4F6] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[15px] font-bold text-gray-900">Derniers blocages</h4>
            <a className="text-[12px] font-semibold text-[#8B5CF6] hover:underline" href="#">Voir tout ↗</a>
          </div>
          <ul className="space-y-3">
            {allBlocks.map((b, i) => (
              <li key={i} className="flex items-start gap-3 pb-3 border-b border-[#F3F4F6] last:border-0 last:pb-0">
                <div className="p-2 rounded-xl bg-[#F3F4F6] text-gray-700 shrink-0">
                  <Shield size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-gray-900 truncate">{b.name}</div>
                  <div className="text-[11px] text-gray-500 truncate">{b.context}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-gray-500">{new Date(b.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - {new Date(b.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                  <span className={cn(
                    'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1',
                    b.outcome === 'blocked' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600',
                  )}>
                    {b.outcome === 'blocked' ? 'Bloqué' : 'Ajusté'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Bandeau sécurité */}
      <div className="bg-violet-50/50 border border-violet-100 rounded-2xl px-5 py-4 flex items-center gap-3">
        <Info size={16} className="text-violet-600 shrink-0" />
        <p className="text-[13px] text-gray-700">
          Les garde-fous protègent votre stratégie et s'appliquent <b>avant</b> les règles automatiques et l'autopilote RMS.
        </p>
      </div>

      <GuardrailModal
        guardrail={editing}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
};

const Legend: React.FC<{ color: string; label: string; value: string }> = ({ color, label, value }) => (
  <div className="flex items-center gap-2">
    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
    <span className="flex-1 text-gray-600">{label}</span>
    <span className="font-semibold text-gray-900">{value}</span>
  </div>
);

export const GuardrailsTabHeaderActions: React.FC<{ onNew: () => void }> = ({ onNew }) => (
  <button
    onClick={onNew}
    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-semibold hover:bg-[#7C3AED] shadow-sm shadow-[#8B5CF6]/20"
  >
    <Plus size={16} />
    Nouveau garde-fou
  </button>
);
