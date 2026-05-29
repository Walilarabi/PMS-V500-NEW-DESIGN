/**
 * FLOWTYM — Hotel domain mutation tests.
 * Covers useUpdateHotel, useUpdateRoom, useCreateRoom, useDeleteRoom.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const { mockFrom, mockSupabaseAuthGetUser, mockUseAuth } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSupabaseAuthGetUser: vi.fn(),
  mockUseAuth: vi.fn(() => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    status: 'authenticated' as const,
  })),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: { getUser: mockSupabaseAuthGetUser },
  },
}));

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOTEL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ROOM_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function makeChain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  // delete().eq() resolves directly
  chain.eq.mockResolvedValue(result);
  chain.delete.mockReturnValue({ eq: vi.fn().mockResolvedValue(result) });
  chain.update.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(result) }),
    }),
  });
  chain.insert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(result) }) });
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

import { useUpdateHotel, useUpdateRoom, useCreateRoom, useDeleteRoom } from './hooks';

describe('useUpdateHotel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls supabase.from("hotels").update().eq() and resolves', async () => {
    const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockFrom.mockReturnValue({ update: updateFn });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateHotel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Hôtel Test' });
    });

    expect(mockFrom).toHaveBeenCalledWith('hotels');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: throws when session has no tenantId', async () => {
    mockUseAuth.mockReturnValueOnce({ session: null, status: 'authenticated' as const });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateHotel(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ name: 'X' })).rejects.toThrow('No active hotel');
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('error: isError=true when supabase returns an error', async () => {
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'DB error', code: '42000' } }),
    });
    mockFrom.mockReturnValue({ update: updateFn });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateHotel(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ name: 'X' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateRoom', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls supabase.from("rooms").update() with patch and id', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    mockFrom.mockReturnValue({ update: updateFn });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateRoom(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: ROOM_ID, patch: { type: 'Deluxe' } });
    });

    expect(mockFrom).toHaveBeenCalledWith('rooms');
    expect(updateFn).toHaveBeenCalledWith({ type: 'Deluxe' });
    expect(eqFn).toHaveBeenCalledWith('id', ROOM_ID);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when supabase returns an error', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'not found', code: '42000' } });
    mockFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqFn }) });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateRoom(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: ROOM_ID, patch: { type: 'Suite' } }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateRoom', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls supabase.from("rooms").insert() with room data', async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: insertFn });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateRoom(), { wrapper });

    const newRoom = { hotel_id: HOTEL_ID, number: '101', type: 'Standard', active: true };
    await act(async () => {
      await result.current.mutateAsync(newRoom);
    });

    expect(mockFrom).toHaveBeenCalledWith('rooms');
    expect(insertFn).toHaveBeenCalledWith(newRoom);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when supabase returns an error', async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: { message: 'unique violation', code: '23505' } });
    mockFrom.mockReturnValue({ insert: insertFn });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateRoom(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ number: '101' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteRoom', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls supabase.from("rooms").delete().eq("id", id)', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqFn });
    mockFrom.mockReturnValue({ delete: deleteFn });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteRoom(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(ROOM_ID);
    });

    expect(mockFrom).toHaveBeenCalledWith('rooms');
    expect(deleteFn).toHaveBeenCalled();
    expect(eqFn).toHaveBeenCalledWith('id', ROOM_ID);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when supabase returns an error', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'RLS denied', code: '42501' } });
    mockFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqFn }) });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteRoom(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync(ROOM_ID); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
