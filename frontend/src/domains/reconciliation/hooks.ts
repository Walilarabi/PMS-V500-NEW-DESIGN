/**
 * FLOWTYM — Reconciliation TanStack hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/src/domains/auth/AuthContext';
import {
  listBankStatements,
  createBankStatement,
  createBankStatementsBatch,
  updateStatementStatus,
  matchStatement,
  listCsvTemplates,
  upsertCsvTemplate,
  deleteCsvTemplate,
  type BankStatement,
  type CreateBankStatementInput,
  type CsvTemplate,
  type ReconStatus,
  type UpsertCsvTemplateInput,
} from './repository';

const KEY = ['reconciliation'] as const;

export function useBankStatements() {
  const { status } = useAuth();
  return useQuery<BankStatement[]>({
    queryKey: [...KEY, 'list'],
    queryFn: listBankStatements,
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useCreateBankStatement() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<BankStatement, Error, CreateBankStatementInput>({
    mutationFn: async (input) => {
      if (!session?.tenantId) throw new Error('Hôtel actif inconnu');
      return createBankStatement(session.tenantId, input);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateStatementStatus() {
  const qc = useQueryClient();
  return useMutation<BankStatement, Error, { id: string; status: ReconStatus; notes?: string }>({
    mutationFn: ({ id, status, notes }) => updateStatementStatus(id, status, notes),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMatchStatement() {
  const qc = useQueryClient();
  return useMutation<BankStatement, Error, { id: string; validationId?: string | null; reservationId?: string | null }>({
    mutationFn: ({ id, validationId, reservationId }) => matchStatement(id, { validationId, reservationId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useImportBankStatementsCSV() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<{ inserted: number; skipped: number }, Error, CreateBankStatementInput[]>({
    mutationFn: async (rows) => {
      if (!session?.tenantId) throw new Error('Hôtel actif inconnu');
      return createBankStatementsBatch(session.tenantId, rows);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

/* ----- CSV mapping templates ----- */

export function useCsvTemplates() {
  return useQuery<CsvTemplate[]>({
    queryKey: [...KEY, 'csv-templates'],
    queryFn: listCsvTemplates,
  });
}

export function useUpsertCsvTemplate() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<CsvTemplate, Error, UpsertCsvTemplateInput>({
    mutationFn: async (input) => {
      if (!session?.tenantId) throw new Error('Hôtel actif inconnu');
      return upsertCsvTemplate(session.tenantId, input);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, 'csv-templates'] }),
  });
}

export function useDeleteCsvTemplate() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteCsvTemplate(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...KEY, 'csv-templates'] }),
  });
}


