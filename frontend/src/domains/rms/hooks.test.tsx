/**
 * FLOWTYM — RMS domain mutation tests.
 * Covers useUpdatePrice, useCascadeReferencePrice, useUpdateRestriction.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const { mockUpdatePrice, mockCascadeReferencePrice, mockUpdateRestriction } =
  vi.hoisted(() => ({
    mockUpdatePrice: vi.fn(),
    mockCascadeReferencePrice: vi.fn(),
    mockUpdateRestriction: vi.fn(),
  }));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/domains/rms/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./repository')>();
  return {
    ...actual,
    updatePrice: mockUpdatePrice,
    cascadeReferencePrice: mockCascadeReferencePrice,
    updateRestriction: mockUpdateRestriction,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOTEL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const fakePrice = {
  id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
  hotel_id: HOTEL_ID,
  rate_plan_id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
  stay_date: '2026-06-15',
  price: 220,
  currency: 'EUR',
  source: 'manual',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const fakeRestriction = {
  id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  hotel_id: HOTEL_ID,
  rate_plan_id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
  stay_date: '2026-06-15',
  cta: false,
  ctd: false,
  min_stay: null,
  max_stay: null,
  inventory_override: null,
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

import { useUpdatePrice, useCascadeReferencePrice, useUpdateRestriction } from './hooks';

describe('useUpdatePrice', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls repo.updatePrice with hotelId merged in', async () => {
    mockUpdatePrice.mockResolvedValue(fakePrice);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdatePrice(HOTEL_ID), { wrapper });

    let returned: typeof fakePrice | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: fakePrice.id, price: 220, version: 0 });
    });

    expect(returned).toEqual(fakePrice);
    expect(mockUpdatePrice).toHaveBeenCalledOnce();
    expect(mockUpdatePrice).toHaveBeenCalledWith(
      expect.objectContaining({ id: fakePrice.id, price: 220, hotelId: HOTEL_ID }),
    );
  });

  it('error: throws when hotelId is null', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdatePrice(null), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'some-id', price: 100, version: 0 }),
      ).rejects.toThrow('hotelId required');
    });
    expect(mockUpdatePrice).not.toHaveBeenCalled();
  });

  it('error: mutation reaches isError=true after repo rejects', async () => {
    mockUpdatePrice.mockRejectedValue(new Error('DB conflict'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdatePrice(HOTEL_ID), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'x', price: 100, version: 0 }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('DB conflict');
  });
});

describe('useCascadeReferencePrice', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls repo with hotelId, stayDate, and newPrice', async () => {
    mockCascadeReferencePrice.mockResolvedValue({ updated: 30 });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCascadeReferencePrice(HOTEL_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ stayDate: '2026-07-01', newPrice: 350 });
    });

    expect(mockCascadeReferencePrice).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      stayDate: '2026-07-01',
      newPrice: 350,
    });
  });

  it('error: throws when hotelId is null', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCascadeReferencePrice(null), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ stayDate: '2026-07-01', newPrice: 350 }),
      ).rejects.toThrow('hotelId required');
    });
  });

  it('error: isError=true when repo rejects', async () => {
    mockCascadeReferencePrice.mockRejectedValue(new Error('version conflict'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCascadeReferencePrice(HOTEL_ID), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ stayDate: '2026-07-01', newPrice: 350 }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateRestriction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls repo with hotelId and patch merged', async () => {
    mockUpdateRestriction.mockResolvedValue(fakeRestriction);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateRestriction(HOTEL_ID), { wrapper });

    let returned: typeof fakeRestriction | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        id: fakeRestriction.id,
        version: 1,
        patch: { cta: true, min_stay: 2 },
      });
    });

    expect(returned).toEqual(fakeRestriction);
    expect(mockUpdateRestriction).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelId: HOTEL_ID,
        id: fakeRestriction.id,
        patch: { cta: true, min_stay: 2 },
      }),
    );
  });

  it('error: throws when hotelId is null', async () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateRestriction(null), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'x', version: 0, patch: { cta: false } }),
      ).rejects.toThrow('hotelId required');
    });
    expect(mockUpdateRestriction).not.toHaveBeenCalled();
  });

  it('error: isError=true when repo rejects', async () => {
    mockUpdateRestriction.mockRejectedValue(new Error('RLS denied'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateRestriction(HOTEL_ID), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'x', version: 0, patch: {} }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
