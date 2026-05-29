/**
 * FLOWTYM — Reservations domain mutation tests.
 *
 * Covers all mutations in frontend/src/domains/reservations/hooks.ts.
 * repository functions are mocked; no network access.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const {
  mockCreateReservation, mockUpdateStatus,
  mockCheckIn, mockCheckOut, mockCancelReservation, mockDeleteReservation,
  mockSupabaseFrom, mockSupabaseAuth,
} = vi.hoisted(() => ({
  mockCreateReservation:  vi.fn(),
  mockUpdateStatus:       vi.fn(),
  mockCheckIn:            vi.fn(),
  mockCheckOut:           vi.fn(),
  mockCancelReservation:  vi.fn(),
  mockDeleteReservation:  vi.fn(),
  mockSupabaseFrom:       vi.fn(),
  mockSupabaseAuth:       vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./repository', () => ({
  listReservations:           vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  getReservation:             vi.fn().mockResolvedValue(null),
  createReservation:          mockCreateReservation,
  updateReservationStatus:    mockUpdateStatus,
  checkInReservation:         mockCheckIn,
  checkOutReservation:        mockCheckOut,
  cancelReservation:          mockCancelReservation,
  deleteReservation:          mockDeleteReservation,
}));

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: mockSupabaseFrom,
    auth: { getUser: mockSupabaseAuth },
  },
}));

const HOTEL_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: HOTEL_ID },
    status: 'authenticated',
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const fakeReservation = {
  id: 'res-0001',
  hotel_id: HOTEL_ID,
  room_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  room_number: '101',
  guest_id: null,
  guest_name: 'Alice Dupont',
  guest_email: 'alice@example.com',
  guest_phone: null,
  check_in: '2026-06-01',
  check_out: '2026-06-04',
  nights: 3,
  adults: 2,
  children: 0,
  pax: 2,
  status: 'confirmed',
  source: 'direct',
  total_amount: 450,
  room_type: 'DBL',
  room_category: 'CL',
  notes: null,
  reference: 'REF-001',
  meal_plan: 'RO',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  version: 1,
};

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  useCreateReservation, useUpdateReservationStatus,
  useCheckIn, useCheckOut, useCancelReservation, useDeleteReservation,
} from './hooks';

// ─── useCreateReservation ─────────────────────────────────────────────────────

describe('useCreateReservation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: returns new reservation with hotelId from session', async () => {
    mockCreateReservation.mockResolvedValue(fakeReservation);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateReservation(), { wrapper });

    let returned: typeof fakeReservation | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        reference: 'REF-001',
        roomId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        guestName: 'Alice Dupont',
        guestEmail: 'alice@example.com',
        checkIn: '2026-06-01',
        checkOut: '2026-06-04',
        adults: 2,
        children: 0,
        source: 'DIRECT',
        totalAmount: 450,
      });
    });

    expect(returned).toEqual(fakeReservation);
    expect(mockCreateReservation).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ guestName: 'Alice Dupont', checkIn: '2026-06-01' }),
    );
  });

  it('error: sets isError when createReservation rejects', async () => {
    mockCreateReservation.mockRejectedValue(new Error('room already booked'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateReservation(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          reference: 'REF-002',
          roomId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', guestName: 'Bob', guestEmail: null,
          checkIn: '2026-06-01', checkOut: '2026-06-02',
          adults: 1, children: 0, source: 'DIRECT', totalAmount: 150,
        });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('room already booked');
  });
});

// ─── useUpdateReservationStatus ───────────────────────────────────────────────

describe('useUpdateReservationStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: updates status and returns updated reservation', async () => {
    const updated = { ...fakeReservation, status: 'checked_in', version: 2 };
    mockUpdateStatus.mockResolvedValue(updated);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateReservationStatus(), { wrapper });

    let returned: typeof updated | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: 'res-0001', status: 'checked_in', expectedVersion: 1 });
    });

    expect(returned?.status).toBe('checked_in');
    expect(mockUpdateStatus).toHaveBeenCalledWith('res-0001', 'checked_in', 1);
  });

  it('error: sets isError on optimistic lock violation', async () => {
    mockUpdateStatus.mockRejectedValue(new Error('version_conflict'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateReservationStatus(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'res-0001', status: 'checked_in', expectedVersion: 0 }); }
      catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useCheckIn ───────────────────────────────────────────────────────────────

describe('useCheckIn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: checks in and returns checked_in reservation', async () => {
    const checkedIn = { ...fakeReservation, status: 'checked_in', version: 2 };
    mockCheckIn.mockResolvedValue(checkedIn);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCheckIn(), { wrapper });

    let returned: typeof checkedIn | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: 'res-0001', expectedVersion: 1 });
    });

    expect(returned?.status).toBe('checked_in');
    expect(mockCheckIn).toHaveBeenCalledWith('res-0001', 1);
  });

  it('error: sets isError when checkIn rejects', async () => {
    mockCheckIn.mockRejectedValue(new Error('already checked in'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCheckIn(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'res-0001', expectedVersion: 1 }); }
      catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useCheckOut ──────────────────────────────────────────────────────────────

describe('useCheckOut', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: checks out and returns checked_out reservation', async () => {
    const checkedOut = { ...fakeReservation, status: 'checked_out', version: 3 };
    mockCheckOut.mockResolvedValue(checkedOut);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCheckOut(), { wrapper });

    let returned: typeof checkedOut | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: 'res-0001', expectedVersion: 2 });
    });

    expect(returned?.status).toBe('checked_out');
    expect(mockCheckOut).toHaveBeenCalledWith('res-0001', 2);
  });

  it('error: sets isError when checkOut rejects', async () => {
    mockCheckOut.mockRejectedValue(new Error('not checked in'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCheckOut(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: 'res-0001', expectedVersion: 1 }); }
      catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useCancelReservation ─────────────────────────────────────────────────────

describe('useCancelReservation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: cancels reservation with reason', async () => {
    const cancelled = { ...fakeReservation, status: 'cancelled', version: 2 };
    mockCancelReservation.mockResolvedValue(cancelled);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCancelReservation(), { wrapper });

    let returned: typeof cancelled | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        id: 'res-0001', reason: 'guest_request', expectedVersion: 1,
      });
    });

    expect(returned?.status).toBe('cancelled');
    expect(mockCancelReservation).toHaveBeenCalledWith('res-0001', 'guest_request', 1);
  });

  it('error: sets isError when cancel rejects', async () => {
    mockCancelReservation.mockRejectedValue(new Error('cannot cancel checked-in reservation'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCancelReservation(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'res-0001', reason: 'test', expectedVersion: 1 });
      } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useDeleteReservation ─────────────────────────────────────────────────────

describe('useDeleteReservation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success: deletes reservation and completes', async () => {
    mockDeleteReservation.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteReservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('res-0001');
    });

    expect(mockDeleteReservation).toHaveBeenCalledWith('res-0001');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: sets isError when delete rejects', async () => {
    mockDeleteReservation.mockRejectedValue(new Error('FK constraint'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteReservation(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync('res-0001'); }
      catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
