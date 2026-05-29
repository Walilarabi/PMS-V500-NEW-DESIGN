/**
 * FLOWTYM — Users domain mutation tests.
 * Covers useSetUserActive, useSetUserRole, useCreateInvitation,
 *         useRevokeInvitation, useUpdateSelfProfile, useUpdateSelfPassword.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── vi.hoisted ───────────────────────────────────────────────────────────────

const {
  mockSetUserActive, mockSetUserRole,
  mockCreateInvitation, mockRevokeInvitation,
  mockUpdateSelfProfile, mockUpdateSelfPassword,
} = vi.hoisted(() => ({
  mockSetUserActive: vi.fn(),
  mockSetUserRole: vi.fn(),
  mockCreateInvitation: vi.fn(),
  mockRevokeInvitation: vi.fn(),
  mockUpdateSelfProfile: vi.fn(),
  mockUpdateSelfPassword: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu' },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/domains/users/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./repository')>();
  return {
    ...actual,
    setUserActive: mockSetUserActive,
    setUserRole: mockSetUserRole,
    createInvitation: mockCreateInvitation,
    revokeInvitation: mockRevokeInvitation,
    updateSelfProfile: mockUpdateSelfProfile,
    updateSelfPassword: mockUpdateSelfPassword,
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

const fakeUser = {
  id: USER_ID,
  hotel_id: HOTEL_ID,
  auth_id: 'auth-uid',
  full_name: 'Alice Dupont',
  email: 'alice@example.com',
  role: 'reception',
  is_active: true,
  last_login_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

const fakeInvitation = {
  id: 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii',
  hotel_id: HOTEL_ID,
  email: 'bob@example.com',
  full_name: 'Bob Martin',
  role: 'reception',
  status: 'PENDING' as const,
  invited_by: USER_ID,
  invited_at: '2026-01-01T00:00:00Z',
  accepted_at: null,
  token: 'tok-abc',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

import {
  useSetUserActive, useSetUserRole,
  useCreateInvitation, useRevokeInvitation,
  useUpdateSelfProfile, useUpdateSelfPassword,
} from './hooks';

describe('useSetUserActive', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls setUserActive with id and isActive=true', async () => {
    mockSetUserActive.mockResolvedValue({ ...fakeUser, is_active: true });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSetUserActive(), { wrapper });

    let returned: typeof fakeUser | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: USER_ID, isActive: true });
    });

    expect(returned?.is_active).toBe(true);
    expect(mockSetUserActive).toHaveBeenCalledWith(USER_ID, true);
  });

  it('success: calls setUserActive with isActive=false to deactivate', async () => {
    mockSetUserActive.mockResolvedValue({ ...fakeUser, is_active: false });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSetUserActive(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: USER_ID, isActive: false });
    });

    expect(mockSetUserActive).toHaveBeenCalledWith(USER_ID, false);
  });

  it('error: isError=true when setUserActive rejects', async () => {
    mockSetUserActive.mockRejectedValue(new Error('RLS denied'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSetUserActive(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: USER_ID, isActive: false }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSetUserRole', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls setUserRole with id and role', async () => {
    mockSetUserRole.mockResolvedValue({ ...fakeUser, role: 'admin' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSetUserRole(), { wrapper });

    let returned: typeof fakeUser | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: USER_ID, role: 'admin' });
    });

    expect(returned?.role).toBe('admin');
    expect(mockSetUserRole).toHaveBeenCalledWith(USER_ID, 'admin');
  });

  it('error: isError=true when setUserRole rejects', async () => {
    mockSetUserRole.mockRejectedValue(new Error('not found'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useSetUserRole(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ id: USER_ID, role: 'direction' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateInvitation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: passes hotelId, userId, and input to createInvitation', async () => {
    mockCreateInvitation.mockResolvedValue(fakeInvitation);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateInvitation(), { wrapper });

    let returned: typeof fakeInvitation | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        email: 'bob@example.com',
        fullName: 'Bob Martin',
        role: 'reception',
      });
    });

    expect(returned).toEqual(fakeInvitation);
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      HOTEL_ID,
      USER_ID,
      expect.objectContaining({ email: 'bob@example.com', role: 'reception' }),
    );
  });

  it('error: isError=true when createInvitation rejects', async () => {
    mockCreateInvitation.mockRejectedValue(new Error('email already invited'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateInvitation(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ email: 'x@x.com', role: 'reception' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRevokeInvitation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls revokeInvitation with invitation id', async () => {
    mockRevokeInvitation.mockResolvedValue({ ...fakeInvitation, status: 'REVOKED' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRevokeInvitation(), { wrapper });

    let returned: typeof fakeInvitation | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(fakeInvitation.id);
    });

    expect(returned?.status).toBe('REVOKED');
    expect(mockRevokeInvitation).toHaveBeenCalledWith(fakeInvitation.id);
  });

  it('error: isError=true when revokeInvitation rejects', async () => {
    mockRevokeInvitation.mockRejectedValue(new Error('already revoked'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRevokeInvitation(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync('some-id'); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateSelfProfile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls updateSelfProfile with patch', async () => {
    mockUpdateSelfProfile.mockResolvedValue({ ...fakeUser, full_name: 'Alice Updated' });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateSelfProfile(), { wrapper });

    let returned: typeof fakeUser | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ full_name: 'Alice Updated' });
    });

    expect(returned?.full_name).toBe('Alice Updated');
    expect(mockUpdateSelfProfile).toHaveBeenCalledWith({ full_name: 'Alice Updated' });
  });

  it('error: isError=true when updateSelfProfile rejects', async () => {
    mockUpdateSelfProfile.mockRejectedValue(new Error('Session non authentifiée'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateSelfProfile(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync({ full_name: 'X' }); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Session non authentifiée');
  });
});

describe('useUpdateSelfPassword', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('success: calls updateSelfPassword with new password', async () => {
    mockUpdateSelfPassword.mockResolvedValue(undefined);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateSelfPassword(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('newSecurePassword123!');
    });

    expect(mockUpdateSelfPassword).toHaveBeenCalledWith('newSecurePassword123!');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('error: isError=true when updateSelfPassword rejects', async () => {
    mockUpdateSelfPassword.mockRejectedValue(new Error('password too weak'));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateSelfPassword(), { wrapper });

    await act(async () => {
      try { await result.current.mutateAsync('weak'); } catch { /* expected */ }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
