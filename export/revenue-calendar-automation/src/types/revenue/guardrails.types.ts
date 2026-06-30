/**
 * FLOWTYM — Types garde-fous RMS
 */

export type GuardrailCategory =
  | 'pricing'        // Tarification
  | 'availability'   // Disponibilité
  | 'restriction'    // Restrictions
  | 'distribution'   // Distribution
  | 'quality';       // Qualité & Réputation

export type GuardrailSeverity = 'blocking' | 'warning' | 'auto_adjust';

export type GuardrailId =
  | 'price_floor'
  | 'price_ceiling'
  | 'daily_variation_max'
  | 'weekly_variation_max'
  | 'adr_minimum'
  | 'revpar_minimum'
  | 'min_stay_events'
  | 'max_stay_events'
  | 'group_adr_protection'
  | 'occupancy_max'
  | 'ota_parity'
  | 'reputation_protection';

export interface GuardrailCoverage {
  scope: 'all' | 'channel' | 'segment' | 'season' | 'room_type' | 'event';
  detail: string;            // ex: "OTA Booking, Expedia"
  percentage: number;        // % dates couvertes
}

export interface Guardrail {
  id: GuardrailId;
  name: string;
  category: GuardrailCategory;
  severity: GuardrailSeverity;
  condition: string;
  threshold: string;          // ex: "110 €", "±15%"
  thresholdValue: number;
  action: string;
  coverage: GuardrailCoverage;
  status: 'active' | 'paused';
  blocksCount30d: number;
  warningsCount30d: number;
  adjustmentsCount30d: number;
  averageDeltaLimited: number; // % moyen évité
  history: GuardrailBlockEntry[];
}

export interface GuardrailBlockEntry {
  timestamp: string;
  date: string;
  context: string;            // ex: "Chambre Standard"
  requested: string;          // ex: "Prix demandé : 95€"
  limit: string;              // ex: "Plancher : 110€"
  outcome: 'blocked' | 'adjusted' | 'warning';
  source: 'rule' | 'autopilot' | 'manual' | 'channel_manager';
}

export interface GuardrailsKpis {
  activeCount: number;
  totalCount: number;
  blocksCount30d: number;
  globalRisk: 'low' | 'medium' | 'high';
  protectedEvents: number;
  averageDeltaLimited: number;  // %
  globalCoverage: number;       // %
  uncoveredDates: number;
  totalDates: number;
}

export interface GuardrailHierarchyLevel {
  priority: number;
  severity: GuardrailSeverity;
  label: string;
  description: string;
}
