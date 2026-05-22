/**
 * FLOWTYM RMS — Règles de température de la demande marché.
 *
 * Mapping STRICT valeur → palier → couleur unie.
 *   value <= 30          => blue
 *   value > 30 && <= 50  => green
 *   value > 50 && <= 70  => lightOrange
 *   value > 70 && <= 80  => darkOrange
 *   value > 80 && <= 90  => lightRed
 *   value > 90           => darkRed
 */

import type { DemandTier, DemandBand } from './chartColors';
import { DEMAND_COLORS, DEMAND_BANDS } from './chartColors';

/** Retourne le palier de demande pour une valeur (0-100). */
export function getDemandTier(value: number): DemandTier {
  if (value <= 30) return 'blue';
  if (value <= 50) return 'green';
  if (value <= 70) return 'lightOrange';
  if (value <= 80) return 'darkOrange';
  if (value <= 90) return 'lightRed';
  return 'darkRed';
}

/**
 * Couleur unie pour une barre de demande marché.
 * UNE valeur => UNE couleur. Aucun dégradé.
 */
export function getDemandColor(value: number): string {
  return DEMAND_COLORS[getDemandTier(value)];
}

/** Bande complète (label + bornes + couleur) pour une valeur. */
export function getDemandBand(value: number): DemandBand {
  const tier = getDemandTier(value);
  return DEMAND_BANDS.find((b) => b.tier === tier) ?? DEMAND_BANDS[0];
}

export type MarketPressureLevel =
  | 'Calme'
  | 'Modéré'
  | 'Soutenu'
  | 'Tendu'
  | 'Surchauffe';

export interface MarketPressure {
  level: MarketPressureLevel;
  color: string;
}

/** Niveau de pression marché à partir de la demande moyenne. */
export function getMarketPressure(avgDemand: number): MarketPressure {
  if (avgDemand <= 30) return { level: 'Calme', color: DEMAND_COLORS.blue };
  if (avgDemand <= 50) return { level: 'Modéré', color: DEMAND_COLORS.green };
  if (avgDemand <= 70) return { level: 'Soutenu', color: DEMAND_COLORS.lightOrange };
  if (avgDemand <= 85) return { level: 'Tendu', color: DEMAND_COLORS.darkOrange };
  return { level: 'Surchauffe', color: DEMAND_COLORS.lightRed };
}
