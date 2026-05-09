/**
 * FLOWTYM — Reservations Zod schemas (aligned with live Supabase schema).
 */
import { z } from 'zod';

/** Permissive UUID matcher: tolerates v0 fixtures used by legacy seeds. */
const uuidLoose = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Invalid UUID');

export const reservationRowSchema = z
  .object({
    id: uuidLoose,
    reference: z.string().nullable(),
    hotel_id: uuidLoose.nullable(),
    room_id: uuidLoose.nullable(),
    room_number: z.string().nullable(),
    guest_id: uuidLoose.nullable(),
    guest_name: z.string().nullable(),
    guest_email: z.string().nullable(),
    guest_phone: z.string().nullable(),
    rate_plan_id: uuidLoose.nullable(),
    check_in: z.string(),
    check_out: z.string(),
    nights: z.number().int().nullable(),
    status: z.string().nullable(),
    checkin_status: z.string().nullable(),
    adults: z.number().int().nullable(),
    children: z.number().int().nullable(),
    pax: z.number().int().nullable(),
    total_amount: z.number().nullable(),
    paid_amount: z.number().nullable(),
    solde: z.number().nullable(),
    source: z.string().nullable(),
    segment: z.string().nullable(),
    payment_status: z.string().nullable(),
    notes: z.string().nullable(),
    special_requests: z.string().nullable(),
    room_type: z.string().nullable(),
    room_category: z.string().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
  })
  .passthrough();

export type ReservationRow = z.infer<typeof reservationRowSchema>;

export const createReservationInputSchema = z
  .object({
    reference: z
      .string()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9-]+$/, 'Référence en majuscules, chiffres et tirets'),
    guestId: uuidLoose.nullable().optional(),
    roomId: uuidLoose.nullable().optional(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(10).default(0),
    source: z.string().min(1).default('Direct'),
    totalAmount: z.number().nonnegative(),
    notes: z.string().nullable().optional(),
    guestName: z.string().nullable().optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: 'check_out doit être strictement après check_in',
    path: ['checkOut'],
  });

export type CreateReservationInput = z.infer<typeof createReservationInputSchema>;
