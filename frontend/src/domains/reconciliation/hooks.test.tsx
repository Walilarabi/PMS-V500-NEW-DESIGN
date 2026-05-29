/**
 * FLOWTYM — Reconciliation domain mutation tests.
 *
 * Covers every mutation in frontend/src/domains/reconciliation/hooks.ts:
 *   useCreateBankStatement, useUpdateStatementStatus, useMatchStatement,
 *   useImportBankStatementsCSV, useUpsertCsvTemplate, useDeleteCsvTemplate
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

const {
  mockCreateBankStatement,
  mockUpdateStatementStatus,
  mockMatchStatement,
  mockCreateBankStatementsBatch,
  mockUpsertCsvTemplate,
  mockDeleteCsvTemplate,
  mockListBankStatements,
  mockListCsvTemplates,
} = vi.hoisted(() => ({
  mockCreateBankStatement:       vi.fn(),
  mockUpdateStatementStatus:     vi.fn(),
  mockMatchStatement:            vi.fn(),
  mockCreateBankStatementsBatch: vi.fn(),
  mockUpsertCsvTemplate:         vi.fn(),
  mockDeleteCsvTemplate:         vi.fn(),
  mockListBankStatements:        vi.fn(),
  mockListCsvTemplates:          vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/domains/reconciliation/repository', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    createBankStatement:       mockCreateBankStatement,
    updateStatementStatus:     mockUpdateStatementStatus,
    matchStatement:            mockMatchStatement,
    createBankStatementsBatch: mockCreateBankStatementsBatch,
    upsertCsvTemplate:         mockUpsertCsvTemplate,
    deleteCsvTemplate:         mockDeleteCsvTemplate,
    listBankStatements:        mockListBankStatements,
    listCsvTemplates:          mockListCsvTemplates,
  };
});

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    status: 'authenticated',
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOTEL_ID  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STMT_ID   = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const RES_ID    = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const TMPL_ID   = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// Minimal valid BankStatement fixture
const fakeBankStatement = {
  id:                      STMT_ID,
  hotel_id:                HOTEL_ID,
  source:                  'BANK_HOTEL',
  external_reference:      'REF-001',
  description:             'Virement client',
  amount:                  250.00,
  currency:                'EUR',
  posted_at:               '2026-01-15T00:00:00.000Z',
  imported_at:             '2026-01-16T00:00:00.000Z',
  matched_validation_id:   null,
  matched_reservation_id:  null,
  status:                  'UNMATCHED' as const,
  notes:                   null,
};

// Minimal valid CsvTemplate fixture
const fakeCsvTemplate = {
  id:               TMPL_ID,
  hotel_id:         HOTEL_ID,
  name:             'BNP Export',
  source:           'BANK_HOTEL',
  mapping:          { date: ['Date'], amount: ['Montant'], description: ['Libellé'] },
  default_currency: 'EUR',
  is_default:       true,
  created_at:       '2026-01-01T00:00:00.000Z',
  updated_at:       '2026-01-01T00:00:00.000Z',
};

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  useCreateBankStatement,
  useUpdateStatementStatus,
  useMatchStatement,
  useImportBankStatementsCSV,
  useUpsertCsvTemplate,
  useDeleteCsvTemplate,
} from './hooks';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useCreateBankStatement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls createBankStatement with tenantId and input, returns BankStatement', async () => {
    mockCreateBankStatement.mockResolvedValue(fakeBankStatement);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateBankStatement(), { wrapper });

    const input = {
      source: 'BANK_HOTEL',
      amount: 250.00,
      postedAt: '2026-01-15',
    };

    let returned: typeof fakeBankStatement | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(input);
    });

    expect(returned?.id).toBe(STMT_ID);
    expect(returned?.status).toBe('UNMATCHED');
    expect(mockCreateBankStatement).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ source: 'BANK_HOTEL', amount: 250.00 }),
    );
  });

  it('error: reaches isError state when repository rejects', async () => {
    mockCreateBankStatement.mockRejectedValue(new Error('DB insert failed'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateBankStatement(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ source: 'BANK_HOTEL', amount: 100, postedAt: '2026-01-15' });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('DB insert failed');
  });
});

describe('useUpdateStatementStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls updateStatementStatus with id and status, returns updated BankStatement', async () => {
    const updated = { ...fakeBankStatement, status: 'IGNORED' as const };
    mockUpdateStatementStatus.mockResolvedValue(updated);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateStatementStatus(), { wrapper });

    let returned: typeof updated | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: STMT_ID, status: 'IGNORED' });
    });

    expect(returned?.status).toBe('IGNORED');
    expect(mockUpdateStatementStatus).toHaveBeenCalledWith(STMT_ID, 'IGNORED', undefined);
  });

  it('error: reaches isError state when repository rejects', async () => {
    mockUpdateStatementStatus.mockRejectedValue(new Error('Statement not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateStatementStatus(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: STMT_ID, status: 'DISPUTED' });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Statement not found');
  });
});

describe('useMatchStatement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls matchStatement with id and reservationId, returns matched BankStatement', async () => {
    const matched = {
      ...fakeBankStatement,
      status: 'MATCHED' as const,
      matched_reservation_id: RES_ID,
    };
    mockMatchStatement.mockResolvedValue(matched);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useMatchStatement(), { wrapper });

    let returned: typeof matched | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: STMT_ID, reservationId: RES_ID });
    });

    expect(returned?.status).toBe('MATCHED');
    expect(returned?.matched_reservation_id).toBe(RES_ID);
    expect(mockMatchStatement).toHaveBeenCalledWith(
      STMT_ID,
      expect.objectContaining({ reservationId: RES_ID }),
    );
  });

  it('error: reaches isError state when repository rejects', async () => {
    mockMatchStatement.mockRejectedValue(new Error('Match failed'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useMatchStatement(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: STMT_ID, reservationId: RES_ID });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Match failed');
  });
});

describe('useImportBankStatementsCSV', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls createBankStatementsBatch with tenantId and rows, returns result counts', async () => {
    mockCreateBankStatementsBatch.mockResolvedValue({ inserted: 3, skipped: 1 });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useImportBankStatementsCSV(), { wrapper });

    const rows = [
      { source: 'BANK_HOTEL', amount: 100, postedAt: '2026-01-10' },
      { source: 'BANK_HOTEL', amount: 200, postedAt: '2026-01-11' },
      { source: 'BANK_HOTEL', amount: 300, postedAt: '2026-01-12' },
      { source: 'BANK_HOTEL', amount: 400, postedAt: '2026-01-13' },
    ];

    let returned: { inserted: number; skipped: number } | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(rows);
    });

    expect(returned?.inserted).toBe(3);
    expect(returned?.skipped).toBe(1);
    expect(mockCreateBankStatementsBatch).toHaveBeenCalledWith(HOTEL_ID, rows);
  });

  it('error: reaches isError state when batch import rejects', async () => {
    mockCreateBankStatementsBatch.mockRejectedValue(new Error('Batch import error'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useImportBankStatementsCSV(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync([{ source: 'BANK_HOTEL', amount: 50, postedAt: '2026-01-10' }]);
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Batch import error');
  });
});

describe('useUpsertCsvTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls upsertCsvTemplate with tenantId and input, returns CsvTemplate', async () => {
    mockUpsertCsvTemplate.mockResolvedValue(fakeCsvTemplate);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpsertCsvTemplate(), { wrapper });

    const input = {
      name: 'BNP Export',
      source: 'BANK_HOTEL',
      mapping: { date: ['Date'], amount: ['Montant'], description: ['Libellé'] },
      isDefault: true,
    };

    let returned: typeof fakeCsvTemplate | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(input);
    });

    expect(returned?.id).toBe(TMPL_ID);
    expect(returned?.name).toBe('BNP Export');
    expect(returned?.is_default).toBe(true);
    expect(mockUpsertCsvTemplate).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ name: 'BNP Export', source: 'BANK_HOTEL' }),
    );
  });

  it('error: reaches isError state when upsert rejects', async () => {
    mockUpsertCsvTemplate.mockRejectedValue(new Error('Template upsert failed'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpsertCsvTemplate(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          name: 'Test',
          source: 'BANK_HOTEL',
          mapping: {},
        });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Template upsert failed');
  });
});

describe('useDeleteCsvTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls deleteCsvTemplate with id and resolves', async () => {
    mockDeleteCsvTemplate.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteCsvTemplate(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(TMPL_ID);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteCsvTemplate).toHaveBeenCalledWith(TMPL_ID);
  });

  it('error: reaches isError state when delete rejects', async () => {
    mockDeleteCsvTemplate.mockRejectedValue(new Error('Template not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteCsvTemplate(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync(TMPL_ID);
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Template not found');
  });
});
