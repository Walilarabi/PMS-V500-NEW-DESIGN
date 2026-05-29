/**
 * FLOWTYM — SAS domain mutation tests.
 * Covers useCreateIncoming, useUpdateIncomingStatus, useReleaseQuarantine,
 *         useCreateDispute, useUpdateDisputeStatus, useAddDisputeMessage.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const {
  mockCreateIncoming, mockUpdateIncomingStatus, mockReleaseQuarantine,
  mockCreateDispute, mockUpdateDisputeStatus, mockAddDisputeMessage,
} = vi.hoisted(() => ({
  mockCreateIncoming: vi.fn(),
  mockUpdateIncomingStatus: vi.fn(),
  mockReleaseQuarantine: vi.fn(),
  mockCreateDispute: vi.fn(),
  mockUpdateDisputeStatus: vi.fn(),
  mockAddDisputeMessage: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu' },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/domains/sas/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./repository')>();
  return {
    ...actual,
    createIncoming: mockCreateIncoming,
    updateIncomingStatus: mockUpdateIncomingStatus,
    releaseQuarantine: mockReleaseQuarantine,
    createDispute: mockCreateDispute,
    updateDisputeStatus: mockUpdateDisputeStatus,
    addDisputeMessage: mockAddDisputeMessage,
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

const fakeIncoming = {
  id: 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii',
  hotel_id: HOTEL_ID,
  partner_id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
  status: 'PENDING',
  created_at: '2026-01-01T00:00:00Z',
};

const fakeDispute = {
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  hotel_id: HOTEL_ID,
  status: 'DRAFT',
  created_at: '2026-01-01T00:00:00Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

import {
  useCreateIncoming, useUpdateIncomingStatus, useReleaseQuarantine,
  useCreateDispute, useUpdateDisputeStatus, useAddDisputeMessage,
} from './hooks';

describe('useCreateIncoming', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls createIncoming with tenantId and input', async () => {
    mockCreateIncoming.mockResolvedValue(fakeIncoming);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateIncoming(), { wrapper });

    let returned: typeof fakeIncoming | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        partner_id: fakeIncoming.partner_id,
        check_in: '2026-06-15',
        check_out: '2026-06-16',
        guest_name: 'Alice Dupont',
        total_amount: 200,
        currency: 'EUR',
      } as never);
    });

    expect(returned).toEqual(fakeIncoming);
    expect(mockCreateIncoming).toHaveBeenCalledWith(HOTEL_ID, expect.any(Object));
  });

  it('error: isError=true when createIncoming rejects', async () => {
    mockCreateIncoming.mockRejectedValue(new Error('validation failed'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateIncoming(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({} as never); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateIncomingStatus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls updateIncomingStatus with id, status, and optional args', async () => {
    mockUpdateIncomingStatus.mockResolvedValue({ ...fakeIncoming, status: 'VALIDATED' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateIncomingStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: fakeIncoming.id, status: 'VALIDATED', score: 95 });
    });

    expect(mockUpdateIncomingStatus).toHaveBeenCalledWith(fakeIncoming.id, 'VALIDATED', 95, undefined);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when updateIncomingStatus rejects', async () => {
    mockUpdateIncomingStatus.mockRejectedValue(new Error('not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateIncomingStatus(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'x', status: 'REJECTED' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useReleaseQuarantine', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls releaseQuarantine with id, userId, and note', async () => {
    mockReleaseQuarantine.mockResolvedValue(fakeIncoming);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useReleaseQuarantine(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: fakeIncoming.id, note: 'Approved by manager' });
    });

    expect(mockReleaseQuarantine).toHaveBeenCalledWith(fakeIncoming.id, USER_ID, 'Approved by manager');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when releaseQuarantine rejects', async () => {
    mockReleaseQuarantine.mockRejectedValue(new Error('already released'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useReleaseQuarantine(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'x', note: 'ok' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateDispute', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls createDispute with tenantId and input', async () => {
    mockCreateDispute.mockResolvedValue(fakeDispute);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateDispute(), { wrapper });

    let returned: typeof fakeDispute | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        partner_id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
        type: 'COMMERCIAL',
        description: 'Dispute about invoice',
        amount: 500,
        currency: 'EUR',
      } as never);
    });

    expect(returned).toEqual(fakeDispute);
    expect(mockCreateDispute).toHaveBeenCalledWith(HOTEL_ID, expect.any(Object));
  });

  it('error: isError=true when createDispute rejects', async () => {
    mockCreateDispute.mockRejectedValue(new Error('RLS denied'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateDispute(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({} as never); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateDisputeStatus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls updateDisputeStatus with tenantId, id, and newStatus', async () => {
    mockUpdateDisputeStatus.mockResolvedValue({ ...fakeDispute, status: 'OPEN' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateDisputeStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: fakeDispute.id, newStatus: 'OPEN' as never, reason: 'Evidence received' });
    });

    expect(mockUpdateDisputeStatus).toHaveBeenCalledWith(
      HOTEL_ID, fakeDispute.id, 'OPEN', 'Evidence received', USER_ID,
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when updateDisputeStatus rejects', async () => {
    mockUpdateDisputeStatus.mockRejectedValue(new Error('Invalid status transition'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateDisputeStatus(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'x', newStatus: 'CLOSED' as never }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAddDisputeMessage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls addDisputeMessage with tenantId, disputeId, direction, content, userId', async () => {
    mockAddDisputeMessage.mockResolvedValue({ id: 'mmm', content: 'Message sent' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddDisputeMessage(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        disputeId: fakeDispute.id,
        direction: 'OUTBOUND',
        content: 'Dear partner, please review our claim.',
      });
    });

    expect(mockAddDisputeMessage).toHaveBeenCalledWith(
      HOTEL_ID,
      fakeDispute.id,
      'OUTBOUND',
      'Dear partner, please review our claim.',
      USER_ID,
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when addDisputeMessage rejects', async () => {
    mockAddDisputeMessage.mockRejectedValue(new Error('dispute closed'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useAddDisputeMessage(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ disputeId: 'x', direction: 'INTERNAL', content: 'test' });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
