/**
 * FLOWTYM — Layout Enterprise pour la page Règles tactiques
 *
 * Structure plein écran inspirée des cockpits RMS pros :
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  HEADER                                                       │
 *   │  KPIs : règles actives, conflits, priorités, overrides, on   │
 *   ├────────┬───────────────────────────────────────┬─────────────┤
 *   │ SIDE   │ ZONE CENTRALE                          │ DETAIL      │
 *   │ filtres│  Tableau / Tabs / Drag&drop priorités  │ Risk score  │
 *   │ tags   │                                        │ Conflits IA │
 *   │ search │                                        │ Impact prév │
 *   └────────┴───────────────────────────────────────┴─────────────┘
 *
 * - 100% largeur disponible
 * - Hauteur stable entre onglets (pas de saut)
 * - Drag & drop, simulation pré-activation, mode brouillon, duplication,
 *   templates, recherche multicritère, historique, rollback
 */
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Cpu, Shield, Plus, Settings2, Search, X, Tag, Filter, ChevronRight,
  Sparkles, AlertTriangle, History, Copy, Eye, Zap, Brain,
  CheckCircle2, Pause, FlaskConical,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useT } from '@/src/i18n';
import { LocaleSwitcher } from '@/src/i18n/LocaleSwitcher';

import type { TacticalTab } from './TacticalRulesTabs';
import { AutomaticRulesTab } from './AutomaticRulesTab';
import { GuardrailsTab } from './GuardrailsTab';
import { PrioritiesConflictsTab } from './PrioritiesConflictsTab';

import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import { guardrailsEngine } from '@/src/services/revenue/guardrailsEngine';
import { priorityConflictEngine } from '@/src/services/revenue/priorityConflictEngine';
import { rmsAuditLogger } from '@/src/services/revenue/rmsAuditLogger';
import { pricingPlanningSync } from '@/src/services/revenue/pricingPlanningSync.service';
import type { TacticalRule, TacticalRuleCategory } from '@/src/types/revenue/tacticalRules.types';

import { NewRuleModal } from './NewRuleModal';
import { GuardrailModal } from './GuardrailModal';
import { ConfigurePrioritiesModal } from './ConfigurePrioritiesModal';

// ─── Snapshot stable des engines ────────────────────────────────────────────

function useEnginesSnapshot() {
  useSyncExternalStore(
    (cb) => tacticalRulesEngine.subscribe(cb),
    () => tacticalRulesEngine.version(),
    () => tacticalRulesEngine.version(),
  );
  useSyncExternalStore(
    (cb) => guardrailsEngine.subscribe(cb),
    () => guardrailsEngine.version(),
    () => guardrailsEngine.version(),
  );
  useSyncExternalStore(
    (cb) => priorityConflictEngine.subscribe(cb),
    () => priorityConflictEngine.version(),
    () => priorityConflictEngine.version(),
  );
  useSyncExternalStore(
    (cb) => pricingPlanningSync.subscribe(cb),
    () => pricingPlanningSync.version(),
    () => pricingPlanningSync.version(),
  );
}

// ─── KPI atomique header ───────────────────────────────────────────────────

const HeaderKpi: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'violet' | 'emerald' | 'amber' | 'rose' | 'slate' | 'blue';
  icon?: React.ReactNode;
}> = ({ label, value, hint, tone = 'slate', icon }) => {
  const toneCls = {
    violet: 'text-violet-700 bg-violet-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    amber: 'text-amber-700 bg-amber-50',
    rose: 'text-rose-700 bg-rose-50',
    slate: 'text-slate-700 bg-slate-50',
    blue: 'text-blue-700 bg-blue-50',
  }[tone];
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className={cn('p-1.5 rounded-lg shrink-0', toneCls)}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 leading-none">
          {label}
        </div>
        <div className="text-[15px] font-bold text-slate-900 leading-tight mt-0.5 truncate">
          {value}
        </div>
        {hint && <div className="text-[10px] text-slate-500 leading-tight truncate">{hint}</div>}
      </div>
    </div>
  );
};

// ─── Sidebar gauche : catégories + filtres + tags + recherche ──────────────

export type RuleStatusFilter = 'all' | 'active' | 'paused' | 'simulation';

