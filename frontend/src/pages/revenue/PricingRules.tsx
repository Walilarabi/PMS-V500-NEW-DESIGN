/**
 * FLOWTYM PRICING RULES
 *
 * Rules Engine visuel pour automatisation tarifaire
 *
 * Features :
 * - Liste règles avec drag-drop natif (réordonne les priorités)
 * - Conditions builder (TO/Lead/Événements/Jour semaine)
 * - Actions builder (±%, Min/Max, MLOS)
 * - Simulation / Test sur scénario fictif
 */

import React, { useState, useMemo } from 'react';
import {
  Zap,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Play,
  GripVertical,
  Calendar,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

interface PricingRule {
  id: string;
  name: string;
  priority: number;
  active: boolean;
  conditions: {
    toMin?: number;
    toMax?: number;
    leadTimeMin?: number;
    leadTimeMax?: number;
    eventPresent?: boolean;
    eventName?: string;
    dayOfWeek?: number[];
  };
  actions: {
    priceAdjustment?: number;
    minPrice?: number;
    maxPrice?: number;
    mlos?: number;
  };
  createdAt: string;
  lastTriggered?: string;
}

interface SimulationContext {
  occupancyRate: number;
  leadTime: number;
  eventPresent: boolean;
  dayOfWeek: number;
  currentPrice: number;
}

interface SimulationResult {
  matchedRules: PricingRule[];
  finalPrice: number;
  appliedAdjustments: number;
  enforcedMlos?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

function generateMockRules(): PricingRule[] {
  return [
    {
      id: 'rule_1',
      name: 'High Demand - Weekend Premium',
      priority: 1,
      active: true,
      conditions: { toMin: 85, dayOfWeek: [5, 6] },
      actions: { priceAdjustment: 15, minPrice: 300 },
      createdAt: '2026-01-15',
      lastTriggered: '2026-05-16',
    },
    {
      id: 'rule_2',
      name: 'Event Detected - Price Surge',
      priority: 2,
      active: true,
      conditions: { eventPresent: true },
      actions: { priceAdjustment: 25, minPrice: 350 },
      createdAt: '2026-02-01',
      lastTriggered: '2026-05-10',
    },
    {
      id: 'rule_3',
      name: 'Last Minute - Low Occupancy Boost',
      priority: 3,
      active: true,
      conditions: { toMax: 40, leadTimeMax: 3 },
      actions: { priceAdjustment: -12, mlos: 1 },
      createdAt: '2026-01-20',
      lastTriggered: '2026-05-15',
    },
    {
      id: 'rule_4',
      name: 'Early Bird Discount',
      priority: 4,
      active: false,
      conditions: { leadTimeMin: 60 },
      actions: { priceAdjustment: -8, maxPrice: 280 },
      createdAt: '2026-03-05',
    },
    {
      id: 'rule_5',
      name: 'Minimum Stay - Weekends',
      priority: 5,
      active: true,
      conditions: { dayOfWeek: [5, 6] },
      actions: { mlos: 2 },
      createdAt: '2026-02-15',
      lastTriggered: '2026-05-17',
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// FORM STATE / DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

interface RuleFormState {
  name: string;
  enableToMin: boolean;
  toMin: number;
  enableToMax: boolean;
  toMax: number;
  enableLeadTimeMin: boolean;
  leadTimeMin: number;
  enableLeadTimeMax: boolean;
  leadTimeMax: number;
  eventPresent: boolean;
  dayOfWeek: number[];
  enablePriceAdjustment: boolean;
  priceAdjustment: number;
  enableMinPrice: boolean;
  minPrice: number;
  enableMaxPrice: boolean;
  maxPrice: number;
  enableMlos: boolean;
  mlos: number;
}

const defaultForm = (): RuleFormState => ({
  name: '',
  enableToMin: false,
  toMin: 80,
  enableToMax: false,
  toMax: 40,
  enableLeadTimeMin: false,
  leadTimeMin: 30,
  enableLeadTimeMax: false,
  leadTimeMax: 7,
  eventPresent: false,
  dayOfWeek: [],
  enablePriceAdjustment: true,
  priceAdjustment: 10,
  enableMinPrice: false,
  minPrice: 200,
  enableMaxPrice: false,
  maxPrice: 400,
  enableMlos: false,
  mlos: 2,
});

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function ruleMatches(rule: PricingRule, ctx: SimulationContext): boolean {
  const c = rule.conditions;
  if (c.toMin !== undefined && ctx.occupancyRate < c.toMin) return false;
  if (c.toMax !== undefined && ctx.occupancyRate > c.toMax) return false;
  if (c.leadTimeMin !== undefined && ctx.leadTime < c.leadTimeMin) return false;
  if (c.leadTimeMax !== undefined && ctx.leadTime > c.leadTimeMax) return false;
  if (c.eventPresent && !ctx.eventPresent) return false;
  if (c.dayOfWeek && c.dayOfWeek.length > 0 && !c.dayOfWeek.includes(ctx.dayOfWeek)) return false;
  return true;
}

function simulate(rules: PricingRule[], ctx: SimulationContext): SimulationResult {
  const ordered = [...rules]
    .filter((r) => r.active)
    .sort((a, b) => a.priority - b.priority);

  let price = ctx.currentPrice;
  let appliedAdjustments = 0;
  let enforcedMlos: number | undefined;
  const matched: PricingRule[] = [];

  for (const rule of ordered) {
    if (!ruleMatches(rule, ctx)) continue;
    matched.push(rule);
    if (rule.actions.priceAdjustment !== undefined) {
      price = price * (1 + rule.actions.priceAdjustment / 100);
      appliedAdjustments += rule.actions.priceAdjustment;
    }
    if (rule.actions.minPrice !== undefined) {
      price = Math.max(price, rule.actions.minPrice);
    }
    if (rule.actions.maxPrice !== undefined) {
      price = Math.min(price, rule.actions.maxPrice);
    }
    if (rule.actions.mlos !== undefined) {
      enforcedMlos = Math.max(enforcedMlos ?? 0, rule.actions.mlos);
    }
  }

  return {
    matchedRules: matched,
    finalPrice: Math.round(price),
    appliedAdjustments,
    enforcedMlos,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const RULES_STORAGE_KEY = 'flowtym_pricing_rules';

function loadRules(): PricingRule[] {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return generateMockRules();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : generateMockRules();
  } catch {
    return generateMockRules();
  }
}

export function PricingRules() {
  const [rules, setRulesRaw] = useState<PricingRule[]>(() => loadRules());
  const setRules: typeof setRulesRaw = (updater) => {
    setRulesRaw((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: PricingRule[]) => PricingRule[])(prev) : updater;
      try {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota
      }
      return next;
    });
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(defaultForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [simulationRule, setSimulationRule] = useState<PricingRule | null>(null);

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules]
  );
  const activeRules = sortedRules.filter((r) => r.active);
  const inactiveRules = sortedRules.filter((r) => !r.active);

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  };

  const deleteRule = (id: string) => {
    if (confirm('Supprimer cette règle ?')) {
      setRules(rules.filter((r) => r.id !== id));
    }
  };

  const reorderActive = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const active = activeRules;
    const sourceIdx = active.findIndex((r) => r.id === sourceId);
    const targetIdx = active.findIndex((r) => r.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const newOrder = [...active];
    const [moved] = newOrder.splice(sourceIdx, 1);
    newOrder.splice(targetIdx, 0, moved);

    setRules((prev) => {
      const map = new Map(newOrder.map((r, i) => [r.id, i + 1]));
      return prev.map((r) => (map.has(r.id) ? { ...r, priority: map.get(r.id)! } : r));
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm());
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEdit = (rule: PricingRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      enableToMin: rule.conditions.toMin !== undefined,
      toMin: rule.conditions.toMin ?? 80,
      enableToMax: rule.conditions.toMax !== undefined,
      toMax: rule.conditions.toMax ?? 40,
      enableLeadTimeMin: rule.conditions.leadTimeMin !== undefined,
      leadTimeMin: rule.conditions.leadTimeMin ?? 30,
      enableLeadTimeMax: rule.conditions.leadTimeMax !== undefined,
      leadTimeMax: rule.conditions.leadTimeMax ?? 7,
      eventPresent: !!rule.conditions.eventPresent,
      dayOfWeek: rule.conditions.dayOfWeek ?? [],
      enablePriceAdjustment: rule.actions.priceAdjustment !== undefined,
      priceAdjustment: rule.actions.priceAdjustment ?? 10,
      enableMinPrice: rule.actions.minPrice !== undefined,
      minPrice: rule.actions.minPrice ?? 200,
      enableMaxPrice: rule.actions.maxPrice !== undefined,
      maxPrice: rule.actions.maxPrice ?? 400,
      enableMlos: rule.actions.mlos !== undefined,
      mlos: rule.actions.mlos ?? 2,
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  const submitForm = () => {
    if (!form.name.trim()) {
      setFormError('Le nom de la règle est requis');
      return;
    }
    const hasCondition =
      form.enableToMin ||
      form.enableToMax ||
      form.enableLeadTimeMin ||
      form.enableLeadTimeMax ||
      form.eventPresent ||
      form.dayOfWeek.length > 0;
    if (!hasCondition) {
      setFormError('Sélectionnez au moins une condition');
      return;
    }
    const hasAction =
      form.enablePriceAdjustment ||
      form.enableMinPrice ||
      form.enableMaxPrice ||
      form.enableMlos;
    if (!hasAction) {
      setFormError('Sélectionnez au moins une action');
      return;
    }

    const conditions: PricingRule['conditions'] = {};
    if (form.enableToMin) conditions.toMin = form.toMin;
    if (form.enableToMax) conditions.toMax = form.toMax;
    if (form.enableLeadTimeMin) conditions.leadTimeMin = form.leadTimeMin;
    if (form.enableLeadTimeMax) conditions.leadTimeMax = form.leadTimeMax;
    if (form.eventPresent) conditions.eventPresent = true;
    if (form.dayOfWeek.length > 0) conditions.dayOfWeek = [...form.dayOfWeek];

    const actions: PricingRule['actions'] = {};
    if (form.enablePriceAdjustment) actions.priceAdjustment = form.priceAdjustment;
    if (form.enableMinPrice) actions.minPrice = form.minPrice;
    if (form.enableMaxPrice) actions.maxPrice = form.maxPrice;
    if (form.enableMlos) actions.mlos = form.mlos;

    if (editingId) {
      setRules(
        rules.map((r) =>
          r.id === editingId ? { ...r, name: form.name.trim(), conditions, actions } : r
        )
      );
    } else {
      const maxPriority = rules.reduce((m, r) => Math.max(m, r.priority), 0);
      const newRule: PricingRule = {
        id: `rule_${Date.now()}`,
        name: form.name.trim(),
        priority: maxPriority + 1,
        active: true,
        conditions,
        actions,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setRules([...rules, newRule]);
    }
    setShowCreateModal(false);
  };

  const toggleFormDay = (day: number) => {
    setForm((f) =>
      f.dayOfWeek.includes(day)
        ? { ...f, dayOfWeek: f.dayOfWeek.filter((d) => d !== day) }
        : { ...f, dayOfWeek: [...f.dayOfWeek, day].sort((a, b) => a - b) }
    );
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      <RevenueHeader
        icon={Zap}
        title="Règles Tarifaires"
        subtitle="Rules Engine pour automatisation tarifaire avancée"
        quickActions={[
          {
            label: 'Nouvelle règle',
            icon: Plus,
            onClick: openCreate,
          },
        ]}
      />

      {/* KPI CARDS */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Règles actives
            </div>
            <div className="text-3xl font-bold text-emerald-600">{activeRules.length}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Règles inactives
            </div>
            <div className="text-3xl font-bold text-gray-600">{inactiveRules.length}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Déclenchements 7j
            </div>
            <div className="text-3xl font-bold text-blue-600">142</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Impact RevPAR
            </div>
            <div className="text-3xl font-bold text-emerald-600">+12%</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* RULES LIST */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">Règles actives</h3>
              <span className="text-xs text-gray-500">
                Glisser-déposer pour réordonner les priorités
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {activeRules.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  Aucune règle active
                </div>
              ) : (
                activeRules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    isDragging={dragId === rule.id}
                    onDragStart={() => setDragId(rule.id)}
                    onDragEnd={() => setDragId(null)}
                    onDrop={() => {
                      if (dragId) reorderActive(dragId, rule.id);
                      setDragId(null);
                    }}
                    onToggle={() => toggleRule(rule.id)}
                    onDelete={() => deleteRule(rule.id)}
                    onEdit={() => openEdit(rule)}
                    onTest={() => setSimulationRule(rule)}
                  />
                ))
              )}
            </div>
          </div>

          {/* INACTIVE RULES */}
          {inactiveRules.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700">Règles inactives</h3>
              </div>

              <div className="divide-y divide-gray-100">
                {inactiveRules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onToggle={() => toggleRule(rule.id)}
                    onDelete={() => deleteRule(rule.id)}
                    onEdit={() => openEdit(rule)}
                    onTest={() => setSimulationRule(rule)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showCreateModal && (
        <RuleFormModal
          form={form}
          setForm={setForm}
          editing={editingId !== null}
          error={formError}
          onClose={() => setShowCreateModal(false)}
          onSubmit={submitForm}
          onToggleDay={toggleFormDay}
        />
      )}

      {/* SIMULATION MODAL */}
      {simulationRule && (
        <SimulationModal
          rules={rules}
          highlightRule={simulationRule}
          onClose={() => setSimulationRule(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE CARD
// ═══════════════════════════════════════════════════════════════════════════

function RuleCard({
  rule,
  isDragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onToggle,
  onDelete,
  onEdit,
  onTest,
}: {
  rule: PricingRule;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onTest: () => void;
}) {
  const draggable = !!onDragStart;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.();
      }}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDrop?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      className={cn(
        'px-4 py-4 hover:bg-gray-50 transition-colors',
        !rule.active && 'opacity-60',
        isDragging && 'opacity-40 bg-blue-50'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <div className="mt-1" title={draggable ? 'Glisser pour réordonner' : undefined}>
          <GripVertical
            className={cn(
              'w-5 h-5',
              draggable ? 'text-gray-400 cursor-grab active:cursor-grabbing' : 'text-gray-300'
            )}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-bold text-gray-900 mb-1">{rule.name}</h4>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Priorité: {rule.priority}</span>
                <span>•</span>
                <span>Créée le {new Date(rule.createdAt).toLocaleDateString('fr-FR')}</span>
                {rule.lastTriggered && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-600 font-semibold">
                      Déclenchée le {new Date(rule.lastTriggered).toLocaleDateString('fr-FR')}
                    </span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={onToggle}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                rule.active ? 'bg-emerald-600' : 'bg-gray-300'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  rule.active ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Conditions */}
          <div className="mb-2">
            <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Conditions</div>
            <div className="flex flex-wrap gap-2">
              {rule.conditions.toMin !== undefined && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                  TO ≥ {rule.conditions.toMin}%
                </span>
              )}
              {rule.conditions.toMax !== undefined && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                  TO ≤ {rule.conditions.toMax}%
                </span>
              )}
              {rule.conditions.leadTimeMin !== undefined && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                  Lead ≥ {rule.conditions.leadTimeMin}j
                </span>
              )}
              {rule.conditions.leadTimeMax !== undefined && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                  Lead ≤ {rule.conditions.leadTimeMax}j
                </span>
              )}
              {rule.conditions.eventPresent && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                  Événement présent
                </span>
              )}
              {rule.conditions.dayOfWeek && rule.conditions.dayOfWeek.length > 0 && (
                <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-semibold rounded">
                  {rule.conditions.dayOfWeek
                    .map((d) => DAY_LABELS[(d + 6) % 7])
                    .join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Actions</div>
            <div className="flex flex-wrap gap-2">
              {rule.actions.priceAdjustment !== undefined && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-semibold rounded',
                    rule.actions.priceAdjustment > 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  )}
                >
                  Prix {rule.actions.priceAdjustment > 0 ? '+' : ''}
                  {rule.actions.priceAdjustment}%
                </span>
              )}
              {rule.actions.minPrice !== undefined && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                  Min {rule.actions.minPrice}€
                </span>
              )}
              {rule.actions.maxPrice !== undefined && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                  Max {rule.actions.maxPrice}€
                </span>
              )}
              {rule.actions.mlos !== undefined && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded">
                  MLOS {rule.actions.mlos} nuit(s)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-blue-100 rounded transition-colors"
            title="Éditer"
          >
            <Edit className="w-4 h-4 text-blue-600" />
          </button>
          <button
            className="p-1.5 hover:bg-red-100 rounded transition-colors"
            onClick={onDelete}
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
          <button
            onClick={onTest}
            className="p-1.5 hover:bg-emerald-100 rounded transition-colors"
            title="Tester"
          >
            <Play className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE FORM MODAL
// ═══════════════════════════════════════════════════════════════════════════

function RuleFormModal({
  form,
  setForm,
  editing,
  error,
  onClose,
  onSubmit,
  onToggleDay,
}: {
  form: RuleFormState;
  setForm: React.Dispatch<React.SetStateAction<RuleFormState>>;
  editing: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onToggleDay: (day: number) => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? 'Modifier la règle' : 'Créer une nouvelle règle tarifaire'}
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nom de la règle *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Promotion Week-end"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Conditions Builder */}
          <section>
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">SI</span>
              Conditions
            </h3>
            <div className="space-y-3 bg-gray-50 rounded-md p-3 border border-gray-200">
              {/* TO Min */}
              <ConditionRow
                label="Taux d'occupation minimum"
                enabled={form.enableToMin}
                onToggle={(v) => setForm({ ...form, enableToMin: v })}
              >
                <NumberField
                  value={form.toMin}
                  onChange={(v) => setForm({ ...form, toMin: v })}
                  suffix="%"
                  min={0}
                  max={100}
                />
              </ConditionRow>

              <ConditionRow
                label="Taux d'occupation maximum"
                enabled={form.enableToMax}
                onToggle={(v) => setForm({ ...form, enableToMax: v })}
              >
                <NumberField
                  value={form.toMax}
                  onChange={(v) => setForm({ ...form, toMax: v })}
                  suffix="%"
                  min={0}
                  max={100}
                />
              </ConditionRow>

              <ConditionRow
                label="Lead time minimum"
                enabled={form.enableLeadTimeMin}
                onToggle={(v) => setForm({ ...form, enableLeadTimeMin: v })}
              >
                <NumberField
                  value={form.leadTimeMin}
                  onChange={(v) => setForm({ ...form, leadTimeMin: v })}
                  suffix="jours"
                  min={0}
                />
              </ConditionRow>

              <ConditionRow
                label="Lead time maximum"
                enabled={form.enableLeadTimeMax}
                onToggle={(v) => setForm({ ...form, enableLeadTimeMax: v })}
              >
                <NumberField
                  value={form.leadTimeMax}
                  onChange={(v) => setForm({ ...form, leadTimeMax: v })}
                  suffix="jours"
                  min={0}
                />
              </ConditionRow>

              <ConditionRow
                label="Événement présent"
                enabled={form.eventPresent}
                onToggle={(v) => setForm({ ...form, eventPresent: v })}
              >
                <span className="text-xs text-gray-500">
                  (déclenche quand un événement est détecté)
                </span>
              </ConditionRow>

              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Jours de la semaine</div>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, i) => {
                    // i: 0=Lun..6=Dim → mapper vers Date.getDay() (0=Dim..6=Sam)
                    const dowValue = i === 6 ? 0 : i + 1;
                    const selected = form.dayOfWeek.includes(dowValue);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => onToggleDay(dowValue)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-semibold rounded border transition-colors',
                          selected
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-teal-500'
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Actions Builder */}
          <section>
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">ALORS</span>
              Actions
            </h3>
            <div className="space-y-3 bg-gray-50 rounded-md p-3 border border-gray-200">
              <ConditionRow
                label="Ajustement de prix"
                enabled={form.enablePriceAdjustment}
                onToggle={(v) => setForm({ ...form, enablePriceAdjustment: v })}
              >
                <NumberField
                  value={form.priceAdjustment}
                  onChange={(v) => setForm({ ...form, priceAdjustment: v })}
                  suffix="%"
                  min={-100}
                  max={500}
                  allowNegative
                />
              </ConditionRow>

              <ConditionRow
                label="Prix minimum"
                enabled={form.enableMinPrice}
                onToggle={(v) => setForm({ ...form, enableMinPrice: v })}
              >
                <NumberField
                  value={form.minPrice}
                  onChange={(v) => setForm({ ...form, minPrice: v })}
                  suffix="€"
                  min={0}
                />
              </ConditionRow>

              <ConditionRow
                label="Prix maximum"
                enabled={form.enableMaxPrice}
                onToggle={(v) => setForm({ ...form, enableMaxPrice: v })}
              >
                <NumberField
                  value={form.maxPrice}
                  onChange={(v) => setForm({ ...form, maxPrice: v })}
                  suffix="€"
                  min={0}
                />
              </ConditionRow>

              <ConditionRow
                label="MLOS (durée minimum de séjour)"
                enabled={form.enableMlos}
                onToggle={(v) => setForm({ ...form, enableMlos: v })}
              >
                <NumberField
                  value={form.mlos}
                  onChange={(v) => setForm({ ...form, mlos: v })}
                  suffix="nuits"
                  min={1}
                  max={30}
                />
              </ConditionRow>
            </div>
          </section>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={onSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {editing ? 'Enregistrer' : 'Créer la règle'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConditionRow({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 accent-blue-600"
        />
        <span className="text-sm text-gray-700">{label}</span>
      </label>
      <div className={cn('flex items-center gap-2', !enabled && 'opacity-40 pointer-events-none')}>
        {children}
      </div>
    </div>
  );
}

function NumberField({
  value,
  onChange,
  suffix,
  min,
  max,
  allowNegative,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  allowNegative?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          let v = Number(e.target.value);
          if (!allowNegative && v < 0) v = 0;
          if (min !== undefined && v < min) v = min;
          if (max !== undefined && v > max) v = max;
          onChange(v);
        }}
        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-right"
      />
      {suffix && <span className="text-xs text-gray-500 w-12">{suffix}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATION MODAL
// ═══════════════════════════════════════════════════════════════════════════

function SimulationModal({
  rules,
  highlightRule,
  onClose,
}: {
  rules: PricingRule[];
  highlightRule: PricingRule;
  onClose: () => void;
}) {
  const [ctx, setCtx] = useState<SimulationContext>({
    occupancyRate: 88,
    leadTime: 5,
    eventPresent: false,
    dayOfWeek: 5,
    currentPrice: 280,
  });

  const result = useMemo(() => simulate(rules, ctx), [rules, ctx]);
  const highlightMatches = ruleMatches(highlightRule, ctx);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Simulation</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Règle ciblée : <span className="font-semibold">{highlightRule.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Scenario inputs */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3">Scénario</h3>
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-md border border-gray-200">
              <label className="text-sm">
                <span className="block text-xs font-semibold text-gray-600 mb-1">
                  Taux d'occupation
                </span>
                <NumberField
                  value={ctx.occupancyRate}
                  onChange={(v) => setCtx({ ...ctx, occupancyRate: v })}
                  suffix="%"
                  min={0}
                  max={100}
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-gray-600 mb-1">Lead time</span>
                <NumberField
                  value={ctx.leadTime}
                  onChange={(v) => setCtx({ ...ctx, leadTime: v })}
                  suffix="jours"
                  min={0}
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-gray-600 mb-1">Prix actuel</span>
                <NumberField
                  value={ctx.currentPrice}
                  onChange={(v) => setCtx({ ...ctx, currentPrice: v })}
                  suffix="€"
                  min={0}
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-semibold text-gray-600 mb-1">
                  Jour (0=Dim..6=Sam)
                </span>
                <NumberField
                  value={ctx.dayOfWeek}
                  onChange={(v) => setCtx({ ...ctx, dayOfWeek: Math.max(0, Math.min(6, v)) })}
                  min={0}
                  max={6}
                />
              </label>
              <label className="flex items-center gap-2 text-sm col-span-2">
                <input
                  type="checkbox"
                  checked={ctx.eventPresent}
                  onChange={(e) => setCtx({ ...ctx, eventPresent: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
                Événement présent ce jour
              </label>
            </div>
          </div>

          {/* Result */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3">Résultat</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs text-blue-700 font-semibold uppercase">Prix final</span>
                <span className="text-3xl font-bold text-blue-700">{result.finalPrice}€</span>
                <span className="text-xs text-gray-500">
                  (depuis {ctx.currentPrice}€, ajust. cumulé {result.appliedAdjustments >= 0 ? '+' : ''}
                  {result.appliedAdjustments}%)
                </span>
              </div>
              {result.enforcedMlos !== undefined && (
                <div className="text-xs text-gray-700 mb-2">
                  MLOS appliqué : <span className="font-bold">{result.enforcedMlos} nuit(s)</span>
                </div>
              )}
              <div className="text-xs font-semibold text-gray-700 mb-1">
                Règles déclenchées ({result.matchedRules.length})
              </div>
              {result.matchedRules.length === 0 ? (
                <div className="text-xs italic text-gray-500">Aucune règle ne matche ce scénario</div>
              ) : (
                <ol className="list-decimal pl-5 space-y-1">
                  {result.matchedRules.map((r) => (
                    <li
                      key={r.id}
                      className={cn(
                        'text-xs',
                        r.id === highlightRule.id ? 'font-bold text-blue-700' : 'text-gray-700'
                      )}
                    >
                      {r.name} (priorité {r.priority})
                    </li>
                  ))}
                </ol>
              )}

              {!highlightMatches && (
                <div className="mt-3 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">
                  La règle ciblée <strong>ne matche pas</strong> ce scénario.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
