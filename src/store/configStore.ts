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

interface ConfigState {
  hotel: HotelConfig;
  taxes: TaxConfig;
  users: User[];
  updateHotel: (hotel: Partial<HotelConfig>) => void;
  updateTaxes: (taxes: Partial<TaxConfig>) => void;
  updateUsers: (users: User[]) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      hotel: {
        name: 'Flowtym Premium Resort',
        stars: 4,
        address: '123 Avenue des Champs-Élysées',
        city: 'Paris',
        zip: '75008',
        country: 'France',
        phone: '+33 1 23 45 67 89',
        email: 'contact@flowtym.com',
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
      updateHotel: (hotel) => set((state) => ({ hotel: { ...state.hotel, ...hotel } })),
      updateTaxes: (taxes) => set((state) => ({ taxes: { ...state.taxes, ...taxes } })),
      updateUsers: (users) => set({ users }),
    }),
    {
      name: 'flowtym-config-storage',
    }
  )
);
