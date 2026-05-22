/**
 * FLOWTYM RMS — Calculs de comparaison dynamique.
 *
 * Deltas Aujourd'hui vs période passée (Hier / J-3 / J-7 / J-14 / J-30) :
 *   - demande marché
 *   - médiane compset
 *   - positionnement (rang : plus bas = meilleur)
 *   - momentum marché
 */

export type Direction = 'up' | 'down' | 'flat';

export interface Delta {
  value: number;
  percent: number;
  direction: Direction;
}

function resolveDirection(value: number, threshold = 0): Direction {
  if (value > threshold) return 'up';
  if (value < -threshold) return 'down';
  return 'flat';
}

/** Delta de demande marché (points de %). */
export function calculateDemandDelta(today: number, past: number): Delta {
  const value = Math.round(today - past);
  return {
    value,
    percent: past !== 0 ? ((today - past) / past) * 100 : 0,
    direction: resolveDirection(value, 0.5),
  };
}

/** Delta de médiane compset (en €). */
export function calculateMedianDelta(today: number, past: number): Delta {
  const value = Math.round(today - past);
  return {
    value,
    percent: past !== 0 ? ((today - past) / past) * 100 : 0,
    direction: resolveDirection(value, 0.5),
  };
}

/**
 * Delta de positionnement.
 * Le rang est inversé : un rang plus bas est meilleur.
 * value > 0  => gain de places (amélioration)
 */
export function calculatePositionDelta(todayRank: number, pastRank: number): Delta {
  const value = pastRank - todayRank;
  return {
    value,
    percent: 0,
    direction: resolveDirection(value, 0),
  };
}

export type MomentumLabel =
  | 'Refroidissement'
  | 'Marché stable'
  | 'Réchauffement'
  | 'Surchauffe';

export interface Momentum {
  label: MomentumLabel;
  /** Intensité 0-5 pour la jauge à segments. */
  intensity: number;
  color: string;
}

/** Momentum marché déduit de la variation de demande. */
export function getMarketMomentum(demandDelta: number): Momentum {
  if (demandDelta <= -10) {
    return { label: 'Refroidissement', intensity: 1, color: '#3B82F6' };
  }
  if (demandDelta < 8) {
    return { label: 'Marché stable', intensity: 2, color: '#22C55E' };
  }
  if (demandDelta < 20) {
    return { label: 'Réchauffement', intensity: 4, color: '#F59E0B' };
  }
  return { label: 'Surchauffe', intensity: 5, color: '#EF4444' };
}

/** Moyenne d'un tableau de nombres (0 si vide). */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Formatage signé d'un nombre (+12 / -8 / 0). */
export function formatSigned(value: number, suffix = ''): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
}
