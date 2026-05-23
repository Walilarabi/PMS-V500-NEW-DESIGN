/**
 * FLOWTYM RMS — Autopilote RMS.
 *
 * Pilotage autonome du revenue management : niveau d'automatisation,
 * garde-fous, acceptation automatique des recommandations, transmission
 * vers le Channel Manager, journal des décisions et rollback.
 */

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Plane, Play, ListChecks, History, ShieldCheck,
  CheckCircle2, Inbox, Wand2,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import {
  useRmsAutomationStore,
  evaluateActivation,
  AUTOMATION_LEVELS,
  type AutomationLevel,
} from '@/src/store/rmsAutomationStore';
import { buildActivationContext } from '@/src/components/rms/automation/ActivationSlotsPanel';
import { GuardrailsPanel } from '@/src/components/rms/automation/GuardrailsPanel';
import { RecommendationCard } from '@/src/components/rms/automation/RecommendationCard';
import { DecisionRow } from '@/src/components/rms/automation/DecisionRow';
import { STRATEGY_BY_ID } from '@/src/lib/rms/strategies';
import { AutopilotForecastPanel } from '@/src/components/revenue/automation/AutopilotForecastPanel';
import { RmsEnterpriseFeed } from '@/src/components/revenue/automation/RmsEnterpriseFeed';

const LEVEL_ACCENT: Record<AutomationLevel, string> = {
  1: '#6B7280',
  2: '#2563EB',
  3: '#D97706',
  4: '#8B5CF6',
};

const Kpi: React.FC<{
  label: string;
  value: string;
  hint: string;
  accent: string;
}> = ({ label, value, hint, accent }) => (
  <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
      {label}
    </div>
    <div className="text-[18px] font-extrabold mt-0.5" style={{ color: accent }}>
      {value}
    </div>
    <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{hint}</div>
  </div>
);

