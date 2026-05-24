/**
 * FLOWTYM RMS — Utilitaires de déduplication pour le Calendrier tarifaire.
 *
 * Résout le bug "dédoublement Ouverture/Fermeture + 3 lignes tarifaires
 * dupliquées pour un même plan" qui survenait quand :
 *   • la table `plans` Supabase contenait plusieurs lignes pour le même
 *     plan_code (legacy import ou bug intégration) ;
 *   • la table `rate_restrictions` avait plusieurs entrées pour la même
 *     paire (room_type_code, stay_date).
 *
 * Stratégie : déduplication **stable** côté client (la plus récente gagne),
 * appliquée à 3 endroits :
 *   1. supabaseAdapter avant construction des RoomTypeData[]
 *   2. rateCalendarStore.loadData après chargement
 *   3. (defensive) au rendu, RoomSection vérifie filteredPlans
 */
import type { RatePlanData, RatePrice, RoomStatus, RoomTypeData } from '../types';

/**
 * Dédupe une liste de RatePlanData par `planCode` (clé fonctionnelle).
 * En cas de doublon, on garde la dernière occurrence (présomption :
 * import le plus récent). Préserve l'ordre original sinon.
 */
export function dedupRatePlans(plans: RatePlanData[]): RatePlanData[] {
  if (plans.length <= 1) return plans.map(dedupRatePlanInner);
  const seen = new Map<string, number>(); // planCode → index dans `plans`
  plans.forEach((p, idx) => {
    const key = (p.planCode ?? p.planId ?? '').trim().toLowerCase();
    if (!key) return;
    seen.set(key, idx); // écrase = garde le plus récent
  });
  const keepIndexes = new Set(seen.values());
  return plans.filter((_, i) => keepIndexes.has(i)).map(dedupRatePlanInner);
}

/**
 * Dédupe les `prices` d'un plan tarifaire par `date`. Évite l'affichage
 * de plusieurs cellules pour une même date quand la table rate_prices
 * Supabase contient des doublons (bug Phase 8 — push RMS répétés).
 */
export function dedupRatePrices(prices: RatePrice[]): RatePrice[] {
  if (prices.length <= 1) return prices;
  const byDate = new Map<string, RatePrice>();
  for (const p of prices) {
    const existing = byDate.get(p.date);
    if (!existing) {
      byDate.set(p.date, p);
      continue;
    }
    // Merge : préfère la valeur la plus récente (priceVersion + priceId)
    const moreRecent =
      (p.priceVersion ?? 0) > (existing.priceVersion ?? 0)
        ? p
        : (existing.priceVersion ?? 0) > (p.priceVersion ?? 0)
          ? existing
          : p; // tie-break sur la dernière entrée du tableau
    byDate.set(p.date, moreRecent);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Helper interne : applique dedupRatePrices à un plan. */
function dedupRatePlanInner(p: RatePlanData): RatePlanData {
  const dedupedPrices = dedupRatePrices(p.prices);
  if (dedupedPrices.length === p.prices.length) return p;
  return { ...p, prices: dedupedPrices };
}

/**
 * Dédupe une liste de RoomStatus par `date`. En cas de doublon, on
 * fusionne en gardant la dernière valeur non-vide pour chaque champ.
 * Évite la perte de restrictions saisies par l'utilisateur.
 */
export function dedupRoomStatuses(statuses: RoomStatus[]): RoomStatus[] {
  if (statuses.length <= 1) return statuses;
  const byDate = new Map<string, RoomStatus>();
  for (const s of statuses) {
    const existing = byDate.get(s.date);
    if (!existing) {
      byDate.set(s.date, s);
      continue;
    }
    // Merge — préfère la valeur non-nulle de la nouvelle entrée
    byDate.set(s.date, {
      ...existing,
      ...s,
      // Conserve la restrictionId la plus récente (Supabase = source de vérité)
      restrictionId: s.restrictionId ?? existing.restrictionId,
      restrictionVersion: s.restrictionVersion ?? existing.restrictionVersion,
    });
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Dédupe l'ensemble d'un RoomTypeData : plans + statuses.
 */
export function dedupRoomType(rt: RoomTypeData): RoomTypeData {
  const plans = dedupRatePlans(rt.ratePlans);
  const statuses = dedupRoomStatuses(rt.statuses);
  if (plans.length === rt.ratePlans.length && statuses.length === rt.statuses.length) {
    return rt;
  }
  return { ...rt, ratePlans: plans, statuses };
}

/**
 * Dédupe également la liste des room types par roomTypeCode (cas extrême
 * où deux chambres physiques distinctes auraient le même code).
 */
export function dedupRoomTypes(rooms: RoomTypeData[]): RoomTypeData[] {
  if (rooms.length <= 1) return rooms.map(dedupRoomType);
  const seen = new Map<string, RoomTypeData>();
  for (const r of rooms) {
    const key = (r.roomTypeCode ?? r.roomTypeId).trim().toLowerCase();
    if (!key) {
      seen.set(r.roomTypeId, dedupRoomType(r));
      continue;
    }
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, dedupRoomType(r));
    } else {
      // Fusionne — concatène les plans puis re-dédupe
      seen.set(key, dedupRoomType({
        ...existing,
        ratePlans: [...existing.ratePlans, ...r.ratePlans],
        statuses: [...existing.statuses, ...r.statuses],
      }));
    }
  }
  return Array.from(seen.values());
}
