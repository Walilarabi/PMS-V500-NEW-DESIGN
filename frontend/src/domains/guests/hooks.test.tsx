/**
 * FLOWTYM — Guests domain hook mutation tests.
 *
 * Covers useCreateGuest from frontend/src/domains/guests/hooks.ts.
 *
 * Strategy:
 *   - Mock @/src/lib/supabase (no network)
 *   - Mock repository.findOrCreateGuest to control outcome
 *   - Mock AuthContext with a stable session
 *   - Fresh QueryClient per test via makeWrapper()
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const { mockFindOrCreateGuest, mockSupabaseAuthGetUser, mockSupabaseFrom } =
  vi.hoisted(() => ({
    mockFindOrCreateGuest: vi.fn(),
    mockSupabaseAuthGetUser: vi.fn(),
    mockSupabaseFrom: vi.fn(),
  }));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: mockSupabaseFrom,
    auth: { getUser: mockSupabaseAuthGetUser },
  },
}));

vi.mock('@/src/domains/guests/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./repository')>();
  return { ...actual, findOrCreateGuest: mockFindOrCreateGuest };
});

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    status: 'authenticated',
  }),
}));

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

const fakeGuest = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  hotel_id: HOTEL_ID,
  legacy_id: 1,
  first_name: 'Alice',
  last_name: 'Dupont',
  email: 'alice@example.com',
  phone: null,
  country: null,
  nationality: 'FR',
  passport: null,
  date_of_birth: null,
  address: null,
  city: null,
  zip: null,
  language: null,
  segment: 'Leisure',
  loyalty_level: null,
  total_spent: null,
  total_stays: null,
  id_verified: null,
  gdpr_consent: null,
  gdpr_date: null,
  blacklisted: null,
  notes: null,
  tags: null,
  gender: null,
  whatsapp: null,
  social_links: null,
  photo_url: null,
  profession: null,
  employer: null,
  job_title: null,
  visa: null,
  doc_expiry_date: null,
  languages: null,
  acquisition_source: null,
  vip: false,
  risk_level: 'none',
  satisfaction_score: null,
  ai_scores: null,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

import { useCreateGuest } from './hooks';

describe('useCreateGuest', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: returns the new guest from findOrCreateGuest', async () => {
    mockFindOrCreateGuest.mockResolvedValue(fakeGuest);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateGuest(), { wrapper });

    let returned: typeof fakeGuest | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        fullName: 'Alice Dupont',
        email: 'alice@example.com',
        nationality: 'FR',
        segment: 'Leisure',
      });
    });

    expect(returned).toEqual(fakeGuest);
    expect(mockFindOrCreateGuest).toHaveBeenCalledOnce();
    expect(mockFindOrCreateGuest).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelId: HOTEL_ID,
        fullName: 'Alice Dupont',
        email: 'alice@example.com',
        nationality: 'FR',
        segment: 'Leisure',
      }),
    );
  });

  it('success: passes null for optional fields when they are omitted', async () => {
    mockFindOrCreateGuest.mockResolvedValue({ ...fakeGuest, email: null, phone: null });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateGuest(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ fullName: 'Bob Martin' });
    });

    expect(mockFindOrCreateGuest).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelId: HOTEL_ID,
        fullName: 'Bob Martin',
        email: null,
        phone: null,
        nationality: null,
        segment: null,
      }),
    );
  });

  it('success: mutation reaches isSuccess=true after resolving', async () => {
    mockFindOrCreateGuest.mockResolvedValue(fakeGuest);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateGuest(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ fullName: 'Alice Dupont' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fakeGuest);
  });

  it('error: re-throws when findOrCreateGuest rejects', async () => {
    const boom = new Error('unique_violation: duplicate email');
    mockFindOrCreateGuest.mockRejectedValue(boom);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateGuest(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ fullName: 'Alice Dupont', email: 'alice@example.com' }),
      ).rejects.toThrow('unique_violation: duplicate email');
    });
  });

  it('error: mutation reaches isError=true after rejecting', async () => {
    mockFindOrCreateGuest.mockRejectedValue(new Error('DB error'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateGuest(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ fullName: 'Alice Dupont' });
      } catch {
        // expected — we want to check mutation state below
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('DB error');
  });
});
