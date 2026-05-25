/**
 * FLOWTYM — Event → RMS Integration Bridge
 *
 * Quand des événements sont importés / acceptés dans le module Événements,
 * ce service propage leur impact dans le moteur revenue :
 *
 *   1. Pour chaque date couverte par un événement haute priorité,
 *      le Central Pricing Engine reçoit un seed de prix suggéré
 *      (majoration basée sur l'impact ADR de l'événement).
 *
 *   2. Le rmsAutomationStore reçoit un signal eventIntensity mis à jour
 *      (moyenne pondérée de la compression marché des événements actifs).
 *
 * Ce pont garantit qu'un import d'événements se répercute immédiatement
 * sur les recommandations tarifaires, l'autopilote et les alertes revenue.
 */

import type { RMSMarketEvent } from '../types/events';
import { centralPricingEngine } from './revenue/centralPricingEngine.service';
import { useRateCalendarStore } from '../components/rms/store/rateCalendarStore';
import { useRmsAutomationStore } from '../store/rmsAutomationStore';

const HIGH_IMPACT_THRESHOLD = 60; // impact.compression >= 60 → déclenche l'intégration

/**
 * Propage les événements haute priorité vers le Central Pricing Engine
 * et met à jour le signal eventIntensity de l'autopilote.
 *
 * Appelé juste après bulkUpsert dans le flow import.
 */
export function integrateEventsToRMS(events: RMSMarketEvent[]): void {
  const highImpact = events.filter(
    (ev) => ev.impact.compression >= HIGH_IMPACT_THRESHOLD,
  );

  if (highImpact.length === 0) return;

  // ── 1. Seed du Central Pricing Engine par date ────────────────────────
  const { roomTypes } = useRateCalendarStore.getState();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refRoom = (roomTypes as any[]).find((r: any) => r.isReference) ?? roomTypes[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refPlan = refRoom?.ratePlans?.find((p: any) => p.isReference) ?? refRoom?.ratePlans?.[0];

  for (const ev of highImpact) {
    // Itère sur chaque jour couvert par l'événement
    const start = new Date(ev.startDate);
    const end = new Date(ev.endDate);
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);

      // Prix courant du calendrier pour ce jour (si disponible)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calCell = refPlan?.prices?.find((c: any) => c.date === dateStr);
      const currentPrice = calCell?.price ?? 0;

      if (currentPrice > 0) {
        // Majoration suggérée = currentPrice × (1 + ADR impact / 100)
        const adrFactor = 1 + ev.impact.adr / 100;
        const suggestedPrice = Math.round(currentPrice * adrFactor);

        centralPricingEngine.getOrSeed(dateStr, {
          current: currentPrice,
          suggested: suggestedPrice,
          confidence: ev.impact.confidence,
          strategy: 'event_driven',
          roomTypeCode: refRoom?.roomTypeCode ?? null,
          planId: refPlan?.planId ?? null,
        });
      }

      current.setDate(current.getDate() + 1);
    }
  }

  // ── 2. Signal eventIntensity pour l'autopilote ─────────────────────────
  // Compression moyenne des événements haute priorité actifs aujourd'hui
  const today = new Date().toISOString().slice(0, 10);
  const activeNow = highImpact.filter(
    (ev) => ev.startDate <= today && ev.endDate >= today,
  );

  if (activeNow.length > 0) {
    const avgCompression =
      activeNow.reduce((sum, ev) => sum + ev.impact.compression, 0) /
      activeNow.length;

    // Mise à jour du signal eventIntensity dans l'store automation
    // (jitter désactivé — valeur réelle issue des événements)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useRmsAutomationStore.setState((state: any) => ({
      signals: {
        ...state.signals,
        eventIntensity: Math.round(Math.min(100, avgCompression)),
        marketCompression: Math.round(
          Math.min(100, (state.signals.marketCompression + avgCompression) / 2),
        ),
      },
    }));
  }
}
