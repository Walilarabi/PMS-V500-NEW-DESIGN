/**
 * FLOWTYM — Hooks React Query du Journal Unifié (L3).
 *
 * Chargement À LA DEMANDE (la requête n'est activée que lorsqu'un scope valide
 * est fourni et que le conteneur est ouvert), cache par client/réservation,
 * invalidation après ajout de note.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCommunicationTimeline,
  addInternalNote,
  type TimelineScope,
} from './timeline.service';

export function communicationTimelineKey(scope: TimelineScope) {
  return ['comm-timeline', scope.guestId ?? null, scope.reservationId ?? null] as const;
}

export function useCommunicationTimeline(
  scope: TimelineScope,
  opts: { enabled?: boolean; limit?: number } = {},
) {
  const hasScope = Boolean(scope.guestId || scope.reservationId);
  return useQuery({
    queryKey: communicationTimelineKey(scope),
    queryFn: () => fetchCommunicationTimeline({ ...scope, limit: opts.limit ?? 50 }),
    enabled: (opts.enabled ?? true) && hasScope,
    staleTime: 30_000,
  });
}

export function useAddInternalNote(scope: TimelineScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addInternalNote({ ...scope, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: communicationTimelineKey(scope) }),
  });
}
