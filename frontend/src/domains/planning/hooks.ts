/**
 * FLOWTYM — Planning domain hooks (TanStack Query).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/src/domains/auth/AuthContext';
import {
  createChannel, deleteChannel, listChannels, updateChannel,
  createEvent, deleteEvent, listEvents, updateEvent,
} from './repository';
import type {
  PlanningChannelInput, PlanningChannelRow,
  PlanningEventInput, PlanningEventRow,
} from './schemas';

const PLANNING_KEY = ['planning'] as const;

/* ------------------------------- Channels ------------------------------- */

export function useChannels() {
  const { status } = useAuth();
  return useQuery<PlanningChannelRow[]>({
    queryKey: [...PLANNING_KEY, 'channels'],
    queryFn: listChannels,
    enabled: status === 'authenticated',
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<PlanningChannelRow, Error, PlanningChannelInput>({
    mutationFn: async (input) => {
      if (!session?.tenantId) throw new Error('Hôtel actif inconnu');
      return createChannel(session.tenantId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...PLANNING_KEY, 'channels'] });
    },
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation<PlanningChannelRow, Error, { id: string; patch: Partial<PlanningChannelInput> }>({
    mutationFn: ({ id, patch }) => updateChannel(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...PLANNING_KEY, 'channels'] });
    },
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteChannel(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...PLANNING_KEY, 'channels'] });
    },
  });
}

/* -------------------------------- Events -------------------------------- */

export function useEvents() {
  const { status } = useAuth();
  return useQuery<PlanningEventRow[]>({
    queryKey: [...PLANNING_KEY, 'events'],
    queryFn: listEvents,
    enabled: status === 'authenticated',
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<PlanningEventRow, Error, PlanningEventInput>({
    mutationFn: async (input) => {
      if (!session?.tenantId) throw new Error('Hôtel actif inconnu');
      return createEvent(session.tenantId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...PLANNING_KEY, 'events'] });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation<PlanningEventRow, Error, { id: string; patch: Partial<PlanningEventInput> }>({
    mutationFn: ({ id, patch }) => updateEvent(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...PLANNING_KEY, 'events'] });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteEvent(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...PLANNING_KEY, 'events'] });
    },
  });
}
