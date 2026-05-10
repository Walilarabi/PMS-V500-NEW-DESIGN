/**
 * FLOWTYM — Planning domain schemas (channels & events).
 */
import { z } from 'zod';

export const planningChannelSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  position: z.number().int().nonnegative(),
  active: z.boolean(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type PlanningChannelRow = z.infer<typeof planningChannelSchema>;

export const planningEventImpactSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type PlanningEventImpact = z.infer<typeof planningEventImpactSchema>;

export const planningEventSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  name: z.string().min(1),
  start_date: z.string(), // ISO date YYYY-MM-DD
  end_date: z.string(),
  impact: planningEventImpactSchema,
  description: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type PlanningEventRow = z.infer<typeof planningEventSchema>;

export interface PlanningEventInput {
  name: string;
  start_date: string;
  end_date: string;
  impact: PlanningEventImpact;
  description?: string | null;
  source?: string | null;
  location?: string | null;
}

export interface PlanningChannelInput {
  code: string;
  name: string;
  color: string;
  position?: number;
  active?: boolean;
}
