/**
 * FLOWTYM — Finance domain hooks (TanStack Query).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/domains/auth/AuthContext';
import * as repo from './repository';
import type { UpsertCsvTemplateInput, ImportCsvLine } from './schemas';

const RECON_KEY = ['reconciliation'] as const;
const FEC_KEY = ['fec'] as const;
const ANOMALY_KEY = ['revenue-anomalies'] as const;
const CSV_TPL_KEY = ['csv-templates'] as const;
const AUDIT_KEY = ['audit-logs'] as const;

// ─── Reconciliation ───────────────────────────────────────────────────────────

export function useReconciliationLines(params: repo.ListReconciliationParams = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...RECON_KEY, 'list', params],
    queryFn: () => repo.listReconciliationLines(params),
    enabled: status === 'authenticated',
    staleTime: 10_000,
    refetchInterval: 30_000, // Live refresh toutes les 30s
  });
}

export function useReconciliationStats() {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...RECON_KEY, 'stats'],
    queryFn: () => repo.getReconciliationStats(),
    enabled: status === 'authenticated',
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useImportCsvLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lines: ImportCsvLine[]) => repo.importCsvLines(lines),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: RECON_KEY });
    },
  });
}

export function useUpdateReconciliationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reservationId,
      notes,
    }: {
      id: string;
      status: string;
      reservationId?: string | null;
      notes?: string;
    }) => repo.updateReconciliationStatus(id, status, reservationId, notes),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: RECON_KEY });
    },
  });
}

// ─── FEC ─────────────────────────────────────────────────────────────────────

export function useFecExports() {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...FEC_KEY, 'list'],
    queryFn: () => repo.listFecExports(),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

export function useGenerateFecEntries(fromDate: string, toDate: string, enabled = false) {
  return useQuery({
    queryKey: [...FEC_KEY, 'entries', fromDate, toDate],
    queryFn: () => repo.generateFecEntries(fromDate, toDate),
    enabled,
    staleTime: 0,
  });
}

// ─── Revenue Anomalies ────────────────────────────────────────────────────────

export function useRevenueAnomalies(params: { status?: string; severity?: string } = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...ANOMALY_KEY, 'list', params],
    queryFn: () => repo.listRevenueAnomalies(params),
    enabled: status === 'authenticated',
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useAnomalyStats() {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...ANOMALY_KEY, 'stats'],
    queryFn: () => repo.getAnomalyStats(),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useResolveAnomaly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      repo.resolveAnomaly(id, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ANOMALY_KEY });
    },
  });
}

// ─── CSV Templates ────────────────────────────────────────────────────────────

export function useCsvTemplates() {
  const { status } = useAuth();
  return useQuery({
    queryKey: CSV_TPL_KEY,
    queryFn: () => repo.listCsvTemplates(),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

export function useUpsertCsvTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCsvTemplateInput) => repo.upsertCsvTemplate(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CSV_TPL_KEY });
    },
  });
}

export function useDeleteCsvTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteCsvTemplate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CSV_TPL_KEY });
    },
  });
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export function useAuditLogs(params: {
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...AUDIT_KEY, 'list', params],
    queryFn: () => repo.listAuditLogs(params),
    enabled: status === 'authenticated',
    staleTime: 20_000,
  });
}
