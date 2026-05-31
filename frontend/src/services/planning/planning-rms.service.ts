/**
 * FLOWTYM — Application d'une recommandation RMS au calendrier tarifaire.
 *
 * « Appliquer » écrit RÉELLEMENT le prix recommandé dans `rate_prices`
 * (pas seulement un changement de statut). Chaîne :
 *   recommandation.room_type_id → room_types.room_type_code
 *   → ligne rate_prices (hotel, code, plan, stay_date) → updatePrice (verrou
 *   optimiste via version).
 *
 * Si aucune ligne tarifaire ne correspond, on lève une erreur explicite :
 * jamais de succès simulé.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { updatePrice } from '@/src/domains/rms/repository';

export interface ApplicableRecommendation {
  room_type_id: string | null;
  rate_plan_id: string | null;
  date: string;
  recommended_price: number;
}

/**
 * Applique le prix recommandé dans rate_prices.
 * @throws si la recommandation est incomplète ou si aucune ligne tarifaire
 *         correspondante n'existe.
 */
export async function applyRecommendationToRatePrices(
  rec: ApplicableRecommendation,
  hotelId: string,
): Promise<void> {
  if (!rec.room_type_id || !rec.rate_plan_id) {
    throw new Error('Recommandation incomplète : type de chambre ou plan tarifaire manquant.');
  }

  // 1. room_type_id → room_type_code
  const { data: rt, error: rtErr } = await supabase
    .from('room_types')
    .select('room_type_code')
    .eq('id', rec.room_type_id)
    .maybeSingle();
  if (rtErr) throw mapSupabaseError(rtErr);
  const code = (rt as { room_type_code: string } | null)?.room_type_code;
  if (!code) throw new Error('Type de chambre introuvable pour cette recommandation.');

  // 2. Ligne rate_prices ciblée (hotel + code + plan + date)
  const { data: rp, error: rpErr } = await supabase
    .from('rate_prices')
    .select('id, version')
    .eq('hotel_id', hotelId)
    .eq('room_type_code', code)
    .eq('plan_id', rec.rate_plan_id)
    .eq('stay_date', rec.date)
    .maybeSingle();
  if (rpErr) throw mapSupabaseError(rpErr);
  const row = rp as { id: string; version: number } | null;
  if (!row) {
    throw new Error('Aucune ligne tarifaire correspondante — impossible d\'appliquer le prix recommandé.');
  }

  // 3. Écriture réelle du prix (verrou optimiste)
  await updatePrice({
    id: row.id,
    hotelId,
    price: rec.recommended_price,
    version: row.version,
    source: 'rms',
  });
}
