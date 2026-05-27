import type { TicketPriority } from './support.service';

export type RiskScore = 'faible' | 'moyen' | 'eleve' | 'critique';

// ─── Risk score matrix (module group × priority) ──────────────────────────────

const RISK_MATRIX: Record<string, Record<TicketPriority, RiskScore>> = {
  finance: {
    bloquant: 'critique',
    eleve:    'critique',
    moyen:    'eleve',
    faible:   'moyen',
  },
  revenue: {
    bloquant: 'critique',
    eleve:    'critique',
    moyen:    'eleve',
    faible:   'moyen',
  },
  rms: {
    bloquant: 'critique',
    eleve:    'eleve',
    moyen:    'moyen',
    faible:   'faible',
  },
  reservations: {
    bloquant: 'critique',
    eleve:    'eleve',
    moyen:    'moyen',
    faible:   'faible',
  },
  planning: {
    bloquant: 'critique',
    eleve:    'eleve',
    moyen:    'moyen',
    faible:   'faible',
  },
  ota: {
    bloquant: 'critique',
    eleve:    'eleve',
    moyen:    'moyen',
    faible:   'faible',
  },
  flowday: {
    bloquant: 'eleve',
    eleve:    'eleve',
    moyen:    'moyen',
    faible:   'faible',
  },
  sas: {
    bloquant: 'eleve',
    eleve:    'moyen',
    moyen:    'moyen',
    faible:   'faible',
  },
  clients: {
    bloquant: 'eleve',
    eleve:    'moyen',
    moyen:    'moyen',
    faible:   'faible',
  },
  settings: {
    bloquant: 'moyen',
    eleve:    'moyen',
    moyen:    'faible',
    faible:   'faible',
  },
  default: {
    bloquant: 'moyen',
    eleve:    'moyen',
    moyen:    'faible',
    faible:   'faible',
  },
};

// ─── Module → affected modules mapping ───────────────────────────────────────

const AFFECTED_MODULES: Record<string, string[]> = {
  finance:      ['Revenue', 'Réservations', 'Exports', 'Facturation', 'OTA'],
  revenue:      ['Planning', 'Réservations', 'Calendrier tarifaire', 'OTA', 'Finance'],
  rms:          ['Revenue', 'Planning', 'Réservations', 'OTA'],
  reservations: ['Planning', 'Finance', 'Clients', 'OTA', 'Flowday'],
  planning:     ['Réservations', 'Revenue', 'Flowday'],
  ota:          ['Réservations', 'Revenue', 'Finance', 'API externe'],
  flowday:      ['Réservations', 'Planning', 'SAS'],
  sas:          ['Clients', 'Réservations'],
  clients:      ['Réservations', 'Finance'],
  settings:     ['Permissions (tous modules)'],
  support:      [],
  default:      [],
};

function moduleKey(module: string): string {
  const m = module.toLowerCase();
  if (m.includes('financ') || m.includes('factur') || m.includes('caisse') || m.includes('payment') || m.includes('stripe')) return 'finance';
  if (m.includes('revenue') || m.includes('tarif') || m.includes('prix') || m.includes('pricing')) return 'revenue';
  if (m.includes('rms') || m.includes('yield') || m.includes('autopilot') || m.includes('stratégie')) return 'rms';
  if (m.includes('réservation') || m.includes('reservation') || m.includes('booking')) return 'reservations';
  if (m.includes('planning') || m.includes('calendrier')) return 'planning';
  if (m.includes('ota') || m.includes('d-edge') || m.includes('channel')) return 'ota';
  if (m.includes('flowday') || m.includes('housekeeping') || m.includes('maintenance')) return 'flowday';
  if (m.includes('sas') || m.includes('synchron')) return 'sas';
  if (m.includes('client') || m.includes('guest')) return 'clients';
  if (m.includes('paramètre') || m.includes('parametre') || m.includes('settings') || m.includes('config')) return 'settings';
  return 'default';
}

export interface RiskAnalysis {
  score:            RiskScore;
  affectedModules:  string[];
  sharedComponent:  boolean;
  impactsRevenue:   boolean;
  impactsFinance:   boolean;
  impactsOTA:       boolean;
  rollbackPossible: boolean;
  estimatedTime:    string;
  testsRequired:    boolean;
  strategy:         string;
}

export function computeRiskScore(module: string, priority: TicketPriority): RiskScore {
  const key = moduleKey(module);
  return (RISK_MATRIX[key] ?? RISK_MATRIX.default)[priority];
}

export function getAffectedModules(module: string): string[] {
  return AFFECTED_MODULES[moduleKey(module)] ?? [];
}

export function buildRiskAnalysis(
  module:   string,
  feature:  string,
  priority: TicketPriority,
): RiskAnalysis {
  const key            = moduleKey(module);
  const score          = computeRiskScore(module, priority);
  const affectedModules = getAffectedModules(module);
  const impactsRevenue  = affectedModules.some(m => m.toLowerCase().includes('revenue') || m.toLowerCase().includes('tarif'));
  const impactsFinance  = key === 'finance' || affectedModules.some(m => m.toLowerCase().includes('financ') || m.toLowerCase().includes('factur'));
  const impactsOTA      = key === 'ota' || affectedModules.some(m => m.toLowerCase().includes('ota'));
  const sharedComponent = affectedModules.length > 1;
  const testsRequired   = score === 'critique' || score === 'eleve';
  const rollbackPossible = score !== 'critique';

  const estimatedTimeMap: Record<RiskScore, string> = {
    faible:   '< 1h',
    moyen:    '1–4h',
    eleve:    '4–24h',
    critique: '> 24h + validation complète',
  };

  const strategyMap: Record<RiskScore, string> = {
    faible:   'Correction directe possible. Valider sur environnement de test.',
    moyen:    'Analyser l\'impact sur les composants liés avant intervention. Tests requis.',
    eleve:    'Identifier la cause racine. Proposer un rollback plan. Tester tous les modules impactés.',
    critique: 'Stopper les modifications en production. Analyse complète requise. Validation par l\'équipe avant déploiement.',
  };

  return {
    score,
    affectedModules,
    sharedComponent,
    impactsRevenue,
    impactsFinance,
    impactsOTA,
    rollbackPossible,
    estimatedTime: estimatedTimeMap[score],
    testsRequired,
    strategy: strategyMap[score],
  };
}

export const RISK_COLORS: Record<RiskScore, { bg: string; text: string; border: string; label: string }> = {
  faible:   { bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-200',  label: 'Faible' },
  moyen:    { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200', label: 'Moyen' },
  eleve:    { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200',label: 'Élevé' },
  critique: { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',   label: 'Critique' },
};
