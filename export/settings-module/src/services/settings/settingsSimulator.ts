/**
 * FLOWTYM — Settings Alert Simulator.
 *
 * Permet de prévisualiser l'impact d'une correction d'alerte sur les
 * scores du Control Center, AVANT que l'utilisateur ne corrige
 * réellement. Pédagogique : "si je résous cette alerte, mon score
 * Conformité passera de 65 à 81".
 *
 * Stratégie : on connaît la cible PageId de chaque alerte et le
 * driver qui en est responsable. Pour chaque alerte connue, on
 * estime l'impact sur les 5 dimensions de score.
 *
 * NB : on ne touche pas aux stores — c'est une projection pure, pas
 * une exécution.
 */

import type {
  ConfigAlert,
  ScoreCardId,
} from '@/src/types/settings/diagnostic';

export interface SimulatedImpact {
  /** Variation par dimension (delta points). */
  deltas: Partial<Record<ScoreCardId, number>>;
  /** Variation du score système agrégé. */
  systemHealthDelta: number;
  /** Récit court de l'effet attendu. */
  narrative: string;
  /** Effort estimé (court / moyen / long). */
  effort: 'court' | 'moyen' | 'long';
}

/**
 * Modèle d'impact par identifiant d'alerte connu. Les deltas sont des
 * estimations métier — pas un calcul exact (qui nécessiterait de
 * dérouler le moteur de diagnostic avec un store mocké).
 */
const IMPACT_MODEL: Record<string, Omit<SimulatedImpact, 'systemHealthDelta'>> = {
  rooms_no_floor: {
    deltas: { configuration: +12 },
    narrative: 'Affecter les chambres orphelines à un étage débloque le driver "Chambres avec étage" et fait monter la Configuration de ~12 pts.',
    effort: 'court',
  },
  plans_no_reference: {
    deltas: { configuration: +10, revenue: +4 },
    narrative: 'Définir un plan tarifaire de référence par typologie permet au moteur RMS d\'appliquer les recommandations — Configuration +10, Revenue +4.',
    effort: 'court',
  },
  no_channels: {
    deltas: { distribution: +30, configuration: +5 },
    narrative: 'Connecter au moins un canal OTA fait passer la Distribution d\'inopérante à opérationnelle (+30 pts).',
    effort: 'moyen',
  },
  no_pricing_rules: {
    deltas: { revenue: +15, configuration: +8 },
    narrative: 'Activer au moins une règle tarifaire pose les garde-fous du RMS — Revenue +15, Configuration +8.',
    effort: 'moyen',
  },
  conflicting_rules: {
    deltas: { revenue: +15 },
    narrative: 'Corriger les contradictions stabilise les recommandations RMS — Revenue +15.',
    effort: 'court',
  },
  no_city_tax: {
    deltas: { compliance: +15 },
    narrative: 'Renseigner la taxe de séjour rend les factures conformes — Conformité +15.',
    effort: 'court',
  },
  admin_no_2fa: {
    deltas: { security: +20 },
    narrative: 'Activer le 2FA sur tous les comptes administrateur ferme une porte de compromission majeure — Sécurité +20.',
    effort: 'court',
  },
  no_admin: {
    deltas: { security: +25, compliance: +20 },
    narrative: 'Créer un administrateur actif débloque la gouvernance complète — Sécurité +25, Conformité +20.',
    effort: 'court',
  },
  no_events: {
    deltas: { revenue: +6, distribution: +5 },
    narrative: 'Charger la bibliothèque d\'événements donne du contexte au moteur RMS — Revenue et Distribution +5 à +6.',
    effort: 'court',
  },
  hotel_no_email: {
    deltas: { configuration: +3 },
    narrative: 'Renseigner l\'email hôtel termine le profil — Configuration +3 et active les communications transactionnelles.',
    effort: 'court',
  },
  recent_sync_errors: {
    deltas: { distribution: +5 },
    narrative: 'Corriger les sources externes en erreur stabilise la veille marché — Distribution +5.',
    effort: 'moyen',
  },
};

/**
 * Modèle générique par sévérité — utilisé pour les alertes dynamiques
 * dont l'id n'est pas dans IMPACT_MODEL (ex. src_error_*).
 */
function genericImpact(alert: ConfigAlert): Omit<SimulatedImpact, 'systemHealthDelta'> {
  const baseDeltas: Record<ConfigAlert['severity'], number> = {
    critical: 12,
    high: 8,
    medium: 5,
    low: 2,
    info: 1,
  };
  // Cible le score le plus pertinent selon le module
  const target: ScoreCardId =
    alert.module === 'pms_reservations' ? 'configuration' :
    alert.module === 'inventory_planning' ? 'configuration' :
    alert.module === 'rms_revenue' ? 'revenue' :
    alert.module === 'channel_manager' ? 'distribution' :
    alert.module === 'finance_billing' ? 'compliance' :
    alert.module === 'housekeeping' ? 'configuration' :
    alert.module === 'automation_ai' ? 'revenue' :
    alert.module === 'security_backups' ? 'security' :
    'distribution';
  const delta = baseDeltas[alert.severity];
  const effort: SimulatedImpact['effort'] =
    alert.severity === 'critical' || alert.severity === 'high' ? 'moyen' : 'court';
  return {
    deltas: { [target]: delta },
    narrative: `Résoudre cette alerte ${alert.severity === 'critical' ? 'critique' : 'haute'} devrait améliorer le score ${target} de ~${delta} pts.`,
    effort,
  };
}

/**
 * Calcule la projection d'impact pour une alerte donnée.
 */
export function simulateAlertFix(alert: ConfigAlert): SimulatedImpact {
  const base = IMPACT_MODEL[alert.id] ?? genericImpact(alert);
  // Le score système est la moyenne des 5 dimensions (poids égal),
  // donc l'agrégé = somme(deltas) / 5
  const sum = Object.values(base.deltas).reduce((s, v) => s + (v ?? 0), 0);
  const systemHealthDelta = Math.round(sum / 5);
  return { ...base, systemHealthDelta };
}

/**
 * Simule l'impact cumulé de plusieurs corrections (top N opportunités).
 * Capping à 100 par dimension.
 */
export function simulateCombined(alerts: ConfigAlert[]): SimulatedImpact {
  const combined: Partial<Record<ScoreCardId, number>> = {};
  for (const a of alerts) {
    const sim = simulateAlertFix(a);
    for (const [k, v] of Object.entries(sim.deltas)) {
      combined[k as ScoreCardId] = (combined[k as ScoreCardId] ?? 0) + (v ?? 0);
    }
  }
  const sum = Object.values(combined).reduce((s, v) => s + (v ?? 0), 0);
  return {
    deltas: combined,
    systemHealthDelta: Math.round(sum / 5),
    narrative: `${alerts.length} corrections cumulées : impact agrégé sur le score système ~+${Math.round(sum / 5)} pts.`,
    effort: alerts.length > 3 ? 'long' : alerts.length > 1 ? 'moyen' : 'court',
  };
}
