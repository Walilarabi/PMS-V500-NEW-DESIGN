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

    // Calculer nombre de nuitées vendues
    let totalNights = 0;
    let totalRevenue = 0;
    
    activeReservations.forEach(res => {
      const checkIn = new Date(res.checkIn || res.arrival);
      const checkOut = new Date(res.checkOut || res.departure);
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
      
      totalNights += nights;
      totalRevenue += (res.totalAmount || res.totalTTC || 0);
    });

    // Calculer période en jours
    const periodDays = dateRange 
      ? Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
      : 30; // Par défaut 30 jours

    // Disponibilité totale = chambres × jours
    const totalAvailability = totalRoomCount * periodDays;
    
    // TO = (nuitées vendues / disponibilité totale) × 100
    const to = totalAvailability > 0 ? (totalNights / totalAvailability) * 100 : 0;
    
    // ADR = revenu total / nuitées vendues
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
    
    // RevPAR = (revenu total / disponibilité totale) OU (TO × ADR / 100)
    const revpar = totalAvailability > 0 ? totalRevenue / totalAvailability : 0;
    
    // Chambres disponibles restantes
    const roomsSold = activeReservations.length;
    const availableRooms = totalRoomCount - roomsSold;

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
