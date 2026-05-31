/**
 * FLOWTYM — Dérivation des badges réservation (fonction pure).
 *
 * Détermine, à partir des champs réels d'une réservation, quels badges
 * afficher sur sa barre Gantt (maquette #3). Aucune donnée fictive : chaque
 * badge n'apparaît que si le champ source le justifie.
 */

export type BadgeKey =
  | 'arrival'    // arrivée du jour
  | 'departure'  // départ du jour
  | 'vip'        // client VIP / fidélité
  | 'paid'       // soldée
  | 'unpaid'     // solde dû
  | 'breakfast'  // petit-déjeuner inclus (BB/HB/FB/AI)
  | 'group'      // réservation de groupe
  | 'online'     // check-in en ligne effectué
  | 'notes';     // demandes spéciales

export interface BadgeInput {
  checkInIso: string;
  checkOutIso: string;
  vip?: boolean | null;
  loyaltyLevel?: string | null;
  paymentStatus?: string | null;
  solde?: number | null;
  groupId?: string | null;
  checkinStatus?: string | null;
  specialRequests?: string | null;
  mealPlan?: string | null;
}

/** Plans incluant un repas (≠ room only). */
const BREAKFAST_PLANS = new Set(['BB', 'HB', 'FB', 'AI']);

/** Un plan tarifaire inclut-il au moins le petit-déjeuner ? */
export function planHasBreakfast(mealPlan?: string | null): boolean {
  if (!mealPlan) return false;
  const code = mealPlan.trim().toUpperCase();
  if (BREAKFAST_PLANS.has(code)) return true;
  // Tolérance libellés longs (« Bed & Breakfast », « Demi-pension »…)
  return /BREAKFAST|PETIT|DEMI|PENSION|DEMI-PENSION|HALF|FULL|INCLUS/.test(code);
}

/**
 * Retourne la liste ordonnée des badges à afficher pour une réservation.
 * @param input  champs réels de la réservation
 * @param todayIso date du jour (YYYY-MM-DD)
 */
export function deriveBadges(input: BadgeInput, todayIso: string): BadgeKey[] {
  const badges: BadgeKey[] = [];
  const ci = input.checkInIso.slice(0, 10);
  const co = input.checkOutIso.slice(0, 10);

  if (ci === todayIso) badges.push('arrival');
  if (co === todayIso) badges.push('departure');
  if (input.vip || (input.loyaltyLevel && input.loyaltyLevel.trim() !== '')) badges.push('vip');

  if (input.paymentStatus === 'paid') badges.push('paid');
  else if ((input.solde ?? 0) > 0) badges.push('unpaid');

  if (planHasBreakfast(input.mealPlan)) badges.push('breakfast');
  if (input.groupId) badges.push('group');
  if (input.checkinStatus === 'online') badges.push('online');
  if (input.specialRequests && input.specialRequests.trim() !== '') badges.push('notes');

  return badges;
}
