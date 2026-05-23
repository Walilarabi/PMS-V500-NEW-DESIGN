/**
 * FLOWTYM — Moteur priorités & conflits RMS
 *
 * Hiérarchie obligatoire :
 *  1 Garde-fous RMS (absolu)
 *  2 Événements majeurs
 *  3 Compression marché
 *  4 Pickup anormal
 *  5 Stratégie automatique
 *  6 Promotions / tarification
 *  7 Last minute / remplissage
 *  8 Optimisation OTA
 *  9 Anti-cannibalisation
 * 10 Détection anomalies RMS
 */

import type {
  Conflict,
  ConflictParticipant,
  PriorityLevel,
  PrioritiesKpis,
  ResolutionLogEntry,
  PrioritySimulation,
} from '@/src/types/revenue/conflicts.types';
import type { TacticalRuleId } from '@/src/types/revenue/tacticalRules.types';
import type { GuardrailId } from '@/src/types/revenue/guardrails.types';
import { tacticalRulesEngine } from './tacticalRulesEngine';
import { rmsAuditLogger } from './rmsAuditLogger';
import { emitRmsEvent } from '@/src/lib/rms/eventBus';
import {
  loadPriorityHierarchy,
  persistPriorityHierarchy,
} from './rmsEnterprisePersistence.service';

const dayAgo = (n: number, h = 0) => new Date(Date.now() - n * 86_400_000 - h * 3_600_000).toISOString();

const DEFAULT_HIERARCHY: PriorityLevel[] = [
  {
    priority: 1, kind: 'guardrail', id: 'guardrails_absolute',
    name: 'Garde-fous RMS (absolu)', category: 'Protection', type: 'Protection',
    objective: 'Sécurité & conformité', preemption: 'Toujours', revenueImpact30d: 0,
  },
  {
    priority: 2, kind: 'event', id: 'major_events',
    name: 'Événements majeurs', category: 'Événements', type: 'Événements',
    objective: 'Maximiser le revenu', preemption: 'Avant stratégie', revenueImpact30d: 4760,
  },
  {
    priority: 3, kind: 'rule', id: 'market_compression',
    name: 'Compression marché', category: 'Demande', type: 'Demande',
    objective: 'Exploiter la forte demande', preemption: 'Avant stratégie', revenueImpact30d: 6820,
  },
  {
    priority: 4, kind: 'rule', id: 'abnormal_pickup',
    name: 'Pickup anormal', category: 'Demande', type: 'Demande',
    objective: 'S\'adapter à l\'accélération', preemption: 'Avant stratégie', revenueImpact30d: 4120,
  },
  {
    priority: 5, kind: 'strategy', id: 'strategy_active',
    name: 'Stratégie automatique', category: 'Stratégie', type: 'Stratégie',
    objective: 'Suivre la stratégie globale', preemption: 'Base', revenueImpact30d: 2980,
  },
  {
    priority: 6, kind: 'rule', id: 'pricing_promo',
    name: 'Promotions / Tarification', category: 'Commercial', type: 'Commercial',
    objective: 'Stimuler la demande', preemption: 'Après stratégie', revenueImpact30d: 1980,
  },
  {
    priority: 7, kind: 'rule', id: 'smart_last_minute',
    name: 'Last minute / Remplissage', category: 'Remplissage', type: 'Remplissage',
    objective: 'Remplir l\'inventaire', preemption: 'Dernier', revenueImpact30d: 2250,
  },
  {
    priority: 8, kind: 'rule', id: 'ota_mix_optimization',
    name: 'Optimisation mix OTA', category: 'Distribution', type: 'Distribution',
    objective: 'Optimiser la rentabilité', preemption: 'En parallèle', revenueImpact30d: 1980,
  },
  {
    priority: 9, kind: 'rule', id: 'anti_cannibalization',
    name: 'Anti-cannibalisation', category: 'Protection', type: 'Protection',
    objective: 'Protéger l\'ADR', preemption: 'Surveillance', revenueImpact30d: 1620,
  },
  {
    priority: 10, kind: 'rule', id: 'rms_anomaly_detection',
    name: 'Détection anomalies RMS', category: 'Protection', type: 'Protection',
    objective: 'Éviter les erreurs', preemption: 'Toujours', revenueImpact30d: 1370,
  },
];

