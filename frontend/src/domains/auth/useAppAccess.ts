/**
 * FLOWTYM — Accès applicatif par hôtel actif (enforcement réel côté client).
 *
 * Source de vérité : public.user_app_access (RLS self-select → l'utilisateur ne
 * lit QUE ses propres lignes). On vérifie ici si l'application PMS est autorisée
 * pour l'hôtel actif de la session.
 *
 * Règle (fail-open, anti-lock-out) :
 *  - pas d'hôtel actif → on autorise (la garde hôtel/RLS s'applique ailleurs) ;
 *  - aucune ligne user_app_access pour cet hôtel → legacy/non configuré → autorisé ;
 *  - au moins une ligne configurée → l'accès PMS est requis explicitement.
 *
 * Les écritures de cette table sont réservées au super_admin plateforme
 * (RLS is_platform_admin + RPC admin_set_app_access). Le contrôle reste donc réel
 * côté serveur : un utilisateur ne peut pas s'auto-octroyer un accès.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from './AuthContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ActiveHotelAppsState {
  /** Vrai tant que la requête est en vol (sur un hôtel actif). */
  isLoading: boolean;
  /** Les app_id auxquels l'utilisateur a accès pour l'hôtel actif. */
  appIds: string[];
  /** Vrai si au moins une application est explicitement configurée pour cet hôtel. */
  configured: boolean;
  /** Vrai si l'application PMS est autorisée (ou non configurée → fail-open). */
  hasPms: boolean;
}

/**
 * Décision pure d'autorisation PMS (testable, sans React/Supabase).
 * Règle fail-open anti-lock-out :
 *  - pas d'hôtel actif, erreur réseau, app PMS inconnue, ou aucune ligne
 *    configurée → autorisé ;
 *  - sinon l'app PMS doit figurer explicitement dans les accès de l'hôtel.
 */
export function resolveHasPms(params: {
  tenantId: string | null;
  appIds: string[];
  pmsId: string | null;
  isError?: boolean;
}): boolean {
  const { tenantId, appIds, pmsId, isError = false } = params;
  if (!tenantId || isError || !pmsId) return true;
  if (appIds.length === 0) return true; // non configuré → legacy → autorisé
  return appIds.includes(pmsId);
}

export function useActiveHotelApps(): ActiveHotelAppsState {
  const { session } = useAuth();
  const tenantId = session?.tenantId ?? null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['active-hotel-apps', tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const [{ data: rows, error: e1 }, { data: pmsApp, error: e2 }] = await Promise.all([
        db.from('user_app_access').select('app_id').eq('hotel_id', tenantId),
        db.from('platform_apps').select('id').eq('code', 'PMS').maybeSingle(),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const appIds: string[] = (rows ?? []).map((r: { app_id: string }) => r.app_id);
      return { appIds, pmsId: (pmsApp as { id: string } | null)?.id ?? null };
    },
  });

  const appIds = data?.appIds ?? [];
  const pmsId = data?.pmsId ?? null;
  const configured = appIds.length > 0;

  return {
    isLoading: !!tenantId && isLoading,
    appIds,
    configured,
    hasPms: resolveHasPms({ tenantId, appIds, pmsId, isError }),
  };
}
