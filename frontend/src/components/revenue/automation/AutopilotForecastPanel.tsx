/**
 * FLOWTYM — Forecast Autopilote
 *
 * Génère une projection sur N jours (30 par défaut) en exécutant le moteur
 * RMS Enterprise (`rmsRuleEvaluator.evaluate`) pour chaque date :
 *
 *   - Contexte marché dérivé : événements Paris, occupation simulée, prix base
 *   - Pipeline : règles → conflits → garde-fous → reco finale
 *   - Affichage : tableau jour par jour avec règles déclenchées et statut autopilote
 *
 * Permet de lancer un push effectif vers le Channel Manager pour les
 * recommandations validées (boutons "Tout pousser" et "Rollback").
 */
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Plane, Play, RotateCcw, Calendar, Shield, Zap, AlertCircle,
  CheckCircle2, Clock, ArrowRight,
} from 'lucide-react';
import { rmsRuleEvaluator, type FinalRecommendation } from '@/src/services/revenue/rmsRuleEvaluator';
import { tacticalRulesEngine } from '@/src/services/revenue/tacticalRulesEngine';
import { getEventsForDate } from '@/src/data/rms/events';
import type { MarketContext } from '@/src/types/revenue/tacticalRules.types';
import { cn } from '@/src/lib/utils';

interface DayForecast {
  date: string;             // YYYY-MM-DD
  weekday: string;
  basePrice: number;
  previousPrice: number;
  events: string[];
  result: FinalRecommendation;
}

function startOfTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Construit un MarketContext dérivé pour une date donnée. La logique est
 * volontairement simple — elle peut être enrichie quand on aura un store
 * Lighthouse / occupation prévisionnelle exposé jour par jour.
 */
function deriveContext(date: string, baselineCtx: MarketContext): MarketContext {
  const events = getEventsForDate(date);
  const hasMajorEvent = events.some((e) => e.impact === 'high');
  const d = new Date(date);
  const isWeekend = d.getDay() === 5 || d.getDay() === 6;
  const daysOut = Math.max(1, Math.round((d.getTime() - Date.now()) / 86_400_000));

  // Occupation simulée : monte progressivement à l'approche de la date,
  // bonus si événement, bonus weekend.
  const occBase = 50 + (30 / Math.max(1, daysOut)) * 8;
  const occupancy = Math.min(98, Math.round(
    occBase + (hasMajorEvent ? 25 : 0) + (isWeekend ? 12 : 0),
  ));

  const pressure: MarketContext['marketPressure'] =
    occupancy > 88 ? 'extreme'
    : occupancy > 75 ? 'high'
    : occupancy > 55 ? 'medium'
    : 'low';

  return {
    ...baselineCtx,
    occupancy,
    pickup24h: isWeekend || hasMajorEvent ? baselineCtx.pickupAverage * 2 : baselineCtx.pickupAverage,
    marketPressure: pressure,
    hasMajorEvent,
    daysUntilStay: daysOut,
  };
}

export interface AutopilotForecastPanelProps {
  /** Nombre de jours projetés (30 par défaut). */
  daysAhead?: number;
  /** Prix de base par défaut si aucun calendrier connecté. */
  defaultBasePrice?: number;
}

