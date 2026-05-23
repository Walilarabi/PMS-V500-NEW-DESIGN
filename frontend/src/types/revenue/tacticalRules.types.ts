/**
 * FLOWTYM — Types règles tactiques RMS
 */

export type TacticalRuleCategory =
  | 'demand'        // Demande
  | 'pricing'       // Tarification
  | 'distribution'  // Distribution
  | 'event'         // Événements
  | 'protection';   // Protection

export type TacticalRuleId =
  | 'market_compression'
  | 'abnormal_pickup'
  | 'demand_gap'
  | 'competitive_parity'
  | 'early_bird'
  | 'smart_last_minute'
  | 'ota_mix_optimization'
  | 'event_protection'
  | 'anti_cannibalization'
  | 'rms_anomaly_detection';

export type TacticalRuleStatus = 'active' | 'paused' | 'simulation';

export interface TacticalRuleAction {
  label: string;
  type: 'price_up' | 'price_down' | 'close_promo' | 'open_promo' | 'min_stay'
      | 'cta' | 'ctd' | 'block' | 'rollback' | 'alert' | 'ota_limit' | 'push_direct';
  magnitude?: number;
}

export interface TacticalRuleTrigger {
  label: string;
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '=' | 'in';
  threshold: number | string | string[];
}

export interface TacticalRule {
  id: TacticalRuleId;
  name: string;
  category: TacticalRuleCategory;
  priority: number;          // 1 = plus haute
  status: TacticalRuleStatus;
  description: string;
  triggers: TacticalRuleTrigger[];
  actions: TacticalRuleAction[];
  connectivity: string[];    // Modules connectés
  iaConfidence: number;      // 0-100
  revenueImpact30d: number;  // €
  revparImpact30d: number;   // %
  triggersCount30d: number;
  successCount: number;
  adjustedCount: number;
  blockedCount: number;
  lastTriggeredAt?: string;
  history: TacticalRuleHistoryEntry[];
}

export interface TacticalRuleHistoryEntry {
  timestamp: string;
  date: string;              // Date concernée
  trigger: string;
  action: string;
  outcome: 'success' | 'adjusted' | 'blocked';
  revenueImpact: number;
  explanation: string;
}

export interface TacticalRulesKpis {
  activeCount: number;
  totalCount: number;
  revenue30d: number;
  revenueDelta: number;          // % vs sans règles
  automatedActions30d: number;
  successfulActions: number;
  adjustedActions: number;
  blockedActions: number;
  conflictsDetected: number;
  averageIaConfidence: number;   // 0-100
}

export interface MarketContext {
  occupancy: number;             // 0-100
  pickup24h: number;
  pickupAverage: number;
  leadTimeDays: number;
  compsetMedianPrice: number;
  ourPrice: number;
  marketPressure: 'low' | 'medium' | 'high' | 'extreme';
  hasMajorEvent: boolean;
  daysUntilStay: number;
  otaShare: number;              // %
  cancellationRate: number;      // %
  activeStrategy: 'aggressive' | 'balanced' | 'defensive';
}