export const AutopilotPage: React.FC = () => {
  const automationLevel = useRmsAutomationStore((s) => s.automationLevel);
  const activeStrategyId = useRmsAutomationStore((s) => s.activeStrategyId);
  const autoMode = useRmsAutomationStore((s) => s.autoMode);
  const activation = useRmsAutomationStore((s) => s.activation);
  const signals = useRmsAutomationStore((s) => s.signals);
  const params = useRmsAutomationStore((s) => s.params);
  const recommendations = useRmsAutomationStore((s) => s.recommendations);
  const decisionLog = useRmsAutomationStore((s) => s.decisionLog);
  const setAutomationLevel = useRmsAutomationStore((s) => s.setAutomationLevel);
  const applyRecommendation = useRmsAutomationStore((s) => s.applyRecommendation);
  const rejectRecommendation = useRmsAutomationStore((s) => s.rejectRecommendation);
  const rollbackDecision = useRmsAutomationStore((s) => s.rollbackDecision);
  const retrySync = useRmsAutomationStore((s) => s.retrySync);
  const runAutopilot = useRmsAutomationStore((s) => s.runAutopilot);

  const activationState = useMemo(
    () => evaluateActivation(activation, buildActivationContext(signals)),
    [activation, signals],
  );

  const strategy = STRATEGY_BY_ID[activeStrategyId];
  const levelInfo = AUTOMATION_LEVELS.find((l) => l.level === automationLevel)!;
  const canRun = automationLevel >= 3;
  const syncedCount = decisionLog.filter((d) => d.syncStatus === 'synced').length;
  const failedCount = decisionLog.filter((d) => d.syncStatus === 'failed').length;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] custom-scrollbar">
      <div className="p-6">
        <RevenueHeader
          icon={Plane}
          title="Autopilote RMS"
          subtitle="Pilotage tarifaire autonome — acceptation automatique, transmission Channel Manager, journal et rollback"
          actions={
            <button
              type="button"
              onClick={runAutopilot}
              disabled={!canRun || recommendations.length === 0}
              className={`h-9 px-3.5 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 transition-colors ${
                canRun && recommendations.length > 0
                  ? 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4" />
              Lancer l'autopilote
            </button>
          }
        />

        {/* Bandeau état */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Kpi
            label="Niveau d'automatisation"
            value={`Niveau ${automationLevel}`}
            hint={levelInfo.name}
            accent={LEVEL_ACCENT[automationLevel]}
          />
          <Kpi
            label="Activation"
            value={activationState.active ? 'Active' : 'En veille'}
            hint={activationState.reason}
            accent={activationState.active ? '#16A34A' : '#6B7280'}
          />
          <Kpi
            label="Recommandations"
            value={`${recommendations.length} en attente`}
            hint="File à traiter par l'autopilote"
            accent="#2563EB"
          />
          <Kpi
            label="Synchronisation CM"
            value={`${syncedCount} / ${decisionLog.length}`}
            hint={failedCount > 0 ? `${failedCount} échec(s) à relancer` : 'Channel Manager à jour'}
            accent={failedCount > 0 ? '#EF4444' : '#16A34A'}
          />
        </div>

        {/* Forecast Autopilote — moteur RMS Enterprise */}
        <div className="mb-5">
          <AutopilotForecastPanel daysAhead={30} />
        </div>

        {/* Flux live RMS Enterprise */}
        <div className="mb-5">
          <RmsEnterpriseFeed limit={6} />
        </div>

        {/* Stratégie directrice */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-3.5 mb-5 flex items-center gap-3 flex-wrap">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${strategy.accent}1a` }}
          >
            <strategy.icon className="w-4.5 h-4.5" style={{ color: strategy.accent }} />
          </div>
          <div className="text-[12.5px]">
            <span className="text-gray-500">Stratégie directrice exploitée par l'autopilote : </span>
            <span className="font-bold text-gray-900">{strategy.name}</span>
            <span className="text-gray-400"> — {strategy.tagline}</span>
          </div>
          {autoMode && (
            <span className="flex items-center gap-1 text-[10.5px] font-bold text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-0.5 rounded-full">
              <Wand2 className="w-3 h-3" /> Sélection automatique
            </span>
          )}
        </div>

        {/* ── Niveaux d'automatisation ─────────────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-gray-800 mb-2.5">
            <ListChecks className="w-4 h-4 text-[#8B5CF6]" />
            Niveau d'automatisation
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {AUTOMATION_LEVELS.map((lvl) => {
              const selected = lvl.level === automationLevel;
              const accent = LEVEL_ACCENT[lvl.level];
              return (
                <button
                  key={lvl.level}
                  type="button"
                  onClick={() => setAutomationLevel(lvl.level)}
                  className={`text-left rounded-2xl border p-3.5 transition-all ${
                    selected
                      ? 'border-transparent ring-2 shadow-md bg-white'
                      : 'border-gray-200/80 bg-white hover:shadow-md'
                  }`}
                  style={selected ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-extrabold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {lvl.level}
                    </span>
                    {selected && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: accent }}
                      >
                        ACTIF
                      </span>
                    )}
                  </div>
                  <div className="text-[13.5px] font-bold text-gray-900 mt-2">{lvl.name}</div>
                  <div className="text-[11.5px] text-gray-500 leading-snug mt-1">
                    {lvl.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Garde-fous ───────────────────────────────────────────────────── */}
        <div className="mb-5">
          <GuardrailsPanel />
        </div>

        {/* ── File de recommandations ──────────────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-gray-800">
              <Inbox className="w-4 h-4 text-[#8B5CF6]" />
              File de recommandations ({recommendations.length})
            </div>
            {automationLevel < 3 && recommendations.length > 0 && (
              <span className="text-[11px] text-gray-400">
                Niveau {automationLevel} — validation manuelle requise
              </span>
            )}
          </div>
          {recommendations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-[13px] font-semibold text-gray-600">
                Aucune recommandation en attente
              </p>
              <p className="text-[12px] text-gray-400">
                Toutes les recommandations tarifaires ont été traitées.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((reco) => (
                <RecommendationCard
                  key={reco.id}
                  reco={reco}
                  params={params}
                  level={automationLevel}
                  onApply={applyRecommendation}
                  onReject={rejectRecommendation}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Journal des décisions ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-gray-800 mb-2.5">
            <History className="w-4 h-4 text-[#8B5CF6]" />
            Journal des décisions — audit trail ({decisionLog.length})
          </div>
          <div className="bg-white rounded-2xl border border-gray-200/80 p-3 space-y-2">
            {decisionLog.length === 0 ? (
              <p className="text-[12px] text-gray-400 text-center py-6">
                Aucune décision automatique enregistrée.
              </p>
            ) : (
              decisionLog.map((entry) => (
                <DecisionRow
                  key={entry.id}
                  entry={entry}
                  onRollback={rollbackDecision}
                  onRetrySync={retrySync}
                />
              ))
            )}
          </div>
        </div>

        {/* Note transparence */}
        <div className="mt-5 rounded-2xl bg-white border border-gray-200/80 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div className="text-[12.5px] text-gray-500 leading-relaxed">
            Chaque décision automatique est <span className="font-semibold text-gray-700">expliquée</span>{' '}
            (facteurs, confiance IA, niveau de risque), <span className="font-semibold text-gray-700">tracée</span>{' '}
            dans le journal et <span className="font-semibold text-gray-700">réversible</span> via rollback.
            Les tarifs validés sont poussés dans le calendrier tarifaire puis transmis au Channel
            Manager — la colonne de synchronisation reflète l'état de cette transmission.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutopilotPage;
