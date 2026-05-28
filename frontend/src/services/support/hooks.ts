import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTickets,
  createTicket,
  updateTicketStatus,
  saveClaudeResponse,
  type CreateTicketInput,
  type TicketStatus,
  type TicketClassification,
} from './support.service';
import {
  listArticles,
  upsertArticle,
  deleteArticle,
  type UpsertArticleInput,
} from './help.service';

export function useSupportTickets(hotelId: string | null) {
  return useQuery({
    queryKey: ['support-tickets', hotelId],
    queryFn:  () => listTickets(hotelId!),
    enabled:  !!hotelId,
    staleTime: 30_000,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTicket,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['support-tickets', vars.hotel_id] });
    },
  });
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, assignedTo }: { id: string; status: TicketStatus; assignedTo?: string }) =>
      updateTicketStatus(id, status, assignedTo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });
}

export function useSaveClaudeResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response, classification }: {
      id: string;
      response: string;
      classification: TicketClassification;
    }) => saveClaudeResponse(id, response, classification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });
}

// ─── Help articles ──────────────────────────────────────────────────────────

export function useHelpArticles(opts?: { includeUnpublished?: boolean }) {
  return useQuery({
    queryKey: ['help-articles', opts?.includeUnpublished ?? false],
    queryFn:  () => listArticles(opts),
    staleTime: 5 * 60_000,
  });
}

export function useUpsertArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertArticleInput) => upsertArticle(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-articles'] });
    },
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['help-articles'] });
    },
  });
}
