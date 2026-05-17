/**
 * FLOWTYM PRICING RULES
 * 
 * Rules Engine visuel pour automatisation tarifaire
 * 
 * Features :
 * - Liste règles actives drag-drop
 * - Conditions builder (TO/Lead/Événements)
 * - Actions (±%, Min/Max, MLOS)
 * - Simulation/Test
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
  Move,
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
    priceAdjustment?: number; // % (peut être négatif)
    minPrice?: number;
    maxPrice?: number;
    mlos?: number;
  };
  createdAt: string;
  lastTriggered?: string;
}

// Mock data
function generateMockRules(): PricingRule[] {
  return [
    {
      id: 'rule_1',
      name: 'High Demand - Weekend Premium',
      priority: 1,
      active: true,
      conditions: {
        toMin: 85,
        dayOfWeek: [5, 6], // Vendredi, Samedi
      },
      actions: {
        priceAdjustment: +15,
        minPrice: 300,
      },
      createdAt: '2026-01-15',
      lastTriggered: '2026-05-16',
    },
    {
      id: 'rule_2',
      name: 'Event Detected - Price Surge',
      priority: 2,
      active: true,
      conditions: {
        eventPresent: true,
      },
      actions: {
        priceAdjustment: +25,
        minPrice: 350,
      },
      createdAt: '2026-02-01',
      lastTriggered: '2026-05-10',
    },
    {
      id: 'rule_3',
      name: 'Last Minute - Low Occupancy Boost',
      priority: 3,
      active: true,
      conditions: {
        toMax: 40,
        leadTimeMax: 3,
      },
      actions: {
        priceAdjustment: -12,
        mlos: 1,
      },
      createdAt: '2026-01-20',
      lastTriggered: '2026-05-15',
    },
    {
      id: 'rule_4',
      name: 'Early Bird Discount',
      priority: 4,
      active: false,
      conditions: {
        leadTimeMin: 60,
      },
      actions: {
        priceAdjustment: -8,
        maxPrice: 280,
      },
      createdAt: '2026-03-05',
    },
    {
      id: 'rule_5',
      name: 'Minimum Stay - Weekends',
      priority: 5,
      active: true,
      conditions: {
        dayOfWeek: [5, 6],
      },
      actions: {
        mlos: 2,
      },
      createdAt: '2026-02-15',
      lastTriggered: '2026-05-17',
    },
  ];
}

export function PricingRules() {
  const [rules, setRules] = useState<PricingRule[]>(generateMockRules());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const activeRules = rules.filter((r) => r.active);
  const inactiveRules = rules.filter((r) => !r.active);

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  };

  const deleteRule = (id: string) => {
    if (confirm('Supprimer cette règle ?')) {
      setRules(rules.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      {/* HEADER */}
      <RevenueHeader
        icon={Zap}
        title="Règles Tarifaires"
        subtitle="Rules Engine pour automatisation tarifaire avancée"
        quickActions={[
          {
            label: 'Nouvelle règle',
            icon: Plus,
            onClick: () => setShowCreateModal(true),
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
                    onToggle={() => toggleRule(rule.id)}
                    onDelete={() => deleteRule(rule.id)}
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
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL (Simplified) */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Créer une nouvelle règle tarifaire
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nom de la règle
                </label>
                <input
                  type="text"
                  placeholder="Ex: Promotion Week-end"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Conditions (une par ligne)
                </label>
                <textarea
                  rows={3}
                  placeholder="TO >= 85&#10;Lead Time <= 3&#10;Événement présent"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Actions (une par ligne)
                </label>
                <textarea
                  rows={3}
                  placeholder="Prix +15%&#10;Min 300€&#10;MLOS 2 nuits"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  alert('Création de règle en développement');
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Créer la règle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function RuleCard({
  rule,
  onToggle,
  onDelete,
}: {
  rule: PricingRule;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'px-4 py-4 hover:bg-gray-50 transition-colors',
        !rule.active && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <div className="mt-1">
          <Move className="w-5 h-5 text-gray-400 cursor-move" />
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

            {/* Toggle */}
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
              {rule.conditions.toMin && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                  TO ≥ {rule.conditions.toMin}%
                </span>
              )}
              {rule.conditions.toMax && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                  TO ≤ {rule.conditions.toMax}%
                </span>
              )}
              {rule.conditions.leadTimeMin && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                  Lead ≥ {rule.conditions.leadTimeMin}j
                </span>
              )}
              {rule.conditions.leadTimeMax && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                  Lead ≤ {rule.conditions.leadTimeMax}j
                </span>
              )}
              {rule.conditions.eventPresent && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                  Événement présent
                </span>
              )}
              {rule.conditions.dayOfWeek && (
                <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-semibold rounded">
                  {rule.conditions.dayOfWeek.map((d) => ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d]).join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Actions</div>
            <div className="flex flex-wrap gap-2">
              {rule.actions.priceAdjustment && (
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
              {rule.actions.minPrice && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                  Min {rule.actions.minPrice}€
                </span>
              )}
              {rule.actions.maxPrice && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                  Max {rule.actions.maxPrice}€
                </span>
              )}
              {rule.actions.mlos && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded">
                  MLOS {rule.actions.mlos} nuit(s)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
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
