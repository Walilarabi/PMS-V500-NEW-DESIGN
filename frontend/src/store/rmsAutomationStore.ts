/**
 * FLOWTYM RMS — Store d'automatisation tarifaire.
 *
 * État partagé entre la page Stratégies (mode automatique + créneaux
 * d'activation) et la page Autopilote RMS (niveaux d'automatisation,
 * garde-fous, file de recommandations, journal de décisions).
 */

import { create } from 'zustand';
import {
  selectStrategy,
  evaluateRecommendation,
  type MarketSignals,
  type AutoStrategyResult,
  type PriceRecommendation,
  type AutopilotParams,
  type RiskLevel,
} from '@/src/lib/rms/autoStrategyEngine';
import type { StrategyId } from '@/src/lib/rms/strategies';
import {
  INITIAL_SIGNALS,
  INITIAL_RECOMMENDATIONS,
  INITIAL_DECISION_LOG,
  DEFAULT_AUTOPILOT_PARAMS,
  DEFAULT_ACTIVATION,
} from '@/src/data/rms/mockAutomationData';

// ─── Créneaux d'activation ──────────────────────────────────────────────────

export type ActivationMode = 'always' | 'scheduled' | 'periods';

export interface ActivationConfig {
  mode: ActivationMode;
  /** Plage horaire (HH:MM) en mode planifié. */
  schedule: { start: string; end: string };
  periods: {
    weekends: boolean;
    holidays: boolean;
    rmAbsence: boolean;
    night: boolean;
    highSeason: boolean;
    highDemand: boolean;
  };
}

export interface ActivationContext {
  now: Date;
  isWeekend: boolean;
  isHoliday: boolean;
  rmAbsent: boolean;
  isHighSeason: boolean;
  isHighDemand: boolean;
}

export interface ActivationState {
  active: boolean;
  reason: string;
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function parseHHMM(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Détermine si l'automatisation doit tourner dans le contexte courant. */
export function evaluateActivation(cfg: ActivationConfig, ctx: ActivationContext): ActivationState {
  if (cfg.mode === 'always') {
    return { active: true, reason: 'Activation permanente 24h/24' };
  }

  if (cfg.mode === 'scheduled') {
    const now = minutesOfDay(ctx.now);
    const start = parseHHMM(cfg.schedule.start);
    const end = parseHHMM(cfg.schedule.end);
    const within = start <= end ? now >= start && now < end : now >= start || now < end;
    return within
      ? { active: true, reason: `Créneau planifié ${cfg.schedule.start}–${cfg.schedule.end}` }
      : { active: false, reason: `Hors créneau planifié (${cfg.schedule.start}–${cfg.schedule.end})` };
  }

  // mode === 'periods'
  const hour = ctx.now.getHours();
  const isNight = hour >= 22 || hour < 7;
  const triggers: string[] = [];
  if (cfg.periods.weekends && ctx.isWeekend) triggers.push('week-end');
  if (cfg.periods.holidays && ctx.isHoliday) triggers.push('jour férié');
  if (cfg.periods.rmAbsence && ctx.rmAbsent) triggers.push('absence Revenue Manager');
  if (cfg.periods.night && isNight) triggers.push('nuit');
  if (cfg.periods.highSeason && ctx.isHighSeason) triggers.push('haute saison');
  if (cfg.periods.highDemand && ctx.isHighDemand) triggers.push('forte demande');

  return triggers.length > 0
    ? { active: true, reason: `Période active : ${triggers.join(', ')}` }
    : { active: false, reason: 'Aucune période d\'activation remplie' };
}

// ─── Niveaux d'automatisation ───────────────────────────────────────────────

export type AutomationLevel = 1 | 2 | 3 | 4;

export interface AutomationLevelInfo {
  level: AutomationLevel;
  name: string;
  short: string;
  description: string;
}

export const AUTOMATION_LEVELS: AutomationLevelInfo[] = [
  {
    level: 1,
    name: 'Suggestion uniquement',
    short: 'Suggestion',
    description: "Le RMS recommande, mais aucune action n'est appliquée automatiquement.",
  },
  {
    level: 2,
    name: 'Validation assistée',
    short: 'Assisté',
    description: 'Les recommandations sont pré-validées et nécessitent une confirmation humaine.',
  },
  {
    level: 3,
    name: 'Autopilote partiel',
    short: 'Partiel',
    description: 'Automatisation sur les recommandations conformes à tous les garde-fous.',
  },
  {
    level: 4,
    name: 'Autopilote total',
    short: 'Total',
    description: 'Le RMS gère les prix et pousse les décisions vers le Channel Manager.',
  },
];

// ─── Journal de décisions ───────────────────────────────────────────────────

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  stayDate: string;
  roomType: string;
  channel: string;
  oldPrice: number;
  newPrice: number;
  strategy: StrategyId;
  confidence: number;
  risk: RiskLevel;
  impact: { revpar: number; adr: number; occ: number };
  factors: string[];
  level: AutomationLevel;
  status: 'applied' | 'rejected' | 'rolled_back';
  syncStatus: SyncStatus;
  /** `decision` = ajustement tarifaire, `rollback` = annulation d'une décision. */
  kind: 'decision' | 'rollback';
  note?: string;
}

// ─── État du store ──────────────────────────────────────────────────────────

interface RmsAutomationState {
  activeStrategyId: StrategyId;
  autoMode: boolean;
  signals: MarketSignals;
  autoResult: AutoStrategyResult;
  activation: ActivationConfig;
  automationLevel: AutomationLevel;
  params: AutopilotParams;
  recommendations: PriceRecommendation[];
  decisionLog: DecisionLogEntry[];

