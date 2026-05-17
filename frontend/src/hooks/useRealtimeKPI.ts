import { useMemo } from 'react';
import { Reservation } from '../types';

interface KPIData {
  to: number;              // Taux d'occupation (%)
  adr: number;             // Average Daily Rate (€)
  revpar: number;          // Revenue Per Available Room (€)
  totalRevenue: number;    // Revenu total (€)
  reservationsCount: number;
  roomsSold: number;
  availableRooms: number;
}

/**
 * Hook qui calcule automatiquement les KPI hôteliers en temps réel
 * à partir des réservations et de la capacité totale.
 * 
 * FORMULES APPLIQUÉES :
 * - Chambres vendues = Nombre de chambres uniques occupées
 * - Chambres disponibles = Total chambres - Chambres vendues
 * - TO (%) = (Chambres vendues / Total chambres) × 100
 * - ADR (€) = Revenu total / Nuitées totales
 * - RevPAR (€) = Revenu total / (Chambres × Jours)
 * 
 * Se recalcule automatiquement dès qu'une réservation change.
 */
export function useRealtimeKPI(
  reservations: Reservation[],
  totalRoomCount: number,
  dateRange?: { start: Date; end: Date }
): KPIData {
  return useMemo(() => {
    // Filtrer réservations confirmées dans la période
    const activeReservations = reservations.filter(res => {
      if (res.reservationStatus === 'cancelled') return false;
      
      // Si période spécifiée, filtrer
      if (dateRange) {
        const checkIn = new Date(res.checkIn || res.arrival);
        const checkOut = new Date(res.checkOut || res.departure);
        const { start, end } = dateRange;
        
        // Chevauchement avec la période
        return checkIn <= end && checkOut >= start;
      }
      
      return true;
    });

    // Calculer chambres UNIQUES occupées (chambres vendues)
    const uniqueRooms = new Set<string>();
    let totalRevenue = 0;
    let totalNights = 0;
    
    activeReservations.forEach(res => {
      const checkIn = new Date(res.checkIn || res.arrival);
      const checkOut = new Date(res.checkOut || res.departure);
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
      
      totalNights += nights;
      totalRevenue += (res.totalAmount || res.totalTTC || 0);
      
      // Compter chambres uniques
      if (res.room) {
        uniqueRooms.add(String(res.room));
      }
    });

    // CHAMBRES VENDUES = nombre de chambres UNIQUES occupées
    const roomsSold = uniqueRooms.size;
    
    // CHAMBRES DISPONIBLES = Total chambres - Chambres vendues
    const availableRooms = Math.max(0, totalRoomCount - roomsSold);
    
    // TO = (Chambres vendues / Total chambres) × 100
    // Plafonné à 100% (ne peut jamais dépasser)
    const toRaw = totalRoomCount > 0 ? (roomsSold / totalRoomCount) * 100 : 0;
    const to = Math.min(100, toRaw);
    
    // ADR = revenu total / nuitées vendues
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
    
    // Calculer période en jours pour RevPAR
    const periodDays = dateRange 
      ? Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    
    const totalAvailability = totalRoomCount * periodDays;
    
    // RevPAR = revenu total / disponibilité totale
    const revpar = totalAvailability > 0 ? totalRevenue / totalAvailability : 0;

    return {
      to: Math.round(to * 10) / 10,           // Arrondi 1 décimale
      adr: Math.round(adr * 10) / 10,
      revpar: Math.round(revpar * 10) / 10,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      reservationsCount: activeReservations.length,
      roomsSold,
      availableRooms: Math.max(0, availableRooms)
    };
  }, [reservations, totalRoomCount, dateRange]);
}
