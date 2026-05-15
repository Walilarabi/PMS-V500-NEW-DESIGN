/**
 * FLOWTYM — RIE TanStack Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/src/domains/auth/AuthContext';
import {
  loadConfiguration,
  persistValidation,
  listRecentValidations,
  listOpenAnomalies,
  listQuarantine,
  resolveQuarantine,
} from './repository';
import { ReservationValidationEngine, type RIEConfiguration } from './engines';
import type { OtaPayload, ValidationOutcome } from './types';

const RIE_KEY = ['rie'] as const;

export function useRieConfiguration() {
  const { status } = useAuth();
  return useQuery<RIEConfiguration>({
    queryKey: [...RIE_KEY, 'config'],
    queryFn: loadConfiguration,
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

export function useRecentValidations(limit = 50) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...RIE_KEY, 'validations', limit],
    queryFn: () => listRecentValidations(limit),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useOpenAnomalies(limit = 100) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...RIE_KEY, 'anomalies', limit],
    queryFn: () => listOpenAnomalies(limit),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useQuarantineQueue(limit = 100) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...RIE_KEY, 'quarantine', limit],
    queryFn: () => listQuarantine(limit),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

/** Validate a payload in-memory without persisting (used by simulator). */
export function useValidatePayload() {
  const cfgQ = useRieConfiguration();
  const validate = (payload: OtaPayload): ValidationOutcome | null => {
    if (!cfgQ.data) return null;
    return ReservationValidationEngine.validate(payload, cfgQ.data);
  };
  return { validate, configurationLoaded: !!cfgQ.data };
}

/** Validate + persist (records audit trail and anomalies). */
export function useRunValidation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const cfgQ = useRieConfiguration();
  return useMutation<
    { outcome: ValidationOutcome; persisted: { id: string } },
    Error,
    { payload: OtaPayload; reservationId: string | null }
  >({
    mutationFn: async ({ payload, reservationId }) => {
      if (!cfgQ.data) throw new Error('Configuration RIE non chargée');
      if (!session?.tenantId) throw new Error('Hôtel actif inconnu');
      const outcome = ReservationValidationEngine.validate(payload, cfgQ.data);
      const persisted = await persistValidation(
        session.tenantId,
        payload,
        outcome,
        reservationId,
      );
      return { outcome, persisted };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: RIE_KEY });
    },
  });
}

export function useResolveQuarantine() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<
    void,
    Error,
    { id: string; status: 'APPROVED' | 'REJECTED'; reason: string }
  >({
    mutationFn: ({ id, status, reason }) => resolveQuarantine(id, status, reason, session?.userId ?? null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...RIE_KEY, 'quarantine'] });
      void qc.invalidateQueries({ queryKey: [...RIE_KEY, 'validations'] });
    },
  });
}
