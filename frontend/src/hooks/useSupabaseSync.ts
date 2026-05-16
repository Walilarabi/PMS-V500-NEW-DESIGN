/**
 * FLOWTYM — Hook de synchronisation Supabase → stores locaux
 *
 * Pour faire fonctionner le Planning et la Vue du Jour avec des données
 * Supabase RÉELLES (Folkestone et autres hôtels), sans tout refactoriser,
 * ce hook lit Supabase et injecte les données dans :
 *
 *   - configStore (rooms) : pour que le Planning affiche les vraies chambres
 *   - ReservationContext (réservations) : pour que toutes les vues partagent
 *     les mêmes données
 *
 * Stratégie :
 *   1. Au login (changement de tenantId), vérifier si l'hôtel a des rooms en DB
 *   2. Si oui → MIGRATION : remplace le store local par les vraies données
 *   3. Si non → garde les mocks (cas Mas Provençal demo)
 *
 * Le hook est idempotent : il marque le store comme "synchronisé via Supabase"
 * et ne le re-synchronise qu'à chaque changement d'hôtel.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useConfigStore } from '@/src/store/configStore';
import { useAuth } from '@/src/domains/auth/AuthContext';

// Types intermédiaires pour mapping
interface SupabaseRoom {
  id: string;
  number: string;
  type: string | null;
  category: string | null;
  room_type_code: string | null;
  active: boolean | null;
}

/**
 * Déduit l'étage depuis le numéro de chambre (ex: "201" → "Étage 2").
 * Les hôtels nomment les chambres avec un préfixe d'étage.
 */
function inferFloor(roomNumber: string): string {
  const trimmed = roomNumber.trim();
  if (trimmed.length < 2) return '—';
  const firstChar = trimmed[0];
  const digit = parseInt(firstChar, 10);
  if (Number.isNaN(digit)) return '—';
  if (digit === 0) return 'RDC';
  return `Étage ${digit}`;
}

/**
 * Mappe une room Supabase vers le format attendu par le configStore local.
 */
function mapSupabaseRoomToStore(r: SupabaseRoom): {
  id: string;
  number: string;
  type: string;
  category: string;
  floor: string;
  status: 'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'maintenance';
  price?: number;
} {
  return {
    id: r.id,
    number: r.number,
    type: r.type ?? r.room_type_code ?? 'Standard',
    category: r.category ?? 'Classique',
    floor: inferFloor(r.number),
    status: 'clean',  // par défaut, propre
  };
}

/**
 * Hook principal — à monter au niveau de l'app (App.tsx).
 *
 * Surveille tenantId. Quand il change ET qu'on est authentifié, fetch les
 * rooms depuis Supabase et les injecte dans configStore.
 */
export function useSupabaseSync() {
  const { status, session } = useAuth();
  const updateRooms = useConfigStore((s) => s.updateRooms);
  const tenantId = session?.tenantId ?? null;

  // Garde une trace du dernier tenantId synchronisé pour éviter les re-syncs inutiles
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !tenantId) return;
    if (lastSyncedRef.current === tenantId) return;  // déjà synchronisé

    let cancelled = false;

    async function syncRooms() {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('id,number,type,category,room_type_code,active')
          .eq('hotel_id', tenantId)
          .eq('active', true)
          .order('number', { ascending: true });

        if (cancelled) return;
        if (error) {
          console.warn('[useSupabaseSync] rooms fetch failed:', error.message);
          return;
        }

        const supabaseRooms = (data ?? []) as SupabaseRoom[];
        if (supabaseRooms.length === 0) {
          // Pas de rooms en DB pour cet hôtel — on garde les mocks
          console.info(`[useSupabaseSync] No rooms in DB for hotel ${tenantId}, keeping mocks`);
          lastSyncedRef.current = tenantId;
          return;
        }

        // Mapping et injection dans le store
        const mappedRooms = supabaseRooms.map(mapSupabaseRoomToStore);
        updateRooms(mappedRooms);
        console.info(
          `[useSupabaseSync] Synced ${mappedRooms.length} rooms from Supabase for hotel ${tenantId}`
        );
        lastSyncedRef.current = tenantId;
      } catch (e) {
        console.error('[useSupabaseSync] Unexpected error during sync:', e);
      }
    }

    syncRooms();

    return () => {
      cancelled = true;
    };
  }, [status, tenantId, updateRooms]);
}
