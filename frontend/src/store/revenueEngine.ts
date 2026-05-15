/**
 * revenueEngine.ts
 * Moteur de tarification dynamique — module pur (sans état React, sans side-effects)
 * Tous les calculs sont déterministes et traçables.
 */

import type { HotelEvent, PricingRule, EventMultiplierConfig } from './configStore';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PriceBreakdown {
  basePrice: number;
  afterOccupancy: number;
  afterEvent: number;
  afterLastMinute: number;
  afterSeason: number;
  finalPrice: number;
}

export interface DynamicPriceResult {
  finalPrice: number;
  appliedRules: string[];
  breakdown: PriceBreakdown;
  occupancyPct: number;
  daysBeforeArrival: number;
}

export interface ComputePriceParams {
  basePrice: number;
  checkInDate: string;           // ISO date "YYYY-MM-DD"
  currentOccupancyPct: number;   // 0-100
  activeEvents: HotelEvent[];
  rules: PricingRule[];
  eventMultipliers: EventMultiplierConfig;
  referenceDate?: string;        // ISO date, pour tests (défaut: today)
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Retourne le mois (1-12) d'une date ISO */
const getMonth = (iso: string): number => new Date(iso).getMonth() + 1;

/** Retourne la saison multiplicateur (selon les mois) */
const getSeasonMultiplier = (iso: string): { mult: number; label: string } => {
  const m = getMonth(iso);
  if ([6, 7, 8].includes(m)) return { mult: 1.20, label: 'Haute saison (été)' };
  if ([12].includes(m))       return { mult: 1.15, label: 'Haute saison (fêtes)' };
  if ([1, 2].includes(m))     return { mult: 0.90, label: 'Basse saison (hiver)' };
  return { mult: 1.00, label: 'Saison normale' };
};

/** Retourne le nombre de jours entre aujourd'hui et la date d'arrivée */
const daysUntil = (checkInISO: string, referenceISO?: string): number => {
  const ref = referenceISO ? new Date(referenceISO) : new Date();
  ref.setHours(0, 0, 0, 0);
  const arrival = new Date(checkInISO);
  arrival.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((arrival.getTime() - ref.getTime()) / 86400000));
};

/** Vérifie si une date d'arrivée tombe dans la période d'un événement */
const isDateInEvent = (checkInISO: string, event: HotelEvent): boolean => {
  const arrival = new Date(checkInISO).getTime();
  const start = new Date(event.startDate).getTime();
  const end = new Date(event.endDate).getTime() + 86400000; // inclusif
  return arrival >= start && arrival < end;
};

/** Arrondi à 2 décimales */
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─── MOTEUR PRINCIPAL ─────────────────────────────────────────────────────────

/**
 * Calcule le prix dynamique pour un séjour donné.
 *
 * Ordre d'application :
 * 1. Règles d'occupation (filtrées par plage, triées par priorité)
 * 2. Multiplicateur événement externe (impact: low/medium/high/critical)
 * 3. Last-minute (si daysBeforeArrival <= daysBeforeArrivalMax de la règle)
 * 4. Saisonnalité
 */
