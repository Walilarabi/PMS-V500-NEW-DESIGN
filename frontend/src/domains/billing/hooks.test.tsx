/**
 * FLOWTYM — Billing domain hook mutation tests.
 *
 * Covers every mutation in frontend/src/domains/billing/hooks.ts:
 *   useCreateInvoice, useIssueInvoice, useVoidInvoice,
 *   useAddFolio, useAddInvoiceLine, useReverseLine,
 *   useAddPayment, useReversePayment
 *
 * Strategy:
 *   - Mock the repository module so all network calls are controlled
 *   - Mock AuthContext with a stable session (tenantId = HOTEL_ID)
 *   - Fresh QueryClient per test
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  createInvoice:    vi.fn(),
  issueInvoice:     vi.fn(),
  voidInvoice:      vi.fn(),
  addFolio:         vi.fn(),
  addInvoiceLine:   vi.fn(),
  reverseLine:      vi.fn(),
  addPayment:       vi.fn(),
  reversePayment:   vi.fn(),
  listInvoices:     vi.fn(),
  getInvoice:       vi.fn(),
  listFolios:       vi.fn(),
  listInvoiceLines: vi.fn(),
  listPayments:     vi.fn(),
  getBillingStats:  vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/domains/billing/repository', () => mocks);

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    status: 'authenticated',
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOTEL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const INV_ID   = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const FOLIO_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const LINE_ID  = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const PAY_ID   = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// Minimal valid fixtures (only the fields assertions care about)
const fakeInvoice = {
  id: INV_ID,
  hotel_id: HOTEL_ID,
  reservation_id: null,
  guest_id: null,
  invoice_number: 'INV-001',
  status: 'draft' as const,
  total_ht: 100,
  total_tva: 10,
  total_ttc: 110,
  paid_amount: 0,
  balance: 110,
  issued_at: null,
  due_date: null,
  bill_to_name: null,
  bill_to_address: null,
  bill_to_vat: null,
  notes: null,
  created_by: null,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

const fakeFolio = {
  id: FOLIO_ID,
  hotel_id: HOTEL_ID,
  invoice_id: INV_ID,
  label: 'Hébergement',
  folio_order: 0,
  created_at: '2025-01-01T00:00:00.000Z',
};

const fakeLine = {
  id: LINE_ID,
  hotel_id: HOTEL_ID,
  folio_id: FOLIO_ID,
  invoice_id: INV_ID,
  product_code: 'ROOM',
  description: 'Nuit chambre',
  service_date: '2025-06-01',
  quantity: 1,
  unit_price_ht: 100,
  tva_rate: 10,
  total_ht: 100,
  total_tva: 10,
  total_ttc: 110,
  source: 'manual' as const,
  reversal_of: null,
  created_by: null,
  created_at: '2025-01-01T00:00:00.000Z',
};

const fakePayment = {
  id: PAY_ID,
  hotel_id: HOTEL_ID,
  invoice_id: INV_ID,
  amount: 110,
  currency: 'EUR',
  method: 'card' as const,
  status: 'completed' as const,
  reversal_of: null,
  reversal_reason: null,
  reference: null,
  collected_at: '2025-01-01T10:00:00.000Z',
  created_by: null,
  created_at: '2025-01-01T10:00:00.000Z',
};

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  useCreateInvoice,
  useIssueInvoice,
  useVoidInvoice,
  useAddFolio,
  useAddInvoiceLine,
  useReverseLine,
  useAddPayment,
  useReversePayment,
} from './hooks';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useCreateInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: returns { invoice, folio } with correct data', async () => {
    mocks.createInvoice.mockResolvedValue({ invoice: fakeInvoice, folio: fakeFolio });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateInvoice(), { wrapper });

    let returned: { invoice: typeof fakeInvoice; folio: typeof fakeFolio } | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        reservationId: undefined,
        guestId: undefined,
        billToName: 'Hôtel Test',
      });
    });

    expect(returned?.invoice.id).toBe(INV_ID);
    expect(returned?.invoice.status).toBe('draft');
    expect(returned?.folio.label).toBe('Hébergement');
    expect(mocks.createInvoice).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ billToName: 'Hôtel Test' }),
    );
  });

  it('success: reaches isSuccess state', async () => {
    mocks.createInvoice.mockResolvedValue({ invoice: fakeInvoice, folio: fakeFolio });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateInvoice(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({});
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: re-throws when repository rejects', async () => {
    mocks.createInvoice.mockRejectedValue(new Error('INVOICE_LOCKED'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateInvoice(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({})).rejects.toThrow('INVOICE_LOCKED');
    });
  });

  it('error: reaches isError state', async () => {
    mocks.createInvoice.mockRejectedValue(new Error('DB failure'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateInvoice(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({}); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('DB failure');
  });
});

describe('useIssueInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: returns issued invoice with status=issued', async () => {
    const issued = { ...fakeInvoice, status: 'issued' as const };
    mocks.issueInvoice.mockResolvedValue(issued);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useIssueInvoice(), { wrapper });

    let returned: typeof issued | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(INV_ID);
    });

    expect(returned?.status).toBe('issued');
    expect(mocks.issueInvoice).toHaveBeenCalledWith(INV_ID);
  });

  it('error: re-throws ConflictError from repository', async () => {
    mocks.issueInvoice.mockRejectedValue(new Error('Facture introuvable ou déjà émise.'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useIssueInvoice(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(INV_ID)).rejects.toThrow('déjà émise');
    });
  });
});

describe('useVoidInvoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: returns voided invoice', async () => {
    const voided = { ...fakeInvoice, status: 'voided' as const };
    mocks.voidInvoice.mockResolvedValue(voided);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useVoidInvoice(), { wrapper });

    let returned: typeof voided | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: INV_ID, reason: 'Customer request' });
    });

    expect(returned?.status).toBe('voided');
    expect(mocks.voidInvoice).toHaveBeenCalledWith(INV_ID, 'Customer request');
  });

  it('error: re-throws when invoice is not found', async () => {
    mocks.voidInvoice.mockRejectedValue(new Error('Invoice not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useVoidInvoice(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: INV_ID, reason: 'test' }),
      ).rejects.toThrow('not found');
    });
  });
});

describe('useAddFolio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: returns the new folio with correct label', async () => {
    const newFolio = { ...fakeFolio, label: 'Restaurant', folio_order: 1 };
    mocks.addFolio.mockResolvedValue(newFolio);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddFolio(), { wrapper });

    let returned: typeof newFolio | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ invoiceId: INV_ID, label: 'Restaurant' });
    });

    expect(returned?.label).toBe('Restaurant');
    expect(mocks.addFolio).toHaveBeenCalledWith(HOTEL_ID, INV_ID, 'Restaurant');
  });

  it('error: re-throws repository error', async () => {
    mocks.addFolio.mockRejectedValue(new Error('folio creation failed'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddFolio(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ invoiceId: INV_ID, label: 'Bar' }),
      ).rejects.toThrow('folio creation failed');
    });
  });
});

describe('useAddInvoiceLine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: returns the new invoice line', async () => {
    mocks.addInvoiceLine.mockResolvedValue(fakeLine);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddInvoiceLine(), { wrapper });

    let returned: typeof fakeLine | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        folioId: FOLIO_ID,
        invoiceId: INV_ID,
        description: 'Nuit chambre',
        serviceDate: '2025-06-01',
        quantity: 1,
        unitPriceHt: 100,
        tvaRate: 10,
        source: 'manual',
      });
    });

    expect(returned?.id).toBe(LINE_ID);
    expect(returned?.description).toBe('Nuit chambre');
    expect(mocks.addInvoiceLine).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ folioId: FOLIO_ID, invoiceId: INV_ID }),
    );
  });

  it('error: re-throws INVOICE_LOCKED error', async () => {
    mocks.addInvoiceLine.mockRejectedValue(new Error('Cette facture est verrouillée après émission.'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddInvoiceLine(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          folioId: FOLIO_ID,
          invoiceId: INV_ID,
          description: 'Extra',
          serviceDate: '2025-06-01',
          quantity: 1,
          unitPriceHt: 20,
          tvaRate: 10,
          source: 'manual',
        }),
      ).rejects.toThrow('verrouillée');
    });
  });
});

describe('useReverseLine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: returns the reversal line with negative quantity', async () => {
    const reversalLine = { ...fakeLine, id: '99999999-9999-9999-9999-999999999999', quantity: -1, source: 'reversal' as const, reversal_of: LINE_ID };
    mocks.reverseLine.mockResolvedValue(reversalLine);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useReverseLine(), { wrapper });

    let returned: typeof reversalLine | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ lineId: LINE_ID, invoiceId: INV_ID });
    });

    expect(returned?.quantity).toBe(-1);
    expect(returned?.source).toBe('reversal');
    expect(returned?.reversal_of).toBe(LINE_ID);
    expect(mocks.reverseLine).toHaveBeenCalledWith(HOTEL_ID, LINE_ID);
  });

  it('error: re-throws when line is not found', async () => {
    mocks.reverseLine.mockRejectedValue(new Error('line not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useReverseLine(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ lineId: LINE_ID, invoiceId: INV_ID }),
      ).rejects.toThrow('line not found');
    });
  });
});

describe('useAddPayment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: returns payment linked to invoice', async () => {
    mocks.addPayment.mockResolvedValue(fakePayment);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddPayment(), { wrapper });

    let returned: typeof fakePayment | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        invoiceId: INV_ID,
        amount: 110,
        method: 'card',
      });
    });

    expect(returned?.id).toBe(PAY_ID);
    expect(returned?.invoice_id).toBe(INV_ID);
    expect(returned?.amount).toBe(110);
    expect(returned?.method).toBe('card');
    expect(returned?.status).toBe('completed');
    expect(mocks.addPayment).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ invoiceId: INV_ID, amount: 110, method: 'card' }),
    );
  });

  it('success: reaches isSuccess state after payment added', async () => {
    mocks.addPayment.mockResolvedValue(fakePayment);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddPayment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ invoiceId: INV_ID, amount: 50, method: 'cash' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: re-throws PAYMENT_LOCKED error', async () => {
    mocks.addPayment.mockRejectedValue(new Error('Ce paiement est finalisé.'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddPayment(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ invoiceId: INV_ID, amount: 110, method: 'card' }),
      ).rejects.toThrow('finalisé');
    });
  });

  it('error: reaches isError state after failure', async () => {
    mocks.addPayment.mockRejectedValue(new Error('payment DB error'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddPayment(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ invoiceId: INV_ID, amount: 100, method: 'transfer' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('payment DB error');
  });
});

describe('useReversePayment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: returns reversal payment with negative amount', async () => {
    const reversalPayment = { ...fakePayment, id: '11111111-1111-1111-1111-111111111111', amount: -110, reversal_of: PAY_ID };
    mocks.reversePayment.mockResolvedValue(reversalPayment);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useReversePayment(), { wrapper });

    let returned: typeof reversalPayment | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        paymentId: PAY_ID,
        invoiceId: INV_ID,
        reason: 'Client annulé',
      });
    });

    expect(returned?.amount).toBe(-110);
    expect(returned?.reversal_of).toBe(PAY_ID);
    expect(mocks.reversePayment).toHaveBeenCalledWith(HOTEL_ID, PAY_ID, 'Client annulé');
  });

  it('error: re-throws when payment cannot be reversed', async () => {
    mocks.reversePayment.mockRejectedValue(new Error('Seuls les paiements complétés peuvent être annulés.'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useReversePayment(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ paymentId: PAY_ID, invoiceId: INV_ID, reason: 'test' }),
      ).rejects.toThrow('complétés');
    });
  });
});