const SEED_CONFLICTS: Conflict[] = [
  {
    id: 'conflict_1',
    type: 'objective_opposition',
    detectedAt: dayAgo(0, 1),
    participants: [
      { kind: 'rule', id: 'market_compression', name: 'Compression marché', priority: 3, intent: 'Augmenter les prix' },
      { kind: 'rule', id: 'smart_last_minute', name: 'Last minute / Remplissage', priority: 7, intent: 'Baisser les prix' },
    ],
    potentialImpact: -930,
    potentialImpactLabel: 'RevPAR potentiel',
    riskLevel: 'high',
    resolution: 'priority_wins',
    winner: { kind: 'rule', id: 'market_compression', name: 'Compression marché', priority: 3, intent: 'Augmenter les prix' },
    suspended: { kind: 'rule', id: 'smart_last_minute', name: 'Last minute', priority: 7, intent: 'Baisser les prix' },
    iaJustification: 'Pression marché élevée détectée — la compression l\'emporte sur le remplissage.',
    recommendedAction: 'Prioriser Compression marché — le moteur appliquera la priorité 3.',
    status: 'resolved',
  },
  {
    id: 'conflict_2',
    type: 'overlap',
    detectedAt: dayAgo(0, 5),
    participants: [
      { kind: 'rule', id: 'early_bird', name: 'Early bird dynamique', priority: 5, intent: 'Stimuler la demande lointaine' },
      { kind: 'rule', id: 'demand_gap', name: 'Trou de demande', priority: 4, intent: 'Stimuler la demande faible' },
    ],
    potentialImpact: -620,
    potentialImpactLabel: 'RevPAR potentiel',
    riskLevel: 'medium',
    resolution: 'auto_merge',
    iaJustification: 'Les deux règles ciblent le même objectif sur des dates compatibles.',
    recommendedAction: 'Fusion automatique — la règle Trou de demande prend l\'antériorité.',
    status: 'resolved',
  },
  {
    id: 'conflict_3',
    type: 'guardrail_blocking',
    detectedAt: dayAgo(1, 3),
    participants: [
      { kind: 'rule', id: 'competitive_parity', name: 'Parité concurrentielle', priority: 4, intent: 'Aligner sur compset' },
      { kind: 'guardrail', id: 'price_floor', name: 'Plancher tarifaire (GF)', priority: 1, intent: 'Bloquer toute baisse < plancher' },
    ],
    potentialImpact: -430,
    potentialImpactLabel: 'RevPAR potentiel',
    riskLevel: 'high',
    resolution: 'guardrail_blocks',
    winner: { kind: 'guardrail', id: 'price_floor', name: 'Plancher tarifaire', priority: 1, intent: 'Protection ADR' },
    suspended: { kind: 'rule', id: 'competitive_parity', name: 'Parité concurrentielle', priority: 4, intent: 'Aligner sur compset' },
    iaJustification: 'Le plancher tarifaire reste intouchable — aucun ajustement appliqué.',
    recommendedAction: 'Aucun changement — le garde-fou bloque la baisse.',
    status: 'action_required',
  },
];

const SEED_LOG: ResolutionLogEntry[] = [
  {
    id: 'res_1',
    timestamp: dayAgo(4, 6),
    title: 'Compression marché vs Last minute',
    resolution: 'auto',
    outcome: 'Compression marché (3)',
    status: 'applied',
    detail: 'Priorité appliquée automatiquement',
  },
  {
    id: 'res_2',
    timestamp: dayAgo(5, 12),
    title: 'Early bird vs Trou de demande',
    resolution: 'auto',
    outcome: 'Trou de demande (4)',
    status: 'applied',
    detail: 'Règle prioritaire',
  },
  {
    id: 'res_3',
    timestamp: dayAgo(6, 18),
    title: 'Parité concurrentielle vs Plancher tarifaire',
    resolution: 'pending',
    outcome: 'Réviser la règle',
    status: 'pending',
    detail: 'En attente d\'action',
  },
];

let hierarchy: PriorityLevel[] = DEFAULT_HIERARCHY.map((l) => ({ ...l }));
let conflicts: Conflict[] = SEED_CONFLICTS.map((c) => ({ ...c }));
let resolutionLog: ResolutionLogEntry[] = SEED_LOG.map((l) => ({ ...l }));
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

