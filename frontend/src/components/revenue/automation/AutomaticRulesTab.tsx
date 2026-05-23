/**
 * FLOWTYM — Onglet « Règles Automatiques »
 *
 * Affiche les KPI, les filtres par catégorie, le tableau des 10 règles
 * tactiques et un bandeau explicatif. Permet d'ouvrir le détail / d'éditer
 * une règle, et expose un bouton « Nouvelle règle ».
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Plus, Power, TrendingUp, Sparkles, Shield, Brain, Info, Columns3, Filter,
} from 'lucide-react';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import type {
  TacticalRule, TacticalRuleCategory, TacticalRulesKpis,
} from '@/src/types/revenue/tacticalRules.types';
import { RuleKpiCard } from './RuleKpiCard';
import { RuleTable } from './RuleTable';
import { RuleDetailModal } from './RuleDetailModal';
import { TacticalEngineWidget } from './TacticalEngineWidget';
import { cn } from '@/src/lib/utils';
import { useT, type TKey } from '@/src/i18n';

const CATEGORY_FILTERS: { id: 'all' | TacticalRuleCategory; key: TKey }[] = [
  { id: 'all', key: 'rules.categoryAll' },
  { id: 'demand', key: 'rules.categoryDemand' },
  { id: 'pricing', key: 'rules.categoryPricing' },
  { id: 'distribution', key: 'rules.categoryDistribution' },
  { id: 'event', key: 'rules.categoryEvent' },
  { id: 'protection', key: 'rules.categoryProtection' },
];

function useRules(): TacticalRule[] {
  useSyncExternalStore(
    (cb) => tacticalRulesEngine.subscribe(cb),
    () => tacticalRulesEngine.version(),
    () => tacticalRulesEngine.version(),
  );
  return tacticalRulesEngine.all();
}

function tinyTrend(seed: number, len = 12, base = 50): number[] {
  return Array.from({ length: len }, (_, i) => base + Math.sin((seed + i) * 0.9) * 8 + Math.cos((seed + i) * 0.4) * 5 + i * 0.3);
}

export const AutomaticRulesTab: React.FC = () => {
  const t = useT();
  const rules = useRules();
  const [filter, setFilter] = useState<'all' | TacticalRuleCategory>('all');
  const [selected, setSelected] = useState<TacticalRule | null>(null);
  const [kpis, setKpis] = useState<TacticalRulesKpis>(() => tacticalRulesEngine.kpis());

  useEffect(() => {
    setKpis(tacticalRulesEngine.kpis());
  }, [rules]);

  const filtered = rules.filter((r) => (filter === 'all' ? true : r.category === filter));

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <RuleKpiCard
          label={t('rules.kpiActiveRules')}
          value={
            <span>
              {kpis.activeCount}
              <span className="text-gray-400 text-[18px] font-semibold"> / {kpis.totalCount}</span>
            </span>
          }
          hint={t('rules.kpiAllActive')}
          icon={Power}
          iconColor="text-emerald-500"
        />
        <RuleKpiCard
          label={t('rules.kpiRevenue30d')}
          value={`+${kpis.revenue30d.toLocaleString('fr-FR')}€`}
          hint={
            <span className="text-emerald-600 font-medium">▲ +{kpis.revenueDelta}%</span>
          }
          trend={tinyTrend(1, 16, 45)}
          trendColor="#8B5CF6"
        />
        <RuleKpiCard
          label={t('rules.kpiAutomatedActions')}
          value={kpis.automatedActions30d}
          hint={
            <span>
              <b className="text-emerald-600">{kpis.successfulActions}</b> ·{' '}
              <b className="text-amber-600">{kpis.adjustedActions}</b> ·{' '}
              <b className="text-rose-600">{kpis.blockedActions}</b>
            </span>
          }
          trend={tinyTrend(3, 16, 60)}
          trendColor="#3B82F6"
        />
        <RuleKpiCard
          label={t('rules.kpiConflictsDetected')}
          value={kpis.conflictsDetected}
          hint={t('rules.kpiAutoResolved')}
          icon={Shield}
          iconColor="text-emerald-500"
        />
        <RuleKpiCard
          label={t('rules.kpiIaConfidence')}
          value={`${kpis.averageIaConfidence}%`}
          hint={<span className="text-emerald-600 font-medium">{t('rules.kpiHigh')}</span>}
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
                {t(f.key)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-gray-600 hover:bg-gray-50">
            <Columns3 size={14} />
            {t('common.columns')}
          </button>
          <button className="flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-gray-600 hover:bg-gray-50">
            <Filter size={14} />
            {t('common.filters')}
          </button>
        </div>
      </div>

      {/* Tableau */}
      <RuleTable rules={filtered} onOpenDetail={setSelected} />

      {/* Moteur tactique (évaluation live + autopilote) */}
      <TacticalEngineWidget />

      {/* Bandeau explicatif */}
      <div className="bg-violet-50/50 border border-violet-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-violet-600 mt-0.5 shrink-0" />
          <p className="text-[13px] text-gray-700 leading-relaxed">
            {t('rules.explainPriority')}
          </p>
        </div>
        <a className="text-[13px] font-semibold text-[#8B5CF6] hover:underline whitespace-nowrap" href="#">
          {t('common.learnMore')} ↗
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
