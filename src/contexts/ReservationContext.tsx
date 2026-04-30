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
  arrival: string;
  departure: string;
  source: string;
  sourceColor: string;
  action: string;
  governess: string;
  vip: boolean;
  payment: string;
  email?: string;
  phone?: string;
  nationality?: string;
  guests?: { adults: number; children: number };
  company?: string;
  mealPlan?: string;
  policy?: string;
  ratePlan?: string;
  pricePerNight?: number;
  totalTTC?: number;
  notes?: string;
}

interface ReservationContextType {
  reservations: Reservation[];
  addReservation: (reservation: Reservation) => void;
}

const ReservationContext = createContext<ReservationContextType | undefined>(undefined);

export const ReservationProvider = ({ children }: { children: ReactNode }) => {
  const [reservations, setReservations] = useState<Reservation[]>([
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
      payment: 'Partiel'
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
      payment: 'Payé'
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
      payment: 'En attente'
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
      payment: 'Payé'
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
      payment: 'Payé'
    },
  ]);

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
