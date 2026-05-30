/**
 * FLOWTYM — Recommandations RMS pour le planning.
 *
 * Lit les recommandations `pending` sur la plage affichée, et expose deux
 * actions réelles (jamais de bouton mort) :
 *   - apply  : écrit le prix dans rate_prices PUIS marque la reco « applied ».
 *   - reject : marque « rejected » avec motif.
 *
 * Toutes les écritures sont scopées par RLS. Aucune donnée fictive.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { applyRecommendationToRatePrices } from '@/src/services/planning/planning-rms.service';
import { toIsoDate } from '@/src/services/planning/planning-kpi.service';

export interface RmsRecommendation {
  id: string;
  date: string;
  room_type_id: string | null;
  rate_plan_id: string | null;
  current_price: number | null;
  recommended_price: number;
  delta_amount: number | null;
  delta_percent: number | null;
  confidence_score: number | null;
  status: string;
  triggered_rules: string[] | null;
  warnings: string[] | null;
}

const RECO_KEY = ['planning', 'rms-reco'] as const;

export function useRmsRecommendations(startDate: Date | string, rangeDays: number) {
  const { status, session } = useAuth();
  const qc = useQueryClient();
  const hotelId = session?.tenantId ?? null;
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const start = toIsoDate(startDate);
  const endDt = new Date(`${start}T00:00:00`);
  endDt.setDate(endDt.getDate() + Math.max(1, rangeDays) - 1);
  const end = toIsoDate(endDt);

  const query = useQuery<RmsRecommendation[]>({
    queryKey: [...RECO_KEY, start, end],
    enabled: status === 'authenticated',
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rms_pricing_recommendations')
        .select('id, date, room_type_id, rate_plan_id, current_price, recommended_price, delta_amount, delta_percent, confidence_score, status, triggered_rules, warnings')
        .eq('status', 'pending')
        .gte('date', start)
        .lte('date', end)
        .order('confidence_score', { ascending: false, nullsFirst: false });
      if (error) throw mapSupabaseError(error);
      return (data ?? []) as RmsRecommendation[];
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: RECO_KEY });
    void qc.invalidateQueries({ queryKey: ['rms-pricing-reco'] });
  };

  const apply = useMutation<void, Error, RmsRecommendation>({
    mutationFn: async (rec) => {
      if (!hotelId) throw new Error('Hôtel actif inconnu.');
      setPendingActionId(rec.id);
      // 1. Écriture réelle du prix
      await applyRecommendationToRatePrices(rec, hotelId);
      // 2. Marque la recommandation appliquée (audit)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('rms_pricing_recommendations')
        .update({ status: 'applied', applied_at: new Date().toISOString(), applied_by: session?.userId ?? null })
        .eq('id', rec.id);
      if (error) throw mapSupabaseError(error);
    },
    onSettled: () => setPendingActionId(null),
    onSuccess: invalidate,
  });

  const reject = useMutation<void, Error, { id: string; reason: string }>({
    mutationFn: async ({ id, reason }) => {
      setPendingActionId(id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('rms_pricing_recommendations')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', id);
      if (error) throw mapSupabaseError(error);
    },
    onSettled: () => setPendingActionId(null),
    onSuccess: invalidate,
  });

  const grouped = useMemo(() => {
    const recos = query.data ?? [];
    const high = recos.filter((r) => (r.confidence_score ?? 0) >= 80);
    const medium = recos.filter((r) => (r.confidence_score ?? 0) >= 50 && (r.confidence_score ?? 0) < 80);
    const low = recos.filter((r) => (r.confidence_score ?? 0) < 50);
    return { high, medium, low };
  }, [query.data]);

  return {
    recommendations: query.data ?? [],
    grouped,
    count: query.data?.length ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    apply,
    reject,
    pendingActionId,
  };
}
