/**
 * FLOWTYM — Partenaires de distribution (table distribution_partners).
 *
 * Source unique : Supabase. Aucune donnée statique / constante locale.
 * Résultats triés par nom. Stale : 5 min (données stables, pas temps-réel).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';

export interface DistributionPartner {
  id: string;
  name: string;
  external_id: string | null;
  is_active: boolean;
}

export function useDistributionPartners() {
  const { status } = useAuth();
  return useQuery<DistributionPartner[]>({
    queryKey: ['distribution-partners'],
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_partners')
        .select('id, name, external_id, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DistributionPartner[];
    },
  });
}