interface SidebarProps {
  activeTab: TacticalTab;
  search: string;
  setSearch: (v: string) => void;
  category: 'all' | TacticalRuleCategory;
  setCategory: (c: 'all' | TacticalRuleCategory) => void;
  statusFilter: RuleStatusFilter;
  setStatusFilter: (s: RuleStatusFilter) => void;
  tags: string[];
  activeTags: string[];
  toggleTag: (t: string) => void;
}

const CATEGORY_META: Record<'all' | TacticalRuleCategory, { label: string; color: string }> = {
  all:          { label: 'Toutes',       color: '#64748B' },
  demand:       { label: 'Demande',      color: '#8B5CF6' },
  pricing:      { label: 'Tarification', color: '#3B82F6' },
  distribution: { label: 'Distribution', color: '#F59E0B' },
  event:        { label: 'Événements',   color: '#EF4444' },
  protection:   { label: 'Protection',   color: '#10B981' },
};

const STATUS_META: Record<RuleStatusFilter, { label: string; icon: React.ReactNode }> = {
  all:        { label: 'Toutes',       icon: <Eye size={11} /> },
  active:     { label: 'Actives',      icon: <CheckCircle2 size={11} /> },
  paused:     { label: 'En pause',     icon: <Pause size={11} /> },
  simulation: { label: 'Simulation',   icon: <FlaskConical size={11} /> },
};

