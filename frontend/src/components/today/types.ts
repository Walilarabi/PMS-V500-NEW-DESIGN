/**
 * FLOWTYM — Shared types for the Flowday (TodayView) module.
 */
export type BadgeType = 'vip' | 'prioritaire' | 'nouveau' | 'fidele' | 'incident';

export type RoomRow = {
  id: number;
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
