/**
 * FLOWTYM — ODMS domain mutation tests.
 * Covers useCreateDispute, useChangeDisputeStatus, useMarkReminderSent,
 *         useSkipReminder, useSendReminderEmail, useToggleDisputeAutoSendPause.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const {
  mockCreateDispute, mockChangeDisputeStatus,
  mockMarkReminderSent, mockSkipReminder,
  mockSendReminderEmail, mockSetDisputeAutoSendPaused,
} = vi.hoisted(() => ({
  mockCreateDispute: vi.fn(),
  mockChangeDisputeStatus: vi.fn(),
  mockMarkReminderSent: vi.fn(),
  mockSkipReminder: vi.fn(),
  mockSendReminderEmail: vi.fn(),
  mockSetDisputeAutoSendPaused: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu' },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/domains/odms/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./repository')>();
  return {
    ...actual,
    createDispute: mockCreateDispute,
    changeDisputeStatus: mockChangeDisputeStatus,
    setDisputeAutoSendPaused: mockSetDisputeAutoSendPaused,
  };
});

vi.mock('@/src/domains/odms/reminders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./reminders')>();
  return {
    ...actual,
    markReminderSent: mockMarkReminderSent,
    skipReminder: mockSkipReminder,
    sendReminderEmail: mockSendReminderEmail,
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

const fakeDispute = {
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  hotel_id: HOTEL_ID,
  reservation_id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
  platform: 'BOOKING' as const,
  status: 'OPEN' as const,
  reason: 'no_show' as const,
  amount_disputed: 200,
  currency: 'EUR',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const fakeReminder = {
  id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  dispute_id: fakeDispute.id,
  scheduled_at: '2026-01-02T10:00:00Z',
  status: 'PENDING' as const,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

import {
  useCreateDispute, useChangeDisputeStatus,
  useMarkReminderSent, useSkipReminder,
  useSendReminderEmail, useToggleDisputeAutoSendPause,
} from './hooks';

describe('useCreateDispute', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: passes hotelId, userId, and input to createDispute', async () => {
    mockCreateDispute.mockResolvedValue(fakeDispute);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateDispute(), { wrapper });

    let returned: typeof fakeDispute | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        reservationId: fakeDispute.reservation_id,
        platform: 'BOOKING',
        reason: 'no_show',
        amountDisputed: 200,
        currency: 'EUR',
      } as never);
    });

    expect(returned).toEqual(fakeDispute);
    expect(mockCreateDispute).toHaveBeenCalledWith(
      HOTEL_ID,
      USER_ID,
      expect.any(Object),
    );
  });

  it('error: isError=true when createDispute rejects', async () => {
    mockCreateDispute.mockRejectedValue(new Error('DB error'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateDispute(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ platform: 'BOOKING', reason: 'no_show' } as never); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useChangeDisputeStatus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls changeDisputeStatus with all args', async () => {
    mockChangeDisputeStatus.mockResolvedValue({ ...fakeDispute, status: 'ACCEPTED' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChangeDisputeStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        disputeId: fakeDispute.id,
        from: 'OPEN',
        to: 'ACCEPTED',
        reason: 'Evidence provided',
      } as never);
    });

    expect(mockChangeDisputeStatus).toHaveBeenCalledWith(
      fakeDispute.id,
      HOTEL_ID,
      'OPEN',
      'ACCEPTED',
      'Evidence provided',
      USER_ID,
      null,
    );
  });

  it('error: isError=true when changeDisputeStatus rejects', async () => {
    mockChangeDisputeStatus.mockRejectedValue(new Error('Invalid transition'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useChangeDisputeStatus(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ disputeId: 'x', from: 'OPEN', to: 'CLOSED', reason: 'x' } as never);
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useMarkReminderSent', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls markReminderSent with id', async () => {
    mockMarkReminderSent.mockResolvedValue({ ...fakeReminder, status: 'SENT' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useMarkReminderSent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(fakeReminder.id);
    });

    expect(mockMarkReminderSent).toHaveBeenCalledWith(fakeReminder.id);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when markReminderSent rejects', async () => {
    mockMarkReminderSent.mockRejectedValue(new Error('not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useMarkReminderSent(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync('some-id'); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSkipReminder', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls skipReminder with id', async () => {
    mockSkipReminder.mockResolvedValue({ ...fakeReminder, status: 'SKIPPED' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSkipReminder(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(fakeReminder.id);
    });

    expect(mockSkipReminder).toHaveBeenCalledWith(fakeReminder.id);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when skipReminder rejects', async () => {
    mockSkipReminder.mockRejectedValue(new Error('already sent'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSkipReminder(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync('some-id'); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSendReminderEmail', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls sendReminderEmail with id', async () => {
    mockSendReminderEmail.mockResolvedValue({ sent: true, messageId: 'msg-001' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSendReminderEmail(), { wrapper });

    let returned: { sent: boolean; messageId: string } | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(fakeReminder.id);
    });

    expect(returned?.sent).toBe(true);
    expect(mockSendReminderEmail).toHaveBeenCalledWith(fakeReminder.id);
  });

  it('error: isError=true when sendReminderEmail rejects', async () => {
    mockSendReminderEmail.mockRejectedValue(new Error('SMTP error'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSendReminderEmail(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync('some-id'); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useToggleDisputeAutoSendPause', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls setDisputeAutoSendPaused with id and paused=true', async () => {
    mockSetDisputeAutoSendPaused.mockResolvedValue({ ...fakeDispute, auto_send_paused: true });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useToggleDisputeAutoSendPause(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: fakeDispute.id, paused: true });
    });

    expect(mockSetDisputeAutoSendPaused).toHaveBeenCalledWith(fakeDispute.id, true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('success: calls setDisputeAutoSendPaused with paused=false to resume', async () => {
    mockSetDisputeAutoSendPaused.mockResolvedValue({ ...fakeDispute, auto_send_paused: false });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useToggleDisputeAutoSendPause(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: fakeDispute.id, paused: false });
    });

    expect(mockSetDisputeAutoSendPaused).toHaveBeenCalledWith(fakeDispute.id, false);
  });

  it('error: isError=true when setDisputeAutoSendPaused rejects', async () => {
    mockSetDisputeAutoSendPaused.mockRejectedValue(new Error('RLS denied'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useToggleDisputeAutoSendPause(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'x', paused: true }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
