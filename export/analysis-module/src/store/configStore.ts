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

export interface Room {
  id: string;
  number: string;
  type: string;
  category: string;
  floor: string;
  status: 'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'maintenance';
  price?: number; // Prix de base par nuit en €
  /**
   * Chambre fictive : visible dans le Planning pour la gestion opérationnelle
   * (overflow, allotement, blocage commercial), mais EXCLUE de l'inventaire
   * vendable (TO, disponibilité OTA, RMS). Cas d'usage Folkestone : numéros
   * 800-820 réservés à des allotements groupes ou de l'overflow saisonnier.
   */
  isFictitious?: boolean;
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

export interface ChannelConfig {
  id: string;
  name: string;
  color: string;
}

// ─── NOUVELLES INTERFACES ────────────────────────────────────────────────────

/** Configuration de l'overbooking contrôlé */
export interface OverbookingConfig {
  enabled: boolean;
  /** Seuil global en % (ex: 10 = 10% de capacité supplémentaire autorisée) */
  globalThresholdPct: number;
  /** Seuils par catégorie de chambre (ex: { 'CL': 5, 'SUP': 0 }) */
  byCategory: Record<string, number>;
}

/** Règle de tarification dynamique */
export interface PricingRule {
  id: string;
  name: string;
  enabled: boolean;
  /** Plage d'occupation déclenchant la règle (%) */
  occupancyMin: number;
  occupancyMax: number;
  /** Multiplicateur appliqué au prix de base (ex: 1.15 = +15%) */
  multiplier: number;
  /** Si défini, s'applique uniquement si j'arrive dans ce délai (jours) */
  daysBeforeArrivalMax?: number;
  /** Priorité d'application (plus élevée = appliquée en premier) */
  priority: number;
}

/** Multiplicateurs par impact d'événement */
export interface EventMultiplierConfig {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

/** Configuration de l'expiration des options */
export interface OptionExpiryConfig {
  /** Durée par défaut en heures (ex: 24) */
  defaultHours: number;
  /** Durée par catégorie de chambre (ex: { 'STE': 48 }) */
  byCategory: Record<string, number>;
}

// ─── ÉTAT DU STORE ────────────────────────────────────────────────────────────

interface ConfigState {
  hotel: HotelConfig;
  taxes: TaxConfig;
  users: User[];
  rooms: Room[];
  events: HotelEvent[];
  channels: ChannelConfig[];

  /** Tracks whether the initial Supabase sync completed at least once. */
  syncStatus: 'idle' | 'loading' | 'done' | 'error';
  setSyncStatus: (s: ConfigState['syncStatus']) => void;

  // Nouvelles configs
  overbooking: OverbookingConfig;
  pricingRules: PricingRule[];
  eventMultipliers: EventMultiplierConfig;
  optionExpiry: OptionExpiryConfig;

  // Actions existantes
  updateHotel: (hotel: Partial<HotelConfig>) => void;
  updateTaxes: (taxes: Partial<TaxConfig>) => void;
  updateUsers: (users: User[]) => void;
  updateRooms: (rooms: Room[]) => void;
  addEvent: (event: HotelEvent) => void;
  updateEvent: (event: HotelEvent) => void;
  deleteEvent: (id: string) => void;
  updateChannels: (channels: ChannelConfig[]) => void;

