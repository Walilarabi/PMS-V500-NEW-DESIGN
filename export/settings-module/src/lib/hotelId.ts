/**
 * FLOWTYM — Résolution mémoïsée du hotel_id actif.
 *
 * `get_user_hotel_id()` (RPC) était appelé à CHAQUE écriture (prix, mapping,
 * partenaire…), ajoutant un aller-retour réseau avant la requête utile.
 * Le hotel actif ne change pas en cours de session (sauf switch explicite),
 * donc on le mémoïse. `clearHotelIdCache()` est appelé au switch d'hôtel et
 * au logout (AuthContext) pour rester correct.
 */
import { supabase } from './supabase';

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;

export async function resolveHotelId(): Promise<string | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_user_hotel_id');
      cached = error || !data ? null : String(data);
      return cached;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function clearHotelIdCache(): void {
  cached = null;
  inflight = null;
}
