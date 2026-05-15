import type { Reservation, ReservationStatus } from '@/src/contexts/ReservationContext';

export interface ReservationInput {
  reference: string;
  guestName: string;
  roomNumber: string;
  roomType?: string;
  checkIn: string;
  checkOut: string;
  channel: string;
  segment?: string;
  paymentStatus?: string;
  totalTTC: number;
  email?: string;
  phone?: string;
  nationality?: string;
  adults?: number;
  children?: number;
  notes?: string;
  reservationStatus?: ReservationStatus;
  isOverbooking?: boolean;
  dynamicPriceApplied?: boolean;
  appliedPricingRules?: string[];
}

export const buildReservation = (data: ReservationInput): Reservation => {
  const resolvedStatus = data.reservationStatus ?? 'confirmed';

  return {
    id: data.reference,
    priority: 'Moyenne',
    room: data.roomNumber,
    roomType: data.roomType ?? 'STD/DLX',
    status: resolvedStatus === 'cancelled' ? 'Annulée' : 'Confirmée',
    statusColor: resolvedStatus === 'cancelled' ? 'text-red-500/80' : 'text-indigo-500/80',
    dotColor: resolvedStatus === 'cancelled' ? 'bg-red-400' : 'bg-indigo-400',
    client: data.guestName,
    arrival: `${data.checkIn} 16:00`,
    departure: `${data.checkOut} 11:00`,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    source: data.channel.toUpperCase(),
    sourceColor: data.channel === 'Direct' ? 'bg-green-400' : 'bg-indigo-400',
    action: 'Check-in',
    governess: 'À faire',
    vip: data.segment === 'VIP',
    payment: data.paymentStatus === 'Payé' ? 'Payé' : 'Partiel',
    totalAmount: data.totalTTC,
    ownerFeeRate: 0.20,
    pmsFeeRate: 0.15,
    cleaningFee: 50,
    email: data.email,
    phone: data.phone,
    nationality: data.nationality,
    guests: { adults: data.adults ?? 2, children: data.children ?? 0 },
    notes: data.notes,
    reservationStatus: resolvedStatus,
    isOverbooking: data.isOverbooking,
    dynamicPriceApplied: data.dynamicPriceApplied,
    appliedPricingRules: data.appliedPricingRules,
  };
};
