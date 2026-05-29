/**
 * FLOWTYM — RIE domain mutation tests.
 * Covers useRunValidation and useResolveQuarantine.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const { mockPersistValidation, mockResolveQuarantine, mockLoadConfiguration } =
  vi.hoisted(() => ({
    mockPersistValidation: vi.fn(),
    mockResolveQuarantine: vi.fn(),
    mockLoadConfiguration: vi.fn(),
  }));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu' },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/domains/rie/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./repository')>();
  return {
    ...actual,
    persistValidation: mockPersistValidation,
    resolveQuarantine: mockResolveQuarantine,
    loadConfiguration: mockLoadConfiguration,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOTEL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const fakeConfig = {
  partners: [],
  paymentModels: [],
  commissions: [],
  promotions: [],
  scoringRules: [],
  currencyRates: [],
};

const fakePayload = {
  reservationId: 'res-001',
  guestName: 'Alice Dupont',
  checkIn: '2026-06-15',
  checkOut: '2026-06-16',
  roomType: 'Standard',
  totalAmount: 200,
  source: 'OTA_BOOKING',
};

const fakeOutcome = {
  status: 'APPROVED' as const,
  anomalies: [],
  score: 100,
  checks: [],
};

const fakePersisted = { id: 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv' };

// ─── Tests ────────────────────────────────────────────────────────────────────

import { useRunValidation, useResolveQuarantine } from './hooks';

function makeWrapperWithConfig() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Pre-seed the RIE configuration so useRunValidation doesn't guard-throw
  qc.setQueryData(['rie', 'config'], fakeConfig);
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useRunValidation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: validates payload and persists result', async () => {
    mockPersistValidation.mockResolvedValue(fakePersisted);
    const wrapper = makeWrapperWithConfig();
    const { result } = renderHook(() => useRunValidation(), { wrapper });

    let returned: { outcome: typeof fakeOutcome; persisted: typeof fakePersisted } | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        payload: fakePayload as never,
        reservationId: 'res-001',
      });
    });

    expect(returned?.persisted).toEqual(fakePersisted);
    expect(mockPersistValidation).toHaveBeenCalledWith(
      HOTEL_ID,
      fakePayload,
      expect.any(Object),
      'res-001',
    );
  });

  it('error: isError=true when persistValidation rejects', async () => {
    mockPersistValidation.mockRejectedValue(new Error('DB error'));
    const wrapper = makeWrapperWithConfig();
    const { result } = renderHook(() => useRunValidation(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ payload: fakePayload as never, reservationId: null });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useResolveQuarantine', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls resolveQuarantine with id, status, reason, userId', async () => {
    mockResolveQuarantine.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useResolveQuarantine(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq',
        status: 'APPROVED',
        reason: 'Validated by manager',
      });
    });

    expect(mockResolveQuarantine).toHaveBeenCalledWith(
      'qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq',
      'APPROVED',
      'Validated by manager',
      USER_ID,
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('success: REJECTED status is passed correctly', async () => {
    mockResolveQuarantine.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useResolveQuarantine(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq',
        status: 'REJECTED',
        reason: 'Invalid data',
      });
    });

    expect(mockResolveQuarantine).toHaveBeenCalledWith(
      expect.any(String),
      'REJECTED',
      'Invalid data',
      USER_ID,
    );
  });

  it('error: isError=true when resolveQuarantine rejects', async () => {
    mockResolveQuarantine.mockRejectedValue(new Error('Not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useResolveQuarantine(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'x', status: 'APPROVED', reason: 'ok' });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Not found');
  });
});
