import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HotelConfig {
  name: string;
  stars: number;
  address: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
  logo: string;
}

interface TaxConfig {
  hebergement: number;
  fb: number;
  sejour: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'receptionist' | 'housekeeping' | 'manager';
  active: boolean;
}

interface Room {
  id: string;
  number: string;
  type: string;
  category: string;
  floor: string;
  status: 'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'maintenance';
}

export type EventImpact = 'low' | 'medium' | 'high' | 'critical';

export interface HotelEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  impact: EventImpact;
  description?: string;
  source?: string;
  location?: string;
}

interface ConfigState {
  hotel: HotelConfig;
  taxes: TaxConfig;
  users: User[];
  rooms: Room[];
  events: HotelEvent[];
  updateHotel: (hotel: Partial<HotelConfig>) => void;
  updateTaxes: (taxes: Partial<TaxConfig>) => void;
  updateUsers: (users: User[]) => void;
  updateRooms: (rooms: Room[]) => void;
  addEvent: (event: HotelEvent) => void;
  updateEvent: (event: HotelEvent) => void;
  deleteEvent: (id: string) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      hotel: {
        name: 'Flowtym Demo Hotel',
        stars: 4,
        address: '12 Rue de la Paix',
        city: 'Paris',
        zip: '75001',
        country: 'France',
        phone: '+33 1 00 00 00 00',
        email: 'demo@flowtym.com',
        logo: '',
      },
      taxes: {
        hebergement: 10,
        fb: 10,
        sejour: 1.50,
      },
      users: [
        { id: '1', name: 'Wali LARABI', email: 'walilarabi@gmail.com', role: 'admin', active: true },
        { id: '2', name: 'Sarah Bernard', email: 's.bernard@hotel.com', role: 'receptionist', active: true },
      ],
      rooms: [
        { id: '1', number: '101', type: 'DBL', category: 'CL', floor: '1', status: 'clean' },
        { id: '2', number: '102', type: 'DBL', category: 'CL', floor: '1', status: 'clean' },
        { id: '3', number: '103', type: 'DBL', category: 'SUP', floor: '1', status: 'dirty' },
        { id: '4', number: '104', type: 'DBL', category: 'SUP', floor: '1', status: 'clean' },
        { id: '5', number: '201', type: 'TWN', category: 'DLX', floor: '2', status: 'clean' },
        { id: '6', number: '202', type: 'TWN', category: 'DLX', floor: '2', status: 'clean' },
        { id: '7', number: '203', type: 'SGL', category: 'STD', floor: '2', status: 'dirty' },
        { id: '8', number: '301', type: 'TPL', category: 'JS', floor: '3', status: 'clean' },
      ],
      events: [
        { id: 'e1', name: 'Salon International du Tourisme', startDate: '2026-05-15', endDate: '2026-05-18', impact: 'critical', description: 'Grand pic d\'activité', source: 'Externe' },
        { id: 'e2', name: 'Concert Stade de France', startDate: '2026-05-20', endDate: '2026-05-20', impact: 'high', description: 'Affluence élevée', source: 'OTA' },
      ],
      updateHotel: (hotel) => set((state) => ({ hotel: { ...state.hotel, ...hotel } })),
      updateTaxes: (taxes) => set((state) => ({ taxes: { ...state.taxes, ...taxes } })),
      updateUsers: (users) => set({ users }),
      updateRooms: (rooms) => set({ rooms }),
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      updateEvent: (event) => set((state) => ({ events: state.events.map(e => e.id === event.id ? event : e) })),
      deleteEvent: (id) => set((state) => ({ events: state.events.filter(e => e.id !== id) })),
    }),
    {
      name: 'flowtym-config-storage',
    }
  )
);
