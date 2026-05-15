/**
 * useRevenueEngine.ts
 * Hook React wrappant le moteur de tarification dynamique.
 * Fournit des fonctions mémoïsées pour calculer prix et taux d'occupation.
 */

import { useMemo, useCallback } from 'react';
import { useConfigStore } from '../store/configStore';
import { useReservations } from '../contexts/ReservationContext';
import {
  computeDynamicPrice,
  computeOccupancyForDate,
  checkOverbookingAllowed,
  type DynamicPriceResult,
  type ComputePriceParams,
} from '../store/revenueEngine';

export interface UseRevenueEngineReturn {
  /**
   * Calcule le prix dynamique pour un séjour.
   * Mémoïsé — recalculé uniquement si les réservations ou événements changent.
   */
  getPriceForStay: (params: {
    basePrice: number;
    checkInDate: string;
    roomCategory?: string;
  }) => DynamicPriceResult;

  /**
   * Calcule le taux d'occupation pour une date donnée (en %)
   */
  getOccupancyForDate: (date: string) => number;

  /**
   * Vérifie si l'overbooking est autorisé pour une catégorie/global
   */
  canOverbook: (params: {
    roomCategory?: string;
    checkInDate: string;
    checkOutDate: string;
    currentRoom: string;
  }) => { allowed: boolean; maxAllowed: number; overCount: number; isOver: boolean };

  /**
   * Retourne un résumé des règles actives pour affichage
   */
  getActivePricingRules: () => typeof useConfigStore extends (...args: any) => { pricingRules: infer R } ? R : never;
}

export function useRevenueEngine() {
  const { events, rooms, pricingRules, eventMultipliers, overbooking } = useConfigStore();
  const { reservations } = useReservations();

  const totalRooms = rooms.length;

  // ── Taux d'occupation par date (mémoïsé sur les réservations) ──
  const getOccupancyForDate = useCallback((date: string): number => {
    return computeOccupancyForDate({
      date,
      totalRooms,
      reservations: reservations.map(r => ({
        arrival: r.arrival,
        departure: r.departure,
        reservationStatus: r.reservationStatus,
        isOverbooking: r.isOverbooking,
      })),
    });
  }, [reservations, totalRooms]);

  // ── Calcul prix dynamique ──
  const getPriceForStay = useCallback((params: {
    basePrice: number;
    checkInDate: string;
    roomCategory?: string;
  }): DynamicPriceResult => {
    const occupancyPct = getOccupancyForDate(params.checkInDate);
    return computeDynamicPrice({
      basePrice: params.basePrice,
      checkInDate: params.checkInDate,
      currentOccupancyPct: occupancyPct,
      activeEvents: events,
      rules: pricingRules,
      eventMultipliers,
    });
  }, [getOccupancyForDate, events, pricingRules, eventMultipliers]);

  // ── Vérification overbooking ──
  const canOverbook = useCallback((params: {
    roomCategory?: string;
    checkInDate: string;
    checkOutDate: string;
    currentRoom: string;
  }) => {
    if (!overbooking.enabled) {
      return { allowed: false, maxAllowed: totalRooms, overCount: 0, isOver: false };
    }

    // Compter les réservations actives sur la période
    const cin = new Date(params.checkInDate).getTime();
    const cout = new Date(params.checkOutDate).getTime();
    const occupied = reservations.filter(r => {
      if (['cancelled', 'noshow'].includes(r.reservationStatus ?? '')) return false;
      const rCin = new Date(r.arrival).getTime();
      const rCout = new Date(r.departure).getTime();
      if (isNaN(rCin) || isNaN(rCout)) return false;
      return Math.max(cin, rCin) < Math.min(cout, rCout);
    }).length;

    const categoryThreshold = params.roomCategory
      ? overbooking.byCategory[params.roomCategory]
      : undefined;

    const result = checkOverbookingAllowed({
      currentOccupied: occupied,
      totalRooms,
      globalThresholdPct: overbooking.globalThresholdPct,
      categoryThresholdPct: categoryThreshold,
    });

    return {
      ...result,
      isOver: occupied >= totalRooms, // déjà au-dessus de la capacité normale
    };
  }, [reservations, totalRooms, overbooking]);

  // ── Règles actives ──
  const getActivePricingRules = useCallback(() => {
    return pricingRules.filter(r => r.enabled);
  }, [pricingRules]);

  return {
    getPriceForStay,
    getOccupancyForDate,
    canOverbook,
    getActivePricingRules,
  };
}
