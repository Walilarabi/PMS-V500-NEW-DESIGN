/**
 * FLOWTYM — Hooks React Query du Journal Unifié (L3).
 *
 * Chargement À LA DEMANDE (la requête n'est activée que lorsqu'un scope valide
 * est fourni et que le conteneur est ouvert), cache par client/réservation,
 * invalidation après ajout de note.
 */
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  fetchCommunicationTimeline,
  fetchTimeline360,
  addInternalNote,
  type TimelineScope,
  type Timeline360Filters,
  type TimelineEntry,
} from './timeline.service';
import { uploadAttachment, type UploadAttachmentParams } from './attachments.service';

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communicationTimelineKey(scope) });
      qc.invalidateQueries({ queryKey: timeline360Key(scope) });
    },
  });
}

// ─── Journal 360° (v2) — pagination infinie + filtres ─────────────────────────

const PAGE_SIZE = 40;

export function timeline360Key(scope: TimelineScope, filters?: Timeline360Filters) {
  return ['timeline360', scope.guestId ?? null, scope.reservationId ?? null, filters ?? null] as const;
}

export function useTimeline360(
  scope: TimelineScope,
  filters: Timeline360Filters = {},
  opts: { enabled?: boolean } = {},
) {
  const hasScope = Boolean(scope.guestId || scope.reservationId);
  return useInfiniteQuery({
    queryKey: timeline360Key(scope, filters),
    queryFn: ({ pageParam }) =>
      fetchTimeline360({ ...scope, ...filters, before: pageParam as string | null, limit: PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: TimelineEntry[]) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1].occurred_at : undefined,
    enabled: (opts.enabled ?? true) && hasScope,
    staleTime: 30_000,
  });
}

export function useUploadAttachment(scope: TimelineScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<UploadAttachmentParams, 'guestId' | 'reservationId'>) =>
      uploadAttachment({ ...p, guestId: scope.guestId ?? null, reservationId: scope.reservationId ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timeline360Key(scope) });
      qc.invalidateQueries({ queryKey: communicationTimelineKey(scope) });
    },
  });
}
