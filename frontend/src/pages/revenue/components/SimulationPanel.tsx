/**
 * FLOWTYM Revenue — SimulationPanel
 *
 * Panneau latéral (slide-in droite) pour configurer le Mode Simulation.
 * Présente 4 sections :
 *   1. Statut (toggle activation)
 *   2. Préréglages rapides (presets démo)
 *   3. Overrides globaux (demande, pickup, canaux)
 *   4. Vue résumé des overrides par date
 *
 * Vague B — Cockpit RMS Premium.
 */

import { useState } from 'react';
import {
  X, FlaskConical, RotateCcw, Zap, AlertTriangle,
  TrendingDown, TrendingUp, Lock, Calendar,
} from 'lucide-react';
import { useSimulationStore, type SimulationPreset } from '../../../store/simulationStore';
import { cn } from '../lib/rms-theme';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Dates affichées dans la vue active (pour appliquer les presets sur la bonne plage) */
  visibleDates: string[];
}

const PRESETS: Array<{ key: SimulationPreset; label: string; icon: typeof Zap; description: string; tone: 'red' | 'green' | 'orange' | 'violet' | 'gray' }> = [
  { key: 'demand_surge',   label: 'Pic demande +40 pts',    icon: TrendingUp,    description: 'Demande boostée globalement', tone: 'green'  },
  { key: 'demand_crash',   label: 'Crash demande -30 pts',  icon: TrendingDown,  description: 'Demande effondrée globalement', tone: 'red'    },
  { key: 'booking_closed', label: 'Booking.com fermé',  icon: Lock,          description: 'Canal Booking désactivé partout', tone: 'orange' },
  { key: 'inventory_low',  label: 'Inventaire critique',    icon: AlertTriangle, description: '5 chambres restantes sur toute la période', tone: 'violet' },
  { key: 'restrictive',    label: 'Min Stay 3 + CTA WE',    icon: Calendar,      description: 'Restriction sur les weekends uniquement', tone: 'violet' },
];

const TONE_CLS: Record<string, string> = {
  red:    'border-red-200 bg-red-50 hover:bg-red-100 text-red-800',
  green:  'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800',
  orange: 'border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800',
  violet: 'border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-800',
  gray:   'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700',
};