export const AutopilotForecastPanel: React.FC<AutopilotForecastPanelProps> = ({
  daysAhead = 30,
  defaultBasePrice = 150,
}) => {
  // Re-render quand les engines bougent — snapshot stable via version().
  useSyncExternalStore(
    (cb) => tacticalRulesEngine.subscribe(cb),
    () => tacticalRulesEngine.version(),
    () => tacticalRulesEngine.version(),
  );

  const [autopilot, setAutopilot] = useState(false);
  const [basePrice, setBasePrice] = useState(defaultBasePrice);
  const [pushed, setPushed] = useState<Set<string>>(new Set());

  const forecast = useMemo<DayForecast[]>(() => {
    const baseline = tacticalRulesEngine.getContext();
    const start = startOfTomorrow();
    const rows: DayForecast[] = [];
    let previousPrice = basePrice;
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const date = isoDate(d);
      const ctx = deriveContext(date, baseline);
      const events = getEventsForDate(date).map((e) => e.name);

      const result = rmsRuleEvaluator.evaluate({
        autopilot: false, // génération de prévision = jamais push réel
        context: ctx,
        basePrice,
        previousPrice,
        date,
        silent: true, // ne pas inonder l'audit + bus avec 30 logs/évaluation
      });

      rows.push({
        date,
        weekday: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        basePrice,
        previousPrice,
        events,
        result,
      });
      previousPrice = result.recommendedPrice;
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePrice, daysAhead]);

  const stats = useMemo(() => {
    let up = 0, down = 0, blocked = 0, eventDays = 0;
    forecast.forEach((d) => {
      if (d.result.recommendedPrice > d.result.basePrice) up++;
      else if (d.result.recommendedPrice < d.result.basePrice) down++;
      if (d.result.guardrails.triggered.some((t) => t.outcome === 'blocked')) blocked++;
      if (d.events.length > 0) eventDays++;
    });
    return { up, down, blocked, eventDays };
  }, [forecast]);

  const pushOne = (day: DayForecast) => {
    rmsRuleEvaluator.evaluate({
      autopilot: true,
      context: deriveContext(day.date, tacticalRulesEngine.getContext()),
      basePrice: day.basePrice,
      previousPrice: day.previousPrice,
      date: day.date,
    });
    setPushed((s) => new Set([...s, day.date]));
  };

  const pushAll = () => {
    forecast
      .filter((d) => !d.result.needsHumanValidation || autopilot)
      .forEach(pushOne);
  };

  const rollback = (date: string) => {
    rmsRuleEvaluator.rollback(date);
    setPushed((s) => {
      const next = new Set(s);
      next.delete(date);
      return next;
    });
  };

  return (
    <section className="bg-white rounded-2xl border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-5">
      <header className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-[#8B5CF6] text-white shadow shadow-[#8B5CF6]/30">
            <Plane size={18} />
          </div>
          <div>
            <h4 className="text-[15px] font-bold text-gray-900">
              Forecast Autopilote — {daysAhead} prochains jours
            </h4>
            <p className="text-[12px] text-gray-500">
              Recommandations générées par le moteur RMS Enterprise sur la base de la stratégie active,
              des règles tactiques, des garde-fous et des événements Paris.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 block">Prix base</label>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(Math.max(1, Number(e.target.value)))}
              className="w-24 px-2 py-1.5 text-[13px] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-gray-700 cursor-pointer">
            <span>Autopilote</span>
            <button
              type="button"
              onClick={() => setAutopilot((v) => !v)}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors',
                autopilot ? 'bg-[#8B5CF6]' : 'bg-gray-300',
              )}
              aria-pressed={autopilot}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                autopilot ? 'translate-x-[18px]' : 'translate-x-[2px]',
              )} />
            </button>
          </label>
          <button
            type="button"
            onClick={pushAll}
            disabled={!autopilot}
            className={cn(
              'flex items-center gap-1.5 text-[12px] font-semibold rounded-xl px-3 py-1.5 shadow-sm',
              autopilot
                ? 'text-white bg-[#8B5CF6] hover:bg-[#7C3AED]'
                : 'text-gray-400 bg-gray-100 cursor-not-allowed',
            )}
          >
            <Play size={12} /> Tout pousser ({daysAhead})
          </button>
        </div>
      </header>

      {/* KPI compacts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Tile label="↑ Hausses" value={stats.up} tone="positive" />
        <Tile label="↓ Baisses" value={stats.down} tone="warning" />
        <Tile label="Bloqués" value={stats.blocked} tone={stats.blocked > 0 ? 'danger' : 'neutral'} />
        <Tile label="Événements" value={stats.eventDays} tone="info" />
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-[12.5px]">
          <thead className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#F3F4F6]">
            <tr>
              <th className="py-2 text-left font-semibold">Date</th>
              <th className="py-2 text-left font-semibold">Événements</th>
              <th className="py-2 text-left font-semibold">Règles fired</th>
              <th className="py-2 text-left font-semibold">Garde-fous</th>
              <th className="py-2 text-right font-semibold">Prix</th>
              <th className="py-2 text-right font-semibold">Statut</th>
              <th className="py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((day) => {
              const isPushed = pushed.has(day.date);
              const blockedGr = day.result.guardrails.triggered.find((t) => t.outcome === 'blocked');
              const delta = day.result.recommendedPrice - day.result.basePrice;
              return (
                <tr
                  key={day.date}
                  className={cn(
                    'border-b border-[#F3F4F6] hover:bg-[#FBFBFC]',
                    isPushed && 'bg-emerald-50/30',
                  )}
                >
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-gray-900">
                      {day.weekday} {new Date(day.date).getDate()}
                    </div>
                    <div className="text-[10px] text-gray-500">{day.date}</div>
                  </td>
                  <td className="py-2 pr-3 max-w-[180px]">
                    {day.events.length === 0 ? (
                      <span className="text-gray-300 text-[11px]">—</span>
                    ) : (
                      <span className="text-[11px] text-rose-600 font-medium truncate block" title={day.events.join(', ')}>
                        <Calendar size={10} className="inline mr-1" />{day.events[0]}
                        {day.events.length > 1 && ` +${day.events.length - 1}`}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {day.result.appliedRules.length === 0 ? (
                      <span className="text-gray-300 text-[11px]">—</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-violet-700 font-medium" title={day.result.appliedRules.map((r) => r.ruleName).join(', ')}>
                        <Zap size={10} />
                        {day.result.appliedRules.length} règle(s)
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {day.result.guardrails.triggered.length === 0 ? (
                      <span className="text-gray-300 text-[11px]">—</span>
                    ) : (
                      <span className={cn(
                        'flex items-center gap-1 text-[11px] font-medium',
                        blockedGr ? 'text-rose-600' : 'text-amber-600',
                      )} title={day.result.guardrails.triggered.map((t) => t.guardrail.name).join(', ')}>
                        <Shield size={10} />
                        {day.result.guardrails.triggered.length}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="font-bold text-gray-900">{day.result.recommendedPrice}€</div>
                    <div className={cn(
                      'text-[10px]',
                      delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-gray-400',
                    )}>
                      {delta > 0 ? '+' : ''}{delta}€
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {isPushed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10} /> Poussé
                      </span>
                    ) : blockedGr ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                        <AlertCircle size={10} /> Bloqué
                      </span>
                    ) : day.result.needsHumanValidation ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Clock size={10} /> Validation
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                        Prêt
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {isPushed ? (
                      <button
                        onClick={() => rollback(day.date)}
                        className="text-[11px] font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 inline-flex items-center gap-1"
                      >
                        <RotateCcw size={10} /> Rollback
                      </button>
                    ) : (
                      <button
                        onClick={() => pushOne(day)}
                        disabled={!!blockedGr}
                        className={cn(
                          'text-[11px] font-semibold px-2 py-1 rounded-lg border inline-flex items-center gap-1',
                          blockedGr
                            ? 'text-gray-400 border-gray-100 cursor-not-allowed'
                            : 'text-[#8B5CF6] hover:bg-violet-50 border-violet-100',
                        )}
                      >
                        <ArrowRight size={10} /> Pousser
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const Tile: React.FC<{ label: string; value: React.ReactNode; tone?: 'positive' | 'warning' | 'danger' | 'info' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => {
  const cls =
    tone === 'positive' ? 'bg-emerald-50 text-emerald-700'
    : tone === 'warning' ? 'bg-amber-50 text-amber-700'
    : tone === 'danger' ? 'bg-rose-50 text-rose-700'
    : tone === 'info' ? 'bg-violet-50 text-violet-700'
    : 'bg-[#FAFAFB] text-gray-700';
  return (
    <div className={cn('rounded-xl px-3 py-2', cls)}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-[18px] font-bold mt-0.5">{value}</div>
    </div>
  );
};
