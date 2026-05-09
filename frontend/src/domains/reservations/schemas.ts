/**
 * FLOWTYM — Reservations domain Zod schemas + DTOs.
 *
 * Strict server boundary contracts. The repository feeds Postgres rows into
 * `reservationRowSchema`; no untyped data ever reaches the UI layer.
 */
import { z } from 'zod';

import type {
  PaymentStatus,
  ReservationStatus,
} from '@/src/lib/supabase.types';

const reservationStatuses = [
  'draft',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
] as const satisfies readonly ReservationStatus[];

const paymentStatuses = ['unpaid', 'partial', 'paid', 'refunded'] as const satisfies readonly PaymentStatus[];

export const reservationRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  reference: z.string(),
  guest_id: z.string().uuid().nullable(),
  room_id: z.string().uuid().nullable(),
  status: z.enum(reservationStatuses),
  payment_status: z.enum(paymentStatuses),
  check_in: z.string(), // ISO date
  check_out: z.string(),
  adults: z.number().int().nonnegative(),
  children: z.number().int().nonnegative(),
  channel: z.string(),
  rate_plan: z.string().nullable(),
  total_cents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  notes: z.string().nullable(),
  version: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ReservationRow = z.infer<typeof reservationRowSchema>;

export const createReservationInputSchema = z
  .object({
    hotelId: z.string().uuid(),
    reference: z
      .string()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9-]+$/, 'Référence en majuscules, chiffres et tirets'),
    guestId: z.string().uuid().nullable().optional(),
    roomId: z.string().uuid().nullable().optional(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(10).default(0),
    channel: z.string().min(1).default('direct'),
    ratePlan: z.string().nullable().optional(),
    totalCents: z.number().int().nonnegative(),
    currency: z.string().length(3).default('EUR'),
    notes: z.string().nullable().optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: 'check_out doit être strictement après check_in',
    path: ['checkOut'],
  });

export type CreateReservationInput = z.infer<typeof createReservationInputSchema>;
