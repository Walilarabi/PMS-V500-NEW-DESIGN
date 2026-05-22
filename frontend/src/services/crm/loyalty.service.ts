/**
 * FLOWTYM — Loyalty & Segmentation Service (Wave C4)
 *
 * Façade for the loyalty-program config, level recomputation and the
 * behavioural-segment overview RPCs.
 */

import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LoyaltyTier {
  id:                string;
  hotel_id:          string;
  name:              string;
  sort_order:        number;
  min_stays:         number;
  min_spent:         number;
  points_multiplier: number;
  color:             string;
  benefits:          string[];
  created_at:        string;
  updated_at:        string;
}

export interface SegmentBucket {
  key:       string;
  count:     number;
  revenue:   number;
  avg_stays: number;
}

export interface SegmentOverview {
  total:    number;
  segments: SegmentBucket[];
  loyalty:  Record<string, number>;
}

export interface RecomputeResult {
  updated:      number;
  distribution: { tier: string; count: number }[];
}

export interface SaveLoyaltyTierInput {
  id:                string;
  min_stays:         number;
  min_spent:         number;
  points_multiplier: number;
  color:             string;
  benefits:          string[];
}

// ─── RPCs ─────────────────────────────────────────────────────────────────────

export async function listLoyaltyTiers(): Promise<LoyaltyTier[]> {
  const { data, error } = await (supabase.rpc as any)('crm_list_loyalty_tiers');
  if (error) return [];
  return (data ?? []) as LoyaltyTier[];
}

export async function saveLoyaltyTier(tier: SaveLoyaltyTierInput): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('crm_save_loyalty_tier', {
    p_id:                tier.id,
    p_min_stays:         tier.min_stays,
    p_min_spent:         tier.min_spent,
    p_points_multiplier: tier.points_multiplier,
    p_color:             tier.color,
    p_benefits:          tier.benefits,
  });
  if (error) throw error;
  return data as string;
}

export async function recomputeLoyalty(): Promise<RecomputeResult> {
  const { data, error } = await (supabase.rpc as any)('crm_recompute_loyalty');
  if (error) throw error;
  return data as RecomputeResult;
}

export async function getSegmentOverview(): Promise<SegmentOverview> {
  const { data, error } = await (supabase.rpc as any)('crm_segment_overview');
  if (error) throw error;
  return data as SegmentOverview;
}
