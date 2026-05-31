/**
 * FLOWTYM — Moteur de forecast d'occupation (fonctions pures).
 *
 * Le forecast n'est JAMAIS saisi manuellement : il est calculé à partir de
 * signaux réels — occupation actuelle, pickup observé (J vs J-1), taux
 * historiques d'annulation / no-show, et compression marché (Lighthouse).
 *
 * Modèle :
 *   survie       = TO_actuel × (1 − taux_annulation − taux_noshow)
 *   tendance     = (pickup_chambres / chambres_total) × 100 × facteur_leadtime
 *   boost_compr. = max(0, (compression% − 70)) × 0.15   (si demande forte)
 *   forecast     = clamp(0..100, survie + tendance + boost_compression)
 *
 * Le facteur lead-time atténue/amplifie la projection du pickup : plus la date
 * est lointaine, plus il reste de temps pour engranger des réservations.
 */

export interface ForecastInput {
  /** Taux d'occupation actuel pour la date (0-100). */
  currentToRate: number;
  /** Pickup chambres J vs J-1 pour la date. null = pas de baseline. */
  pickupRooms: number | null;
  /** Chambres exploitables ce jour. */
  totalRooms: number;
  /** Jours restants avant la date cible (lead time). */
  remainingDays: number;
  /** Taux d'annulation historique (0-1). */
  cancelRate: number;
  /** Taux de no-show historique (0-1). */
  noshowRate: number;
  /** Compression marché 0-100, ou null si pas de donnée Lighthouse. */
  compressionPercent: number | null;
}

/** Calcule les taux d'attrition (annulation, no-show) sur un échantillon réel. */
export function computeAttritionRates(
  reservations: { status: string }[],
): { cancelRate: number; noshowRate: number } {
  const total = reservations.length;
  if (total === 0) return { cancelRate: 0, noshowRate: 0 };
  let cancelled = 0;
  let noshow = 0;
  for (const r of reservations) {
    if (r.status === 'cancelled') cancelled += 1;
    else if (r.status === 'no_show' || r.status === 'noshow') noshow += 1;
  }
  return { cancelRate: cancelled / total, noshowRate: noshow / total };
}

/** Facteur lead-time ∈ [0.5, 1.5] : 0.5 le jour même, 1.5 à 30 jours et +. */
export function leadTimeFactor(remainingDays: number): number {
  const clamped = Math.min(30, Math.max(0, remainingDays));
  return 0.5 + clamped / 30;
}

/** Calcule le forecast d'occupation (0-100) pour une date. */
export function computeForecast(input: ForecastInput): number {
  const attritionSurvival = Math.max(0, 1 - input.cancelRate - input.noshowRate);
  const survival = input.currentToRate * attritionSurvival;

  const pickupPct = input.totalRooms > 0 && input.pickupRooms != null
    ? (input.pickupRooms / input.totalRooms) * 100
    : 0;
  const trend = pickupPct * leadTimeFactor(input.remainingDays);

  const compressionBoost = input.compressionPercent != null && input.compressionPercent > 70
    ? (input.compressionPercent - 70) * 0.15
    : 0;

  const forecast = survival + trend + compressionBoost;
  return Math.max(0, Math.min(100, Math.round(forecast * 10) / 10));
}
