/**
 * FLOWTYM — Onglet « Règles Automatiques »
 *
 * Affiche les KPI, les filtres par catégorie, le tableau des 10 règles
 * tactiques et un bandeau explicatif. Permet d'ouvrir le détail / d'éditer
 * une règle, et expose un bouton « Nouvelle règle ».
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Plus, Power, TrendingUp, Sparkles, Shield, Brain, Info, Search, Columns3, Filter,
} from 'lucide-react';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import type {
  TacticalRule, TacticalRuleCategory, TacticalRulesKpis,
} from '@/src/types/revenue/tacticalRules.types';
import { RuleKpiCard } from './RuleKpiCard';
import { RuleTable } from './RuleTable';
import { RuleDetailModal } from './RuleDetailModal';
import { cn } from '@/src/lib/utils';

const CATEGORY_FILTERS: { id: 'all' | TacticalRuleCategory; label: string }[] = [
  { id: 'all', label: 'Toutes les règles' },
  { id: 'demand', label: 'Demande' },
  { id: 'pricing', label: 'Tarification' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'event', label: 'Événements' },
  { id: 'protection', label: 'Protection' },
];

function useRules(): TacticalRule[] {
  return useSyncExternalStore(
    (cb) => tacticalRulesEngine.subscribe(cb),
    () => tacticalRulesEngine.all(),
    () => tacticalRulesEngine.all(),
  );
}

function tinyTrend(seed: number, len = 12, base = 50): number[] {
  return Array.from({ length: len }, (_, i) => base + Math.sin((seed + i) * 0.9) * 8 + Math.cos((seed + i) * 0.4) * 5 + i * 0.3);
}

export const AutomaticRulesTab: React.FC = () => {
  const rules = useRules();
  const [filter, setFilter] = useState<'all' | TacticalRuleCategory>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TacticalRule | null>(null);
  const [kpis, setKpis] = useState<TacticalRulesKpis>(() => tacticalRulesEngine.kpis());

  useEffect(() => {
    setKpis(tacticalRulesEngine.kpis());
  }, [rules]);

  const filtered = rules
    .filter((r) => (filter === 'all' ? true : r.category === filter))
    .filter((r) => (search ? r.name.toLowerCase().includes(search.toLowerCase()) : true));

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <RuleKpiCard
          label="Règles actives"
          value={
            <span>
              {kpis.activeCount}
              <span className="text-gray-400 text-[18px] font-semibold"> / {kpis.totalCount}</span>
            </span>
          }
          hint="Toutes les règles sont actives"
          icon={Power}
          iconColor="text-emerald-500"
        />
        <RuleKpiCard
          label="Impact revenu (30j)"
          value={`+${kpis.revenue30d.toLocaleString('fr-FR')}€`}
          hint={
            <span className="text-emerald-600 font-medium">▲ +{kpis.revenueDelta}% vs sans règles</span>
          }
          trend={tinyTrend(1, 16, 45)}
          trendColor="#8B5CF6"
        />
        <RuleKpiCard
          label="Actions automatiques (30j)"
          value={kpis.automatedActions30d}
          hint={
            <span>
              <b className="text-emerald-600">{kpis.successfulActions}</b> réussies •{' '}
              <b className="text-amber-600">{kpis.adjustedActions}</b> ajustées •{' '}
              <b className="text-rose-600">{kpis.blockedActions}</b> bloquées
            </span>
          }
          trend={tinyTrend(3, 16, 60)}
          trendColor="#3B82F6"
        />
        <RuleKpiCard
          label="Conflits détectés"
          value={kpis.conflictsDetected}
          hint="Règles automatiquement"
          icon={Shield}
          iconColor="text-emerald-500"
        />
        <RuleKpiCard
          label="IA — Confiance moyenne"
          value={`${kpis.averageIaConfidence}%`}
          hint={<span className="text-emerald-600 font-medium">Élevée</span>}
          icon={Brain}
          iconColor="text-violet-500"
          trend={tinyTrend(5, 16, 70)}
          trendColor="#10B981"
        />
      </div>

      {/* Filtres + actions */}
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
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-8 pr-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 w-[180px]"
            />
          </div>
          <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-gray-600 hover:bg-gray-50">
            <Columns3 size={14} />
            Colonnes
          </button>
          <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-gray-600 hover:bg-gray-50">
            <Filter size={14} />
            Filtres
          </button>
        </div>
      </div>

      {/* Tableau */}
      <RuleTable rules={filtered} onOpenDetail={setSelected} />

      {/* Bandeau explicatif */}
      <div className="bg-violet-50/50 border border-violet-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-violet-600 mt-0.5 shrink-0" />
          <p className="text-[13px] text-gray-700 leading-relaxed">
            Les règles sont appliquées par ordre de priorité (<b>1 = plus haute</b>). En cas de conflit,
            la règle de priorité la plus élevée prévaut, sauf si une règle de niveau{' '}
            <b>« Protection »</b> est activée.
          </p>
        </div>
        <a className="text-[13px] font-semibold text-[#8B5CF6] hover:underline whitespace-nowrap" href="#">
          En savoir plus sur le moteur de règles ↗
        </a>
      </div>

      <RuleDetailModal rule={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export const AutomaticRulesTabHeaderActions: React.FC = () => (
  <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-semibold hover:bg-[#7C3AED] shadow-sm shadow-[#8B5CF6]/20">
    <Plus size={16} />
    Nouvelle règle
  </button>
);
