import { z } from 'zod';

export const guestRowSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid().nullable(),
  legacy_id: z.number().int(),
  first_name: z.string().nullable(),
  last_name: z.string(),
  email: z.string().email().nullable().or(z.literal('')),
  phone: z.string().nullable(),
  country: z.string().nullable(),
  nationality: z.string().nullable(),
  segment: z.string().nullable(),
  loyalty_level: z.string().nullable(),
  total_spent: z.number().nullable(),
  total_stays: z.number().int().nullable(),
  blacklisted: z.boolean().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type GuestRowDto = z.infer<typeof guestRowSchema>;
