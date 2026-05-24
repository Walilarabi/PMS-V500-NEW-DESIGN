/**
 * FLOWTYM — Hook useAuditLogger.
 *
 * Wrapper autour de `logAudit` qui injecte automatiquement l'acteur
 * (userId, email, role) depuis useAuth.session — évite la duplication
 * dans chaque page consommatrice.
 *
 * Utilisation :
 *   const audit = useAuditLogger();
 *   audit({ action: 'user_created', module: 'security_backups',
 *           detail: 'Sarah B. ajoutée', meta: { userId: 'u_42' } });
 */
import { useCallback } from 'react';
import { useAuth } from '@/src/domains/auth/AuthContext';
import {
  logAudit,
  type AuditEntry,
  type AuditSeverity,
} from '@/src/services/settings/settingsAuditLogger';

type LogPayload = Omit<AuditEntry, 'id' | 'at' | 'severity' | 'actor'> & {
  severity?: AuditSeverity;
};

export function useAuditLogger() {
  const auth = useAuth();
  return useCallback(
    (payload: LogPayload): AuditEntry => {
      const actor = auth.session
        ? {
            userId: auth.session.userId ?? null,
            email: auth.session.email ?? null,
            role: auth.session.role ?? null,
          }
        : undefined;
      return logAudit({ ...payload, actor });
    },
    [auth.session],
  );
}
