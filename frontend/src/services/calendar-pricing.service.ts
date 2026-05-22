/**
 * FLOWTYM — Calendar Pricing Helper
 *
 * Récupère les tarifs depuis le Calendrier Tarifaire (rateCalendarStore)
 * pour le formulaire de réservation.
 *
 * Fonctions :
 * - getPricePerNight : prix exact pour une date + room + plan
 * - getStayBreakdown : détail nuit par nuit pour un séjour
 * - findRateForRoomLabel : résout un libellé/numéro de chambre vers roomTypeId
 */

import { useRateCalendarStore } from '../components/rms/store/rateCalendarStore';
import type { RoomTypeData, RatePlanData } from '../components/rms/types';

export interface NightPrice {
  date: string;
  price: number | null;
  source: 'calendar' | 'fallback' | 'closed';
  closed?: boolean;
}

export interface StayBreakdown {
  nights: NightPrice[];
  total: number;
  allFromCalendar: boolean;
  anyClosed: boolean;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Résout un type de chambre (libellé ou roomTypeName) ou un roomTypeId
 * vers le RoomTypeData correspondant dans le store.
 */
export function findRoomType(query: string | null | undefined): RoomTypeData | null {
  if (!query) return null;
  const state = useRateCalendarStore.getState();
  const q = query.toLowerCase().trim();
  return (
    state.roomTypes.find((r) => r.roomTypeId.toLowerCase() === q) ??
    state.roomTypes.find((r) => r.roomTypeName.toLowerCase() === q) ??
    state.roomTypes.find((r) => r.roomTypeName.toLowerCase().includes(q)) ??
    null
  );
}

/**
 * Résout un plan tarifaire par planId ou planName.
 */
export function findRatePlan(
  room: RoomTypeData | null,
  query: string | null | undefined
): RatePlanData | null {
  if (!room) return null;
  if (!query) return room.ratePlans.find((p) => p.isReference) ?? room.ratePlans[0] ?? null;
  const q = query.toLowerCase().trim();
  return (
    room.ratePlans.find((p) => p.planId.toLowerCase() === q) ??
    room.ratePlans.find((p) => p.planName.toLowerCase() === q) ??
    room.ratePlans.find((p) => p.planName.toLowerCase().includes(q)) ??
    null
  );
}

/**
 * Retourne le prix d'une nuit dans le Calendrier Tarifaire, ou null si non trouvé.
 * Vérifie également si la nuit est fermée (closed) côté restriction.
 */
export function getPricePerNight(
  roomQuery: string,
  planQuery: string,
  isoDate: string
): NightPrice {
  const room = findRoomType(roomQuery);
  if (!room) return { date: isoDate, price: null, source: 'fallback' };
  const plan = findRatePlan(room, planQuery);
  if (!plan) return { date: isoDate, price: null, source: 'fallback' };

  const priceEntry = plan.prices?.find((p) => p.date === isoDate);

  // Vérifier fermeture via statuses ou restrictions
  const status = room.statuses?.find((s) => s.date === isoDate);
  const closed =
    status?.status === 'closed' ||
    !!priceEntry?.planClosed ||
    priceEntry?.status === 'closed';

  if (closed) {
    return { date: isoDate, price: priceEntry?.price ?? null, source: 'closed', closed: true };
  }

  if (priceEntry?.price !== undefined && priceEntry?.price !== null) {
    return { date: isoDate, price: priceEntry.price, source: 'calendar' };
  }
  return { date: isoDate, price: null, source: 'fallback' };
}

/**
 * Calcule le breakdown nuit par nuit pour un séjour donné.
 * Si le calendrier ne fournit pas une nuit, fallback = prix de référence donné.
 */
export function getStayBreakdown(params: {
  checkIn: string;
  checkOut: string;
  roomQuery: string;
  planQuery: string;
  fallbackPrice?: number;
}): StayBreakdown {
  const { checkIn, checkOut, roomQuery, planQuery, fallbackPrice = 0 } = params;
  const cin = new Date(checkIn);
  const cout = new Date(checkOut);
  if (
    !checkIn ||
    !checkOut ||
    Number.isNaN(cin.getTime()) ||
    Number.isNaN(cout.getTime()) ||
    cout <= cin
  ) {
    return { nights: [], total: 0, allFromCalendar: false, anyClosed: false };
  }

  const nights: NightPrice[] = [];
  let total = 0;
  let allFromCalendar = true;
  let anyClosed = false;

  const cursor = new Date(cin);
  while (cursor < cout) {
    const iso = toISO(cursor);
    const nightPrice = getPricePerNight(roomQuery, planQuery, iso);
    if (nightPrice.closed) anyClosed = true;
    if (nightPrice.source !== 'calendar') allFromCalendar = false;

    const effective = nightPrice.price ?? fallbackPrice;
    nights.push({
      ...nightPrice,
      price: nightPrice.price ?? (fallbackPrice || null),
    });
    total += effective;

    cursor.setDate(cursor.getDate() + 1);
  }

  return { nights, total, allFromCalendar, anyClosed };
}
