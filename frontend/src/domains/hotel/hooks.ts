/**
 * FLOWTYM — Hotel/rooms hooks (active hotel info).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

export function useUpdateHotel() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<HotelRow>) => {
      if (!session?.tenantId) throw new Error('No active hotel');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('hotels').update(patch).eq('id', session.tenantId);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-hotel'] });
    },
  });
}

export function useRooms() {
  const { status } = useAuth();
  return useQuery<RoomRow[]>({
    queryKey: ['rooms'],
    enabled: status === 'authenticated',
    staleTime: 30_000,
    retry: 1,
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

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RoomRow> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('rooms').update(patch).eq('id', id);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (room: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('rooms').insert(room);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('rooms').delete().eq('id', id);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}
