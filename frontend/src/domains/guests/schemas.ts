import { z } from 'zod';

export const guestRowSchema = z.object({
  // Core identity
  id:                 z.string().uuid(),
  hotel_id:           z.string().uuid().nullable(),
  legacy_id:          z.number().int(),
  first_name:         z.string().nullable(),
  last_name:          z.string(),
  email:              z.string().nullable(),
  phone:              z.string().nullable(),

  // Address & identity documents
  country:            z.string().nullable(),
  nationality:        z.string().nullable(),
  passport:           z.string().nullable(),
  date_of_birth:      z.string().nullable(),
  address:            z.string().nullable(),
  city:               z.string().nullable(),
  zip:                z.string().nullable(),

  // Profile
  language:           z.string().nullable(),
  segment:            z.string().nullable(),
  loyalty_level:      z.string().nullable(),

  // Financials (denormalized — refreshed by crm_compute_guest_kpis)
  total_spent:        z.number().nullable(),
  total_stays:        z.number().int().nullable(),

  // Compliance
  id_verified:        z.boolean().nullable(),
  gdpr_consent:       z.boolean().nullable(),
  gdpr_date:          z.string().nullable(),
  blacklisted:        z.boolean().nullable(),

  // Misc
  notes:              z.string().nullable(),
  tags:               z.array(z.string()).nullable(),

  // ── Wave C1 enterprise columns ──────────────────────────────────
  gender:             z.string().nullable().optional(),
  whatsapp:           z.string().nullable().optional(),
  social_links:       z.record(z.string(), z.string()).nullable().optional(),
  photo_url:          z.string().nullable().optional(),
  profession:         z.string().nullable().optional(),
  employer:           z.string().nullable().optional(),
  job_title:          z.string().nullable().optional(),
  visa:               z.string().nullable().optional(),
  doc_expiry_date:    z.string().nullable().optional(),
  languages:          z.array(z.string()).nullable().optional(),
  acquisition_source: z.string().nullable().optional(),
  vip:                z.boolean().optional(),
  risk_level:         z.string().optional(),
  satisfaction_score: z.number().nullable().optional(),
  ai_scores:          z.record(z.string(), z.unknown()).nullable().optional(),

  // Timestamps
  created_at:         z.string().nullable(),
  updated_at:         z.string().nullable(),
});

export type GuestRowDto = z.infer<typeof guestRowSchema>;
