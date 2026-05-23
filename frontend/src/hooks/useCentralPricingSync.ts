/**
 * FLOWTYM RMS — Pont Central Pricing Engine → Calendrier tarifaire.
 *
 * Le Central Pricing Engine est la source de vérité unique des décisions
 * tarifaires (accept / reject / maintain) émises depuis :
 *   • Veille Concurrentielle
 *   • RMS Tableau Pro
 *   • Recommandations RM / Analyse RM
 *   • Autopilote RMS
 *
 * Avant ce hook, les décisions n'étaient PAS propagées au Calendrier
 * tarifaire (rateCalendarStore). Résultat : une reco acceptée dans le RMS
 * n'apparaissait pas sur la chambre/plan de référence.
 *
 * Ce hook écoute le moteur central, et pour chaque décision finalisée
 * (finalPrice ≠ null) écrit le prix sur la chambre/plan de référence du
 * calendrier — la source de prix unique pour réservation, facturation,
 * channel manager, etc.
 *
 * Sécurité anti-boucle :
 *   - rateCalendarStore.updatePrice n'appelle PAS centralPricingEngine ;
 *   - on déduplique via un Map<date|room|plan, finalPrice> pour ignorer
 *     les notifications redondantes.
 */
import { useEffect, useRef } from 'react';
import { centralPricingEngine, type PricingRecord } from '@/src/services/revenue/centralPricingEngine.service';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';

function keyFor(r: PricingRecord): string {
  return `${r.date}|${r.roomTypeCode ?? '*'}|${r.planId ?? '*'}`;
}

export function useCentralPricingSync() {
  const lastApplied = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    function apply() {
      const { roomTypes } = useRateCalendarStore.getState();
      if (roomTypes.length === 0) return;
      const refRoom = roomTypes.find((r) => r.isReference) ?? roomTypes[0];
      const refPlan = refRoom.ratePlans.find((p) => p.isReference) ?? refRoom.ratePlans[0];
      if (!refRoom || !refPlan) return;

      const records = centralPricingEngine.all();
      for (const r of records) {
        if (r.finalPrice == null) continue;
        if (r.status === 'pending') continue;
        const key = keyFor(r);
        if (lastApplied.current.get(key) === r.finalPrice) continue;

        // Si un roomTypeCode est défini, on essaie de cibler cette chambre ;
        // sinon on retombe sur la chambre/plan de référence.
        const targetRoom = r.roomTypeCode
          ? roomTypes.find((rt) => rt.roomTypeCode === r.roomTypeCode) ?? refRoom
          : refRoom;
        const targetPlan = r.planId
          ? targetRoom.ratePlans.find((p) => p.planId === r.planId) ?? refPlan
          : (targetRoom.ratePlans.find((p) => p.isReference) ?? targetRoom.ratePlans[0]);
        if (!targetRoom || !targetPlan) continue;

        const cell = targetPlan.prices.find((c) => c.date === r.date);
        if (cell && cell.price === r.finalPrice) {
          lastApplied.current.set(key, r.finalPrice);
          continue;
        }

        useRateCalendarStore.getState().updatePrice(
          targetRoom.roomTypeId,
          targetPlan.planId,
          r.date,
          r.finalPrice,
        );
        lastApplied.current.set(key, r.finalPrice);
      }
    }

    // Première application + abonnement (re-évaluation à chaque notify du moteur)
    apply();
    return centralPricingEngine.subscribe(apply);
  }, []);
}
