/**
 * FLOWTYM — Audit log domain (read-only journal).
 */
import { z } from 'zod';

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  hotel_id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable(),
  entity: z.string(),
  entity_id: z.string().uuid(),
  action: z.string(),
  payload: z.unknown().nullable(),
  correlation_id: z.string().uuid().nullable(),
  created_at: z.string(),
}).passthrough();
export type AuditLog = z.infer<typeof auditLogSchema>;

export interface AuditFilters {
  entity?: string | null;
  action?: string | null;
  actorUserId?: string | null;
  fromDate?: string | null; // ISO
  toDate?: string | null;
  limit?: number;
}
