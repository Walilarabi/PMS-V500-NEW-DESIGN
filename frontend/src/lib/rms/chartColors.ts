/**
 * FLOWTYM RMS — Veille Concurrentielle
 * Palette de couleurs centralisée pour les graphiques et la température
 * de demande marché.
 *
 * RÈGLE ABSOLUE : une barre de demande = une seule couleur unie.
 * Jamais de dégradé, jamais de multicolore, jamais de remplissage segmenté.
 */

export type DemandTier =
  | 'blue'
  | 'green'
  | 'lightOrange'
  | 'darkOrange'
  | 'lightRed'
  | 'darkRed';

/** Couleur unie associée à chaque palier de demande marché. */
export const DEMAND_COLORS: Record<DemandTier, string> = {
  blue: '#3B82F6',
  green: '#22C55E',
  lightOrange: '#F59E0B',
  darkOrange: '#EA580C',
  lightRed: '#EF4444',
  darkRed: '#991B1B',
};

export interface DemandBand {
  tier: DemandTier;
  label: string;
  color: string;
  min: number;
  max: number;
}

/** Les 6 paliers de température de la demande marché (ordre croissant). */
export const DEMAND_BANDS: DemandBand[] = [
  { tier: 'blue', label: '0 – 30%', color: DEMAND_COLORS.blue, min: 0, max: 30 },
  { tier: 'green', label: '> 30 – 50%', color: DEMAND_COLORS.green, min: 30, max: 50 },
  { tier: 'lightOrange', label: '> 50 – 70%', color: DEMAND_COLORS.lightOrange, min: 50, max: 70 },
  { tier: 'darkOrange', label: '> 70 – 80%', color: DEMAND_COLORS.darkOrange, min: 70, max: 80 },
  { tier: 'lightRed', label: '> 80 – 90%', color: DEMAND_COLORS.lightRed, min: 80, max: 90 },
  { tier: 'darkRed', label: '> 90%', color: DEMAND_COLORS.darkRed, min: 90, max: 100 },
];

/** Couleurs des séries de graphique (lignes, zones, barres de référence). */
export const CHART_COLORS = {
  ourHotel: '#2563EB',      // Folkestone Opéra — ligne bleue pleine
  median: '#22C55E',        // Médiane compset (aujourd'hui) — ligne verte pleine
  medianPast: '#7C3AED',    // Médiane compset (passé) — ligne violette pointillée
  iqrBand: '#CBD5E1',       // Écart interquartile — zone grise
  iqrBandFill: '#E2E8F0',
  hierBar: '#CBD5E1',       // Barres « Hier » — gris uni
  hierBarLabel: '#94A3B8',
  spreadFrom: '#22C55E',    // Zone d'écart entre médianes — dégradé vert
  spreadTo: '#A78BFA',
  grid: '#EEF1F5',
  axis: '#CBD5E1',
  axisText: '#64748B',
} as const;

/** Couleurs sémantiques (variations, deltas). */
export const SEMANTIC_COLORS = {
  positive: '#16A34A',
  negative: '#EF4444',
  neutral: '#94A3B8',
  accent: '#2563EB',
  violet: '#7C3AED',
} as const;
