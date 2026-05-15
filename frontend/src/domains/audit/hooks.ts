/**
 * FLOWTYM — Audit log TanStack hooks.
 */
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/src/domains/auth/AuthContext';
import { listAuditActors, listAuditEntities, listAuditLogs, type AuditActor } from './repository';
import type { AuditFilters, AuditLog } from './schemas';

const KEY = ['audit'] as const;

export function useAuditLogs(filters: AuditFilters) {
  const { status } = useAuth();
  return useQuery<AuditLog[]>({
    queryKey: [...KEY, 'list', filters],
    queryFn: () => listAuditLogs(filters),
    enabled: status === 'authenticated',
    staleTime: 10_000,
  });
}

export function useAuditEntities() {
  const { status } = useAuth();
  return useQuery<{ entity: string; n: number }[]>({
    queryKey: [...KEY, 'entities'],
    queryFn: listAuditEntities,
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

export function useAuditActors() {
  const { status } = useAuth();
  return useQuery<AuditActor[]>({
    queryKey: [...KEY, 'actors'],
    queryFn: listAuditActors,
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}