  setActiveStrategy: (id: StrategyId) => void;
  setAutoMode: (on: boolean) => void;
  refreshSignals: () => void;
  setActivation: (patch: Partial<ActivationConfig>) => void;
  setActivationPeriod: (key: keyof ActivationConfig['periods'], value: boolean) => void;
  setAutomationLevel: (level: AutomationLevel) => void;
  updateParams: (patch: Partial<AutopilotParams>) => void;
  applyRecommendation: (id: string) => void;
  rejectRecommendation: (id: string) => void;
  rollbackDecision: (id: string) => void;
  runAutopilot: () => void;
  retrySync: (id: string) => void;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Applique une fluctuation aléatoire bornée à un signal. */
function jitter(value: number, amplitude: number, min: number, max: number): number {
  const next = value + (Math.random() - 0.5) * 2 * amplitude;
  return Math.round(Math.min(max, Math.max(min, next)));
}

function jitterSignals(s: MarketSignals): MarketSignals {
  return {
    occupancy: jitter(s.occupancy, 6, 0, 100),
    pickup: jitter(s.pickup, 10, 0, 100),
    leadTime: jitter(s.leadTime, 4, 1, 60),
    marketPressure: jitter(s.marketPressure, 9, 0, 100),
    eventIntensity: jitter(s.eventIntensity, 8, 0, 100),
    compsetTrend: jitter(s.compsetTrend, 12, -100, 100),
    bookingPace: jitter(s.bookingPace, 12, -100, 100),
    segmentMix: jitter(s.segmentMix, 6, 0, 100),
    historyIndex: jitter(s.historyIndex, 5, 0, 100),
    futureDemand: jitter(s.futureDemand, 9, 0, 100),
    otaTrend: jitter(s.otaTrend, 11, -100, 100),
    marketCompression: jitter(s.marketCompression, 10, 0, 100),
  };
}

function syncToChannelManager(id: string) {
  // Simule le délai de transmission vers le Channel Manager.
  window.setTimeout(() => {
    useRmsAutomationStore.setState((state) => ({
      decisionLog: state.decisionLog.map((e) =>
        e.id === id && e.syncStatus === 'syncing' ? { ...e, syncStatus: 'synced' } : e,
      ),
    }));
  }, 1600);
}

function logFromRecommendation(
  reco: PriceRecommendation,
  level: AutomationLevel,
): DecisionLogEntry {
  return {
    id: newId('dec'),
    timestamp: new Date().toISOString(),
    stayDate: reco.stayDate,
    roomType: reco.roomType,
    channel: reco.channel,
    oldPrice: reco.currentPrice,
    newPrice: reco.recommendedPrice,
    strategy: reco.strategy,
    confidence: reco.confidence,
    risk: reco.risk,
    impact: reco.impact,
    factors: reco.factors,
    level,
    status: 'applied',
    syncStatus: 'syncing',
    kind: 'decision',
  };
}

export const useRmsAutomationStore = create<RmsAutomationState>((set, get) => ({
  activeStrategyId: 'balanced',
  autoMode: false,
  signals: INITIAL_SIGNALS,
  autoResult: selectStrategy(INITIAL_SIGNALS),
  activation: DEFAULT_ACTIVATION,
  automationLevel: 1,
  params: DEFAULT_AUTOPILOT_PARAMS,
  recommendations: INITIAL_RECOMMENDATIONS,
  decisionLog: INITIAL_DECISION_LOG,

  setActiveStrategy: (id) => set({ activeStrategyId: id, autoMode: false }),

  setAutoMode: (on) => {
    const { autoResult } = get();
    set({
      autoMode: on,
      activeStrategyId: on ? autoResult.selected : get().activeStrategyId,
    });
  },

  refreshSignals: () => {
    const signals = jitterSignals(get().signals);
    const autoResult = selectStrategy(signals);
    set((state) => ({
      signals,
      autoResult,
      activeStrategyId: state.autoMode ? autoResult.selected : state.activeStrategyId,
    }));
  },

  setActivation: (patch) => set((state) => ({ activation: { ...state.activation, ...patch } })),

  setActivationPeriod: (key, value) =>
    set((state) => ({
      activation: { ...state.activation, periods: { ...state.activation.periods, [key]: value } },
    })),

  setAutomationLevel: (level) => set({ automationLevel: level }),

  updateParams: (patch) => set((state) => ({ params: { ...state.params, ...patch } })),

  applyRecommendation: (id) => {
    const { recommendations, automationLevel } = get();
    const reco = recommendations.find((r) => r.id === id);
    if (!reco) return;
    const entry = logFromRecommendation(reco, automationLevel);
    set((state) => ({
      recommendations: state.recommendations.filter((r) => r.id !== id),
      decisionLog: [entry, ...state.decisionLog],
    }));
    syncToChannelManager(entry.id);
  },

  rejectRecommendation: (id) => {
    const { recommendations, automationLevel } = get();
    const reco = recommendations.find((r) => r.id === id);
    if (!reco) return;
    const entry: DecisionLogEntry = {
      ...logFromRecommendation(reco, automationLevel),
      status: 'rejected',
      syncStatus: 'pending',
    };
    set((state) => ({
      recommendations: state.recommendations.filter((r) => r.id !== id),
      decisionLog: [entry, ...state.decisionLog],
    }));
  },

  rollbackDecision: (id) => {
    const entry = get().decisionLog.find((e) => e.id === id);
    if (!entry || entry.status !== 'applied' || entry.kind !== 'decision') return;
    const rollback: DecisionLogEntry = {
      id: newId('rbk'),
      timestamp: new Date().toISOString(),
      stayDate: entry.stayDate,
      roomType: entry.roomType,
      channel: entry.channel,
      oldPrice: entry.newPrice,
      newPrice: entry.oldPrice,
      strategy: entry.strategy,
      confidence: entry.confidence,
      risk: entry.risk,
      impact: { revpar: -entry.impact.revpar, adr: -entry.impact.adr, occ: -entry.impact.occ },
      factors: [`Rollback de la décision ${entry.id}`],
      level: entry.level,
      status: 'applied',
      syncStatus: 'syncing',
      kind: 'rollback',
      note: `Tarif rétabli à ${entry.oldPrice} €`,
    };
    set((state) => ({
      decisionLog: [
        rollback,
        ...state.decisionLog.map((e) => (e.id === id ? { ...e, status: 'rolled_back' as const } : e)),
      ],
    }));
    syncToChannelManager(rollback.id);
  },

  runAutopilot: () => {
    const { recommendations, automationLevel, params } = get();
    if (automationLevel < 3) return;
    const applied: DecisionLogEntry[] = [];
    const remaining: PriceRecommendation[] = [];
    for (const reco of recommendations) {
      const verdict = evaluateRecommendation(reco, params);
      const eligible =
        verdict.outcome === 'auto' || (automationLevel === 4 && verdict.outcome === 'review');
      if (eligible) {
        applied.push(logFromRecommendation(reco, automationLevel));
      } else {
        remaining.push(reco);
      }
    }
    if (applied.length === 0) return;
    set((state) => ({
      recommendations: remaining,
      decisionLog: [...applied, ...state.decisionLog],
    }));
    applied.forEach((e) => syncToChannelManager(e.id));
  },

  retrySync: (id) => {
    set((state) => ({
      decisionLog: state.decisionLog.map((e) =>
        e.id === id ? { ...e, syncStatus: 'syncing' as const } : e,
      ),
    }));
    syncToChannelManager(id);
  },
}));
