import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { listGuests, findOrCreateGuest, type ListGuestsParams } from './repository';
import { getGuestProfile360 } from '@/src/services/crm/crm.service';
import type { GuestRowDto } from './schemas';

export function useGuests(params: ListGuestsParams = {}) {
  return useQuery({
    queryKey: ['guests', params],
    queryFn: () => listGuests(params),
  });
}

export interface CreateGuestInput {
  fullName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  segment?: string;
}

export function useCreateGuest() {
  const qc = useQueryClient();
  const { session } = useAuth();

  return useMutation<GuestRowDto, Error, CreateGuestInput>({
    mutationFn: async (input) => {
      let hotelId = session?.tenantId ?? '';
      if (!hotelId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: prof } = await supabase
            .from('users').select('hotel_id').eq('auth_id', user.id).maybeSingle();
          hotelId = (prof as any)?.hotel_id ?? '';
        }
      }
      if (!hotelId) {
        const { data: h } = await supabase.from('hotels').select('id').limit(1).maybeSingle();
        hotelId = (h as any)?.id ?? '';
      }
      if (!hotelId) throw new Error('Hôtel introuvable — reconnectez-vous.');

      return findOrCreateGuest({
        hotelId,
        fullName:    input.fullName,
        email:       input.email    ?? null,
        phone:       input.phone    ?? null,
        nationality: input.nationality ?? null,
        segment:     input.segment  ?? null,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['guests'] });
    },
  });
}

export function useGuestProfile360(guestId: string | null) {
  return useQuery({
    queryKey: ['guest-profile-360', guestId],
    queryFn: () => getGuestProfile360(guestId as string),
    enabled: !!guestId,
    staleTime: 30_000,
  });
}
