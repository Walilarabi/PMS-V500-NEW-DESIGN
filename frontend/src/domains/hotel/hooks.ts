/**
 * FLOWTYM — Hotel/rooms hooks (active hotel info).
 */
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import type { HotelRow, RoomRow } from '@/src/lib/supabase.types';

import { useAuth } from '@/src/domains/auth/AuthContext';

export function useActiveHotel() {
  const { status, session } = useAuth();
  return useQuery<HotelRow | null>({
    queryKey: ['active-hotel', session?.tenantId],
    enabled: status === 'authenticated' && !!session?.tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', session!.tenantId!)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      return data;
    },
  });
}

export function useRooms() {
  const { status } = useAuth();
  return useQuery<RoomRow[]>({
    queryKey: ['rooms'],
    enabled: status === 'authenticated',
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('number', { ascending: true });
      if (error) throw mapSupabaseError(error);
      return data ?? [];
    },
  });
}
