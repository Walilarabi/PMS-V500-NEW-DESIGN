/**
 * FLOWTYM — Planning module shared types & helpers.
 */
import type { ReservationRow } from '@/src/domains/reservations/schemas';
import type { RoomRow } from '@/src/lib/supabase.types';

export type ViewLength = '7J' | '15J' | 'Mois';
export type DisplayMode = 'Gantt' | 'Revenue';
export type RevenueSubView = 'KPI' | 'Graphiques';

export interface ChannelDef {
  code: string;
  name: string;
  color: string;
}

/* Default channels palette (mock — to be migrated to Supabase later). */
export const CHANNELS: ChannelDef[] = [
  { code: 'BOOKING', name: 'Booking.com', color: '#003580' },
  { code: 'EXPEDIA', name: 'Expedia', color: '#FFC72C' },
  { code: 'AIRBNB', name: 'Airbnb', color: '#FF5A5F' },
  { code: 'DIRECT', name: 'Direct', color: '#10B981' },
  { code: 'WALKIN', name: 'Walk-in', color: '#8B5CF6' },
  { code: 'PHONE', name: 'Téléphone', color: '#0EA5E9' },
];

/* Category default prices (mock — fed into ConfirmMove differential). */
export const CATEGORY_PRICES: Record<string, number> = {
  STD: 100,
  CL: 110,
  SUP: 150,
  DLX: 200,
  JS: 280,
  STE: 350,
};

export const DAY_MS = 86_400_000;

export const isoDay = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const fmtEUR = (n: number | null | undefined, max = 0): string =>
  typeof n === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: max }).format(n)
    : '—';

export const getContrastColor = (hex: string): string => {
  if (!hex) return '#1e293b';
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#1e293b' : '#ffffff';
};

export const buildDateRange = (anchor: Date, days: number): Date[] => {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY_MS));
};

export const getChannel = (source: string | null | undefined): ChannelDef => {
  const code = (source ?? '').toUpperCase();
  return CHANNELS.find((c) => c.code === code) ?? CHANNELS[3]; // default to DIRECT
};

export const matchRoomToReservation = (room: RoomRow, r: ReservationRow): boolean =>
  r.room_id ? r.room_id === room.id : r.room_number === room.number;

export const computeViewLength = (v: ViewLength): number =>
  v === '7J' ? 7 : v === '15J' ? 15 : 30;

/* Auto-fit width strategy (option C) :
 *   • 7J  → fill 100% width (each cell = 100/7%)
 *   • 15J → fill if container >= 15 * MIN_CELL, else minWidth and scroll
 *   • Mois → always fixed minWidth + scroll
 */
export const MIN_CELL_PX = 64;
export const MAX_CELL_PX = 160;

export interface SizeStrategy {
  fillWidth: boolean;       // if true, cells use percentage, else fixed pixel min width
  cellMinPx: number;
  cellMaxPx: number;
}

export const computeSizeStrategy = (view: ViewLength): SizeStrategy => {
  if (view === '7J') return { fillWidth: true, cellMinPx: MIN_CELL_PX, cellMaxPx: MAX_CELL_PX };
  if (view === '15J') return { fillWidth: true, cellMinPx: MIN_CELL_PX, cellMaxPx: MAX_CELL_PX };
  return { fillWidth: false, cellMinPx: MIN_CELL_PX, cellMaxPx: MAX_CELL_PX };
};
