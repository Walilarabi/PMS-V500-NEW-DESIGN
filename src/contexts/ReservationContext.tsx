import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Reservation {
  id: string;
  priority: string;
  room: string;
  roomType: string;
  status: string;
  statusColor: string;
  dotColor: string;
  client: string;
  arrival: string; // "DD MMM HH:mm"
  departure: string; // "DD MMM HH:mm"
  source: string;
  sourceColor: string;
  action: string;
  governess: string;
  vip: boolean;
  payment: string;
  totalAmount: number;
  ownerFeeRate: number; // e.g. 0.20 for 20%
  pmsFeeRate: number; // e.g. 0.15 for 15%
  cleaningFee: number;
  email?: string;
  phone?: string;
  nationality?: string;
  guests?: { adults: number; children: number };
  company?: string;
  mealPlan?: string;
  policy?: string;
  ratePlan?: string;
  notes?: string;
  pricePerNight?: number;
  totalTTC?: number;
}

interface EnrichedReservation extends Reservation {
  nights: number;
  revenuePerNight: number;
  ownerPayout: number;
  pmsCommission: number;
  season: 'Haute' | 'Basse';
}

interface ReservationContextType {
  reservations: EnrichedReservation[];
  addReservation: (reservation: Reservation) => void;
}

const ReservationContext = createContext<ReservationContextType | undefined>(undefined);

export const ReservationProvider = ({ children }: { children: ReactNode }) => {
  const [baseReservations, setReservations] = useState<Reservation[]>([
    { 
      id: 'RES-001',
      priority: 'Critique', 
      room: '101', 
      roomType: 'STD/DLX',
      status: 'Non prête', 
      statusColor: 'text-red-500/80',
      dotColor: 'bg-red-400',
      client: 'Sophie Dubois', 
      arrival: '27 avr. 16:00', 
      departure: '30 avr. 11:00', 
      source: 'AIRBNB',
      sourceColor: 'bg-rose-400',
      action: 'Lancer ménage',
      governess: 'À faire',
      vip: true,
      payment: 'Partiel',
      totalAmount: 420.00,
      ownerFeeRate: 0.20,
      pmsFeeRate: 0.15,
      cleaningFee: 45,
      email: 'sophie.dubois@gmail.com'
    },
    { 
      id: 'RES-002',
      priority: 'Élevée', 
      room: '105', 
      roomType: 'SUP/SEA',
      status: 'Ménage en cours', 
      statusColor: 'text-orange-500/80',
      dotColor: 'bg-orange-400',
      client: 'Thomas Leroy', 
      arrival: '27 avr. 14:00', 
      departure: '29 avr. 11:00', 
      source: 'BOOKING.COM',
      sourceColor: 'bg-indigo-400',
      action: 'Lancer ménage',
      governess: 'En cours',
      vip: false,
      payment: 'Payé',
      totalAmount: 360.00,
      ownerFeeRate: 0.18,
      pmsFeeRate: 0.12,
      cleaningFee: 50,
      email: 'thomas.leroy@yahoo.com'
    },
    { 
      id: 'RES-003',
      priority: 'Élevée', 
      room: '107', 
      roomType: 'STD/DLX',
      status: 'Arrivée < 1h', 
      statusColor: 'text-orange-500/80',
      dotColor: 'bg-orange-400',
      client: 'Claire Martin', 
      arrival: '27 avr. 14:30', 
      departure: '28 avr. 11:00', 
      source: 'DIRECT',
      sourceColor: 'bg-green-400',
      action: 'Inspection',
      governess: 'À faire',
      vip: true,
      payment: 'En attente',
      totalAmount: 175.00,
      ownerFeeRate: 0.20,
      pmsFeeRate: 0.15,
      cleaningFee: 40,
      email: 'claire.martin@outlook.com'
    },
    { 
      id: 'RES-004',
      priority: 'Moyenne', 
      room: '102', 
      roomType: 'SUP/SEA',
      status: 'Occupée', 
      statusColor: 'text-blue-500',
      dotColor: 'bg-blue-500',
      client: 'Arathew Smith', 
      arrival: '26 avr. 15:00', 
      departure: '27 avr. 11:00', 
      source: 'BOOKING.COM',
      sourceColor: 'bg-indigo-600',
      action: 'Refus de service',
      governess: 'Validé',
      vip: false,
      payment: 'Payé',
      totalAmount: 400.50,
      ownerFeeRate: 0.15,
      pmsFeeRate: 0.10,
      cleaningFee: 60,
      email: 'smith.a@company.com'
    },
    { 
      id: 'RES-005',
      priority: 'Faible', 
      room: '202', 
      roomType: 'STD/DLX',
      status: 'Check-out fait', 
      statusColor: 'text-green-500/80',
      dotColor: 'bg-green-400',
      client: 'Nathalie B.', 
      arrival: '27 avr. 10:30', 
      departure: '27 avr. 10:30', 
      source: 'DIRECT',
      sourceColor: 'bg-green-400',
      action: 'Inspection',
      governess: 'Validé',
      vip: true,
      payment: 'Payé',
      totalAmount: 120.00,
      ownerFeeRate: 0.20,
      pmsFeeRate: 0.15,
      cleaningFee: 30,
      email: 'nathalie.b@gmail.com'
    },
  ]);

  const enrichReservation = (res: Reservation): EnrichedReservation => {
    // Simple night calculation for demo
    // In real app, use Dayjs or native Date parsing
    const nights = Math.max(1, res.id === 'RES-001' ? 3 : (res.id === 'RES-002' ? 2 : 1));
    const revenuePerNight = res.totalAmount / nights;
    
    // Season logic
    // res.arrival format: "27 avr. 16:00"
    const monthStr = res.arrival.split(' ')[1];
    const isHighSeason = ['juin', 'juil', 'août'].includes(monthStr?.toLowerCase());
    const season: 'Haute' | 'Basse' = isHighSeason ? 'Haute' : 'Basse';

    const pmsCommission = res.totalAmount * res.pmsFeeRate;
    const ownerPayout = res.totalAmount - pmsCommission - res.cleaningFee;

    return {
      ...res,
      nights,
      revenuePerNight,
      ownerPayout,
      pmsCommission,
      season
    };
  };

  const reservations = baseReservations.map(enrichReservation);

  const addReservation = (reservation: Reservation) => {
    setReservations((prev) => [reservation, ...prev]);
  };

  return (
    <ReservationContext.Provider value={{ reservations, addReservation }}>
      {children}
    </ReservationContext.Provider>
  );
};

export const useReservations = () => {
  const context = useContext(ReservationContext);
  if (context === undefined) {
    throw new Error('useReservations must be used within a ReservationProvider');
  }
  return context;
};
