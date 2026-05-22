import { z } from 'zod';

/**
 * Runtime validation schema for a guest row.
 * The static type `GuestRowDto` is declared explicitly below — Zod v4's
 * `z.infer` degrades nullable fields, so the contract is hand-written.
 */
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

/** Explicit guest contract — mirrors the DB row shape. */
export interface GuestRowDto {
  id:                 string;
  hotel_id:           string | null;
  legacy_id:          number;
  first_name:         string | null;
  last_name:          string;
  email:              string | null;
  phone:              string | null;
  country:            string | null;
  nationality:        string | null;
  passport:           string | null;
  date_of_birth:      string | null;
  address:            string | null;
  city:               string | null;
  zip:                string | null;
  language:           string | null;
  segment:            string | null;
  loyalty_level:      string | null;
  total_spent:        number | null;
  total_stays:        number | null;
  id_verified:        boolean | null;
  gdpr_consent:       boolean | null;
  gdpr_date:          string | null;
  blacklisted:        boolean | null;
  notes:              string | null;
  tags:               string[] | null;
  gender:             string | null;
  whatsapp:           string | null;
  social_links:       Record<string, string> | null;
  photo_url:          string | null;
  profession:         string | null;
  employer:           string | null;
  job_title:          string | null;
  visa:               string | null;
  doc_expiry_date:    string | null;
  languages:          string[] | null;
  acquisition_source: string | null;
  vip:                boolean;
  risk_level:         string;
  satisfaction_score: number | null;
  ai_scores:          Record<string, unknown> | null;
  created_at:         string | null;
  updated_at:         string | null;
}
