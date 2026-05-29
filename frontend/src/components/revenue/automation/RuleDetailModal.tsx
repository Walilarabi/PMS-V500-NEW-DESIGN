/**
 * FLOWTYM — Modal détail d'une règle tactique
 * Affiche déclencheurs, actions, connectivité, historique, simulation.
 */
import React, { useMemo } from 'react';
import { X, Zap, AlertCircle, History, Settings2, TrendingUp } from 'lucide-react';
import type { TacticalRule } from '@/src/types/revenue/tacticalRules.types';
import { revenueImpactSimulator } from '@/src/services/revenue/revenueImpactSimulator';
import { cn } from '@/src/lib/utils';

const OUTCOME_COLOR: Record<string, string> = {
  success: 'text-emerald-600 bg-emerald-50',
  adjusted: 'text-amber-600 bg-amber-50',
  blocked: 'text-rose-600 bg-rose-50',
};

export interface RuleDetailModalProps {
  rule: TacticalRule | null;
  onClose: () => void;
}

export const RuleDetailModal: React.FC<RuleDetailModalProps> = ({ rule, onClose }) => {
  if (!rule) return null;

  const simulation = useMemo(
    () =>
      revenueImpactSimulator.simulateRule(rule, {
        occupancy: 0,
        pickup24h: 0,
        pickupAverage: 0,
        leadTimeDays: 0,
        compsetMedianPrice: 0,
        ourPrice: 0,
        marketPressure: 'medium',
        hasMajorEvent: false,
        daysUntilStay: 0,
        otaShare: 0,
        cancellationRate: 0,
        activeStrategy: 'balanced',
      }),
    [rule],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-[#F3F4F6]">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{rule.name}</h3>
              <p className="text-[13px] text-gray-500 mt-0.5">{rule.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F3F4F6] text-gray-700">
                  Priorité {rule.priority}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  Confiance IA {rule.iaConfidence}%
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Trois colonnes : déclencheurs, actions, connectivité */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Block title="Déclencheurs" icon={<AlertCircle size={14} className="text-amber-500" />}>
              <ul className="space-y-2 text-[13px] text-gray-700">
                {rule.triggers.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{t.label}</span>
                  </li>
                ))}
              </ul>
            </Block>
            <Block title="Actions" icon={<Zap size={14} className="text-[#8B5CF6]" />}>
              <ul className="space-y-2 text-[13px] text-gray-700">
                {rule.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                    <span>{a.label}</span>
                  </li>
                ))}
              </ul>
            </Block>
            <Block title="Connectivité" icon={<Settings2 size={14} className="text-blue-500" />}>
              <div className="flex flex-wrap gap-1.5">
                {rule.connectivity.map((c) => (
                  <span key={c} className="text-[11px] font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
                    {c}
                  </span>
                ))}
              </div>
            </Block>
          </div>

          {/* Simulation */}
          <Block title="Simulation d'impact" icon={<TrendingUp size={14} className="text-emerald-500" />}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Metric label="RevPAR" value={`${simulation.revparDelta > 0 ? '+' : ''}${simulation.revparDelta}€`} tone="positive" />
              <Metric label="ADR" value={`${simulation.adrDelta > 0 ? '+' : ''}${simulation.adrDelta}%`} tone="positive" />
              <Metric label="TO" value={`${simulation.occupancyDelta > 0 ? '+' : ''}${simulation.occupancyDelta} pt`} tone="positive" />
              <Metric label="Revenu" value={`${simulation.revenueDelta > 0 ? '+' : ''}${simulation.revenueDelta}€`} tone="positive" />
            </div>
          </Block>

          {/* Historique */}
          <Block title="Historique des déclenchements" icon={<History size={14} className="text-gray-400" />}>
            <div className="rounded-xl border border-[#F3F4F6] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-[#FAFAFB] text-[11px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Date</th>
                    <th className="text-left px-3 py-2 font-semibold">Déclencheur</th>
                    <th className="text-left px-3 py-2 font-semibold">Action</th>
                    <th className="text-left px-3 py-2 font-semibold">Résultat</th>
                    <th className="text-right px-3 py-2 font-semibold">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {rule.history.slice(0, 8).map((h, i) => (
                    <tr key={i} className="border-t border-[#F3F4F6]">
                      <td className="px-3 py-2 text-gray-600">{h.date}</td>
                      <td className="px-3 py-2 text-gray-700">{h.trigger}</td>
                      <td className="px-3 py-2 text-gray-700">{h.action}</td>
                      <td className="px-3 py-2">
                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', OUTCOME_COLOR[h.outcome])}>
                          {h.outcome === 'success' ? 'Réussie' : h.outcome === 'adjusted' ? 'Ajustée' : 'Bloquée'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600">+{h.revenueImpact}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#F3F4F6] bg-[#FAFAFB]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Fermer
          </button>
          <button className="px-4 py-2 text-[13px] font-semibold text-white bg-[#8B5CF6] rounded-xl hover:bg-[#7C3AED] shadow-sm">
            Modifier la règle
          </button>
        </div>
      </div>
    </div>
  );
};

const Block: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="bg-[#FAFAFB] border border-[#F3F4F6] rounded-2xl p-4">
    <header className="flex items-center gap-2 mb-3">
      {icon}
      <h4 className="text-[13px] font-semibold text-gray-700 uppercase tracking-wide">{title}</h4>
    </header>
    {children}
  </section>
);

const Metric: React.FC<{ label: string; value: string; tone?: 'positive' | 'neutral' | 'negative' }> = ({ label, value, tone = 'neutral' }) => {
  const cls =
    tone === 'positive' ? 'text-emerald-600 bg-emerald-50'
    : tone === 'negative' ? 'text-rose-600 bg-rose-50'
    : 'text-gray-700 bg-white border border-gray-100';
  return (
    <div className={cn('rounded-xl p-3', cls)}>
      <div className="text-[11px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-[18px] font-bold mt-1">{value}</div>
    </div>
  );
};
