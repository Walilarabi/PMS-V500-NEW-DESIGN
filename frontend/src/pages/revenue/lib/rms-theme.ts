/**
 * FLOWTYM Revenue — Design System (rms-theme)
 *
 * Source unique pour TOUTES les couleurs, niveaux, badges et tokens
 * du module Revenue. Tout composant Revenue doit importer d'ici plutôt
 * que de redéfinir localement.
 *
 * Vague A — Fondations.
 */

import type { SourceMode } from '../../../services/recommandation-rm.service';

// ═══════════════════════════════════════════════════════════════════════════
// NIVEAUX & HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export type DemandLevel      = 'Faible' | 'Moyenne' | 'Forte' | 'Très forte';
export type CompressionLevel = 'Faible' | 'Moyenne' | 'Élevée' | 'Très élevée';

export function getDemandLevel(score: number): DemandLevel {
  if (score >= 80) return 'Très forte';
  if (score >= 60) return 'Forte';
  if (score >= 30) return 'Moyenne';
  return 'Faible';
}

export function getCompressionLevel(score: number): CompressionLevel {
  if (score >= 75) return 'Très élevée';
  if (score >= 50) return 'Élevée';
  if (score >= 25) return 'Moyenne';
  return 'Faible';
}

export function getPricingOpportunity(demandScore: number, compressionScore: number): string {
  if (demandScore < 30) return '–';
  if (demandScore < 60) return '+5% à +10%';
  if (demandScore < 80) return '+10% à +25%';
  if (compressionScore >= 50) return '+25% à +50%';
  return '+15% à +30%';
}

