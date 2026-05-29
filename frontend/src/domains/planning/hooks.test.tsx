/**
 * FLOWTYM — Planning domain mutation tests.
 * Covers useCreateChannel, useUpdateChannel, useDeleteChannel,
 *         useCreateEvent, useUpdateEvent, useDeleteEvent.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const {
  mockCreateChannel, mockUpdateChannel, mockDeleteChannel,
  mockCreateEvent, mockUpdateEvent, mockDeleteEvent,
} = vi.hoisted(() => ({
  mockCreateChannel: vi.fn(),
  mockUpdateChannel: vi.fn(),
  mockDeleteChannel: vi.fn(),
  mockCreateEvent: vi.fn(),
  mockUpdateEvent: vi.fn(),
  mockDeleteEvent: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/domains/planning/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./repository')>();
  return {
    ...actual,
    createChannel: mockCreateChannel,
    updateChannel: mockUpdateChannel,
    deleteChannel: mockDeleteChannel,
    createEvent: mockCreateEvent,
    updateEvent: mockUpdateEvent,
    deleteEvent: mockDeleteEvent,
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

const fakeChannel = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  hotel_id: HOTEL_ID,
  code: 'BOOKING',
  name: 'Booking.com',
  color: '#0066CC',
  position: 0,
  active: true,
};

const fakeEvent = {
  id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  hotel_id: HOTEL_ID,
  name: 'Fête de la Musique',
  start_date: '2026-06-21',
  end_date: '2026-06-21',
  impact: 'high' as const,
  description: null,
  source: null,
  location: 'Paris',
};

// ─── Channel tests ────────────────────────────────────────────────────────────

import {
  useCreateChannel, useUpdateChannel, useDeleteChannel,
  useCreateEvent, useUpdateEvent, useDeleteEvent,
} from './hooks';

describe('useCreateChannel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: passes hotelId and input to createChannel', async () => {
    mockCreateChannel.mockResolvedValue(fakeChannel);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateChannel(), { wrapper });

    let returned: typeof fakeChannel | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        code: 'BOOKING', name: 'Booking.com', color: '#0066CC',
      });
    });

    expect(returned).toEqual(fakeChannel);
    expect(mockCreateChannel).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ code: 'BOOKING', name: 'Booking.com' }),
    );
  });

  it('error: isError=true when createChannel rejects', async () => {
    mockCreateChannel.mockRejectedValue(new Error('unique constraint'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateChannel(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ code: 'X', name: 'X', color: '#000' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateChannel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls updateChannel with id and patch', async () => {
    mockUpdateChannel.mockResolvedValue({ ...fakeChannel, name: 'Booking' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateChannel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: fakeChannel.id, patch: { name: 'Booking' } });
    });

    expect(mockUpdateChannel).toHaveBeenCalledWith(fakeChannel.id, { name: 'Booking' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when updateChannel rejects', async () => {
    mockUpdateChannel.mockRejectedValue(new Error('not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateChannel(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'x', patch: { active: false } }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteChannel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls deleteChannel with the id', async () => {
    mockDeleteChannel.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteChannel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(fakeChannel.id);
    });

    expect(mockDeleteChannel).toHaveBeenCalledWith(fakeChannel.id);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when deleteChannel rejects', async () => {
    mockDeleteChannel.mockRejectedValue(new Error('RLS denied'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteChannel(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync('some-id'); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── Event tests ──────────────────────────────────────────────────────────────

describe('useCreateEvent', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: passes hotelId and input to createEvent', async () => {
    mockCreateEvent.mockResolvedValue(fakeEvent);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateEvent(), { wrapper });

    let returned: typeof fakeEvent | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        name: 'Fête de la Musique',
        start_date: '2026-06-21',
        end_date: '2026-06-21',
        impact: 'high',
      });
    });

    expect(returned).toEqual(fakeEvent);
    expect(mockCreateEvent).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ name: 'Fête de la Musique', impact: 'high' }),
    );
  });

  it('error: isError=true when createEvent rejects', async () => {
    mockCreateEvent.mockRejectedValue(new Error('validation failed'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateEvent(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ name: 'X', start_date: '2026-06-21', end_date: '2026-06-21', impact: 'low' });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateEvent', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls updateEvent with id and patch', async () => {
    mockUpdateEvent.mockResolvedValue({ ...fakeEvent, impact: 'critical' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateEvent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: fakeEvent.id, patch: { impact: 'critical' } });
    });

    expect(mockUpdateEvent).toHaveBeenCalledWith(fakeEvent.id, { impact: 'critical' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when updateEvent rejects', async () => {
    mockUpdateEvent.mockRejectedValue(new Error('not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateEvent(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'x', patch: { impact: 'low' } }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteEvent', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls deleteEvent with the id', async () => {
    mockDeleteEvent.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteEvent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(fakeEvent.id);
    });

    expect(mockDeleteEvent).toHaveBeenCalledWith(fakeEvent.id);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when deleteEvent rejects', async () => {
    mockDeleteEvent.mockRejectedValue(new Error('RLS denied'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteEvent(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync('some-id'); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
