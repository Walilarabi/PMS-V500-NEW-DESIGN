/**
 * FLOWTYM RMS — Supabase Hooks
 * 
 * React hooks pour accéder aux données RMS via Supabase
 * - Événements
 * - Compset
 * - Recommandations pricing
 * - Historique applications
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface RMSEvent {
  id: string;
  tenant_id: string;
  name: string;
  start_date: string;
  end_date: string;
  venue: string | null;
  category: 'salon' | 'sport' | 'national' | 'cultural';
  impact: 'low' | 'medium' | 'high';
  impact_score: number;
  city: string;
  country_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RMSCompetitor {
  id: string;
  tenant_id: string;
  name: string;
  stars: number;
  segment: 'budget' | 'midscale' | 'upscale' | 'luxury';
  distance_km: number | null;
  address: string | null;
  city: string;
  capacity: number | null;
  base_price: number | null;
  quality_score: number | null;
  review_count: number;
  is_active: boolean;
  is_primary_compset: boolean;
  booking_id: string | null;
}

export interface RMSCompetitorPricing {
  id: string;
  tenant_id: string;
  competitor_id: string;
  date: string;
  price: number;
  availability: 'high' | 'medium' | 'low' | 'sold-out' | null;
  variation_vs_yesterday: number | null;
  variation_vs_3days: number | null;
  variation_vs_7days: number | null;
  scraped_at: string;
  source: string;
  is_reliable: boolean;
}

export interface RMSPricingRecommendation {
  id: string;
  tenant_id: string;
  date: string;
  room_type_id: string | null;
  rate_plan_id: string | null;
  current_price: number;
  recommended_price: number;
  delta_amount: number;
  delta_percent: number;
  confidence_score: number;
  status: 'pending' | 'applied' | 'rejected' | 'expired';
  triggered_rules: string[] | null;
  warnings: string[] | null;
  opportunities: string[] | null;
  applied_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface RMSPricingFactor {
  id: string;
  recommendation_id: string;
  factor_id: string;
  factor_name: string;
  weight: number;
  value: number;
  impact: number;
  confidence: number;
  explanation: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS — ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère tous les événements pour une période
 */
export function useRMSEvents(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['rms-events', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('rms_events')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: true });

      if (startDate && endDate) {
        query = query
          .gte('end_date', startDate)
          .lte('start_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RMSEvent[];
    },
    enabled: true,
  });
}

/**
 * Récupère les événements actifs pour une date précise
 */
export function useRMSEventsForDate(date: string) {
  return useQuery({
    queryKey: ['rms-events-date', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rms_events')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', date)
        .gte('end_date', date)
        .order('impact_score', { ascending: false });

      if (error) throw error;
      return data as RMSEvent[];
    },
  });
}

/**
 * Calcule le score d'impact pour une date via function Postgres
 */
export function useRMSEventImpactScore(date: string, city: string = 'Paris') {
  return useQuery({
    queryKey: ['rms-event-impact', date, city],
    queryFn: async () => {
      const sessionResult = await supabase.auth.getSession();
      const tenantId = sessionResult.data.session?.user.user_metadata?.tenant_id ?? '';
      const { data, error } = await supabase.rpc('rms_get_event_impact_score', {
        p_tenant_id: tenantId,
        p_date: date,
        p_city: city,
      });

      if (error) throw error;
      return data as number;
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS — COMPSET
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère les concurrents du compset primaire
 */
export function useRMSCompetitors(primaryOnly: boolean = true) {
  return useQuery({
    queryKey: ['rms-competitors', primaryOnly],
    queryFn: async () => {
      let query = supabase
        .from('rms_competitors')
        .select('*')
        .eq('is_active', true)
        .order('quality_score', { ascending: false });

      if (primaryOnly) {
        query = query.eq('is_primary_compset', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RMSCompetitor[];
    },
  });
}

/**
 * Récupère les prix d'un concurrent sur une période
 */
export function useRMSCompetitorPricing(
  competitorId: string,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ['rms-competitor-pricing', competitorId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rms_competitor_pricing')
        .select('*')
        .eq('competitor_id', competitorId)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('is_reliable', true)
        .order('date', { ascending: true });

      if (error) throw error;
      return data as RMSCompetitorPricing[];
    },
  });
}

/**
 * Statistiques compset pour une date via function Postgres
 */
export function useRMSCompsetStats(date: string) {
  return useQuery({
    queryKey: ['rms-compset-stats', date],
    queryFn: async () => {
      const sessionResult = await supabase.auth.getSession();
      const tenantId = sessionResult.data.session?.user.user_metadata?.tenant_id ?? '';
      const { data, error } = await supabase.rpc('rms_get_compset_stats', {
        p_tenant_id: tenantId,
        p_date: date,
      });

      if (error) throw error;
      return data as {
        avg_price: number;
        median_price: number;
        min_price: number;
        max_price: number;
        competitor_count: number;
        sold_out_count: number;
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS — RECOMMANDATIONS PRICING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère les recommandations pricing pour une période
 */
export function useRMSPricingRecommendations(
  startDate: string,
  endDate: string,
  status?: 'pending' | 'applied' | 'rejected' | 'expired'
) {
  return useQuery({
    queryKey: ['rms-pricing-reco', startDate, endDate, status],
    queryFn: async () => {
      let query = supabase
        .from('rms_pricing_recommendations')
        .select('*, rms_pricing_factors(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (RMSPricingRecommendation & { rms_pricing_factors: RMSPricingFactor[] })[];
    },
  });
}

/**
 * Crée une nouvelle recommandation pricing
 */
export function useCreatePricingRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recommendation: Omit<RMSPricingRecommendation, 'id' | 'created_at' | 'expires_at'>) => {
      const { data, error } = await supabase
        .from('rms_pricing_recommendations')
        .insert(recommendation)
        .select()
        .single();

      if (error) throw error;
      return data as RMSPricingRecommendation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rms-pricing-reco'] });
    },
  });
}

/**
 * Applique une recommandation pricing
 */
export function useApplyPricingRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { data, error } = await supabase
        .from('rms_pricing_recommendations')
        .update({
          status: 'applied',
          applied_at: new Date().toISOString(),
          applied_by: userId,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RMSPricingRecommendation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rms-pricing-reco'] });
    },
  });
}

/**
 * Rejette une recommandation pricing
 */
export function useRejectPricingRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase
        .from('rms_pricing_recommendations')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RMSPricingRecommendation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rms-pricing-reco'] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS — HISTORIQUE APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère l'historique des applications pricing
 */
export function useRMSPricingApplications(limit: number = 50) {
  return useQuery({
    queryKey: ['rms-pricing-apps', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rms_pricing_applications')
        .select('*, rms_pricing_recommendations(*)')
        .order('applied_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}
