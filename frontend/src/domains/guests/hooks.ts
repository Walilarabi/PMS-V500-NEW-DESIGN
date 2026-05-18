import { useQuery } from '@tanstack/react-query';
import { listGuests, type ListGuestsParams } from './repository';

export function useGuests(params: ListGuestsParams = {}) {
  return useQuery({
    queryKey: ['guests', params],
    queryFn: () => listGuests(params),
  });
}
