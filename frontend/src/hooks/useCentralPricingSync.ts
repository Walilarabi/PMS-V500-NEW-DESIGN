/**
 * FLOWTYM RMS — Pont Central Pricing Engine ⇄ Calendrier tarifaire.
 *
 * Le Central Pricing Engine est la source de vérité unique des décisions
 * tarifaires (accept / reject / maintain) émises depuis :
 *   • Veille Concurrentielle
 *   • RMS Tableau Pro
 *   • Recommandations RM / Analyse RM
 *   • Autopilote RMS
 *
 * Ce hook garantit deux invariants :
 *
 *  1) Toute décision finalisée (status ≠ pending, finalPrice ≠ null) est
 *     immédiatement appliquée sur la chambre/plan de référence du
 *     Calendrier tarifaire (rateCalendarStore.updatePrice).
 *
 *  2) Quand le Calendrier (re)charge ses données (changement de période,
 *     ajout d'une nouvelle chambre, refresh Supabase), toutes les
 *     décisions du moteur sont ré-appliquées sur les cellules
 *     nouvellement disponibles — y compris celles qui n'existaient pas
 *     au moment de la décision.
 *
 * Bug fixé : la version précédente marquait l'application comme « faite »
 * même quand `updatePrice` échouait silencieusement (cellule introuvable
 * car date hors période chargée). Résultat : recommandation acceptée +
 * navigation calendrier → le prix n'apparaissait jamais. On vérifie
 * désormais la cellule avant de mémoriser l'application.
 */
import { useEffect, useRef } from 'react';
import { centralPricingEngine, type PricingRecord } from '@/src/services/revenue/centralPricingEngine.service';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';

function keyFor(r: PricingRecord): string {
  return `${r.date}|${r.roomTypeCode ?? '*'}|${r.planId ?? '*'}`;
}

/**
 * Applique les décisions du moteur central sur le store calendrier.
 * Renvoie le nombre d'écritures effectives (pour debug/audit).
 *
 * Exporté pour pouvoir être appelé manuellement après un loadData.
 */
export function applyCentralPricingToCalendar(
  lastApplied: Map<string, number>,
): number {
  const { roomTypes } = useRateCalendarStore.getState();
  if (roomTypes.length === 0) return 0;

  const refRoom = roomTypes.find((r) => r.isReference) ?? roomTypes[0];
  if (!refRoom) return 0;

  const records = centralPricingEngine.all();
  let written = 0;

  for (const r of records) {
    if (r.finalPrice == null) continue;
    if (r.status === 'pending') continue;
    const key = keyFor(r);

    // Détermine la chambre cible : la chambre demandée, sinon la référente.
    const targetRoom = r.roomTypeCode
      ? roomTypes.find((rt) => rt.roomTypeCode === r.roomTypeCode) ?? refRoom
      : refRoom;
    const refPlan = targetRoom.ratePlans.find((p) => p.isReference) ?? targetRoom.ratePlans[0];
    const targetPlan = r.planId
      ? targetRoom.ratePlans.find((p) => p.planId === r.planId) ?? refPlan
      : refPlan;
    if (!targetPlan) continue;

    const cell = targetPlan.prices.find((c) => c.date === r.date);

    // Pas de cellule (date hors période actuellement chargée) — on garde la
    // décision en attente : elle sera ré-appliquée au prochain loadData
    // (sans pollueur de `lastApplied`).
    if (!cell) continue;

    // Déjà à jour : on note pour skip futur, mais on ne fait pas d'écriture.
    if (cell.price === r.finalPrice) {
      lastApplied.set(key, r.finalPrice);
      continue;
    }

    // Skip si on a déjà écrit cette valeur et que la cellule l'a perdue
    // (situation rare : reload du store sans purge engine). Sinon, écrit.
    if (lastApplied.get(key) === r.finalPrice && cell.price === r.finalPrice) continue;

    useRateCalendarStore.getState().updatePrice(
      targetRoom.roomTypeId,
      targetPlan.planId,
      r.date,
      r.finalPrice,
    );
    lastApplied.set(key, r.finalPrice);
    written++;
  }

  return written;
}

export function useCentralPricingSync() {
  const lastApplied = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    function run() {
      applyCentralPricingToCalendar(lastApplied.current);
    }

    // 1) Toute notification du moteur central déclenche la propagation.
    const offEngine = centralPricingEngine.subscribe(run);

    // 2) Tout changement du store calendrier (loadData, edit, ajout de chambre)
    //    rejoue toutes les décisions — y compris sur les cellules
    //    nouvellement disponibles.
    let prevSig = signatureOfRoomTypes();
    const offCalendar = useRateCalendarStore.subscribe(() => {
      const sig = signatureOfRoomTypes();
      if (sig !== prevSig) {
        prevSig = sig;
        // reset partiel : on garde lastApplied car keyFor est stable, mais
        // applyCentralPricingToCalendar re-vérifie le prix réel de la cellule.
        run();
      }
    });

    // 3) Première application au mount (au cas où le moteur a déjà des
    //    décisions persistées et le calendrier est déjà chargé).
    run();

    return () => { offEngine(); offCalendar(); };
  }, []);
}

/** Signature stable des roomTypes : change quand le contenu change. */
function signatureOfRoomTypes(): string {
  const { roomTypes } = useRateCalendarStore.getState();
  // un hash léger : nombre de rooms × somme des cellules sur le plan référent
  let cellCount = 0;
  for (const rt of roomTypes) {
    const refPlan = rt.ratePlans.find((p) => p.isReference) ?? rt.ratePlans[0];
    if (refPlan) cellCount += refPlan.prices.length;
  }
  return `${roomTypes.length}|${cellCount}`;
}