  // Nouvelles actions
  updateOverbooking: (config: Partial<OverbookingConfig>) => void;
  updatePricingRules: (rules: PricingRule[]) => void;
  addPricingRule: (rule: PricingRule) => void;
  updatePricingRule: (rule: PricingRule) => void;
  deletePricingRule: (id: string) => void;
  updateEventMultipliers: (multipliers: Partial<EventMultiplierConfig>) => void;
  updateOptionExpiry: (config: Partial<OptionExpiryConfig>) => void;
  setRoomStatus: (roomNumber: string, status: Room['status']) => void;
}

// ─── VALEURS PAR DÉFAUT ───────────────────────────────────────────────────────

const DEFAULT_PRICING_RULES: PricingRule[] = [
  {
    id: 'rule-low',
    name: 'Taux faible (< 40%)',
    enabled: true,
    occupancyMin: 0,
    occupancyMax: 40,
    multiplier: 0.90,
    priority: 1,
  },
  {
    id: 'rule-medium',
    name: 'Taux modéré (40–70%)',
    enabled: true,
    occupancyMin: 40,
    occupancyMax: 70,
    multiplier: 1.00,
    priority: 2,
  },
  {
    id: 'rule-high',
    name: 'Forte demande (70–90%)',
    enabled: true,
    occupancyMin: 70,
    occupancyMax: 90,
    multiplier: 1.15,
    priority: 3,
  },
  {
    id: 'rule-peak',
    name: 'Pic de demande (> 90%)',
    enabled: true,
    occupancyMin: 90,
    occupancyMax: 100,
    multiplier: 1.30,
    priority: 4,
  },
  {
    id: 'rule-lastminute',
    name: 'Last-minute (< 3 jours)',
    enabled: true,
    occupancyMin: 0,
    occupancyMax: 100,
    multiplier: 0.80,
    daysBeforeArrivalMax: 3,
    priority: 5,
  },
];

// ─── STORE ────────────────────────────────────────────────────────────────────

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      hotel: {
        name: '',
        stars: 4,
        address: '',
        city: '',
        zip: '',
        country: 'France',
        phone: '',
        email: '',
        logo: '',
      },
      taxes: {
        hebergement: 10,
        fb: 10,
        sejour: 1.50,
      },
      users: [],
      rooms: [
        { id: '1', number: '101', type: 'DBL', category: 'CL', floor: '1', status: 'clean', price: 85 },
        { id: '2', number: '102', type: 'DBL', category: 'CL', floor: '1', status: 'clean', price: 85 },
        { id: '3', number: '103', type: 'DBL', category: 'SUP', floor: '1', status: 'dirty', price: 110 },
        { id: '4', number: '104', type: 'DBL', category: 'SUP', floor: '1', status: 'clean', price: 110 },
        { id: '5', number: '201', type: 'TWN', category: 'DLX', floor: '2', status: 'clean', price: 140 },
        { id: '6', number: '202', type: 'TWN', category: 'DLX', floor: '2', status: 'clean', price: 140 },
        { id: '7', number: '203', type: 'SGL', category: 'STD', floor: '2', status: 'dirty', price: 100 },
        { id: '8', number: '301', type: 'TPL', category: 'JS', floor: '3', status: 'clean', price: 100 },
      ],
      events: [],
      channels: [
        { id: '1', name: 'DIRECT', color: '#A5B4FC' },
        { id: '2', name: 'BOOKING.COM', color: '#003580' },
        { id: '3', name: 'EXPEDIA', color: '#FDA44F' },
        { id: '4', name: 'AIRBNB', color: '#FF5A5F' },
        { id: '5', name: 'WALK-IN', color: '#10B981' },
        { id: '6', name: 'AGODA', color: '#FDE68A' },
        { id: '7', name: 'HOTELBEDS', color: '#FBCFE8' },
      ],

      // ── Nouvelles configs avec valeurs par défaut ──
      overbooking: {
        enabled: true,
        globalThresholdPct: 10,
        byCategory: {},
      },
      pricingRules: DEFAULT_PRICING_RULES,
      eventMultipliers: {
        low: 1.05,
        medium: 1.12,
        high: 1.18,
        critical: 1.20,
      },
      optionExpiry: {
        defaultHours: 24,
        byCategory: {},
      },

      // ── Actions existantes ──
      syncStatus: 'idle',
      setSyncStatus: (s) => set({ syncStatus: s }),

      updateHotel: (hotel) => set((state) => ({ hotel: { ...state.hotel, ...hotel } })),
      updateTaxes: (taxes) => set((state) => ({ taxes: { ...state.taxes, ...taxes } })),
      updateUsers: (users) => set({ users }),
      updateRooms: (rooms) => set({ rooms }),
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      updateEvent: (event) => set((state) => ({ events: state.events.map(e => e.id === event.id ? event : e) })),
      deleteEvent: (id) => set((state) => ({ events: state.events.filter(e => e.id !== id) })),
      updateChannels: (channels) => set({ channels }),

      // ── Nouvelles actions ──
      updateOverbooking: (config) =>
        set((state) => ({ overbooking: { ...state.overbooking, ...config } })),
      updatePricingRules: (rules) => set({ pricingRules: rules }),
      addPricingRule: (rule) =>
        set((state) => ({ pricingRules: [...state.pricingRules, rule] })),
      updatePricingRule: (rule) =>
        set((state) => ({
          pricingRules: state.pricingRules.map(r => r.id === rule.id ? rule : r),
        })),
      deletePricingRule: (id) =>
        set((state) => ({ pricingRules: state.pricingRules.filter(r => r.id !== id) })),
      updateEventMultipliers: (multipliers) =>
        set((state) => ({ eventMultipliers: { ...state.eventMultipliers, ...multipliers } })),
      updateOptionExpiry: (config) => set((state) => ({ 
        optionExpiry: { ...state.optionExpiry, ...config } 
      })),
      setRoomStatus: (roomNumber, status) => set((state) => ({
        rooms: state.rooms.map(r => r.number === roomNumber ? { ...r, status } : r)
      })),
    }),
    {
      name: 'hotel-config-storage',
    }
  )
);