export const priorityConflictEngine = {
  hierarchy(): PriorityLevel[] { return hierarchy; },
  conflicts(): Conflict[] { return conflicts; },
  resolutionLog(): ResolutionLogEntry[] { return resolutionLog; },

  reorder(orderedIds: string[]) {
    const map = new Map(hierarchy.map((l) => [l.id, l]));
    hierarchy = orderedIds
      .map((id, idx) => {
        const l = map.get(id);
        return l ? { ...l, priority: idx + 1 } : null;
      })
      .filter(Boolean) as PriorityLevel[];
    rmsAuditLogger.log({
      type: 'priority_changed',
      actor: 'Hiérarchie',
      context: 'Configuration',
      detail: `Nouvel ordre : ${orderedIds.join(' → ')}`,
    });
    try { emitRmsEvent('priority:reordered', { orderedIds }); } catch {/* bus */}
    persistPriorityHierarchy(hierarchy);
    notify();
  },

  resolveConflict(conflictId: string, decision: 'apply_recommendation' | 'override') {
    conflicts = conflicts.map((c) =>
      c.id === conflictId ? { ...c, status: 'resolved' as const } : c
    );
    const c = conflicts.find((x) => x.id === conflictId);
    if (c) {
      resolutionLog = [
        {
          id: `res_${Date.now()}`,
          timestamp: new Date().toISOString(),
          title: c.participants.map((p) => p.name).join(' vs '),
          resolution: decision === 'apply_recommendation' ? 'auto' : 'manual',
          outcome: c.winner?.name ?? c.recommendedAction,
          status: 'applied',
          detail: c.iaJustification,
        },
        ...resolutionLog,
      ].slice(0, 50);
      rmsAuditLogger.log({
        type: 'conflict_resolved',
        actor: c.winner?.name ?? 'Conflit',
        context: c.participants.map((p) => p.name).join(' vs '),
        detail: c.iaJustification,
        impact: c.potentialImpact,
      });
      try {
        emitRmsEvent('conflict:resolved', {
          conflictId: c.id,
          winner: c.winner?.name,
          suspended: c.suspended?.name,
          auto: decision === 'apply_recommendation',
        });
      } catch {/* bus */}
    }
    notify();
  },

  kpis(): PrioritiesKpis {
    const top = hierarchy.find((l) => l.kind === 'rule');
    const revenue = tacticalRulesEngine.kpis().revenue30d;
    const autoResolved = resolutionLog.filter((l) => l.resolution === 'auto' && l.status === 'applied').length;
    return {
      activeLevels: hierarchy.length,
      conflictsDetected: conflicts.filter((c) => c.status !== 'resolved').length || conflicts.length,
      autoResolved30d: 12 + autoResolved,
      topRuleName: top?.name ?? '—',
      topRulePriority: top?.priority ?? 1,
      revenue30d: revenue,
    };
  },

  simulate(ruleId: string, toPosition: number): PrioritySimulation {
    const rule = hierarchy.find((l) => l.id === ruleId);
    const from = rule?.priority ?? 0;
    const delta = from - toPosition;
    return {
      ruleId,
      ruleName: rule?.name ?? ruleId,
      fromPosition: from,
      toPosition,
      estimatedRevpar: Math.round(delta * 280 + (rule ? rule.revenueImpact30d * 0.18 : 1200)),
      estimatedAdr: Number((delta * 0.4).toFixed(1)),
      estimatedOccupancy: Number((delta * 0.3).toFixed(1)),
    };
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Compteur référentiellement stable pour useSyncExternalStore. */
  version(): number { return version; },

  /**
   * Enregistre un conflit détecté au runtime (par `rmsRuleEvaluator` quand
   * deux règles fired veulent aller dans des directions opposées). Si un
   * conflit identique (mêmes participants) existe déjà, il est mis à jour
   * plutôt que dupliqué.
   */
  recordRuntimeConflict(input: {
    winner: { id: string; name: string; priority: number; intent: string };
    suspended: { id: string; name: string; priority: number; intent: string };
    impact: number;
    date: string;
  }) {
    const signature = `${input.winner.id}__vs__${input.suspended.id}`;
    const existing = conflicts.find((c) => c.id === signature);
    if (existing) {
      // Met à jour le timestamp + impact agrégé
      conflicts = conflicts.map((c) =>
        c.id === signature
          ? {
              ...c,
              detectedAt: new Date().toISOString(),
              potentialImpact: c.potentialImpact + input.impact,
            }
          : c,
      );
    } else {
      const newConflict: Conflict = {
        id: signature,
        type: 'objective_opposition',
        detectedAt: new Date().toISOString(),
        participants: [
          { kind: 'rule', id: input.winner.id as TacticalRuleId | GuardrailId, name: input.winner.name, priority: input.winner.priority, intent: input.winner.intent },
          { kind: 'rule', id: input.suspended.id as TacticalRuleId | GuardrailId, name: input.suspended.name, priority: input.suspended.priority, intent: input.suspended.intent },
        ],
        potentialImpact: input.impact,
        potentialImpactLabel: 'RevPAR potentiel',
        riskLevel: Math.abs(input.impact) > 800 ? 'high' : Math.abs(input.impact) > 300 ? 'medium' : 'low',
        resolution: 'priority_wins',
        winner: { kind: 'rule', id: input.winner.id as TacticalRuleId | GuardrailId, name: input.winner.name, priority: input.winner.priority, intent: input.winner.intent },
        suspended: { kind: 'rule', id: input.suspended.id as TacticalRuleId | GuardrailId, name: input.suspended.name, priority: input.suspended.priority, intent: input.suspended.intent },
        iaJustification: `Direction opposée — priorité ${input.winner.priority} l'emporte sur priorité ${input.suspended.priority}.`,
        recommendedAction: `Conserver ${input.winner.name} prioritaire`,
        status: 'resolved',
      };
      conflicts = [newConflict, ...conflicts].slice(0, 50);
      try {
        emitRmsEvent('conflict:detected', {
          conflictId: newConflict.id,
          participants: [input.winner.name, input.suspended.name],
          riskLevel: newConflict.riskLevel,
        });
      } catch {/* bus */}
    }
    notify();
  },

  /** Hydrate depuis Supabase. Garde le seed si vide ou indisponible. */
  async hydrate(): Promise<void> {
    const rows = await loadPriorityHierarchy();
    if (rows && rows.length > 0) {
      hierarchy = rows;
      notify();
    }
  },
};

export type { ConflictParticipant };
