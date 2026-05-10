/**
 * FLOWTYM — ODMS TanStack Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/src/domains/auth/AuthContext';
import {
  changeDisputeStatus,
  createDispute,
  getDispute,
  listDisputes,
  listDisputeMessages,
  listDisputeStatusHistory,
  loadReliability,
} from './repository';
import {
  listReminders,
  listRemindersByDispute,
  markReminderSent,
  skipReminder,
  type ReminderRow,
} from './reminders';
import type { CreateDisputeInput, DisputeRow, DisputeStatus, DraftEmail, ReliabilityRow } from './types';

const ODMS_KEY = ['odms'] as const;

export function usePartnerReliability() {
  const { status } = useAuth();
  return useQuery<ReliabilityRow[]>({
    queryKey: [...ODMS_KEY, 'reliability'],
    queryFn: loadReliability,
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });
}

export function useDisputes(limit = 100) {
  const { status } = useAuth();
  return useQuery<DisputeRow[]>({
    queryKey: [...ODMS_KEY, 'list', limit],
    queryFn: () => listDisputes(limit),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useDisputeDetail(id: string | null) {
  return useQuery<DisputeRow | null>({
    queryKey: [...ODMS_KEY, 'detail', id],
    queryFn: () => getDispute(id as string),
    enabled: !!id,
  });
}

export function useDisputeTimeline(id: string | null) {
  return useQuery<{ messages: unknown[]; history: unknown[] }>({
    queryKey: [...ODMS_KEY, 'timeline', id],
    queryFn: async () => {
      const [messages, history] = await Promise.all([
        listDisputeMessages(id as string),
        listDisputeStatusHistory(id as string),
      ]);
      return { messages, history };
    },
    enabled: !!id,
  });
}

export function useCreateDispute() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<DisputeRow, Error, CreateDisputeInput>({
    mutationFn: async (input) => {
      if (!session?.tenantId) throw new Error('Hôtel actif inconnu');
      return createDispute(session.tenantId, session.userId ?? null, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ODMS_KEY });
    },
  });
}

export function useChangeDisputeStatus() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<
    DisputeRow,
    Error,
    { disputeId: string; from: DisputeStatus; to: DisputeStatus; reason: string; email?: DraftEmail | null }
  >({
    mutationFn: async ({ disputeId, from, to, reason, email }) => {
      if (!session?.tenantId) throw new Error('Hôtel actif inconnu');
      return changeDisputeStatus(disputeId, session.tenantId, from, to, reason, session.userId ?? null, email ?? null);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ODMS_KEY });
    },
  });
}

/* -------------------- Reminders ---------------------------------- */

export function useReminders() {
  const { status } = useAuth();
  return useQuery<ReminderRow[]>({
    queryKey: [...ODMS_KEY, 'reminders'],
    queryFn: listReminders,
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useRemindersByDispute(disputeId: string | null) {
  return useQuery<ReminderRow[]>({
    queryKey: [...ODMS_KEY, 'reminders', disputeId],
    queryFn: () => listRemindersByDispute(disputeId as string),
    enabled: !!disputeId,
  });
}

export function useMarkReminderSent() {
  const qc = useQueryClient();
  return useMutation<ReminderRow, Error, string>({
    mutationFn: (id) => markReminderSent(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ODMS_KEY }),
  });
}

export function useSkipReminder() {
  const qc = useQueryClient();
  return useMutation<ReminderRow, Error, string>({
    mutationFn: (id) => skipReminder(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ODMS_KEY }),
  });
}
