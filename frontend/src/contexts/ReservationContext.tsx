import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { computeReservationPriority } from '../store/revenueEngine';
import { useConfigStore } from '../store/configStore';

// ─── TYPES ────────────────────────────────────────────────────────────────────

/** Statuts complets d'une réservation */
export type ReservationStatus = 'option' | 'pending' | 'confirmed' | 'cancelled' | 'noshow';

/** Entrée de log de traçabilité */
export interface ReservationLog {
  timestamp: string;
  action: string;
  userId?: string;
  field?: string;
  before?: string | number | boolean;
  after?: string | number | boolean;
}

export interface CardexDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  source: 'checkin_scan' | 'manual_upload';
}

export interface Reservation {
  id: string;
  priority: string;
  room: string;
  roomType: string;
  status: string;           // statut opérationnel (affiché dans la UI existante)
  statusColor: string;
  dotColor: string;
  client: string;
  arrival: string;          // "DD MMM HH:mm" ou ISO
  departure: string;
  source: string;
  sourceColor: string;
  action: string;
  governess: string;
  vip: boolean;
  payment: string;
  totalAmount: number;
  ownerFeeRate: number;
  pmsFeeRate: number;
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

  // ── Nouveaux champs (rétrocompatibles — tous optionnels avec valeurs par défaut) ──
  checkIn?: string;                // ISO date "YYYY-MM-DD"
  checkOut?: string;               // ISO date "YYYY-MM-DD"
  reservationStatus?: ReservationStatus;
  isOverbooking?: boolean;
  overbookingPriority?: number;    // 0–4 (calculé automatiquement)
  optionExpiresAt?: string;        // ISO datetime
  dynamicPriceApplied?: boolean;
  appliedPricingRules?: string[];
  dynamicBasePrice?: number;
  logs?: ReservationLog[];
  cardexDocuments?: CardexDocument[];
}

interface EnrichedReservation extends Reservation {
  nights: number;
  revenuePerNight: number;
  ownerPayout: number;
  pmsCommission: number;
  season: 'Haute' | 'Basse';
  // Calculés
  effectiveStatus: ReservationStatus;  // valeur résolue (défaut: 'confirmed')
  isExpiredOption: boolean;            // option expirée non encore nettoyée
}

// ─── CONTEXTE ─────────────────────────────────────────────────────────────────

interface ReservationContextType {
  reservations: EnrichedReservation[];
  addReservation: (reservation: Reservation) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  /** Remplace tout le tableau (utilisé pour la sync Supabase) */
  replaceAll: (reservations: Reservation[]) => void;
  /** Change le statut et trace le changement dans les logs */
  changeStatus: (id: string, newStatus: ReservationStatus, userId?: string) => void;
  /** Expire manuellement toutes les options dépassées */
  expireOptions: () => void;
  /** Retourne les réservations triées par priorité overbooking */
  getPriorityOrder: (roomResIds: string[]) => EnrichedReservation[];
  /** Effectue le check-in d'une réservation */
  doCheckin: (id: string) => void;
  /** Effectue le check-out d'une réservation */
  doCheckout: (id: string) => void;
}

const ReservationContext = createContext<ReservationContextType | undefined>(undefined);

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const OPTION_EXPIRY_INTERVAL = 60_000; // 60 secondes

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Résout le statut effectif (rétrocompatibilité avec anciennes réservations sans reservationStatus) */
const resolveStatus = (res: Reservation): ReservationStatus => {
  if (res.reservationStatus) return res.reservationStatus;
  // Mapping legacy statuts → nouveaux statuts
  const s = res.status?.toLowerCase() ?? '';
  if (s.includes('annul')) return 'cancelled';
  if (s.includes('no-show') || s.includes('noshow')) return 'noshow';
  if (s.includes('option') || s.includes('hold')) return 'option';
  if (s.includes('attente') || s.includes('pending')) return 'pending';
  return 'confirmed'; // Défaut sécurisé
};