export function computeDynamicPrice(params: ComputePriceParams): DynamicPriceResult {
  const {
    basePrice,
    checkInDate,
    currentOccupancyPct,
    activeEvents,
    rules,
    eventMultipliers,
    referenceDate,
  } = params;

  const appliedRules: string[] = [];
  const daysBeforeArrival = daysUntil(checkInDate, referenceDate);
  let price = basePrice;

  const breakdown: PriceBreakdown = {
    basePrice,
    afterOccupancy: basePrice,
    afterEvent: basePrice,
    afterLastMinute: basePrice,
    afterSeason: basePrice,
    finalPrice: basePrice,
  };

  // ── Étape 1 : Règles d'occupation (exclure les règles last-minute ici) ───
  const occupancyRules = rules
    .filter(r =>
      r.enabled &&
      !r.daysBeforeArrivalMax &&
      currentOccupancyPct >= r.occupancyMin &&
      currentOccupancyPct < r.occupancyMax
    )
    .sort((a, b) => b.priority - a.priority);

  if (occupancyRules.length > 0) {
    const rule = occupancyRules[0];
    price = round2(price * rule.multiplier);
    appliedRules.push(`${rule.name} (×${rule.multiplier})`);
  }
  breakdown.afterOccupancy = price;

  // ── Étape 2 : Événements externes ───────────────────────────────────────
  const relevantEvents = activeEvents.filter(e => isDateInEvent(checkInDate, e));
  if (relevantEvents.length > 0) {
    // Prendre l'événement à l'impact le plus élevé
    const impactOrder: EventImpactLevel[] = ['critical', 'high', 'medium', 'low'];
    const topEvent = relevantEvents.sort(
      (a, b) => impactOrder.indexOf(a.impact as EventImpactLevel) - impactOrder.indexOf(b.impact as EventImpactLevel)
    )[0];

    const mult = eventMultipliers[topEvent.impact as keyof EventMultiplierConfig] ?? 1.00;
    price = round2(price * mult);
    appliedRules.push(`Événement "${topEvent.name}" impact ${topEvent.impact} (×${mult})`);
  }
  breakdown.afterEvent = price;

  // ── Étape 3 : Last-minute ────────────────────────────────────────────────
  const lmRules = rules
    .filter(r =>
      r.enabled &&
      r.daysBeforeArrivalMax !== undefined &&
      daysBeforeArrival <= r.daysBeforeArrivalMax
    )
    .sort((a, b) => b.priority - a.priority);

  if (lmRules.length > 0) {
    const lmRule = lmRules[0];
    price = round2(price * lmRule.multiplier);
    appliedRules.push(`${lmRule.name} (J-${daysBeforeArrival}, ×${lmRule.multiplier})`);
  }
  breakdown.afterLastMinute = price;

  // ── Étape 4 : Saisonnalité ───────────────────────────────────────────────
  const season = getSeasonMultiplier(checkInDate);
  if (season.mult !== 1.00) {
    price = round2(price * season.mult);
    appliedRules.push(`${season.label} (×${season.mult})`);
  }
  breakdown.afterSeason = price;
  breakdown.finalPrice = price;

  return {
    finalPrice: price,
    appliedRules,
    breakdown,
    occupancyPct: currentOccupancyPct,
    daysBeforeArrival,
  };
}

// ─── UTILITAIRES PUBLICS ─────────────────────────────────────────────────────

/** Calcule le taux d'occupation pour une date donnée à partir d'une liste de réservations */
export function computeOccupancyForDate(params: {
  date: string;         // ISO "YYYY-MM-DD"
  totalRooms: number;
  reservations: Array<{
    arrival: string;
    departure: string;
    reservationStatus?: string;
    isOverbooking?: boolean;
  }>;
}): number {
  const { date, totalRooms, reservations } = params;
  if (totalRooms <= 0) return 0;

  const ts = new Date(date).getTime();
  const occupied = reservations.filter(res => {
    // Exclure annulées et no-show
    if (['cancelled', 'noshow'].includes(res.reservationStatus ?? '')) return false;
    const cin = new Date(res.arrival).getTime();
    const cout = new Date(res.departure).getTime();
    return !isNaN(cin) && !isNaN(cout) && ts >= cin && ts < cout;
  }).length;

  return Math.min(100, round2((occupied / totalRooms) * 100));
}

/** Vérifie si l'overbooking est autorisé pour une chambre/catégorie */
export function checkOverbookingAllowed(params: {
  currentOccupied: number;
  totalRooms: number;
  globalThresholdPct: number;
  categoryThresholdPct?: number;
}): { allowed: boolean; maxAllowed: number; overCount: number } {
  const { currentOccupied, totalRooms, globalThresholdPct, categoryThresholdPct } = params;
  const threshold = categoryThresholdPct ?? globalThresholdPct;
  const maxAllowed = Math.floor(totalRooms * (1 + threshold / 100));
  const allowed = currentOccupied < maxAllowed;
  return { allowed, maxAllowed, overCount: Math.max(0, currentOccupied - totalRooms) };
}

/** Calcule la priorité d'une réservation pour gestion overbooking */
export function computeReservationPriority(params: {
  reservationStatus: string;
  paymentStatus: string;
}): number {
  const { reservationStatus, paymentStatus } = params;
  if (reservationStatus === 'confirmed' && paymentStatus === 'Payé') return 4;
  if (reservationStatus === 'confirmed') return 3;
  if (reservationStatus === 'pending') return 2;
  if (reservationStatus === 'option') return 1;
  return 0;
}

// Helper type local
type EventImpactLevel = 'low' | 'medium' | 'high' | 'critical';
