/**
 * FLOWTYM YIELD RULES - SIMPLIFIED
 * 
 * Moteur de règles yield management
 * Version simplifiée Phase 1
 */

import React, { useState } from 'react';
import {
  Zap,
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Calendar,
  TrendingUp,
  Users,
  Clock,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

type RuleType = 
  | 'occupation'      // Taux occupation
  | 'lead_time'       // Anticipation réservation
  | 'event'           // Événement marché
  | 'weekday'         // Jour semaine
  | 'min_stay'        // Durée séjour min
  | 'cta'             // Close To Arrival
  | 'yield_window'    // Fenêtre yield
  | 'override';       // Override manuel

interface YieldRule {
  id: string;
  name: string;
  type: RuleType;
  typeLabel: string;
  active: boolean;
  priority: number;       // 1-10 (10 = highest)
  condition: string;      // Description condition
  coefficient: number;    // Multiplicateur prix (0.8-1.5)
  dateStart: string;
  dateEnd: string;
  applied: number;        // Nb fois appliquée
  revenue: number;        // CA généré
}

// Mock data 8 règles
function generateYieldRules(): YieldRule[] {
  return [
    {
      id: '1',
      name: 'Occupation Élevée (+30%)',
      type: 'occupation',
      typeLabel: 'Occupation',
      active: true,
      priority: 9,
      condition: 'Si occupation > 80%',
      coefficient: 1.30,
      dateStart: '2026-01-01',
      dateEnd: '2026-12-31',
      applied: 142,
      revenue: 38420,
    },
    {
      id: '2',
      name: 'Last Minute (<7j) +25%',
      type: 'lead_time',
      typeLabel: 'Lead Time',
      active: true,
      priority: 8,
      condition: 'Si résa < 7 jours avant',
      coefficient: 1.25,
      dateStart: '2026-01-01',
      dateEnd: '2026-12-31',
      applied: 87,
      revenue: 24350,
    },
    {
      id: '3',
      name: 'EuroPCR (+40%)',
      type: 'event',
      typeLabel: 'Événement',
      active: true,
      priority: 10,
      condition: 'Événement EuroPCR 19-22 mai',
      coefficient: 1.40,
      dateStart: '2026-05-19',
      dateEnd: '2026-05-22',
      applied: 56,
      revenue: 15680,
    },
    {
      id: '4',
      name: 'Week-end (+15%)',
      type: 'weekday',
      typeLabel: 'Jour Semaine',
      active: true,
      priority: 6,
      condition: 'Si vendredi/samedi',
      coefficient: 1.15,
      dateStart: '2026-01-01',
      dateEnd: '2026-12-31',
      applied: 298,
      revenue: 81240,
    },
    {
      id: '5',
      name: 'Séjour 3+ nuits (-10%)',
      type: 'min_stay',
      typeLabel: 'Min Stay',
      active: true,
      priority: 5,
      condition: 'Si séjour >= 3 nuits',
      coefficient: 0.90,
      dateStart: '2026-01-01',
      dateEnd: '2026-12-31',
      applied: 124,
      revenue: 42870,
    },
    {
      id: '6',
      name: 'CTA J-1 (+20%)',
      type: 'cta',
      typeLabel: 'Close To Arrival',
      active: true,
      priority: 7,
      condition: 'Si check-in demain',
      coefficient: 1.20,
      dateStart: '2026-01-01',
      dateEnd: '2026-12-31',
      applied: 67,
      revenue: 18340,
    },
    {
      id: '7',
      name: 'Early Bird >30j (-15%)',
      type: 'yield_window',
      typeLabel: 'Yield Window',
      active: true,
      priority: 4,
      condition: 'Si résa > 30 jours avant',
      coefficient: 0.85,
      dateStart: '2026-01-01',
      dateEnd: '2026-12-31',
      applied: 212,
      revenue: 58120,
    },
    {
      id: '8',
      name: 'Noël/Nouvel An (+50%)',
      type: 'override',
      typeLabel: 'Override',
      active: false,
      priority: 10,
      condition: 'Période 24 déc - 2 jan',
      coefficient: 1.50,
      dateStart: '2025-12-24',
      dateEnd: '2026-01-02',
      applied: 0,
      revenue: 0,
    },
  ];
}

export function YieldRules() {
  const [rules, setRules] = useState<YieldRule[]>(generateYieldRules());
  const [selectedRule, setSelectedRule] = useState<YieldRule | null>(null);

  // KPIs
  const activeCount = rules.filter(r => r.active).length;
  const totalApplications = rules.reduce((sum, r) => sum + r.applied, 0);
  const totalRevenue = rules.reduce((sum, r) => sum + r.revenue, 0);

  const toggleActive = (id: string) => {
    setRules(rules.map(r => 
      r.id === id ? { ...r, active: !r.active } : r
    ));
  };

  const deleteRule = (id: string) => {
    if (confirm('Supprimer cette règle ?')) {
      setRules(rules.filter(r => r.id !== id));
      setSelectedRule(null);
    }
  };

  // Tri par priorité décroissante
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB]">
      <div className="p-6 pb-3">
        <RevenueHeader
          icon={Zap}
          title="Règles Yield Management"
          subtitle="Automatisation stratégique pricing - 8 types de règles"
        />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Règles Actives</span>
                <Power className="w-4 h-4 text-green-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{activeCount}</div>
              <div className="mt-1 text-xs text-gray-400">Sur {rules.length} total</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Applications</span>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{totalApplications}</div>
              <div className="mt-1 text-xs text-gray-400">30 derniers jours</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Revenu Généré</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{Math.round(totalRevenue / 1000)}K€</div>
              <div className="mt-1 text-xs text-emerald-600">Impact yield</div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Lift Moyen</span>
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">+18%</div>
              <div className="mt-1 text-xs text-gray-400">vs tarif de base</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <strong>{activeCount}</strong> règles actives • Priorités 1-10 (10 = plus haute)
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
              <Plus className="w-4 h-4" />
              Nouvelle règle
            </button>
          </div>

          {/* Tableau Règles */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Règles par Priorité</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Priorité</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Condition</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Coeff.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Période</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Appliqué</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">CA Généré</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(rule.id)}
                          className={cn(
                            'p-1 rounded transition-colors',
                            rule.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                          )}
                          title={rule.active ? 'Désactiver' : 'Activer'}
                        >
                          {rule.active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold',
                          rule.priority >= 9 ? 'bg-red-100 text-red-700' :
                          rule.priority >= 7 ? 'bg-orange-100 text-orange-700' :
                          rule.priority >= 5 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        )}>
                          {rule.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedRule(rule)}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors text-left"
                        >
                          {rule.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {rule.typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{rule.condition}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'text-sm font-bold',
                          rule.coefficient > 1 ? 'text-emerald-600' : 'text-blue-600'
                        )}>
                          {rule.coefficient > 1 ? '+' : ''}{((rule.coefficient - 1) * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(rule.dateStart).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} 
                        {' → '}
                        {new Date(rule.dateEnd).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{rule.applied}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">
                        {Math.round(rule.revenue / 1000)}K€
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedRule(rule)}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteRule(rule.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>8 Types de Règles</strong> : Occupation, Lead Time, Événement, Jour Semaine, Min Stay, Close To Arrival, Yield Window, Override. 
              Les règles sont appliquées par ordre de priorité (10 = highest). En cas de conflit, la règle avec la priorité la plus élevée prévaut.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Détails */}
      {selectedRule && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRule(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {selectedRule.name}
            </h2>
            <div className="space-y-3 text-sm">
              <div><span className="font-semibold">Type:</span> {selectedRule.typeLabel}</div>
              <div><span className="font-semibold">Priorité:</span> {selectedRule.priority} / 10</div>
              <div><span className="font-semibold">Condition:</span> {selectedRule.condition}</div>
              <div><span className="font-semibold">Coefficient:</span> {selectedRule.coefficient}x ({selectedRule.coefficient > 1 ? '+' : ''}{((selectedRule.coefficient - 1) * 100).toFixed(0)}%)</div>
              <div><span className="font-semibold">Période:</span> {selectedRule.dateStart} → {selectedRule.dateEnd}</div>
              <div><span className="font-semibold">Applications:</span> {selectedRule.applied} fois</div>
              <div><span className="font-semibold">CA Généré:</span> {selectedRule.revenue.toLocaleString()}€</div>
              <div><span className="font-semibold">Statut:</span> {selectedRule.active ? 'Actif ✅' : 'Inactif ⏸️'}</div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => toggleActive(selectedRule.id)}
                className={cn(
                  'px-4 py-2 rounded-md font-medium',
                  selectedRule.active 
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-green-600 text-white hover:bg-green-700'
                )}
              >
                {selectedRule.active ? 'Désactiver' : 'Activer'}
              </button>
              <button
                onClick={() => setSelectedRule(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