export function getMissingEventAlert(marketPressure: number, eventsCount: number): boolean {
  return marketPressure > 70 && eventsCount === 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// COULEURS PAR NIVEAU (badges complets)
// ═══════════════════════════════════════════════════════════════════════════

export const DEMAND_COLORS: Record<DemandLevel, string> = {
  'Très forte': 'bg-red-100 text-red-800 border-red-200',
  'Forte':      'bg-amber-100 text-amber-800 border-amber-200',
  'Moyenne':    'bg-blue-100 text-blue-800 border-blue-200',
  'Faible':     'bg-gray-100 text-gray-600 border-gray-200',
};

export const COMPRESSION_COLORS: Record<CompressionLevel, string> = {
  'Très élevée': 'bg-red-100 text-red-800 border-red-200',
  'Élevée':      'bg-orange-100 text-orange-800 border-orange-200',
  'Moyenne':     'bg-amber-100 text-amber-800 border-amber-200',
  'Faible':      'bg-gray-100 text-gray-600 border-gray-200',
};

export const DEMAND_DOT: Record<DemandLevel, string> = {
  'Très forte': 'bg-red-500',
  'Forte':      'bg-amber-500',
  'Moyenne':    'bg-blue-500',
  'Faible':     'bg-gray-300',
};

export const COMPRESSION_DOT: Record<CompressionLevel, string> = {
  'Très élevée': 'bg-red-500',
  'Élevée':      'bg-orange-500',
  'Moyenne':     'bg-amber-400',
  'Faible':      'bg-gray-300',
};

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE MODE BADGES (LH / EX / Croisé)
// ═══════════════════════════════════════════════════════════════════════════

export const SOURCE_MODE_BADGE: Record<SourceMode, { label: string; cls: string }> = {
  crossed:         { label: 'Croisé LH + EX',  cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  lighthouse_only: { label: 'Lighthouse seul', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  expedia_only:    { label: 'Expedia seul',    cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  none:            { label: 'Aucune source',   cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

export const DOMINANT_SOURCE_LABEL: Record<string, string> = {
  lighthouse: 'LH',
  expedia:    'EX',
  tie:        'LH=EX',
  none:       '–',
};

// ═══════════════════════════════════════════════════════════════════════════
// ACCENTS DYNAMIQUES (text color selon valeur)
// ═══════════════════════════════════════════════════════════════════════════

export function pressureAccent(v: number): string {
  if (v >= 70) return 'text-red-700';
  if (v >= 40) return 'text-amber-700';
  return 'text-gray-700';
}

export function confidenceAccent(v: number): string {
  if (v >= 80) return 'text-emerald-700';
  if (v >= 60) return 'text-amber-700';
  return 'text-red-600';
}

export function deltaAccent(v: number): string {
  if (v > 0) return 'text-emerald-600';
  if (v < 0) return 'text-red-600';
  return 'text-gray-500';
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS DOTS (validation status)
// ═══════════════════════════════════════════════════════════════════════════

export const STATUS_DOT: Record<string, string> = {
  'Acceptée':   'bg-emerald-500',
  'Refusée':    'bg-red-500',
  'Maintenue':  'bg-gray-400',
  'En attente': 'bg-amber-400',
};

export const STATUS_BADGE: Record<string, string> = {
  'Acceptée':   'bg-emerald-100 text-emerald-800',
  'Refusée':    'bg-red-100 text-red-800',
  'Maintenue':  'bg-gray-200 text-gray-700',
  'En attente': 'bg-amber-100 text-amber-800',
};

// ═══════════════════════════════════════════════════════════════════════════
// REVENUE DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export const REVENUE_TOKENS = {
  // Spacing standardisés
  spacing: {
    toolbar:     'px-4 py-2.5',
    card:        'px-4 py-3',
    table:       'px-3 py-2',
    badge:       'px-2 py-0.5',
    button:      'px-3 py-1.5',
    buttonSm:    'px-2.5 py-1',
    modalHeader: 'px-6 py-4',
    modalBody:   'px-6 py-5',
    modalFooter: 'px-6 py-3',
  },
  // Border radius
  radii: {
    badge:  'rounded-full',
    button: 'rounded-md',
    card:   'rounded-lg',
    modal:  'rounded-2xl',
    pill:   'rounded-full',
  },
  // Shadows
  shadows: {
    card:      'shadow-sm',
    cardHover: 'shadow-md',
    modal:     'shadow-2xl',
    stickyCol: 'shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]',
  },
  // Transitions
  transitions: {
    fast:   'transition-colors duration-150',
    medium: 'transition-all duration-200',
    slow:   'transition-all duration-300',
  },
  // Borders
  borders: {
    default: 'border border-gray-200',
    subtle:  'border border-gray-100',
    accent:  'border border-violet-200',
  },
  // Typography
  typography: {
    label:          'text-[10px] uppercase tracking-wide font-semibold text-gray-500',
    labelTight:     'text-[9px] uppercase tracking-wide font-semibold text-gray-500 leading-none',
    valuePrimary:   'text-base font-bold tabular-nums',
    valueSecondary: 'text-sm font-semibold tabular-nums',
    bodyCompact:    'text-xs',
    body:           'text-sm',
    title:          'text-base font-semibold text-gray-900',
    titleLarge:     'text-lg font-bold tracking-tight',
  },
  // Brand colors (in CSS variable form so they're easy to swap)
  colors: {
    primary:        '#7c3aed',
    primaryHover:   '#6d28d9',
    primaryLight:   '#f5f3ff',
    success:        '#10b981',
    successLight:   '#d1fae5',
    warning:        '#f59e0b',
    warningLight:   '#fef3c7',
    danger:         '#ef4444',
    dangerLight:    '#fee2e2',
    neutral:        '#6b7280',
    accent:         '#7c3aed',
    // Simulation mode (orange clair, non destructif)
    simulation:     '#fb923c',
    simulationLight:'#fff7ed',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER cn() — usage commun dans tout le module Revenue
// ═══════════════════════════════════════════════════════════════════════════

export const cn = (...c: (string | boolean | undefined | null)[]) =>
  c.filter(Boolean).join(' ');
