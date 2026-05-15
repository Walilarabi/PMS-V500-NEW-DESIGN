/**
 * FLOWTYM — Users domain hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/domains/auth/AuthContext';
import {
  listUsers, setUserActive, setUserRole,
  listInvitations, createInvitation, revokeInvitation,
  updateSelfProfile, updateSelfPassword,
  type AppUserRow, type InvitationRow, type AppUserRole, type CreateInvitationInput,
  type SelfProfilePatch,
} from './repository';

const KEY = ['users'] as const;
const INV_KEY = ['user-invitations'] as const;

export function useUsers() {
  const { status } = useAuth();
  return useQuery<AppUserRow[]>({
    queryKey: [...KEY, 'list'],
    queryFn: listUsers,
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation<AppUserRow, Error, { id: string; isActive: boolean }>({
    mutationFn: ({ id, isActive }) => setUserActive(id, isActive),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation<AppUserRow, Error, { id: string; role: AppUserRole }>({
    mutationFn: ({ id, role }) => setUserRole(id, role),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useInvitations() {
  const { status } = useAuth();
  return useQuery<InvitationRow[]>({
    queryKey: [...INV_KEY, 'list'],
    queryFn: listInvitations,
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation<InvitationRow, Error, CreateInvitationInput>({
    mutationFn: async (input) => {
      if (!session?.tenantId) throw new Error('Hôtel actif inconnu');
      return createInvitation(session.tenantId, session.userId ?? null, input);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: INV_KEY }),
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation<InvitationRow, Error, string>({
    mutationFn: (id) => revokeInvitation(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: INV_KEY }),
  });
}


export function useUpdateSelfProfile() {
  const qc = useQueryClient();
  return useMutation<AppUserRow, Error, SelfProfilePatch>({
    mutationFn: (patch) => updateSelfProfile(patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSelfPassword() {
  return useMutation<void, Error, string>({
    mutationFn: (newPassword) => updateSelfPassword(newPassword),
  });
}
