/**
 * FLOWTYM RMS — Adaptateur Distribution & OTA
 *
 * Calcule les totaux globaux Distribution depuis les données réellement
 * disponibles dans les stores (rateCalendar pour les ventes, lighthouse pour
 * le compset, expedia pour la pression marché).
 *
 * Limite importante : la répartition par canal (Booking / Expedia / Direct…)
 * n'est PAS dérivable des données actuelles — les chambres portent une liste
 * de `distributionChannels`, mais les ventes ne sont pas étiquetées par canal
 * au niveau réservation. Cet adaptateur retourne donc uniquement les
 * agrégats globaux et indique si la source est complète ou partielle.
 */

import type { RoomTypeData } from '../../components/rms/types';
import type { LighthouseImport } from '../../services/lighthouse-parser.service';

export interface DistributionDataSourceStatus {
  /** True si rateCalendarStore contient des données chargées. */
  hasRateData: boolean;
  /** True si un import Lighthouse est disponible. */
  hasLighthouse: boolean;
  /** True si la page peut afficher des totaux réels. */
  isLive: boolean;
  /** Période couverte par la donnée réelle (libellé court). */
  periodLabel: string | null;
  /** Nombre de jours sur lesquels portent les calculs. */
  daysCovered: number;
}

export interface DistributionTotalsReal {
  totalRevenue: number;
  totalBookings: number;
  totalRoomNights: number;
  avgADR: number;
  avgRevPAR: number;
  totalCapacity: number;
  occupancyPct: number;
}

/**
 * Compute totals globaux depuis le rateCalendar store. Une "vente" = une
 * réservation ; une "nuitée" = une chambre × une nuit. Le revenu = somme
 * (sold * price) sur tous les jours.
 */
export function computeRealTotals(
  roomTypes: RoomTypeData[]
): DistributionTotalsReal | null {
  if (!roomTypes.length) return null;

  let totalRevenue = 0;
  let totalBookings = 0;
  let totalRoomNights = 0;
  let totalCapacity = 0;

  // Index des prix par date pour chaque roomType (on prend le rate plan de
  // référence quand il existe, sinon le premier).
  for (const rt of roomTypes) {
    const referencePlan =
      rt.ratePlans.find((rp) => rp.isReference) ?? rt.ratePlans[0];
    const pricesByDate = new Map<string, number>();
    if (referencePlan) {
      for (const p of referencePlan.prices) {
        pricesByDate.set(p.date, p.price);
      }
    }

    for (const status of rt.statuses) {
      const sold = Math.max(0, status.sold ?? 0);
      const capacity = status.capacity ?? rt.capacity ?? 0;
      const price = pricesByDate.get(status.date) ?? 0;

      totalBookings += sold;
      totalRoomNights += sold;
      totalCapacity += capacity;
      totalRevenue += sold * price;
    }
  }

  if (totalRoomNights === 0 && totalCapacity === 0) return null;

  const avgADR = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
  // RevPAR = Revenue / Available rooms (capacity représente les chambres dispos)
  const avgRevPAR = totalCapacity > 0 ? totalRevenue / totalCapacity : 0;
  const occupancyPct = totalCapacity > 0 ? (totalRoomNights / totalCapacity) * 100 : 0;

  return {
    totalRevenue: Math.round(totalRevenue),
    totalBookings,
    totalRoomNights,
    avgADR: Math.round(avgADR),
    avgRevPAR: Math.round(avgRevPAR),
    totalCapacity,
    occupancyPct: Math.round(occupancyPct * 10) / 10,
  };
}

/**
 * Indique le statut global de la source de données Distribution.
 */
export function getDataSourceStatus(args: {
  roomTypes: RoomTypeData[];
  lighthouse: LighthouseImport | null | undefined;
}): DistributionDataSourceStatus {
  const hasRateData = args.roomTypes.length > 0;
  const hasLighthouse = !!args.lighthouse;

  let periodLabel: string | null = null;
  let daysCovered = 0;

  if (hasRateData) {
    const allDates = new Set<string>();
    for (const rt of args.roomTypes) {
      for (const s of rt.statuses) allDates.add(s.date);
    }
    daysCovered = allDates.size;
    if (daysCovered > 0) {
      const sorted = Array.from(allDates).sort();
      const start = new Date(sorted[0]);
      const end = new Date(sorted[sorted.length - 1]);
      periodLabel = `${start.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
      })} → ${end.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
      })}`;
    }
  }

  return {
    hasRateData,
    hasLighthouse,
    isLive: hasRateData,
    periodLabel,
    daysCovered,
  };
}
