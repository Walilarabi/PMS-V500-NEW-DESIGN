/**
 * FLOWTYM — Types conflits & arbitrage RMS
 */

import type { TacticalRuleId } from './tacticalRules.types';
import type { GuardrailId } from './guardrails.types';

export type ConflictType =
  | 'objective_opposition'    // Opposition d'objectifs
  | 'overlap'                 // Chevauchement
  | 'guardrail_blocking'      // Garde-fou bloquant
  | 'incompatible_promo'      // Promo incompatible
  | 'ota_parity'              // Parité OTA
  | 'event_vs_lastminute'
  | 'compression_vs_filling'
  | 'earlybird_vs_demandgap'
  | 'strategy_vs_tactical'
  | 'autopilot_vs_human';

export type ConflictResolution =
  | 'priority_wins'           // Règle prioritaire l'emporte
  | 'auto_merge'              // Fusion automatique
  | 'guardrail_blocks'        // Garde-fou bloque
  | 'human_review'            // En attente d'action humaine
  | 'suspended';              // Suspendu

export interface ConflictParticipant {
  kind: 'rule' | 'guardrail' | 'strategy' | 'autopilot' | 'promotion';
  id: TacticalRuleId | GuardrailId | string;
  name: string;
  priority: number;
  intent: string;             // Ex: "Augmenter le prix"
}

export interface Conflict {
  id: string;
  type: ConflictType;
  detectedAt: string;
  participants: ConflictParticipant[];
  potentialImpact: number;    // €
  potentialImpactLabel: string; // ex: "RevPAR potentiel"
  riskLevel: 'low' | 'medium' | 'high';
  resolution: ConflictResolution;
  winner?: ConflictParticipant;
  suspended?: ConflictParticipant;
  iaJustification: string;
  recommendedAction: string;
  status: 'pending' | 'resolved' | 'action_required';
}

export interface PriorityLevel {
  priority: number;            // 1 = plus haute
  kind: 'rule' | 'guardrail' | 'strategy' | 'event' | 'autopilot';
  id: string;
  name: string;
  category: string;
  type: string;                // Label du type
  objective: string;           // Objectif principal
  preemption: string;          // Quand préempte-t-il ?
  revenueImpact30d: number;
}

export interface PrioritiesKpis {
  activeLevels: number;
  conflictsDetected: number;
  autoResolved30d: number;
  topRuleName: string;
  topRulePriority: number;
  revenue30d: number;
}

export interface ResolutionLogEntry {
  id: string;
  timestamp: string;
  title: string;               // ex: "Compression marché vs Last minute"
  resolution: 'auto' | 'manual' | 'pending';
  outcome: string;             // ex: "Compression marché (3)"
  status: 'applied' | 'pending';
  detail: string;
}

export interface PrioritySimulation {
  ruleId: string;
  ruleName: string;
  fromPosition: number;
  toPosition: number;
  estimatedRevpar: number;
  estimatedAdr: number;
  estimatedOccupancy: number;
}
