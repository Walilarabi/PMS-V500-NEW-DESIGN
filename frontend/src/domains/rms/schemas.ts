/**
 * FLOWTYM RMS — Zod schemas
 *
 * Mirrors the database shape of:
 *   - rate_plans
 *   - pricing_rules
 *   - rate_prices
 *   - rate_restrictions
 *   - competitor_rates
 *
 * These schemas are the single source of truth at the API/DB boundary.
 * All mutations are validated here before hitting Supabase.
 */
import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const pensionTypeSchema = z.enum(['RO', 'BB', 'HB', 'FB', 'AI', 'Package']);
export const channelTypeSchema = z.enum(['OTA', 'Mobile', 'Corporate', 'Direct']);
export const calcModeSchema = z.enum(['fixed', 'derived']);
export const connectivityTypeSchema = z.enum(['D-EDGE', 'ChannelManager', 'Aucun']);
export const cellStatusSchema = z.enum(['open', 'closed', 'restricted', 'readonly']);
export const priceSourceSchema = z.enum([
  'manual',
  'cascade',
  'rms_recommendation',
  'import',
  'lighthouse',
]);
export const inventoryOverrideSchema = z.enum(['manual_closed', 'force_open']).nullable();
export const diffTypeSchema = z.enum(['fixed', 'percent']);

// ─── Rate Plan ──────────────────────────────────────────────────────────────

export const ratePlanRowSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  plan_code: z.string().min(1).max(50),
  plan_name: z.string().min(1).max(200),
  pension_type: pensionTypeSchema,
  channel_type: channelTypeSchema,
  calc_mode: calcModeSchema,
  calc_value: z.number(),
  reference_plan_id: z.string().uuid().nullable(),
  is_reference: z.boolean(),
  is_active: z.boolean(),
  connectivity_type: connectivityTypeSchema,
  is_connectivity_locked: z.boolean(),
  distribution_channels: z.array(z.string()).default([]),
  min_stay: z.number().int().nullable().optional(),
  max_stay: z.number().int().nullable().optional(),
  cancellation_policy: z.string().nullable().optional(),
  meal_plan: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  version: z.number().int(),
});
export type RatePlanRow = z.infer<typeof ratePlanRowSchema>;

// ─── Pricing Rules ──────────────────────────────────────────────────────────

export const roomPriceRuleSchema = z.object({
  room_type_code: z.string().min(1),
  diff_type: diffTypeSchema,
  diff_value: z.number(),
});
export type RoomPriceRule = z.infer<typeof roomPriceRuleSchema>;

export const planPriceRuleSchema = z.object({
  plan_id: z.string().uuid(),
  diff_type: diffTypeSchema,
  diff_value: z.number(),
});
export type PlanPriceRule = z.infer<typeof planPriceRuleSchema>;

export const pricingRulesRowSchema = z.object({
  hotel_id: z.string().uuid(),
  reference_room_type_code: z.string().min(1),
  reference_plan_id: z.string().uuid().nullable(),
  room_rules: z.array(roomPriceRuleSchema).default([]),
  plan_rules: z.array(planPriceRuleSchema).default([]),
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
  version: z.number().int(),
});
export type PricingRulesRow = z.infer<typeof pricingRulesRowSchema>;

// ─── Rate Price ─────────────────────────────────────────────────────────────

export const ratePriceRowSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  room_type_code: z.string().min(1),
  plan_id: z.string().uuid(),
  stay_date: z.string(), // YYYY-MM-DD
  price: z.number().nonnegative(),
  currency: z.string().min(3).max(8),
  status: cellStatusSchema,
  plan_closed: z.boolean(),
  block_reason: z.string().nullable(),
  source: priceSourceSchema,
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
  version: z.number().int(),
});
export type RatePriceRow = z.infer<typeof ratePriceRowSchema>;

// ─── Rate Restriction ───────────────────────────────────────────────────────

export const rateRestrictionRowSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  room_type_code: z.string().min(1),
  stay_date: z.string(),
  cta: z.boolean(),
  ctd: z.boolean(),
  min_stay: z.number().int().nullable(),
  max_stay: z.number().int().nullable(),
  inventory: z.number().int(),
  capacity: z.number().int().nullable(),
  sold: z.number().int(),
  inventory_override: inventoryOverrideSchema,
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
  version: z.number().int(),
});
export type RateRestrictionRow = z.infer<typeof rateRestrictionRowSchema>;

// ─── Competitor Rates (Lighthouse) ──────────────────────────────────────────

export const competitorRateRowSchema = z.object({
  hotel_id: z.string().uuid(),
  competitor_id: z.number().int(),
  competitor_name: z.string(),
  ota: z.string(),
  stay_date: z.string(),
  los: z.number().int(),
  price: z.number().nullable(),
  currency: z.string(),
  available: z.boolean(),
  meal_type: z.string().nullable().optional(),
  room_type_label: z.string().nullable().optional(),
  is_refundable: z.boolean().nullable().optional(),
  position: z.number().int().nullable().optional(),
  shopped_at: z.string(),
  fetched_at: z.string(),
});
export type CompetitorRateRow = z.infer<typeof competitorRateRowSchema>;

// ─── Update Inputs (client → server) ────────────────────────────────────────

export const updatePriceInputSchema = z.object({
  id: z.string().uuid(),
  price: z.number().nonnegative(),
  version: z.number().int(), // optimistic lock — must match DB
});
export type UpdatePriceInput = z.infer<typeof updatePriceInputSchema>;

export const cascadeReferencePriceInputSchema = z.object({
  hotel_id: z.string().uuid(),
  stay_date: z.string(),
  new_price: z.number().nonnegative(),
});
export type CascadeReferencePriceInput = z.infer<typeof cascadeReferencePriceInputSchema>;

export const updateRestrictionInputSchema = z.object({
  id: z.string().uuid(),
  cta: z.boolean().optional(),
  ctd: z.boolean().optional(),
  min_stay: z.number().int().nullable().optional(),
  max_stay: z.number().int().nullable().optional(),
  inventory_override: inventoryOverrideSchema.optional(),
  version: z.number().int(),
});
export type UpdateRestrictionInput = z.infer<typeof updateRestrictionInputSchema>;
