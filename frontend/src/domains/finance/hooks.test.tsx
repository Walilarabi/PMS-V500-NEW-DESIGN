/**
 * FLOWTYM — Finance domain hook mutation tests.
 *
 * Covers every mutation in frontend/src/domains/finance/hooks.ts:
 *   useImportCsvLines, useUpdateReconciliationStatus,
 *   useResolveAnomaly, useUpsertCsvTemplate, useDeleteCsvTemplate
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
  importCsvLines:              vi.fn(),
  updateReconciliationStatus:  vi.fn(),
  resolveAnomaly:              vi.fn(),
  upsertCsvTemplate:           vi.fn(),
  deleteCsvTemplate:           vi.fn(),
  // read-side stubs (not under test but imported by the module)
  listReconciliationLines:     vi.fn(),
  getReconciliationStats:      vi.fn(),
  listFecExports:              vi.fn(),
  generateFecEntries:          vi.fn(),
  listRevenueAnomalies:        vi.fn(),
  getAnomalyStats:             vi.fn(),
  listCsvTemplates:            vi.fn(),
  listAuditLogs:               vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/domains/finance/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./repository')>();
  return {
    ...actual,
    importCsvLines:             mocks.importCsvLines,
    updateReconciliationStatus: mocks.updateReconciliationStatus,
    resolveAnomaly:             mocks.resolveAnomaly,
    upsertCsvTemplate:          mocks.upsertCsvTemplate,
    deleteCsvTemplate:          mocks.deleteCsvTemplate,
    listReconciliationLines:    mocks.listReconciliationLines,
    getReconciliationStats:     mocks.getReconciliationStats,
    listFecExports:             mocks.listFecExports,
    generateFecEntries:         mocks.generateFecEntries,
    listRevenueAnomalies:       mocks.listRevenueAnomalies,
    getAnomalyStats:            mocks.getAnomalyStats,
    listCsvTemplates:           mocks.listCsvTemplates,
    listAuditLogs:              mocks.listAuditLogs,
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
const RECON_ID  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ANOMALY_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const TPL_ID    = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fakeReconLine = {
  id: RECON_ID,
  hotel_id: HOTEL_ID,
  source: 'BOOKING' as const,
  reference: 'BK-001',
  description: 'Nuit du 01/06',
  amount: 150.00,
  currency: 'EUR',
  line_date: '2025-06-01',
  status: 'pending' as const,
  reservation_id: null,
  match_score: null,
  match_delta: null,
  matched_at: null,
  matched_by: null,
  notes: null,
  raw_payload: null,
  created_at: '2025-06-01T10:00:00.000Z',
  updated_at: '2025-06-01T10:00:00.000Z',
};

const fakeCsvTemplate = {
  id: TPL_ID,
  hotel_id: HOTEL_ID,
  name: 'Booking Import',
  source: 'BOOKING' as const,
  mapping: { date: 'Date', amount: 'Amount', reference: 'Ref' },
  default_currency: 'EUR',
  is_default: false,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

const fakeCsvLines = [
  {
    source: 'BOOKING' as const,
    reference: 'BK-001',
    description: 'Nuit chambre',
    amount: 150.00,
    date: '2025-06-01',
  },
  {
    source: 'BOOKING' as const,
    reference: 'BK-002',
    description: 'Nuit chambre',
    amount: 120.00,
    date: '2025-06-02',
  },
];

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  useImportCsvLines,
  useUpdateReconciliationStatus,
  useResolveAnomaly,
  useUpsertCsvTemplate,
  useDeleteCsvTemplate,
} from './hooks';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useImportCsvLines', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls repo.importCsvLines with the provided lines and returns the rows', async () => {
    const fakeRows = [fakeReconLine, { ...fakeReconLine, id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', reference: 'BK-002', amount: 120.00 }];
    mocks.importCsvLines.mockResolvedValue(fakeRows);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useImportCsvLines(), { wrapper });

    let returned: typeof fakeRows | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(fakeCsvLines);
    });

    expect(returned).toEqual(fakeRows);
    expect(mocks.importCsvLines).toHaveBeenCalledOnce();
    expect(mocks.importCsvLines).toHaveBeenCalledWith(fakeCsvLines);
  });

  it('success: reaches isSuccess state after import completes', async () => {
    mocks.importCsvLines.mockResolvedValue([fakeReconLine]);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useImportCsvLines(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync([fakeCsvLines[0]]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('error: re-throws when repo.importCsvLines rejects', async () => {
    mocks.importCsvLines.mockRejectedValue(new Error('CSV_PARSE_ERROR'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useImportCsvLines(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(fakeCsvLines)).rejects.toThrow('CSV_PARSE_ERROR');
    });
  });

  it('error: reaches isError=true after rejection', async () => {
    mocks.importCsvLines.mockRejectedValue(new Error('DB import failure'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useImportCsvLines(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync(fakeCsvLines); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('DB import failure');
  });
});

describe('useUpdateReconciliationStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls repo with id, status, reservationId, and notes', async () => {
    mocks.updateReconciliationStatus.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateReconciliationStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: RECON_ID,
        status: 'matched',
        reservationId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        notes: 'Matched by accountant',
      });
    });

    expect(mocks.updateReconciliationStatus).toHaveBeenCalledOnce();
    expect(mocks.updateReconciliationStatus).toHaveBeenCalledWith(
      RECON_ID,
      'matched',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      'Matched by accountant',
    );
  });

  it('success: works without optional reservationId and notes', async () => {
    mocks.updateReconciliationStatus.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateReconciliationStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: RECON_ID, status: 'disputed' });
    });

    expect(mocks.updateReconciliationStatus).toHaveBeenCalledWith(
      RECON_ID,
      'disputed',
      undefined,
      undefined,
    );
  });

  it('success: reaches isSuccess state after update', async () => {
    mocks.updateReconciliationStatus.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateReconciliationStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: RECON_ID, status: 'matched' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: reaches isError=true when repo rejects', async () => {
    mocks.updateReconciliationStatus.mockRejectedValue(new Error('RECON_NOT_FOUND'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateReconciliationStatus(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: RECON_ID, status: 'matched' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('RECON_NOT_FOUND');
  });
});

describe('useResolveAnomaly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls repo.resolveAnomaly with id and note', async () => {
    mocks.resolveAnomaly.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useResolveAnomaly(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: ANOMALY_ID, note: 'Corrected manually' });
    });

    expect(mocks.resolveAnomaly).toHaveBeenCalledOnce();
    expect(mocks.resolveAnomaly).toHaveBeenCalledWith(ANOMALY_ID, 'Corrected manually');
  });

  it('success: reaches isSuccess state after resolving', async () => {
    mocks.resolveAnomaly.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useResolveAnomaly(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: ANOMALY_ID, note: 'Fixed' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: re-throws when repo.resolveAnomaly rejects', async () => {
    mocks.resolveAnomaly.mockRejectedValue(new Error('ANOMALY_ALREADY_RESOLVED'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useResolveAnomaly(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: ANOMALY_ID, note: 'attempt' }),
      ).rejects.toThrow('ANOMALY_ALREADY_RESOLVED');
    });
  });

  it('error: reaches isError=true after rejection', async () => {
    mocks.resolveAnomaly.mockRejectedValue(new Error('DB error'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useResolveAnomaly(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: ANOMALY_ID, note: 'attempt' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('DB error');
  });
});

describe('useUpsertCsvTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls repo.upsertCsvTemplate with the input and returns the saved template', async () => {
    mocks.upsertCsvTemplate.mockResolvedValue(fakeCsvTemplate);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpsertCsvTemplate(), { wrapper });

    const input = {
      name: 'Booking Import',
      source: 'BOOKING' as const,
      mapping: { date: 'Date', amount: 'Amount', reference: 'Ref' },
      is_default: false,
    };

    let returned: typeof fakeCsvTemplate | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(input);
    });

    expect(returned).toEqual(fakeCsvTemplate);
    expect(mocks.upsertCsvTemplate).toHaveBeenCalledOnce();
    expect(mocks.upsertCsvTemplate).toHaveBeenCalledWith(input);
  });

  it('success: reaches isSuccess state with returned template data', async () => {
    mocks.upsertCsvTemplate.mockResolvedValue(fakeCsvTemplate);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpsertCsvTemplate(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Booking Import',
        source: 'BOOKING' as const,
        mapping: { date: 'Date' },
        is_default: false,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(TPL_ID);
    expect(result.current.data?.name).toBe('Booking Import');
  });

  it('error: re-throws when repo.upsertCsvTemplate rejects', async () => {
    mocks.upsertCsvTemplate.mockRejectedValue(new Error('TEMPLATE_CONFLICT'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpsertCsvTemplate(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          name: 'Duplicate',
          source: 'EXPEDIA' as const,
          mapping: { date: 'Date' },
          is_default: false,
        }),
      ).rejects.toThrow('TEMPLATE_CONFLICT');
    });
  });

  it('error: reaches isError=true after rejection', async () => {
    mocks.upsertCsvTemplate.mockRejectedValue(new Error('upsert DB failure'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpsertCsvTemplate(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          name: 'Test',
          source: 'AIRBNB' as const,
          mapping: { amount: 'Montant' },
          is_default: false,
        });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('upsert DB failure');
  });
});

describe('useDeleteCsvTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: calls repo.deleteCsvTemplate with the template id', async () => {
    mocks.deleteCsvTemplate.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteCsvTemplate(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(TPL_ID);
    });

    expect(mocks.deleteCsvTemplate).toHaveBeenCalledOnce();
    expect(mocks.deleteCsvTemplate).toHaveBeenCalledWith(TPL_ID);
  });

  it('success: reaches isSuccess state after deletion', async () => {
    mocks.deleteCsvTemplate.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteCsvTemplate(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(TPL_ID);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: re-throws when repo.deleteCsvTemplate rejects', async () => {
    mocks.deleteCsvTemplate.mockRejectedValue(new Error('TEMPLATE_NOT_FOUND'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteCsvTemplate(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(TPL_ID)).rejects.toThrow('TEMPLATE_NOT_FOUND');
    });
  });

  it('error: reaches isError=true after rejection', async () => {
    mocks.deleteCsvTemplate.mockRejectedValue(new Error('delete DB error'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteCsvTemplate(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync(TPL_ID); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('delete DB error');
  });
});
