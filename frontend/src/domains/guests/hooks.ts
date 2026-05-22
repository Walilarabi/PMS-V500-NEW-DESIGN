import { useQuery } from '@tanstack/react-query';
import { listGuests, type ListGuestsParams } from './repository';
import { getGuestProfile360 } from '@/src/services/crm/crm.service';

export function useGuests(params: ListGuestsParams = {}) {
  return useQuery({
    queryKey: ['guests', params],
    queryFn: () => listGuests(params),
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
