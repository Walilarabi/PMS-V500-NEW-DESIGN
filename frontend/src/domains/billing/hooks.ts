/**
 * FLOWTYM — Billing domain hooks (TanStack Query).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/domains/auth/AuthContext';
import * as repo from './repository';
import type { CreateInvoiceInput, AddInvoiceLineInput, AddPaymentInput } from './schemas';

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