export function SimulationPanel({ isOpen, onClose, visibleDates }: Props) {
  const {
    active, scenarioLabel, setScenarioLabel,
    globalOverride, setGlobalOverride,
    dateOverrides,
    clearOverrides, applyPreset, exitSimulation, setActive,
  } = useSimulationStore();

  const [demandShiftDraft, setDemandShiftDraft] = useState<string>(
    globalOverride.demandShift !== null && globalOverride.demandShift !== undefined
      ? String(globalOverride.demandShift) : '',
  );
  const [pickupShiftDraft, setPickupShiftDraft] = useState<string>(
    globalOverride.pickupShift !== null && globalOverride.pickupShift !== undefined
      ? String(globalOverride.pickupShift) : '',
  );

  if (!isOpen) return null;

  const nbDateOverrides = Object.keys(dateOverrides).length;
  const closedChannels = globalOverride.closedChannels ?? [];

  const toggleChannel = (channel: string) => {
    const next = closedChannels.includes(channel)
      ? closedChannels.filter(c => c !== channel)
      : [...closedChannels, channel];
    setGlobalOverride('closedChannels', next.length === 0 ? undefined : next);
  };

  const commitDemandShift = () => {
    const n = demandShiftDraft.trim() === '' ? null : parseFloat(demandShiftDraft);
    setGlobalOverride('demandShift', n !== null && isFinite(n) ? n : null);
  };

  const commitPickupShift = () => {
    const n = pickupShiftDraft.trim() === '' ? null : parseFloat(pickupShiftDraft);
    setGlobalOverride('pickupShift', n !== null && isFinite(n) ? n : null);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-white/20 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide">Mode Simulation</h2>
              <p className="text-[11px] text-orange-100">Tester des sc&eacute;narios sans toucher au planning r&eacute;el</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 bg-gray-50/50">

          {/* Section 1: Statut */}
          <section className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">Statut</h3>
              <button
                onClick={() => setActive(!active)}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  active ? 'bg-orange-500' : 'bg-gray-300',
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  active ? 'translate-x-4' : 'translate-x-0.5',
                )} />
              </button>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {active
                ? <>Le RMS utilise actuellement des <strong>donn&eacute;es simul&eacute;es</strong>. D&eacute;sactivez pour revenir aux donn&eacute;es r&eacute;elles.</>
                : <>Activez pour basculer en mode simulation. Les overrides ci-dessous ne seront appliqu&eacute;s qu&apos;en mode actif.</>
              }
            </p>

            {/* Label scénario */}
            <div className="mt-3">
              <label className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 block mb-1">
                Libell&eacute; sc&eacute;nario
              </label>
              <input
                type="text"
                value={scenarioLabel}
                onChange={e => setScenarioLabel(e.target.value)}
                placeholder="Ex: Pic Roland Garros, Crash post-COVID..."
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
              />
            </div>
          </section>

          {/* Section 2: Préréglages */}
          <section className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">Pr&eacute;r&eacute;glages</h3>
              <button
                onClick={clearOverrides}
                className="text-[11px] text-gray-500 hover:text-orange-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                R&eacute;initialiser
              </button>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {PRESETS.map(p => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p.key, visibleDates)}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded-md border text-left transition-colors',
                      TONE_CLS[p.tone],
                    )}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{p.label}</div>
                      <div className="text-[10px] opacity-80 leading-snug">{p.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 3: Overrides globaux */}
          <section className="bg-white rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3">Surcharges globales</h3>

            {/* Demand shift */}
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 block mb-1">
                Demande march&eacute; (delta en points)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={demandShiftDraft}
                  onChange={e => setDemandShiftDraft(e.target.value)}
                  onBlur={commitDemandShift}
                  placeholder="Ex: -20 ou +30"
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <span className="text-xs text-gray-400">pts</span>
              </div>
              {globalOverride.demandShift !== null && globalOverride.demandShift !== undefined && (
                <div className={cn(
                  'text-[10px] mt-1',
                  globalOverride.demandShift > 0 ? 'text-emerald-700' : 'text-red-700',
                )}>
                  {globalOverride.demandShift > 0 ? '+' : ''}{globalOverride.demandShift} pts appliqu&eacute;s &agrave; toutes les dates
                </div>
              )}
            </div>

            {/* Pickup shift */}
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 block mb-1">
                Pickup (delta en points)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={pickupShiftDraft}
                  onChange={e => setPickupShiftDraft(e.target.value)}
                  onBlur={commitPickupShift}
                  placeholder="Ex: -10 ou +15"
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <span className="text-xs text-gray-400">pts</span>
              </div>
            </div>

            {/* Channels */}
            <div>
              <label className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 block mb-1.5">
                Canaux ferm&eacute;s
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['booking', 'expedia', 'direct', 'hotelbeds'].map(ch => {
                  const closed = closedChannels.includes(ch);
                  return (
                    <button
                      key={ch}
                      onClick={() => toggleChannel(ch)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border transition-colors',
                        closed
                          ? 'bg-orange-100 text-orange-800 border-orange-300'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                      )}
                    >
                      {closed && <Lock className="w-2.5 h-2.5" />}
                      {ch}
                    </button>
                  );
                })}
              </div>
              {closedChannels.length > 0 && (
                <div className="text-[10px] text-orange-700 mt-1.5">
                  {closedChannels.length} canal{closedChannels.length > 1 ? 'aux' : ''} ferm&eacute;{closedChannels.length > 1 ? 's' : ''} sur toute la p&eacute;riode
                </div>
              )}
            </div>
          </section>

          {/* Section 4: Résumé overrides par date */}
          <section className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">Surcharges par date</h3>
              <span className="text-[10px] text-gray-500">{nbDateOverrides} date{nbDateOverrides > 1 ? 's' : ''}</span>
            </div>
            {nbDateOverrides === 0 ? (
              <p className="text-xs text-gray-400 italic">
                Aucune surcharge par date. Les overrides par date se font directement depuis la table RMS (Vague C).
              </p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {Object.entries(dateOverrides).map(([date, ov]) => (
                  <li key={date} className="flex items-center justify-between text-xs px-2 py-1 bg-gray-50 rounded">
                    <span className="font-mono text-gray-700">{date}</span>
                    <span className="text-[10px] text-gray-500">
                      {Object.entries(ov).filter(([, v]) => v !== null && v !== undefined).length} champ(s)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-gray-200 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={exitSimulation}
            className="text-xs text-gray-500 hover:text-red-700 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Tout effacer &amp; quitter
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600"
          >
            Fermer
          </button>
        </div>
      </div>
    </>
  );
}
