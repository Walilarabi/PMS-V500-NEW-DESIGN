/**
 * FLOWTYM RMS — Cohérence Calendrier ↔ Autopilote ↔ RMS
 *
 * Source unique de vérité pour le « prix de référence » (BAR du type de
 * chambre principal) à une date donnée. Utilisée par :
 *   • l'Autopilote (forecast & push CM)
 *   • le RMS table (recommendations)
 *   • le formulaire de réservation (proposition initiale)
 *   • les simulations (basePrice de départ)
 *
 * AVANT cette refonte : l'Autopilote utilisait un `defaultBasePrice = 150€`
 * figé dans le composant, indépendant du calendrier. Conséquence : ses
 * recommandations divergeaient du tableau RMS qui lui se basait sur les
 * prix réels du calendrier. Ce module corrige ce bug critique de
 * cohérence métier.
 *
 * Règles métier :
 *   1) Type de chambre de référence = `isReference: true` (ou le 1er si absent)
 *   2) Plan tarifaire de référence = plan BAR / "BAR" / 1er plan actif
 *   3) Prix retourné = prix réel du calendrier à la date demandée
 *   4) Fallbacks ordonnés :
 *        a. prix exact date demandée
 *        b. prix moyen des 7 derniers jours connus (lissage)
 *        c. prix moyen sur toute la série connue
 *        d. valeur safe par défaut (150)
 *
 * 100 % pur, déterministe, testable.
 */

import type { RoomTypeData, RatePlanData, RatePrice } from '../../components/rms/types';

const SAFE_DEFAULT_PRICE = 150;

/* ────────────────────────────────────────────────────────────────────────── */
/* SÉLECTEUR : type de chambre de référence                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Renvoie le type de chambre marqué comme référence (`isReference: true`).
 * Fallback : 1er type actif, sinon 1er type tout court, sinon null.
 */
export function pickReferenceRoom(roomTypes: RoomTypeData[]): RoomTypeData | null {
  if (!roomTypes || roomTypes.length === 0) return null;
  const explicit = roomTypes.find((r) => r.isReference === true);
  if (explicit) return explicit;
  const active = roomTypes.find((r) => r.isActive !== false);
  if (active) return active;
  return roomTypes[0];
}

/**
 * Renvoie le rate plan "BAR" (Best Available Rate) du type de chambre.
 * Fallback : plan dont le code commence par "BAR", sinon plan dont le nom
 * contient "BAR", sinon 1er plan actif, sinon 1er plan.
 */
export function pickBarPlan(room: RoomTypeData): RatePlanData | null {
  if (!room.ratePlans || room.ratePlans.length === 0) return null;
  const byCode = room.ratePlans.find((p) =>
    typeof p.planCode === 'string' && p.planCode.trim().toUpperCase().startsWith('BAR'),
  );
  if (byCode) return byCode;
  const byName = room.ratePlans.find((p) =>
    typeof p.planName === 'string' && p.planName.toUpperCase().includes('BAR'),
  );
  if (byName) return byName;
  const active = room.ratePlans.find((p) => p.isActive !== false);
  if (active) return active;
  return room.ratePlans[0];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* GETTER : prix BAR à une date                                                */
/* ────────────────────────────────────────────────────────────────────────── */

interface PriceLookupResult {
  price: number;
  /** D'où vient le prix : 'exact' / 'avg7' / 'avgAll' / 'default'. */
  source: 'exact' | 'avg7' | 'avgAll' | 'default';
  /** Type de chambre utilisé (libellé court pour traçabilité). */
  roomLabel: string | null;
  /** Plan utilisé (libellé court). */
  planLabel: string | null;
}

/**
 * Renvoie le prix BAR à une date donnée avec fallback intelligent.
 * @param date  ISO YYYY-MM-DD
 */
export function getBarPriceForDate(
  roomTypes: RoomTypeData[],
  date: string,
): PriceLookupResult {
  const room = pickReferenceRoom(roomTypes);
  if (!room) {
    return { price: SAFE_DEFAULT_PRICE, source: 'default', roomLabel: null, planLabel: null };
  }
  const plan = pickBarPlan(room);
  if (!plan) {
    return { price: SAFE_DEFAULT_PRICE, source: 'default', roomLabel: room.roomTypeName ?? null, planLabel: null };
  }
  const prices = (plan.prices ?? []) as RatePrice[];

  // 1. Exact date
  const exact = prices.find((p) => p.date === date && Number.isFinite(p.price) && p.price > 0);
  if (exact) {
    return {
      price: roundPrice(exact.price),
      source: 'exact',
      roomLabel: room.roomTypeName ?? null,
      planLabel: plan.planName ?? null,
    };
  }

  // 2. Avg des 7 derniers jours connus avant `date`
  const past7 = prices
    .filter((p) => p.date < date && Number.isFinite(p.price) && p.price > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map((p) => p.price);
  if (past7.length >= 3) {
    const avg = past7.reduce((s, v) => s + v, 0) / past7.length;
    return {
      price: roundPrice(avg),
      source: 'avg7',
      roomLabel: room.roomTypeName ?? null,
      planLabel: plan.planName ?? null,
    };
  }

  // 3. Avg toute la série connue
  const allPositive = prices.filter((p) => Number.isFinite(p.price) && p.price > 0);
  if (allPositive.length > 0) {
    const avg = allPositive.reduce((s, p) => s + p.price, 0) / allPositive.length;
    return {
      price: roundPrice(avg),
      source: 'avgAll',
      roomLabel: room.roomTypeName ?? null,
      planLabel: plan.planName ?? null,
    };
  }

  // 4. Default
  return {
    price: SAFE_DEFAULT_PRICE,
    source: 'default',
    roomLabel: room.roomTypeName ?? null,
    planLabel: plan.planName ?? null,
  };
}

/**
 * Version simplifiée pour les callers qui ne veulent que le prix.
 */
export function getBarPriceValueForDate(
  roomTypes: RoomTypeData[],
  date: string,
): number {
  return getBarPriceForDate(roomTypes, date).price;
}

/**
 * Prix moyen BAR sur les `daysAhead` prochains jours connus.
 * Utilisé comme `defaultBasePrice` de l'Autopilote pour initialiser sa
 * simulation avec une valeur cohérente avec le calendrier.
 *
 * @param daysAhead nombre de jours à projeter (défaut 30)
 * @param today     date de départ (défaut aujourd'hui)
 */
export function getAverageBarPriceAhead(
  roomTypes: RoomTypeData[],
  daysAhead = 30,
  today: Date = new Date(),
): number {
  const room = pickReferenceRoom(roomTypes);
  if (!room) return SAFE_DEFAULT_PRICE;
  const plan = pickBarPlan(room);
  if (!plan) return SAFE_DEFAULT_PRICE;

  const todayIso = today.toISOString().slice(0, 10);
  const endIso = (() => {
    const e = new Date(today);
    e.setDate(today.getDate() + daysAhead);
    return e.toISOString().slice(0, 10);
  })();

  const inRange = (plan.prices ?? []).filter(
    (p) => p.date >= todayIso && p.date <= endIso && Number.isFinite(p.price) && p.price > 0,
  );
  if (inRange.length === 0) return SAFE_DEFAULT_PRICE;
  const avg = inRange.reduce((s, p) => s + p.price, 0) / inRange.length;
  return roundPrice(avg);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function roundPrice(p: number): number {
  // Arrondi à l'entier — cohérent avec l'affichage € sans décimale du PMS.
  // Les flottants à virgule causaient des divergences d'affichage 138.5 vs 139.
  return Math.round(p);
}