/** Vérifie si une option est expirée */
const isOptionExpired = (res: Reservation): boolean => {
  if (resolveStatus(res) !== 'option') return false;
  if (!res.optionExpiresAt) return false;
  return new Date(res.optionExpiresAt).getTime() < Date.now();
};

/** Ajoute un log à une réservation */
const appendLog = (res: Reservation, log: Omit<ReservationLog, 'timestamp'>): Reservation => ({
  ...res,
  logs: [
    ...(res.logs ?? []),
    { ...log, timestamp: new Date().toISOString() },
  ],
});

/** Calcule les nuits entre arrival et departure (robuste) */
const calcNights = (arrival: string, departure: string): number => {
  // Try to extract date part if it's "DD MMM HH:mm"
  const parseSpecial = (s: string) => {
    if (s.includes(' avr.')) return new Date(2026, 3, parseInt(s));
    if (s.includes(' mai')) return new Date(2026, 4, parseInt(s));
    return new Date(s);
  };

  const cin = parseSpecial(arrival).getTime();
  const cout = parseSpecial(departure).getTime();
  if (isNaN(cin) || isNaN(cout)) return 1;
  const diff = Math.ceil((cout - cin) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
};

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
// In-memory bridge: populated by useSupabaseSync after login.
// No localStorage — PMS data (guest PII, amounts) must not be cached client-side.

export const ReservationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Start empty; useSupabaseSync injects real Supabase data via replaceAll()
  const [baseReservations, setReservations] = useState<Reservation[]>([]);
  const setRoomStatus = useConfigStore(state => state.setRoomStatus);

  // ── Enrichissement ──
  const enrichReservation = (res: Reservation): EnrichedReservation => {
    const nights = calcNights(res.arrival, res.departure);
    const revenuePerNight = nights > 0 ? res.totalAmount / nights : res.totalAmount;
    const monthStr = res.arrival.split(' ')[1];
    const isHighSeason = ['juin', 'juil', 'août'].includes(monthStr?.toLowerCase());
    const season: 'Haute' | 'Basse' = isHighSeason ? 'Haute' : 'Basse';
    const pmsCommission = res.totalAmount * res.pmsFeeRate;
    const ownerPayout = res.totalAmount - pmsCommission - res.cleaningFee;
    const effectiveStatus = resolveStatus(res);
    const isExpiredOption = isOptionExpired(res);
    const overbookingPriority = res.overbookingPriority ?? computeReservationPriority({
      reservationStatus: effectiveStatus,
      paymentStatus: res.payment,
    });

    return {
      ...res,
      nights,
      revenuePerNight,
      ownerPayout,
      pmsCommission,
      season,
      effectiveStatus,
      isExpiredOption,
      overbookingPriority,
    };
  };

  const reservations = baseReservations.map(enrichReservation);

  // ── Expiration automatique des options (toutes les 60 secondes) ──
  useEffect(() => {
    const interval = setInterval(() => {
      setReservations(prev => {
        let changed = false;
        const updated = prev.map(res => {
          if (isOptionExpired(res)) {
            changed = true;
            const logged = appendLog(res, {
              action: 'Option expirée automatiquement',
              field: 'reservationStatus',
              before: 'option',
              after: 'cancelled',
              userId: 'system',
            });
            return { ...logged, reservationStatus: 'cancelled' as ReservationStatus };
          }
          return res;
        });
        return changed ? updated : prev;
      });
    }, OPTION_EXPIRY_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // ── Actions ──
  const addReservation = useCallback((reservation: Reservation) => {
    const withDefaults: Reservation = {
      reservationStatus: 'confirmed',
      isOverbooking: false,
      logs: [{ timestamp: new Date().toISOString(), action: 'Réservation créée', userId: 'user' }],
      ...reservation,
    };
    // Si c'est une option, calculer la date d'expiration (défaut 24h)
    if (withDefaults.reservationStatus === 'option' && !withDefaults.optionExpiresAt) {
      const exp = new Date();
      exp.setHours(exp.getHours() + 24);
      withDefaults.optionExpiresAt = exp.toISOString();
    }
    withDefaults.overbookingPriority = computeReservationPriority({
      reservationStatus: withDefaults.reservationStatus!,
      paymentStatus: withDefaults.payment,
    });
    setReservations(prev => [withDefaults, ...prev]);
  }, []);

  const updateReservation = useCallback((id: string, updates: Partial<Reservation>) => {
    setReservations(prev => prev.map(res => {
      if (res.id !== id) return res;
      const updated = { ...res, ...updates };
      // Recalculer priorité si statut ou paiement change
      if (updates.reservationStatus !== undefined || updates.payment !== undefined) {
        updated.overbookingPriority = computeReservationPriority({
          reservationStatus: updated.reservationStatus ?? resolveStatus(updated),
          paymentStatus: updated.payment,
        });
      }
      return updated;
    }));
  }, []);

  const changeStatus = useCallback((id: string, newStatus: ReservationStatus, userId?: string) => {
    setReservations(prev => prev.map(res => {
      if (res.id !== id) return res;
      const oldStatus = resolveStatus(res);
      let updated = appendLog(res, {
        action: `Statut changé: ${oldStatus} → ${newStatus}`,
        field: 'reservationStatus',
        before: oldStatus,
        after: newStatus,
        userId: userId ?? 'user',
      });
      updated = { ...updated, reservationStatus: newStatus };

      // Si passage en option → calculer expiration
      if (newStatus === 'option' && !updated.optionExpiresAt) {
        const exp = new Date();
        exp.setHours(exp.getHours() + 24);
        updated.optionExpiresAt = exp.toISOString();
      }
      // Recalculer priorité
      updated.overbookingPriority = computeReservationPriority({
        reservationStatus: newStatus,
        paymentStatus: updated.payment,
      });
      return updated;
    }));
  }, []);

  const doCheckin = useCallback((id: string) => {
    updateReservation(id, {
      status: 'En séjour',
      statusColor: 'text-indigo-500',
      dotColor: 'bg-indigo-500',
      action: 'Check-out',
      reservationStatus: 'confirmed',
      logs: [{ timestamp: new Date().toISOString(), action: 'Check-in effectué', userId: 'user' }],
    });
  }, [updateReservation]);

  const doCheckout = useCallback((id: string) => {
    const res = baseReservations.find(r => r.id === id);
    if (res) {
      updateReservation(id, {
        status: 'Check-out fait',
        statusColor: 'text-gray-500',
        dotColor: 'bg-gray-400',
        action: 'Archivé',
        reservationStatus: 'confirmed',
        logs: [{ timestamp: new Date().toISOString(), action: 'Check-out effectué', userId: 'user' }],
      });
      setRoomStatus(res.room, 'dirty');
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Facture FA-${new Date().getFullYear()}-${id.split('-')[1]} générée pour ${res.client}` },
      }));
    }
  }, [updateReservation, baseReservations, setRoomStatus]);

  const expireOptions = useCallback(() => {
    setReservations(prev => prev.map(res => {
      if (!isOptionExpired(res)) return res;
      const logged = appendLog(res, {
        action: 'Option expirée manuellement',
        field: 'reservationStatus',
        before: 'option',
        after: 'cancelled',
        userId: 'user',
      });
      return { ...logged, reservationStatus: 'cancelled' as ReservationStatus };
    }));
  }, []);

  const getPriorityOrder = useCallback((roomResIds: string[]): EnrichedReservation[] => {
    return reservations
      .filter(r => roomResIds.includes(r.id))
      .sort((a, b) => (b.overbookingPriority ?? 0) - (a.overbookingPriority ?? 0));
  }, [reservations]);

  const replaceAll = useCallback((newReservations: Reservation[]) => {
    setReservations(newReservations);
  }, []);

  return (
    <ReservationContext.Provider value={{
      reservations,
      addReservation,
      updateReservation,
      replaceAll,
      changeStatus,
      expireOptions,
      getPriorityOrder,
      doCheckin,
      doCheckout,
    }}>
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
