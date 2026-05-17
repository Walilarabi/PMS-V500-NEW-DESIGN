/**
 * FLOWTYM — STATUS MAPPER
 * 
 * Mapping unifié entre :
 * - Statuts base de données (Supabase)
 * - Statuts OTA (Booking.com, Airbnb, etc.)
 * - Statuts internes PMS
 * - Statuts affichage UI
 * 
 * OBJECTIF : Chaque réservation doit apparaître dans la bonne catégorie,
 * quelle que soit sa source ou son état initial.
 */

import { colorClasses } from '@/design-system/tokens';

// ─── TYPES ────────────────────────────────────────────────────────────────────

/**
 * Statut normalisé interne (source de vérité).
 */
export type NormalizedStatus =
  | 'confirmed'      // Réservation confirmée (avec ou sans paiement)
  | 'checked_in'     // Client arrivé, en cours de séjour
  | 'checked_out'    // Client parti, séjour terminé
  | 'hold'           // Option / hold temporaire (expire sous X heures)
  | 'pending'        // En attente (paiement, validation, etc.)
  | 'cancelled'      // Annulée
  | 'no_show';       // No-show (client ne s'est pas présenté)

/**
 * Catégorie d'affichage dans le module Réservations.
 */
export type ReservationCategory =
  | 'confirmed'              // Onglet "Confirmées"
  | 'pending'                // Onglet "En attente"
  | 'hold'                   // Onglet "Options"
  | 'cancelled'              // Onglet "Annulées"
  | 'payment_pending'        // Onglet "Attente de paiement"
  | 'groups';                // Onglet "Groupes"

/**
 * Métadonnées visuelles pour l'affichage.
 */
export interface StatusDisplay {
  label: string;
  color: string;        // Classes Tailwind pour bg/text/border
  dotColor: string;     // Classe pour le dot indicator
  category: ReservationCategory;
  priority: number;     // Pour tri (1 = plus urgent, 5 = moins urgent)
}

// ─── MAPPING TABLES ───────────────────────────────────────────────────────────

/**
 * Statuts base de données → statut normalisé.
 */
const DB_STATUS_MAP: Record<string, NormalizedStatus> = {
  // Standards Flowtym
  'confirmed': 'confirmed',
  'checked_in': 'checked_in',
  'checked_out': 'checked_out',
  'cancelled': 'cancelled',
  'pending': 'pending',
  'hold': 'hold',
  'no_show': 'no_show',
  
  // Variantes possibles (snake_case, camelCase, etc.)
  'checkedIn': 'checked_in',
  'checkedOut': 'checked_out',
  'noShow': 'no_show',
};

/**
 * Statuts OTA → statut normalisé.
 * Booking.com, Airbnb, Expedia, etc. ont leurs propres conventions.
 */
const OTA_STATUS_MAP: Record<string, NormalizedStatus> = {
  // Booking.com
  'booked': 'confirmed',
  'confirmed': 'confirmed',
  'cancelled': 'cancelled',
  'no-show': 'no_show',
  
  // Airbnb
  'accept': 'confirmed',
  'pending': 'pending',
  'declined': 'cancelled',
  'canceled': 'cancelled',
  
  // Expedia
  'committed': 'confirmed',
  'pending_payment': 'pending',
};

/**
 * Statut normalisé → affichage UI.
 */
const STATUS_DISPLAY_MAP: Record<NormalizedStatus, StatusDisplay> = {
  confirmed: {
    label: 'Confirmée',
    color: colorClasses.status.confirmed,
    dotColor: 'bg-emerald-500',
    category: 'confirmed',
    priority: 2,
  },
  checked_in: {
    label: 'Check-in',
    color: colorClasses.status.checkedIn,
    dotColor: 'bg-blue-500',
    category: 'confirmed',  // Apparaît dans Confirmées (in-house)
    priority: 1,
  },
  checked_out: {
    label: 'Check-out',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    dotColor: 'bg-gray-400',
    category: 'confirmed',  // Historique récent
    priority: 5,
  },
  hold: {
    label: 'Option',
    color: colorClasses.status.hold,
    dotColor: 'bg-amber-500',
    category: 'hold',
    priority: 3,
  },
  pending: {
    label: 'En attente',
    color: colorClasses.status.pending,
    dotColor: 'bg-amber-500',
    category: 'pending',
    priority: 2,
  },
  cancelled: {
    label: 'Annulée',
    color: colorClasses.status.cancelled,
    dotColor: 'bg-red-500',
    category: 'cancelled',
    priority: 4,
  },
  no_show: {
    label: 'No-show',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    dotColor: 'bg-orange-500',
    category: 'cancelled',  // Apparaît dans Annulées
    priority: 4,
  },
};

