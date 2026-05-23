/**
 * FLOWTYM RMS — Decisions Service
 *
 * Service d'écriture/lecture de l'historique horodaté des décisions yield manager.
 * La table `rms_decisions` est immutable (append-only) côté DB.
 *
 * Multi-tenant : hotel_id résolu via RPC get_user_hotel_id.
 * Auth user : récupéré via supabase.auth.getUser().
 */

import { supabase } from '../lib/supabase';
import { emitRmsEvent } from '../lib/rms/eventBus';

export type DecisionAction = 'accepted' | 'rejected' | 'maintained';

export interface RmsDecisionInput {
  stayDate: string;                  // YYYY-MM-DD
  roomTypeCode?: string | null;
  action: DecisionAction;
  currentPrice: number;
  suggestedPrice: number;
  finalPrice: number;
  strategy: string;
  recommendation: string;
  confidenceScore?: number | null;
  marketPressurePercent?: number | null;
  occupancyRate?: number | null;
  medianPrice?: number | null;
}

export interface RmsDecisionRecord {
  id: string;
  hotel_id: string;
  stay_date: string;
  room_type_code: string | null;
  action: DecisionAction;
  current_price: number;
  suggested_price: number;
  final_price: number;
  strategy: string;
  recommendation: string;
  confidence_score: number | null;
  market_pressure_percent: number | null;
  occupancy_rate: number | null;
  median_price: number | null;
  created_at: string;
  created_by: string | null;
  // Joins (optionnels via select)
  user_email?: string | null;
}

async function resolveHotelAndUser(): Promise<{ hotelId: string | null; userId: string | null }> {
  let hotelId: string | null = null;
  let userId: string | null = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)('get_user_hotel_id');
    if (data) hotelId = String(data);
  } catch {/* ignore */}

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) userId = userData.user.id;
  } catch {/* ignore */}

  return { hotelId, userId };
}

/**
 * Enregistre une décision RMS dans l'historique.
 * En cas d'échec (pas d'auth, pas de hotel_id), on log un warning mais on
 * ne lance pas d'exception : la décision UI doit rester fluide.
 */
export async function recordRmsDecision(input: RmsDecisionInput): Promise<boolean> {
  const { hotelId, userId } = await resolveHotelAndUser();
  if (!hotelId) {
    console.warn('[rms-decisions] No hotel_id resolved — décision non persistée');
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('rms_decisions')
      .insert({
        hotel_id: hotelId,
        stay_date: input.stayDate,
        room_type_code: input.roomTypeCode ?? null,
        action: input.action,
        current_price: input.currentPrice,
        suggested_price: input.suggestedPrice,
        final_price: input.finalPrice,
        strategy: input.strategy,
        recommendation: input.recommendation,
        confidence_score: input.confidenceScore ?? null,
        market_pressure_percent: input.marketPressurePercent ?? null,
        occupancy_rate: input.occupancyRate ?? null,
        median_price: input.medianPrice ?? null,
        created_by: userId,
      });

    if (error) {
      console.warn('[rms-decisions] Insert failed:', error.message);
      return false;
    }

    // Notifie le module Revenue d'une nouvelle décision (DecisionHistoryPage,
    // KPI agrégés, etc.). L'ID DB n'est pas retourné par l'insert sans
    // .select(), on émet donc un identifiant de remplacement déterministe.
    const delta = input.finalPrice - input.currentPrice;
    if (input.action === 'accepted' || input.action === 'maintained') {
      emitRmsEvent('rms-decision:accepted', {
        decisionId: `${input.stayDate}-${input.roomTypeCode ?? 'all'}-${Date.now()}`,
        date: input.stayDate,
        delta,
      });
    } else {
      emitRmsEvent('rms-decision:rejected', {
        decisionId: `${input.stayDate}-${input.roomTypeCode ?? 'all'}-${Date.now()}`,
      });
    }
    return true;
  } catch (err) {
    console.warn('[rms-decisions] Insert exception:', err);
    return false;
  }
}

/**
 * Récupère l'historique des décisions pour l'hôtel courant.
 * Paramètres optionnels : range de dates (stay_date), limit, ordre.
 */
export async function fetchRmsDecisions(opts: {
  stayDateFrom?: string;
  stayDateTo?: string;
  limit?: number;
} = {}): Promise<RmsDecisionRecord[]> {
  const { hotelId } = await resolveHotelAndUser();
  if (!hotelId) return [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from('rms_decisions')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 200);

    if (opts.stayDateFrom) q = q.gte('stay_date', opts.stayDateFrom);
    if (opts.stayDateTo) q = q.lte('stay_date', opts.stayDateTo);

    const { data, error } = await q;
    if (error) {
      console.warn('[rms-decisions] Fetch failed:', error.message);
      return [];
    }
    return (data ?? []) as RmsDecisionRecord[];
  } catch (err) {
    console.warn('[rms-decisions] Fetch exception:', err);
    return [];
  }
}
