/**
 * FLOWTYM — Settings Control Center — Domain types
 *
 * Toutes les structures consommées par le cockpit Paramètres :
 *   • DiagnosticReport — sortie complète du moteur de diagnostic ;
 *   • ScoreCard       — un score normalisé 0-100 + tier + détails ;
 *   • ConfigAlert     — alerte actionnable produite par le moteur ;
 *   • ModuleStatus    — statut d'un module clé du PMS ;
 *   • ChecklistDomain — domaine de la checklist de configuration ;
 *   • GuidedStep      — étape du parcours de configuration guidée ;
 *   • SystemLogEntry  — entrée journal système (sync, modif, alerte).
 *
 * Le moteur (settingsDiagnosticEngine) consomme les stores réels
 * (configStore, eventsStore, rateCalendarStore, centralPricingEngine,
 * etc.) et produit un DiagnosticReport — c'est la seule source de
 * vérité du Control Center.
 */

import type { PageId } from '@/src/types';

export type HealthTier = 'excellent' | 'good' | 'attention' | 'critical';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'open' | 'in_progress' | 'resolved';

export type ModuleStatusLevel =
  | 'operational'
  | 'attention'
  | 'critical'
  | 'disabled'
  | 'pending_configuration';

/** Score normalisé 0-100 avec tier dérivé et drivers explicatifs. */
export interface ScoreCard {
  id: ScoreCardId;
  label: string;
  value: number;            // 0-100
  tier: HealthTier;
  trend?: number[];         // mini-sparkline (5-12 points)
  caption?: string;
  /** Points qui expliquent le score (positifs ou négatifs). */
  drivers: Array<{ label: string; weight: number; ok: boolean }>;
}

export type ScoreCardId =
  | 'system_health'
  | 'configuration'
  | 'compliance'
  | 'security'
  | 'distribution'
  | 'revenue';

/** Alerte actionnable affichée dans le panneau "Actions recommandées". */
export interface ConfigAlert {
  id: string;
  severity: AlertSeverity;
  /** Module métier d'origine — sert au routage et au filtrage. */
  module: ModuleKey;
  title: string;
  description: string;
  /** Impact business si non corrigé. */
  businessImpact?: string;
  /** Bouton d'action principal (libellé + page cible). */
  action: { label: 'Corriger' | 'Ouvrir' | 'Configurer' | 'Renouveler' | 'Voir'; target: PageId };
  status: AlertStatus;
  /** ISO timestamp de détection. */
  detectedAt: string;
}

export type ModuleKey =
  | 'pms_reservations'
  | 'inventory_planning'
  | 'rms_revenue'
  | 'channel_manager'
  | 'finance_billing'
  | 'housekeeping'
  | 'automation_ai'
  | 'security_backups'
  | 'integrations';

export interface ModuleStatus {
  key: ModuleKey;
  name: string;
  status: ModuleStatusLevel;
  lastCheckedAt: string;
  /** Liste courte des problèmes détectés sur ce module. */
  issues: string[];
  /** Action recommandée + cible de navigation. */
  recommendedAction?: { label: string; target: PageId };
  /** Page principale du module (utilisée par "Voir détails"). */
  homePage: PageId;
}

export interface ChecklistTask {
  id: string;
  label: string;
  done: boolean;
  /** Page de configuration ciblée par le clic. */
  target: PageId;
  blockedBy?: string;
}

export interface ChecklistDomain {
  id: ChecklistDomainId;
  label: string;
  tasks: ChecklistTask[];
  /** Pourcentage de complétion 0-100. */
  progress: number;
}

export type ChecklistDomainId =
  | 'establishment'
  | 'inventory'
  | 'pricing'
  | 'distribution'
  | 'finance'
  | 'housekeeping'
  | 'security'
  | 'integrations';

export type GuidedStepStatus = 'completed' | 'in_progress' | 'todo' | 'blocked';

export interface GuidedStep {
  index: number;
  label: string;
  status: GuidedStepStatus;
  domain: ChecklistDomainId;
  target: PageId;
  blockedBy?: string;
}

export interface SystemLogEntry {
  id: string;
  at: string;
  module: ModuleKey;
  level: 'info' | 'warn' | 'error' | 'success';
  status: 'success' | 'failed' | 'pending';
  title: string;
  detail?: string;
  auditTarget?: PageId;
}

export interface SyncConnector {
  id: string;
  name: string;
  module: ModuleKey;
  status: 'ok' | 'pending' | 'error' | 'disabled';
  lastSyncAt?: string;
  expiresAt?: string;
}

export interface DiagnosticReport {
  generatedAt: string;
  scores: Record<ScoreCardId, ScoreCard>;
  modules: ModuleStatus[];
  alerts: ConfigAlert[];
  checklist: ChecklistDomain[];
  guided: GuidedStep[];
  logs: SystemLogEntry[];
  connectors: SyncConnector[];
  /** Synthèse globale Excellent/Bon/Attention/Critique. */
  overallTier: HealthTier;
}

export const TIER_LABEL: Record<HealthTier, string> = {
  excellent: 'Excellent',
  good: 'Bon',
  attention: 'Attention',
  critical: 'Critique',
};

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: 'Critique',
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
  info: 'Info',
};

export const MODULE_LABEL: Record<ModuleKey, string> = {
  pms_reservations: 'PMS & Réservations',
  inventory_planning: 'Inventaire & Planning',
  rms_revenue: 'RMS & Revenue',
  channel_manager: 'Channel Manager',
  finance_billing: 'Finance & Facturation',
  housekeeping: 'Housekeeping',
  automation_ai: 'Automatisations & IA',
  security_backups: 'Sauvegardes & Sécurité',
  integrations: 'Intégrations',
};

export const STATUS_LABEL: Record<ModuleStatusLevel, string> = {
  operational: 'Opérationnel',
  attention: 'Attention',
  critical: 'Critique',
  disabled: 'Désactivé',
  pending_configuration: 'En attente de configuration',
};
