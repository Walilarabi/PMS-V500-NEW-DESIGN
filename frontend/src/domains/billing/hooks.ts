/**
 * FLOWTYM — Billing domain hooks (TanStack Query).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/domains/auth/AuthContext';
import * as repo from './repository';
import type { CreateInvoiceInput, AddInvoiceLineInput, AddPaymentInput } from './schemas';
import * as haRepo from './houseAccounts.repository';
import type { CreateHouseAccountInput, AddHouseAccountLineInput } from './houseAccounts.repository';
import * as depRepo from './deposits.repository';
import type { CreateDepositInput } from './deposits.repository';
import * as cnRepo from './creditNotes.repository';
import type { CreateCreditNoteInput } from './creditNotes.repository';

const INVOICE_KEY  = ['invoices'] as const;
const PAYMENT_KEY  = ['payments'] as const;
const BILLING_KEY  = ['billing'] as const;

// ─── Invoices ─────────────────────────────────────────────────────────────────

export function useInvoices(params: { status?: string; reservationId?: string; limit?: number; offset?: number } = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...INVOICE_KEY, 'list', params],
    queryFn: () => repo.listInvoices(params),
    enabled: status === 'authenticated',
    staleTime: 20_000,
  });
}

export function useInvoice(id: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...INVOICE_KEY, 'one', id],
    queryFn: () => repo.getInvoice(id!),
    enabled: status === 'authenticated' && !!id,
    staleTime: 10_000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      repo.createInvoice(session?.tenantId ?? '', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: INVOICE_KEY }),
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.issueInvoice(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: INVOICE_KEY });
      void qc.invalidateQueries({ queryKey: BILLING_KEY });
    },
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      repo.voidInvoice(id, reason),
    onSuccess: () => void qc.invalidateQueries({ queryKey: INVOICE_KEY }),
  });
}

// ─── Folios ───────────────────────────────────────────────────────────────────

export function useFolios(invoiceId: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['folios', invoiceId],
    queryFn: () => repo.listFolios(invoiceId!),
    enabled: status === 'authenticated' && !!invoiceId,
    staleTime: 15_000,
  });
}

export function useAddFolio() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ invoiceId, label }: { invoiceId: string; label: string }) =>
      repo.addFolio(session?.tenantId ?? '', invoiceId, label),
    onSuccess: (_d, vars) =>
      void qc.invalidateQueries({ queryKey: ['folios', vars.invoiceId] }),
  });
}

// ─── Invoice Lines ────────────────────────────────────────────────────────────

export function useInvoiceLines(invoiceId: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ['invoice_lines', invoiceId],
    queryFn: () => repo.listInvoiceLines(invoiceId!),
    enabled: status === 'authenticated' && !!invoiceId,
    staleTime: 10_000,
  });
}

export function useAddInvoiceLine() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: AddInvoiceLineInput) =>
      repo.addInvoiceLine(session?.tenantId ?? '', input),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['invoice_lines', vars.invoiceId] });
      void qc.invalidateQueries({ queryKey: [...INVOICE_KEY, 'one', vars.invoiceId] });
    },
  });
}

export function useReverseLine() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ lineId, invoiceId }: { lineId: string; invoiceId: string }) =>
      repo.reverseLine(session?.tenantId ?? '', lineId),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['invoice_lines', vars.invoiceId] });
      void qc.invalidateQueries({ queryKey: [...INVOICE_KEY, 'one', vars.invoiceId] });
    },
  });
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function usePayments(invoiceId: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...PAYMENT_KEY, invoiceId],
    queryFn: () => repo.listPayments(invoiceId!),
    enabled: status === 'authenticated' && !!invoiceId,
    staleTime: 10_000,
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: AddPaymentInput) =>
      repo.addPayment(session?.tenantId ?? '', input),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: [...PAYMENT_KEY, vars.invoiceId] });
      void qc.invalidateQueries({ queryKey: [...INVOICE_KEY, 'one', vars.invoiceId] });
      void qc.invalidateQueries({ queryKey: BILLING_KEY });
    },
  });
}

export function useReversePayment() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ paymentId, invoiceId, reason }: { paymentId: string; invoiceId: string; reason: string }) =>
      repo.reversePayment(session?.tenantId ?? '', paymentId, reason),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: [...PAYMENT_KEY, vars.invoiceId] });
      void qc.invalidateQueries({ queryKey: [...INVOICE_KEY, 'one', vars.invoiceId] });
    },
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function useBillingStats() {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...BILLING_KEY, 'stats'],
    queryFn: () => repo.getBillingStats(),
    enabled: status === 'authenticated',
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ─── House Accounts ───────────────────────────────────────────────────────────

const HA_KEY = ['house_accounts'] as const;

export function useHouseAccounts(activeOnly = true) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...HA_KEY, 'list', activeOnly],
    queryFn: () => haRepo.listHouseAccounts(activeOnly),
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });
}

export function useHouseAccountLines(houseAccountId: string | null) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...HA_KEY, 'lines', houseAccountId],
    queryFn: () => haRepo.listHouseAccountLines(houseAccountId!),
    enabled: status === 'authenticated' && !!houseAccountId,
    staleTime: 15_000,
  });
}

export function useCreateHouseAccount() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: CreateHouseAccountInput) =>
      haRepo.createHouseAccount(session?.tenantId ?? '', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: HA_KEY }),
  });
}

export function useAddHouseAccountLine() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: AddHouseAccountLineInput) =>
      haRepo.addHouseAccountLine(session?.tenantId ?? '', input),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: [...HA_KEY, 'lines', vars.houseAccountId] });
      void qc.invalidateQueries({ queryKey: [...HA_KEY, 'list'] });
    },
  });
}

// ─── Deposits ─────────────────────────────────────────────────────────────────

const DEP_KEY = ['deposits'] as const;

export function useDeposits(params: {
  reservationId?: string;
  invoiceId?: string;
  status?: string;
} = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...DEP_KEY, 'list', params],
    queryFn: () => depRepo.listDeposits(params),
    enabled: status === 'authenticated',
    staleTime: 20_000,
  });
}

export function useCreateDeposit() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: CreateDepositInput) =>
      depRepo.createDeposit(session?.tenantId ?? '', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: DEP_KEY }),
  });
}

export function useCaptureDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => depRepo.captureDeposit(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: DEP_KEY }),
  });
}

export function useReleaseDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      depRepo.releaseDeposit(id, notes),
    onSuccess: () => void qc.invalidateQueries({ queryKey: DEP_KEY }),
  });
}

export function useApplyDepositToInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, invoiceId, appliedAmount }: {
      id: string; invoiceId: string; appliedAmount?: number;
    }) => depRepo.applyDepositToInvoice(id, invoiceId, appliedAmount),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: DEP_KEY });
      void qc.invalidateQueries({ queryKey: [...INVOICE_KEY, 'one', vars.invoiceId] });
    },
  });
}

// ─── Credit Notes ─────────────────────────────────────────────────────────────

const CN_KEY = ['credit_notes'] as const;

export function useCreditNotes(params: {
  originalInvoiceId?: string;
  reservationId?: string;
  status?: string;
} = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...CN_KEY, 'list', params],
    queryFn: () => cnRepo.listCreditNotes(params),
    enabled: status === 'authenticated',
    staleTime: 20_000,
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: CreateCreditNoteInput) =>
      cnRepo.createCreditNote(session?.tenantId ?? '', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CN_KEY }),
  });
}

export function useIssueCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cnRepo.issueCreditNote(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CN_KEY });
      void qc.invalidateQueries({ queryKey: BILLING_KEY });
    },
  });
}
