/**
 * FLOWTYM — Plans tarifaires filtrés par partenaire.
 *
 * Logique :
 *   - partnerId = null / 'direct'  → tous les plans actifs (réservation directe)
 *   - partnerId = UUID réel        → plans liés via rate_plan_partner_mappings
 *
 * Source unique : Supabase. Aucune constante locale (ENHANCED_RATE_PLANS, etc.).
 * Les plans retournés contiennent les métadonnées nécessaires au tooltip
 * (pension_type, cancellation_type, min_stay, max_stay, meal_plan).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';

export interface RatePlanOption {
  id: string;
  plan_code: string;
  plan_name: string;
  pension_type: string | null;
  channel_type: string | null;
  calc_mode: string | null;
  cancellation_type: string | null;
  cancellation_policy: string | null;
  meal_plan: string | null;
  min_stay: number | null;
  max_stay: number | null;
  partner_rate_code: string | null;
}

const PLAN_COLUMNS = 'id, plan_code, plan_name, pension_type, channel_type, calc_mode, cancellation_type, cancellation_policy, meal_plan, min_stay, max_stay';

export function useRatePlansForPartner(partnerId: string | null) {
  const { status } = useAuth();

  return useQuery<RatePlanOption[]>({
    queryKey: ['rate-plans-for-partner', partnerId ?? 'direct'],
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // ── Réservation directe : tous les plans actifs ──────────────────────
      if (!partnerId || partnerId === 'direct') {
        const { data, error } = await supabase
          .from('rate_plans')
          .select(PLAN_COLUMNS)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('plan_name', { ascending: true });
        if (error) throw error;
        return ((data ?? []) as Omit<RatePlanOption, 'partner_rate_code'>[]).map(
          (p) => ({ ...p, partner_rate_code: null }),
        );
      }

      // ── Partenaire OTA : plans liés via rate_plan_partner_mappings ────────
      const { data, error } = await supabase
        .from('rate_plan_partner_mappings')
        .select(`partner_rate_code, rate_plans!rate_plan_id(${PLAN_COLUMNS})`)
        .eq('partner_id', partnerId)
        .eq('is_active', true);

      if (error) throw error;

      return ((data ?? []) as Array<{
        partner_rate_code: string | null;
        rate_plans: Omit<RatePlanOption, 'partner_rate_code'> | null;
      }>)
        .filter((row) => row.rate_plans !== null)
        .map((row) => ({
          ...(row.rate_plans as Omit<RatePlanOption, 'partner_rate_code'>),
          partner_rate_code: row.partner_rate_code,
        }));
    },
  });
}
