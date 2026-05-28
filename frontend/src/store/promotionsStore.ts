/**
 * FLOWTYM RMS — Promotions store
 *
 * Source de vérité pour les promotions. Persistance localStorage via Zustand.
 * Chaque mutation émet un événement sur le bus RMS pour permettre aux autres
 * modules (Alertes, Distribution, Tableau RMS) de réagir en temps réel.
 *
 * État initial = 10 promotions seed pour démontrer le produit, écrasable par
 * l'utilisateur.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { emitRmsEvent } from '../lib/rms/eventBus';

/* ────────────────────────────────────────────────────────────────────────── */
/* TYPES                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export type PromoStatus = 'active' | 'scheduled' | 'paused' | 'draft' | 'ended';
export type PromoPriority = 'low' | 'medium' | 'high';

export type PromoType =
  | 'mobile_rate'
  | 'early_booker'
  | 'last_minute'
  | 'long_stay'
  | 'non_refundable'
  | 'genius'
  | 'romantic'
  | 'family'
  | 'free_breakfast'
  | 'secret'
  | 'package'
  | 'corporate'
  | 'flash'
  | 'weekend'
  | 'seasonal';

export interface PromoAlert {
  why: string;
  when: string;
  who: string;
  priority: PromoPriority;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: PromoType;
  typeLabel: string;
  discount: string;
  discountValue: number;
  code: string | null;
  startDate: string;
  endDate: string;
  permanent: boolean;
  channels: string[];
  rooms: string[];
  segments: string[];
  minNights: number;
  bookings: number;
  bookingsDelta: number;
  revenue: number;
  revenueDelta: number;
  roi: number;
  conversion: number;
  performance: number;
  status: PromoStatus;
  alert?: PromoAlert;
  /** 14 valeurs pour la sparkline d'évolution réservations. */
  sparkline: number[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SEED DATA                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const spark = (n: number, base = 50, jitter = 25): number[] =>
  Array.from({ length: n }, (_, i) =>
    Math.max(
      2,
      Math.round(base + Math.sin(i / 1.4) * jitter + Math.sin(i * 3.7 + base) * jitter * 0.3)
    )
  );

const SEED_PROMOTIONS: Promotion[] = [
  {
    id: '1',
    name: 'Tarif Mobile Exclusif',
    description: 'Réservé aux utilisateurs mobile',
    type: 'mobile_rate',
    typeLabel: 'Mobile Rate',
    discount: '10%',
    discountValue: 10,
    code: 'MOBILE10',
    startDate: '2026-05-15',
    endDate: '2026-06-30',
    permanent: false,
    channels: ['Booking.com', 'Direct'],
    rooms: ['Toutes'],
    segments: ['Loisir', 'Affaires'],
    minNights: 1,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'active',
    sparkline: spark(14, 90, 35),
    alert: {
      why: 'Capter la clientèle mobile-first (60% du trafic OTA)',
      when: 'Permanent — Booking mobile > 50% des réservations',
      who: 'Booking.com + Site direct (app mobile)',
      priority: 'high',
    },
  },
  {
    id: '2',
    name: 'Early Bird Été',
    description: 'Réservation anticipée 90j',
    type: 'early_booker',
    typeLabel: 'Early Booker',
    discount: '20%',
    discountValue: 20,
    code: 'EARLY20',
    startDate: '2026-05-01',
    endDate: '2026-08-15',
    permanent: false,
    channels: ['Direct', 'Expedia'],
    rooms: ['Supérieure', 'Deluxe'],
    segments: ['Loisir', 'Famille'],
    minNights: 2,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'active',
    sparkline: spark(14, 72, 28),
    alert: {
      why: 'Sécuriser occupation haute saison 3 mois avant',
      when: 'Activer 90j avant période cible (avril pour été)',
      who: 'Site direct (meilleure marge) + Expedia',
      priority: 'high',
    },
  },
  {
    id: '3',
    name: 'Last Minute Week-end',
    description: 'Offre de dernière minute',
    type: 'last_minute',
    typeLabel: 'Last Minute',
    discount: '25%',
    discountValue: 25,
    code: null,
    startDate: '2026-06-06',
    endDate: '2026-06-29',
    permanent: false,
    channels: ['Direct'],
    rooms: ['Toutes'],
    segments: ['Loisir'],
    minNights: 1,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'scheduled',
    sparkline: spark(14, 40, 22),
    alert: {
      why: 'Occupation < 60% à J-3 → Yield de dernière minute',
      when: 'Activer SI occupation vendredi/samedi < 60% le mercredi',
      who: 'Direct uniquement (pas de commission OTA)',
      priority: 'medium',
    },
  },
  {
    id: '4',
    name: 'Long Séjour Affaires',
    description: 'Séjour 3 nuits et plus',
    type: 'long_stay',
    typeLabel: 'Long Stay',
    discount: '15%',
    discountValue: 15,
    code: 'STAY3',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    permanent: true,
    channels: ['Booking.com', 'Direct', 'Expedia'],
    rooms: ['Toutes'],
    segments: ['Affaires', 'Groupe'],
    minNights: 3,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'active',
    sparkline: spark(14, 80, 18),
  },
  {
    id: '5',
    name: 'Non Remboursable',
    description: 'Tarif non annulable',
    type: 'non_refundable',
    typeLabel: 'Non Refundable',
    discount: '18%',
    discountValue: 18,
    code: null,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    permanent: true,
    channels: ['Booking.com', 'Expedia'],
    rooms: ['Toutes'],
    segments: ['Loisir', 'Affaires'],
    minNights: 1,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'active',
    sparkline: spark(14, 130, 30),
    alert: {
      why: 'Meilleure visibilité algorithmes OTA + réduit no-shows',
      when: 'Permanent sur OTA (boost ranking)',
      who: 'Booking.com + Expedia (demandé par algorithmes)',
      priority: 'high',
    },
  },
  {
    id: '6',
    name: 'Genius / Fidélité',
    description: 'Offre réservée membres Genius',
    type: 'genius',
    typeLabel: 'Genius',
    discount: '12%',
    discountValue: 12,
    code: null,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    permanent: true,
    channels: ['Booking.com'],
    rooms: ['Toutes'],
    segments: ['Loisir', 'Affaires'],
    minNights: 1,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'active',
    sparkline: spark(14, 170, 32),
  },
  {
    id: '7',
    name: 'Escapade Romantique',
    description: 'Package avec avantages',
    type: 'romantic',
    typeLabel: 'Romantic Escape',
    discount: '1 nuit',
    discountValue: 0,
    code: 'LOVE2026',
    startDate: '2026-02-01',
    endDate: '2026-02-14',
    permanent: false,
    channels: ['Direct'],
    rooms: ['Suite'],
    segments: ['Loisir'],
    minNights: 2,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'paused',
    sparkline: spark(14, 25, 15),
  },
  {
    id: '8',
    name: 'Offre Famille',
    description: 'Enfants gratuits',
    type: 'family',
    typeLabel: 'Family Deal',
    discount: '20%',
    discountValue: 20,
    code: 'FAMILY20',
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    permanent: false,
    channels: ['Direct', 'Booking.com'],
    rooms: ['Familiale'],
    segments: ['Famille'],
    minNights: 2,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'draft',
    sparkline: spark(14, 10, 6),
    alert: {
      why: 'Vacances scolaires — segment famille = séjours longs',
      when: 'Activer début juin pour résa juillet-août',
      who: 'Direct + Booking (large audience famille)',
      priority: 'medium',
    },
  },
  {
    id: '9',
    name: 'Petit Déjeuner Offert',
    description: 'Petit déjeuner inclus',
    type: 'free_breakfast',
    typeLabel: 'Free Breakfast',
    discount: '15€/pers',
    discountValue: 0,
    code: null,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    permanent: true,
    channels: ['Direct'],
    rooms: ['Toutes'],
    segments: ['Loisir'],
    minNights: 1,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'active',
    sparkline: spark(14, 55, 20),
  },
  {
    id: '10',
    name: 'Deal Secret',
    description: 'Offre confidentielle',
    type: 'secret',
    typeLabel: 'Secret Deal',
    discount: '30%',
    discountValue: 30,
    code: null,
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    permanent: false,
    channels: ['Booking.com'],
    rooms: ['Toutes'],
    segments: ['Loisir'],
    minNights: 1,
    bookings: 0,
    bookingsDelta: 0,
    revenue: 0,
    revenueDelta: 0,
    roi: 0,
    conversion: 0,
    performance: 0,
    status: 'ended',
    sparkline: spark(14, 18, 10),
  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* STORE                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

interface PromotionsStore {
  promotions: Promotion[];
  /** Hydratée à false jusqu'à ce que Zustand persist soit prêt. */
  isHydrated: boolean;

  /* Mutations — toutes émettent un événement sur le bus RMS */
  toggleStatus: (id: string) => void;
  updatePromotion: (id: string, patch: Partial<Promotion>) => void;
  createPromotion: (input: Omit<Promotion, 'id' | 'sparkline'>) => string;
  duplicatePromotion: (id: string) => string | null;
  deletePromotion: (id: string) => void;
  resetSeed: () => void;
}

function nextStatusFromToggle(current: PromoStatus): PromoStatus {
  if (current === 'active') return 'paused';
  if (current === 'paused' || current === 'scheduled' || current === 'draft')
    return 'active';
  return current; // 'ended' n'est pas toggable depuis la table
}

export const usePromotionsStore = create<PromotionsStore>()(
  persist(
    (set, get) => ({
      promotions: SEED_PROMOTIONS,
      isHydrated: false,

      toggleStatus: (id) => {
        const promo = get().promotions.find((p) => p.id === id);
        if (!promo) return;
        const nextStatus = nextStatusFromToggle(promo.status);
        if (nextStatus === promo.status) return;
        set((s) => ({
          promotions: s.promotions.map((p) =>
            p.id === id ? { ...p, status: nextStatus } : p
          ),
        }));
        emitRmsEvent('promotion:status-changed', {
          promotionId: id,
          nextStatus,
          previousStatus: promo.status,
        });
      },

      updatePromotion: (id, patch) => {
        if (!get().promotions.some((p) => p.id === id)) return;
        set((s) => ({
          promotions: s.promotions.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        }));
        emitRmsEvent('promotion:updated', { promotionId: id });
      },

      createPromotion: (input) => {
        const id = `promo_${Date.now().toString(36)}_${Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('')}`;
        const promo: Promotion = { ...input, id, sparkline: spark(14, 12, 8) };
        set((s) => ({ promotions: [promo, ...s.promotions] }));
        emitRmsEvent('promotion:created', { promotionId: id, name: promo.name });
        return id;
      },

      duplicatePromotion: (id) => {
        const source = get().promotions.find((p) => p.id === id);
        if (!source) return null;
        const newId = `promo_${Date.now().toString(36)}_${Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('')}`;
        const copy: Promotion = {
          ...source,
          id: newId,
          name: `${source.name} (copie)`,
          status: 'draft',
          bookings: 0,
          revenue: 0,
          roi: 0,
          bookingsDelta: 0,
          revenueDelta: 0,
          performance: 0,
          sparkline: spark(14, 10, 5),
        };
        set((s) => ({ promotions: [copy, ...s.promotions] }));
        emitRmsEvent('promotion:duplicated', { sourceId: id, newId });
        return newId;
      },

      deletePromotion: (id) => {
        if (!get().promotions.some((p) => p.id === id)) return;
        set((s) => ({ promotions: s.promotions.filter((p) => p.id !== id) }));
        emitRmsEvent('promotion:deleted', { promotionId: id });
      },

      resetSeed: () => {
        set({ promotions: SEED_PROMOTIONS });
      },
    }),
    {
      name: 'flowtym_promotions',
      partialize: (state) => ({ promotions: state.promotions }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);

/* ────────────────────────────────────────────────────────────────────────── */
/* SÉLECTEURS UTILITAIRES                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export function selectActivePromotions(state: PromotionsStore): Promotion[] {
  return state.promotions.filter((p) => p.status === 'active');
}

/** Compte les promotions actives par canal (ex: { 'Booking.com': 4, 'Direct': 3 }). */
export function selectActivePromotionsByChannel(
  state: PromotionsStore
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of state.promotions) {
    if (p.status !== 'active') continue;
    for (const c of p.channels) counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}