const Sidebar: React.FC<SidebarProps> = ({
  activeTab, search, setSearch, category, setCategory,
  statusFilter, setStatusFilter, tags, activeTags, toggleTag,
}) => {
  // Comptage par catégorie
  const rules = tacticalRulesEngine.all();
  const counts: Record<string, number> = { all: rules.length };
  for (const r of rules) counts[r.category] = (counts[r.category] ?? 0) + 1;

  return (
    <aside className="w-[260px] shrink-0 bg-white border-r border-slate-200 h-full overflow-y-auto flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher règle, déclencheur…"
            className="w-full pl-7 pr-7 py-1.5 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Catégories */}
      <div className="p-3 border-b border-slate-100">
        <h4 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Catégories
        </h4>
        <ul className="space-y-0.5">
          {(Object.keys(CATEGORY_META) as Array<'all' | TacticalRuleCategory>).map((c) => {
            const meta = CATEGORY_META[c];
            const active = category === c;
            return (
              <li key={c}>
                <button
                  onClick={() => setCategory(c)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors',
                    active
                      ? 'bg-violet-50 text-violet-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    {meta.label}
                  </span>
                  <span className="text-[10px] font-bold tabular-nums text-slate-400">
                    {counts[c] ?? 0}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Statut */}
      <div className="p-3 border-b border-slate-100">
        <h4 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Statut
        </h4>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(STATUS_META) as RuleStatusFilter[]).map((s) => {
            const meta = STATUS_META[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors',
                  active
                    ? 'bg-violet-500 text-white border-violet-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
              >
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="p-3 border-b border-slate-100">
          <h4 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
            <Tag size={10} /> Tags
          </h4>
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => {
              const active = activeTags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-md border',
                    active
                      ? 'bg-violet-100 text-violet-700 border-violet-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                  )}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Templates */}
      <div className="p-3 border-b border-slate-100">
        <h4 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
          <Copy size={10} /> Templates
        </h4>
        <ul className="space-y-0.5 text-[11px]">
          {['Compression marché', 'Pickup anormal', 'Trou demande', 'Early bird'].map((tpl) => (
            <li key={tpl}>
              <button
                onClick={() => tacticalRulesEngine.duplicateRule(
                  tpl.toLowerCase().includes('compression') ? 'market_compression'
                  : tpl.toLowerCase().includes('pickup') ? 'abnormal_pickup'
                  : tpl.toLowerCase().includes('trou') ? 'demand_gap'
                  : 'early_bird',
                )}
                className="w-full text-left px-2 py-1 text-slate-600 hover:bg-slate-50 rounded-md flex items-center justify-between"
              >
                {tpl}
                <Copy size={9} className="text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Pied : tab actif rappel */}
      <div className="mt-auto p-3 bg-slate-50/50 text-[10px] text-slate-500">
        <div className="flex items-center justify-between">
          <span>Onglet</span>
          <span className="font-semibold text-slate-700">
            {activeTab === 'rules' ? 'Règles' : activeTab === 'guardrails' ? 'Garde-fous' : 'Priorités'}
          </span>
        </div>
      </div>
    </aside>
  );
};

// ─── Panneau droit : detail/IA d'une règle sélectionnée ────────────────────

const RightPanel: React.FC<{ selectedRule: TacticalRule | null }> = ({ selectedRule }) => {
  if (!selectedRule) {
    return (
      <aside className="w-[320px] shrink-0 bg-white border-l border-slate-200 h-full overflow-y-auto flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-3">
          <Brain size={20} className="text-violet-500" />
        </div>
        <h4 className="text-[13px] font-bold text-slate-900 mb-1">
          Détail règle & analyse IA
        </h4>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Sélectionnez une règle dans la zone centrale pour voir son score de risque,
          ses conflits, les recommandations IA et la prévision d'impact revenu.
        </p>
      </aside>
    );
  }

  // Score de risque dérivé de la priorité + impact
  const riskScore = Math.min(100, Math.round(
    50 + (10 - selectedRule.priority) * 4 + selectedRule.iaConfidence * 0.2,
  ));
  const riskTone =
    riskScore >= 75 ? { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Faible risque' }
    : riskScore >= 50 ? { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Risque modéré' }
    : { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Risque élevé' };

  return (
    <aside className="w-[320px] shrink-0 bg-white border-l border-slate-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-violet-100 text-violet-700">
            <Zap size={12} />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-slate-900 leading-tight">
              {selectedRule.name}
            </h4>
            <p className="text-[10.5px] text-slate-500 leading-tight mt-0.5">
              {selectedRule.description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Explication métier */}
        <div>
          <h5 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
            <Sparkles size={10} /> Explication métier
          </h5>
          <p className="text-[11.5px] text-slate-700 leading-relaxed">
            Cette règle se déclenche sur <b>{selectedRule.triggers.length}</b> condition(s) et
            applique <b>{selectedRule.actions.length}</b> action(s). Catégorie{' '}
            <b>{CATEGORY_META[selectedRule.category]?.label}</b>, priorité{' '}
            <b>{selectedRule.priority}</b>.
          </p>
        </div>

        {/* Score risque */}
        <div className={cn('rounded-lg p-2.5', riskTone.bg)}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Score de risque
            </span>
            <span className={cn('text-[10px] font-bold', riskTone.text)}>
              {riskTone.label}
            </span>
          </div>
          <div className="flex items-end gap-1">
            <span className={cn('text-[24px] font-extrabold tabular-nums leading-none', riskTone.text)}>
              {riskScore}
            </span>
            <span className="text-[10px] text-slate-500 mb-1">/ 100</span>
          </div>
          <div className="mt-2 h-1 bg-white/50 rounded-full overflow-hidden">
            <div className={cn('h-full', riskTone.text.replace('text-', 'bg-'))}
                 style={{ width: `${riskScore}%` }} />
          </div>
        </div>

        {/* Confiance IA */}
        <div className="rounded-lg bg-violet-50/50 border border-violet-100 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Brain size={11} className="text-violet-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
              Confiance IA
            </span>
          </div>
          <div className="text-[20px] font-extrabold text-violet-700 tabular-nums">
            {selectedRule.iaConfidence}%
          </div>
        </div>

        {/* Impact prévisionnel */}
        <div>
          <h5 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Prévision d'impact (30j)
          </h5>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Revenu" value={`+${selectedRule.revenueImpact30d.toLocaleString('fr-FR')}€`} tone="emerald" />
            <Mini label="RevPAR" value={`+${selectedRule.revparImpact30d}%`} tone="emerald" />
            <Mini label="Déclench." value={`${selectedRule.triggersCount30d}×`} tone="violet" />
            <Mini label="Réussite" value={`${selectedRule.successCount}`} tone="blue" />
          </div>
        </div>

        {/* Connectivité */}
        <div>
          <h5 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Connectivité
          </h5>
          <div className="flex flex-wrap gap-1">
            {selectedRule.connectivity.map((c) => (
              <span
                key={c}
                className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* Conflits */}
        <div>
          <h5 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
            <AlertTriangle size={10} /> Conflits potentiels
          </h5>
          {priorityConflictEngine.conflicts()
            .filter((c) => c.participants.some((p) => p.id === selectedRule.id))
            .slice(0, 3)
            .map((c) => (
              <div key={c.id} className="text-[10.5px] text-slate-700 px-2 py-1 rounded-md bg-amber-50 border border-amber-100 mb-1">
                vs <b>{c.participants.find((p) => p.id !== selectedRule.id)?.name ?? '—'}</b>
                <span className="text-amber-700 ml-1">({c.riskLevel})</span>
              </div>
            ))}
          {priorityConflictEngine.conflicts()
            .filter((c) => c.participants.some((p) => p.id === selectedRule.id)).length === 0 && (
            <p className="text-[10.5px] text-slate-400 italic">Aucun conflit détecté</p>
          )}
        </div>

        {/* Historique */}
        <div>
          <h5 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
            <History size={10} /> Historique récent
          </h5>
          <ul className="space-y-0.5 text-[10.5px]">
            {selectedRule.history.slice(0, 4).map((h, i) => (
              <li key={i} className="flex items-center justify-between px-1.5 py-0.5 rounded-md hover:bg-slate-50">
                <span className="text-slate-600 truncate">{h.date}</span>
                <span className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded',
                  h.outcome === 'success' ? 'bg-emerald-100 text-emerald-700'
                  : h.outcome === 'adjusted' ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700',
                )}>
                  {h.outcome === 'success' ? 'OK' : h.outcome === 'adjusted' ? 'Ajusté' : 'Bloqué'}
                </span>
              </li>
            ))}
            {selectedRule.history.length === 0 && (
              <p className="text-[10.5px] text-slate-400 italic">Pas encore d'historique</p>
            )}
          </ul>
        </div>
      </div>
    </aside>
  );
};

const Mini: React.FC<{ label: string; value: string; tone: 'emerald' | 'violet' | 'blue' }> = ({ label, value, tone }) => {
  const cls = {
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    blue: 'bg-blue-50 text-blue-700',
  }[tone];
  return (
    <div className={cn('rounded-md px-2 py-1', cls)}>
      <div className="text-[9px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-[12px] font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
};

// ─── Tabs Pills entreprise (inline dans header) ────────────────────────────

const TabsPill: React.FC<{
  active: TacticalTab;
  onChange: (t: TacticalTab) => void;
}> = ({ active, onChange }) => {
  const t = useT();
  const tabs: { id: TacticalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'rules', label: t('rules.tabAutomatic'), icon: <Cpu size={12} /> },
    { id: 'guardrails', label: t('rules.tabGuardrails'), icon: <Shield size={12} /> },
    { id: 'priorities', label: t('rules.tabPriorities'), icon: <Settings2 size={12} /> },
  ];
  return (
    <div className="inline-flex bg-slate-100 rounded-xl p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors',
            active === tab.id
              ? 'bg-white text-violet-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// ─── Header Enterprise ─────────────────────────────────────────────────────

const Header: React.FC<{
  activeTab: TacticalTab;
  setActiveTab: (t: TacticalTab) => void;
  onNewRule: () => void;
  onNewGuardrail: () => void;
  onConfigurePriorities: () => void;
}> = ({ activeTab, setActiveTab, onNewRule, onNewGuardrail, onConfigurePriorities }) => {
  const t = useT();
  const rules = tacticalRulesEngine.all();
  const activeCount = rules.filter((r) => r.status === 'active').length;
  const simCount = rules.filter((r) => r.status === 'simulation').length;
  const conflicts = priorityConflictEngine.conflicts();
  const topRule = rules.sort((a, b) => a.priority - b.priority)[0];
  const overrides = pricingPlanningSync.all().length;
  const engineActive = activeCount > 0;

  return (
    <header className="bg-white border-b border-slate-200">
      {/* Ligne 1 : titre + tabs + actions */}
      <div className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm">
              <Cpu size={16} />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-slate-900 leading-none">{t('rules.title')}</h1>
              <p className="text-[10.5px] text-slate-500 leading-tight mt-0.5">
                Moteur RMS Enterprise
              </p>
            </div>
          </div>
          <TabsPill active={activeTab} onChange={setActiveTab} />
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          {activeTab === 'rules' && (
            <button
              onClick={onNewRule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[12px] font-semibold shadow-sm"
            >
              <Plus size={12} />
              {t('rules.newRule')}
            </button>
          )}
          {activeTab === 'guardrails' && (
            <button
              onClick={onNewGuardrail}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[12px] font-semibold shadow-sm"
            >
              <Plus size={12} />
              {t('rules.newGuardrail')}
            </button>
          )}
          {activeTab === 'priorities' && (
            <button
              onClick={onConfigurePriorities}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[12px] font-semibold shadow-sm"
            >
              <Settings2 size={12} />
              {t('rules.configurePriorities')}
            </button>
          )}
        </div>
      </div>

      {/* Ligne 2 : 5 KPIs metiers */}
      <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 grid grid-cols-2 lg:grid-cols-5 gap-4">
        <HeaderKpi
          label="Règles actives"
          value={
            <span>
              {activeCount}
              <span className="text-slate-400 text-[12px] font-semibold"> / {rules.length}</span>
            </span>
          }
          hint={`${simCount} en simulation`}
          tone="emerald"
          icon={<CheckCircle2 size={11} />}
        />
        <HeaderKpi
          label="Conflits détectés"
          value={conflicts.length}
          hint={`${conflicts.filter((c) => c.status === 'action_required').length} action requise`}
          tone={conflicts.length > 0 ? 'amber' : 'emerald'}
          icon={<AlertTriangle size={11} />}
        />
        <HeaderKpi
          label="Règle prioritaire"
          value={topRule?.name ?? '—'}
          hint={topRule ? `Priorité ${topRule.priority} · IA ${topRule.iaConfidence}%` : ''}
          tone="violet"
          icon={<Zap size={11} />}
        />
        <HeaderKpi
          label="Overrides manuels"
          value={overrides}
          hint={overrides > 0 ? 'Sync planning suspendue' : 'Aucune simulation manuelle'}
          tone={overrides > 0 ? 'amber' : 'slate'}
          icon={<FlaskConical size={11} />}
        />
        <HeaderKpi
          label="Moteur"
          value={engineActive ? 'Actif' : 'Inactif'}
          hint={engineActive ? 'Évaluations en cours' : 'Activez au moins une règle'}
          tone={engineActive ? 'emerald' : 'rose'}
          icon={<Cpu size={11} />}
        />
      </div>
    </header>
  );
};

// ─── Layout principal ──────────────────────────────────────────────────────

export interface TacticalRulesEnterpriseLayoutProps {
  /** Onglet actif (rules / guardrails / priorities) */
  tab: TacticalTab;
  setTab: (t: TacticalTab) => void;
}

export const TacticalRulesEnterpriseLayout: React.FC<TacticalRulesEnterpriseLayoutProps> = ({
  tab, setTab,
}) => {
  useEnginesSnapshot();

  const [newGuardrailOpen, setNewGuardrailOpen] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [configurePrioritiesOpen, setConfigurePrioritiesOpen] = useState(false);

  // Filtres sidebar (partagés via contexte simple)
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | TacticalRuleCategory>('all');
  const [statusFilter, setStatusFilter] = useState<RuleStatusFilter>('all');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selectedRule, setSelectedRule] = useState<TacticalRule | null>(null);

  // Tags dérivés des connectivités
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const r of tacticalRulesEngine.all()) {
      for (const c of r.connectivity) set.add(c.toLowerCase().replace(/\s+/g, '-'));
    }
    return Array.from(set).slice(0, 12);
  }, []);

  const toggleTag = (t: string) =>
    setActiveTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-50 min-h-0">
      <Header
        activeTab={tab}
        setActiveTab={setTab}
        onNewRule={() => setNewRuleOpen(true)}
        onNewGuardrail={() => setNewGuardrailOpen(true)}
        onConfigurePriorities={() => setConfigurePrioritiesOpen(true)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar
          activeTab={tab}
          search={search}
          setSearch={setSearch}
          category={category}
          setCategory={setCategory}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          tags={tags}
          activeTags={activeTags}
          toggleTag={toggleTag}
        />

        {/* Zone centrale — tableau / contenu de l'onglet actif */}
        <main className="flex-1 overflow-y-auto min-w-0 p-5">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'rules' && <AutomaticRulesTab />}
            {tab === 'guardrails' && <GuardrailsTab />}
            {tab === 'priorities' && <PrioritiesConflictsTab />}
          </motion.div>
        </main>

        <RightPanel selectedRule={selectedRule} />
      </div>

      {/* Modals */}
      <GuardrailModal guardrail={null} open={newGuardrailOpen} onClose={() => setNewGuardrailOpen(false)} />
      <NewRuleModal open={newRuleOpen} onClose={() => setNewRuleOpen(false)} />
      <ConfigurePrioritiesModal open={configurePrioritiesOpen} onClose={() => setConfigurePrioritiesOpen(false)} />
    </div>
  );
};
