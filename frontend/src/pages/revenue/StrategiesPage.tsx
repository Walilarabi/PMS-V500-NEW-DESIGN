/**
 * FLOWTYM RMS — Stratégies tarifaires.
 *
 * Pilotage du positionnement RMS de l'établissement : choix d'une
 * stratégie tarifaire directrice, ou délégation au mode Automatique qui
 * sélectionne dynamiquement la stratégie la plus pertinente parmi les 7
 * disponibles selon les signaux marché temps réel.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Target, Check, Gauge, Wand2, RefreshCw, TrendingUp, Sparkles,
} from 'lucide-react';
import { RevenueHeader } from '../../components/revenue/RevenueHeader';
import { STRATEGIES, STRATEGY_BY_ID } from '@/src/lib/rms/strategies';
import { useRmsAutomationStore } from '@/src/store/rmsAutomationStore';
import { ActivationSlotsPanel } from '@/src/components/rms/automation/ActivationSlotsPanel';
import { MarketSignalsGrid } from '@/src/components/rms/automation/MarketSignalsGrid';

const TONE_CLASS: Record<'up' | 'down' | 'flat', string> = {
  up: 'text-emerald-600',
  down: 'text-red-500',
  flat: 'text-gray-400',
};

const IMPACT_CLASS: Record<'positive' | 'neutral' | 'negative', string> = {
  positive: 'text-emerald-600',
  neutral: 'text-gray-400',
  negative: 'text-red-500',
};

export const StrategiesPage: React.FC = () => {
  const activeId = useRmsAutomationStore((s) => s.activeStrategyId);
  const autoMode = useRmsAutomationStore((s) => s.autoMode);
  const signals = useRmsAutomationStore((s) => s.signals);
  const autoResult = useRmsAutomationStore((s) => s.autoResult);
  const setActiveStrategy = useRmsAutomationStore((s) => s.setActiveStrategy);
  const setAutoMode = useRmsAutomationStore((s) => s.setAutoMode);
  const refreshSignals = useRmsAutomationStore((s) => s.refreshSignals);

  const active = STRATEGY_BY_ID[activeId] ?? STRATEGIES[2];
  const highlightKeys = autoResult.factors.map((f) => f.key);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] custom-scrollbar">
      <div className="p-6">
        <RevenueHeader
          icon={Target}
          title="Stratégies tarifaires"
          subtitle="Pilotez le positionnement RMS — manuellement ou via le mode Automatique qui adapte la stratégie en temps réel"
        />

        {/* Bandeau stratégie active */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl p-5 mb-5 text-white shadow-lg"
          style={{ background: `linear-gradient(120deg, ${active.accent}, ${active.accent}cc)` }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <active.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-white/70">
                  Stratégie active
                  {autoMode && (
                    <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full normal-case tracking-normal">
                      <Wand2 className="w-3 h-3" /> Mode automatique
                    </span>
                  )}
                </div>
                <div className="text-[20px] font-extrabold leading-tight">{active.name}</div>
                <div className="text-[13px] text-white/80">{active.tagline}</div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              {active.metrics.map((m) => (
                <div key={m.label} className="text-center">
                  <div className="text-[11px] font-medium text-white/70">{m.label}</div>
                  <div className="text-[17px] font-extrabold">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Mode Automatique ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200/80 bg-white mb-5 overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center shrink-0">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-gray-900">Mode Automatique</h2>
                {autoMode && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    ACTIF
                  </span>
                )}
              </div>
              <p className="text-[12px] text-gray-500 leading-snug">
                Le moteur RMS sélectionne dynamiquement la stratégie la plus pertinente parmi
                les 7 disponibles, selon 12 signaux marché temps réel.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoMode}
              onClick={() => setAutoMode(!autoMode)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                autoMode ? 'bg-[#8B5CF6]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  autoMode ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {autoMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-gray-100"
              >
                <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Décision du moteur */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${active.accent}1a` }}
                          >
                            <active.icon className="w-5 h-5" style={{ color: active.accent }} />
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                              Stratégie sélectionnée par le moteur
                            </div>
                            <div className="text-[16px] font-extrabold text-gray-900">
                              {active.name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-gray-400 font-medium">Confiance IA</div>
                          <div className="text-[20px] font-extrabold text-[#8B5CF6]">
                            {autoResult.confidence} %
                          </div>
                        </div>
                      </div>

                      {/* Facteurs déterminants */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                          <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          Facteurs ayant influencé la décision
                        </div>
                        {autoResult.factors.slice(0, 4).map((f) => (
                          <div
                            key={f.key}
                            className="flex items-center gap-2 bg-white/70 rounded-lg px-2.5 py-1.5"
                          >
                            <span className="text-[11.5px] font-semibold text-gray-700 w-32 shrink-0">
                              {f.label}
                            </span>
                            <span className={`text-[11.5px] font-bold ${IMPACT_CLASS[f.impact]}`}>
                              {f.display}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#8B5CF6]"
                                style={{ width: `${Math.min(100, f.weight * 1.4)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Classement des stratégies */}
                    <div className="rounded-xl border border-gray-200/80 p-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 mb-2">
                        <TrendingUp className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        Pertinence des 7 stratégies
                      </div>
                      <div className="space-y-1">
                        {autoResult.ranking.map((r) => {
                          const meta = STRATEGY_BY_ID[r.id];
                          const isWinner = r.id === autoResult.selected;
                          return (
                            <div key={r.id} className="flex items-center gap-2">
                              <span
                                className={`text-[11.5px] w-28 shrink-0 ${
                                  isWinner ? 'font-bold text-gray-900' : 'text-gray-500'
                                }`}
                              >
                                {meta.name}
                              </span>
                              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${r.score}%`,
                                    backgroundColor: isWinner ? meta.accent : '#D1D5DB',
                                  }}
                                />
                              </div>
                              <span
                                className={`text-[11px] w-8 text-right ${
                                  isWinner ? 'font-bold text-gray-900' : 'text-gray-400'
                                }`}
                              >
                                {r.score}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Signaux marché temps réel */}
                    <div className="rounded-xl border border-gray-200/80 p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                          <Gauge className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          Signaux marché temps réel
                        </div>
                        <button
                          type="button"
                          onClick={refreshSignals}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#8B5CF6] hover:text-[#7C3AED]"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
                        </button>
                      </div>
                      <MarketSignalsGrid signals={signals} highlightKeys={highlightKeys} columns={4} />
                    </div>
                  </div>

                  {/* Créneaux d'activation */}
                  <div>
                    <ActivationSlotsPanel />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Grille des stratégies */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {STRATEGIES.map((strategy, i) => {
            const isActive = strategy.id === activeId;
            const isAutoPick = autoMode && strategy.id === autoResult.selected;
            return (
              <motion.div
                key={strategy.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * i }}
                className={`bg-white rounded-2xl border p-4 flex flex-col transition-all ${
                  isActive
                    ? 'border-transparent ring-2 shadow-md'
                    : 'border-gray-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md'
                }`}
                style={isActive ? { boxShadow: `0 0 0 2px ${strategy.accent}` } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${strategy.accent}1a` }}
                  >
                    <strategy.icon className="w-5 h-5" style={{ color: strategy.accent }} />
                  </div>
                  {isActive && (
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded-full text-white flex items-center gap-1"
                      style={{ backgroundColor: strategy.accent }}
                    >
                      {isAutoPick && <Wand2 className="w-3 h-3" />}
                      {isAutoPick ? 'AUTO' : 'ACTIVE'}
                    </span>
                  )}
                </div>

                <h3 className="text-[15px] font-bold text-gray-900 mt-3">{strategy.name}</h3>
                <p className="text-[12px] font-semibold" style={{ color: strategy.accent }}>
                  {strategy.tagline}
                </p>
                <p className="text-[12px] text-gray-500 leading-snug mt-2 flex-1">
                  {strategy.description}
                </p>

                <div className="mt-3 space-y-1.5">
                  {strategy.params.map((p) => (
                    <div key={p.label} className="flex items-center justify-between text-[11.5px]">
                      <span className="text-gray-400">{p.label}</span>
                      <span className="font-semibold text-gray-700">{p.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  {strategy.metrics.map((m) => (
                    <div key={m.label} className="text-center">
                      <div className="text-[10px] text-gray-400">{m.label}</div>
                      <div className={`text-[12.5px] font-bold ${TONE_CLASS[m.tone]}`}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveStrategy(strategy.id)}
                  disabled={isActive && !autoMode}
                  className={`mt-3 h-9 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    isActive && !autoMode
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED]'
                  }`}
                >
                  {isActive && !autoMode ? (
                    <>
                      <Check className="w-4 h-4" /> Stratégie appliquée
                    </>
                  ) : autoMode ? (
                    'Passer en manuel sur cette stratégie'
                  ) : (
                    'Activer cette stratégie'
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Note d'exploitation */}
        <div className="mt-6 rounded-2xl bg-white border border-gray-200/80 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Gauge className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div className="text-[12.5px] text-gray-500 leading-relaxed">
            La stratégie active — choisie manuellement ou par le mode Automatique — alimente{' '}
            <span className="font-semibold text-gray-700">Pricing &amp; Recommandations</span>,{' '}
            <span className="font-semibold text-gray-700">l'Autopilote RMS</span>, la{' '}
            <span className="font-semibold text-gray-700">Simulation</span> et le{' '}
            <span className="font-semibold text-gray-700">Dashboard</span>. En mode Automatique,
            chaque variation des signaux marché peut déclencher un changement de stratégie.
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategiesPage;
