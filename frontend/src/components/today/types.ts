/**
 * FLOWTYM — Shared types for the Flowday (TodayView) module.
 */
// Badges canoniques (voir src/services/communication/badges.ts).
export type BadgeType =
  | 'vip' | 'habitue' | 'corporate' | 'attention'
  | 'pmr' | 'blacklist' | 'litige' | 'preference';

export type RoomRow = {
  id: number;
  /** UUID Supabase du client (pour persistance badges + logs de communication). */
  guestId?: string;
  /** UUID Supabase de la réservation. */
  reservationUuid?: string;
  priority: string;
  room: string;
  type: string;
  status: string;
  guest: string;
  initials: string;
  reservationId: string;
  guestCount: number;
  etaTime: string;
  etaNote: string;
  movement: string;
  nights: number;
  stayAmount: string;
  vip: string | null;
  payment: string;
  arrival: string;
  departure: string;
  source: string;
  action: string;
  taskStatus: string;
  badges?: BadgeType[];
  email?: string;
  phone?: string;
  assignedTo?: string;
  isGroup?: boolean;
  category?: string;
  adults?: number;
  children?: number;
  nationality?: string;
  bookingRef?: string;
  ratePlan?: string;
};

export type ReservationModalState = {
  row: RoomRow;
  mode: 'arrival' | 'departure';
};

export type ModalTab = 'reservation' | 'billing' | 'cardex' | 'incidents' | 'lost' | 'reviews' | 'elite';

export type CommunicationChannel = 'email' | 'whatsapp';

export type MessageTemplate = {
  id: string;
  label: string;
  icon: string;
  content: string;
};

export type SortKey = 'priority' | 'room' | 'status' | 'guest' | 'arrival' | 'departure' | 'eta' | 'nights' | 'payment' | 'source' | 'movement' | 'action' | 'assignedTo' | 'taskStatus';
