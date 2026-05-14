/**
 * FLOWTYM — SAS domain hooks (TanStack Query).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/domains/auth/AuthContext';
import * as repo from './repository';
import type { CreateIncomingReservationInput, CreateDisputeInput, DisputeStatus } from './schemas';

const NAV_KEY      = ['sas', 'nav'] as const;
const PARTNER_KEY  = ['sas', 'partners'] as const;
const INCOMING_KEY = ['sas', 'incoming'] as const;
const VALID_KEY    = ['sas', 'validations'] as const;
const QUAR_KEY     = ['sas', 'quarantine'] as const;
const DISPUTE_KEY  = ['sas', 'disputes'] as const;
const STATS_KEY    = ['sas', 'stats'] as const;

// ─── Nav Badges ───────────────────────────────────────────────────────────────

export function useSasNavBadges() {
  const { status } = useAuth();
  return useQuery({
    queryKey: NAV_KEY,
    queryFn: () => repo.getSasNavBadges(),
    enabled: status === 'authenticated',
    staleTime: 15_000,
    refetchInterval: 30_000, // Live refresh pour la bulle
  });
}

// ─── Partners ─────────────────────────────────────────────────────────────────

export function useSasPartners() {
  const { status } = useAuth();
  return useQuery({
    queryKey: PARTNER_KEY,
    queryFn: () => repo.listPartners(),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

export function useSasCommissions(partnerId: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...PARTNER_KEY, 'commissions', partnerId],
    queryFn: () => repo.listCommissions(partnerId!),
    enabled: status === 'authenticated' && !!partnerId,
    staleTime: 30_000,
  });
}

export function useSasScoringRules(partnerId?: string) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...PARTNER_KEY, 'scoring', partnerId],
    queryFn: () => repo.listScoringRules(partnerId),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

// ─── Incoming Reservations ────────────────────────────────────────────────────

export function useSasIncoming(params: { status?: string; partnerId?: string; limit?: number } = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...INCOMING_KEY, 'list', params],
    queryFn: () => repo.listIncoming(params),
    enabled: status === 'authenticated',
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useSasIncomingItem(id: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...INCOMING_KEY, 'one', id],
    queryFn: () => repo.getIncoming(id!),
    enabled: status === 'authenticated' && !!id,
    staleTime: 10_000,
  });
}

export function useCreateIncoming() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: CreateIncomingReservationInput) =>
      repo.createIncoming(session?.tenantId ?? '', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: INCOMING_KEY });
      void qc.invalidateQueries({ queryKey: NAV_KEY });
    },
  });
}

export function useUpdateIncomingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, status, score, reservationId,
    }: { id: string; status: string; score?: number; reservationId?: string }) =>
      repo.updateIncomingStatus(id, status, score, reservationId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: INCOMING_KEY });
      void qc.invalidateQueries({ queryKey: NAV_KEY });
      void qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

// ─── Validations ─────────────────────────────────────────────────────────────

export function useSasValidations(params: { decision?: string; partnerId?: string } = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...VALID_KEY, 'list', params],
    queryFn: () => repo.listValidations(params),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

// ─── Quarantine ───────────────────────────────────────────────────────────────

export function useSasQuarantine(params: { status?: string } = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...QUAR_KEY, 'list', params],
    queryFn: () => repo.listQuarantine(params),
    enabled: status === 'authenticated',
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useReleaseQuarantine() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      repo.releaseQuarantine(id, session?.userId ?? '', note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUAR_KEY });
      void qc.invalidateQueries({ queryKey: INCOMING_KEY });
      void qc.invalidateQueries({ queryKey: NAV_KEY });
    },
  });
}

// ─── ODMS Disputes ────────────────────────────────────────────────────────────

export function useSasDisputes(params: { status?: string; partnerId?: string } = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...DISPUTE_KEY, 'list', params],
    queryFn: () => repo.listDisputes(params),
    enabled: status === 'authenticated',
    staleTime: 20_000,
  });
}

export function useSasDispute(id: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...DISPUTE_KEY, 'one', id],
    queryFn: () => repo.getDispute(id!),
    enabled: status === 'authenticated' && !!id,
    staleTime: 10_000,
  });
}

export function useSasDisputeMessages(disputeId: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...DISPUTE_KEY, 'messages', disputeId],
    queryFn: () => repo.listDisputeMessages(disputeId!),
    enabled: status === 'authenticated' && !!disputeId,
    staleTime: 10_000,
  });
}

export function useSasDisputeHistory(disputeId: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...DISPUTE_KEY, 'history', disputeId],
    queryFn: () => repo.listDisputeStatusHistory(disputeId!),
    enabled: status === 'authenticated' && !!disputeId,
    staleTime: 10_000,
  });
}

export function useCreateDispute() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateDisputeInput) => {
      // tenantId peut être null si le user n'est pas provisionné dans public.users
      // On passe '' et le repository le résoudra via get_user_hotel_id()
      return repo.createDispute(session?.tenantId ?? '', input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DISPUTE_KEY });
      void qc.invalidateQueries({ queryKey: STATS_KEY });
    },
    onError: (err) => {
      console.error('[useCreateDispute] error:', err);
    },
  });
}

export function useUpdateDisputeStatus() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({
      id, newStatus, reason,
    }: { id: string; newStatus: DisputeStatus; reason?: string }) =>
      repo.updateDisputeStatus(
        session?.tenantId ?? '',
        id,
        newStatus,
        reason,
        session?.userId,
      ),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: [...DISPUTE_KEY, 'one', vars.id] });
      void qc.invalidateQueries({ queryKey: [...DISPUTE_KEY, 'history', vars.id] });
      void qc.invalidateQueries({ queryKey: DISPUTE_KEY });
    },
  });
}

export function useAddDisputeMessage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({
      disputeId, direction, content,
    }: { disputeId: string; direction: 'OUTBOUND' | 'INBOUND' | 'INTERNAL'; content: string }) =>
      repo.addDisputeMessage(
        session?.tenantId ?? '',
        disputeId,
        direction,
        content,
        session?.userId,
      ),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: [...DISPUTE_KEY, 'messages', vars.disputeId] });
    },
  });
}

// ─── Partner Reliability ──────────────────────────────────────────────────────

export function useSasReliability() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['sas', 'reliability'],
    queryFn: () => repo.listReliability(),
    enabled: status === 'authenticated',
    staleTime: 300_000, // 5 min — rolling 30j
  });
}

// ─── Global SAS Stats ─────────────────────────────────────────────────────────

export function useSasStats() {
  const { status } = useAuth();
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: () => repo.getSasStats(),
    enabled: status === 'authenticated',
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