// ─── API PUBLIQUE ─────────────────────────────────────────────────────────────

/**
 * Normalise un statut brut (DB, OTA, ou autre) vers le statut interne.
 * 
 * @param rawStatus - Statut brut (de n'importe quelle source)
 * @param source - Source optionnelle ('booking', 'airbnb', 'db', etc.)
 * @returns Statut normalisé
 * 
 * @example
 * normalizeStatus('booked', 'booking') → 'confirmed'
 * normalizeStatus('cancelled') → 'cancelled'
 */
export function normalizeStatus(
  rawStatus: string | null | undefined,
  source?: 'db' | 'booking' | 'airbnb' | 'expedia' | 'direct'
): NormalizedStatus {
  if (!rawStatus) return 'pending';
  
  const normalized = rawStatus.toLowerCase().trim();
  
  // Si source OTA connue, utiliser sa map spécifique
  if (source && source !== 'db' && source !== 'direct') {
    const otaMapped = OTA_STATUS_MAP[normalized];
    if (otaMapped) return otaMapped;
  }
  
  // Sinon map générique DB
  return DB_STATUS_MAP[normalized] ?? 'pending';
}

/**
 * Retourne les métadonnées d'affichage pour un statut.
 * 
 * @param status - Statut normalisé ou brut
 * @returns Métadonnées UI (label, couleurs, catégorie)
 * 
 * @example
 * getStatusDisplay('confirmed') → { label: 'Confirmée', color: '...', category: 'confirmed', ... }
 */
export function getStatusDisplay(status: NormalizedStatus | string): StatusDisplay {
  const normalized = typeof status === 'string' 
    ? normalizeStatus(status) 
    : status;
  
  return STATUS_DISPLAY_MAP[normalized] ?? STATUS_DISPLAY_MAP.pending;
}

/**
 * Détermine la catégorie d'affichage d'une réservation.
 * Prend en compte le statut ET le contexte (paiement, groupe, etc.).
 * 
 * @param status - Statut normalisé
 * @param context - Contexte additionnel (paiement en attente, groupe, etc.)
 * @returns Catégorie pour filtrage UI
 * 
 * @example
 * getCategory('confirmed', { paymentPending: true }) → 'payment_pending'
 * getCategory('confirmed', { isGroup: true }) → 'groups'
 */
export function getCategory(
  status: NormalizedStatus,
  context?: {
    paymentPending?: boolean;
    isGroup?: boolean;
    pax?: number;
  }
): ReservationCategory {
  // Groupe (>= 10 pax ou marqué explicitement)
  if (context?.isGroup || (context?.pax && context.pax >= 10)) {
    return 'groups';
  }
  
  // Attente de paiement (confirmée mais paiement incomplet)
  if (status === 'confirmed' && context?.paymentPending) {
    return 'payment_pending';
  }
  
  // Sinon, catégorie standard depuis le statut
  return STATUS_DISPLAY_MAP[status].category;
}

/**
 * Trie les réservations par priorité (urgent → moins urgent).
 * Utile pour afficher les réservations dans l'ordre optimal.
 */
export function sortByPriority<T extends { status: NormalizedStatus }>(
  reservations: T[]
): T[] {
  return [...reservations].sort((a, b) => {
    const priorityA = STATUS_DISPLAY_MAP[a.status].priority;
    const priorityB = STATUS_DISPLAY_MAP[b.status].priority;
    return priorityA - priorityB;
  });
}
