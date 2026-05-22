/**
 * FLOWTYM RMS — Créneaux d'activation du mode automatique.
 *
 * Permet de définir quand le moteur RMS pilote la stratégie de manière
 * autonome : 24h/24, sur créneau horaire planifié, ou selon des périodes
 * spécifiques (week-ends, jours fériés, absence du RM, nuit, haute saison,
 * forte demande).
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Clock, CalendarClock, CalendarRange, Power, Moon, Sun, Sparkles,
  UserX, PartyPopper, CalendarDays,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useRmsAutomationStore,
  evaluateActivation,
  type ActivationMode,
  type ActivationContext,
  type ActivationConfig,
} from '@/src/store/rmsAutomationStore';
import type { MarketSignals } from '@/src/lib/rms/autoStrategyEngine';

export function buildActivationContext(signals: MarketSignals): ActivationContext {
  const now = new Date();
  const day = now.getDay();
  const month = now.getMonth();
  const hour = now.getHours();
  return {
    now,
    isWeekend: day === 0 || day === 6,
    isHoliday: false,
    rmAbsent: hour < 9 || hour >= 18,
    isHighSeason: month >= 5 && month <= 8,
    isHighDemand: signals.futureDemand >= 65,
  };
}

const MODE_OPTIONS: { id: ActivationMode; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'always', label: 'Permanent', hint: '24h/24 et 7j/7', icon: Power },
  { id: 'scheduled', label: 'Planifié', hint: 'Sur créneau horaire', icon: CalendarClock },
  { id: 'periods', label: 'Périodes', hint: 'Selon le contexte', icon: CalendarRange },
];

type PeriodKey = keyof ActivationConfig['periods'];

const PERIOD_OPTIONS: {
  key: PeriodKey;
  label: string;
  hint: string;
  icon: LucideIcon;
  active: (ctx: ActivationContext) => boolean;
}[] = [
  { key: 'weekends', label: 'Week-ends', hint: 'Samedi & dimanche', icon: CalendarDays, active: (c) => c.isWeekend },
  { key: 'holidays', label: 'Jours fériés', hint: 'Calendrier des fériés', icon: PartyPopper, active: (c) => c.isHoliday },
  { key: 'rmAbsence', label: 'Absence du Revenue Manager', hint: 'Hors heures de présence', icon: UserX, active: (c) => c.rmAbsent },
  { key: 'night', label: 'Nuit', hint: '22h → 7h', icon: Moon, active: (c) => c.now.getHours() >= 22 || c.now.getHours() < 7 },
  { key: 'highSeason', label: 'Haute saison', hint: 'Juin → septembre', icon: Sun, active: (c) => c.isHighSeason },
  { key: 'highDemand', label: 'Forte demande', hint: 'Demande future élevée', icon: Sparkles, active: (c) => c.isHighDemand },
];

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
      checked ? 'bg-[#8B5CF6]' : 'bg-gray-200'
    }`}
  >
    <span
      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
        checked ? 'left-[18px]' : 'left-0.5'
      }`}
    />
  </button>
);

export const ActivationSlotsPanel: React.FC = () => {
  const activation = useRmsAutomationStore((s) => s.activation);
  const signals = useRmsAutomationStore((s) => s.signals);
  const setActivation = useRmsAutomationStore((s) => s.setActivation);
  const setActivationPeriod = useRmsAutomationStore((s) => s.setActivationPeriod);

  const ctx = buildActivationContext(signals);
  const state = evaluateActivation(activation, ctx);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-4">
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
          <Clock className="w-4.5 h-4.5 text-violet-600" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-gray-900">Créneaux d'activation</h3>
          <p className="text-[12px] text-gray-500 leading-snug">
            Définit quand le moteur RMS pilote la stratégie sans intervention manuelle.
          </p>
        </div>
      </div>

      {/* Sélecteur de mode */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {MODE_OPTIONS.map((opt) => {
          const selected = activation.mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setActivation({ mode: opt.id })}
              className={`rounded-xl border p-2.5 text-left transition-all ${
                selected
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/[0.05] ring-1 ring-[#8B5CF6]'
                  : 'border-gray-200/80 hover:border-gray-300'
              }`}
            >
              <opt.icon
                className={`w-4 h-4 mb-1 ${selected ? 'text-[#8B5CF6]' : 'text-gray-400'}`}
              />
              <div className="text-[12.5px] font-bold text-gray-900">{opt.label}</div>
              <div className="text-[10.5px] text-gray-400">{opt.hint}</div>
            </button>
          );
        })}
      </div>

      {/* Mode planifié — créneau horaire */}
      {activation.mode === 'scheduled' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200/80 p-3 mb-1"
        >
          <span className="text-[12px] font-semibold text-gray-600">Créneau actif</span>
          <label className="flex items-center gap-1.5 text-[12px] text-gray-500">
            de
            <input
              type="time"
              value={activation.schedule.start}
              onChange={(e) =>
                setActivation({ schedule: { ...activation.schedule, start: e.target.value } })
              }
              className="rounded-lg border border-gray-200 px-2 py-1 text-[12.5px] font-semibold text-gray-800"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-gray-500">
            à
            <input
              type="time"
              value={activation.schedule.end}
              onChange={(e) =>
                setActivation({ schedule: { ...activation.schedule, end: e.target.value } })
              }
              className="rounded-lg border border-gray-200 px-2 py-1 text-[12.5px] font-semibold text-gray-800"
            />
          </label>
        </motion.div>
      )}

      {/* Mode périodes — liste de déclencheurs */}
      {activation.mode === 'periods' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-1.5 mb-1"
        >
          {PERIOD_OPTIONS.map((opt) => {
            const enabled = activation.periods[opt.key];
            const liveActive = enabled && opt.active(ctx);
            return (
              <div
                key={opt.key}
                className="flex items-center gap-3 rounded-xl border border-gray-200/80 px-3 py-2"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    enabled ? 'bg-[#8B5CF6]/10' : 'bg-gray-100'
                  }`}
                >
                  <opt.icon
                    className={`w-4 h-4 ${enabled ? 'text-[#8B5CF6]' : 'text-gray-400'}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-gray-800">{opt.label}</div>
                  <div className="text-[10.5px] text-gray-400">{opt.hint}</div>
                </div>
                {liveActive && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    EN COURS
                  </span>
                )}
                <Toggle
                  checked={enabled}
                  onChange={(v) => setActivationPeriod(opt.key, v)}
                />
              </div>
            );
          })}
        </motion.div>
      )}

      {/* État courant de l'activation */}
      <div
        className={`mt-3 flex items-center gap-2.5 rounded-xl p-3 ${
          state.active ? 'bg-emerald-50' : 'bg-gray-50'
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            state.active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
          }`}
        />
        <div className="text-[12px]">
          <span className={`font-bold ${state.active ? 'text-emerald-700' : 'text-gray-500'}`}>
            {state.active ? 'Automatisation active' : 'Automatisation en veille'}
          </span>
          <span className="text-gray-500"> — {state.reason}</span>
        </div>
      </div>
    </div>
  );
};
