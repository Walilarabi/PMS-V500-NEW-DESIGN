/**
 * FLOWTYM — Users domain (direction view).
 */
import { z } from 'zod';
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';

export type AppUserRole = 'owner' | 'direction' | 'admin' | 'reception' | 'housekeeping' | 'accountant' | 'rms';

export const appUserRowSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  auth_id: z.string().nullable(),
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.string(),
  is_active: z.boolean(),
  last_login_at: z.string().nullable(),
  created_at: z.string().nullable(),
}).passthrough();
export type AppUserRow = z.infer<typeof appUserRowSchema>;

export const invitationRowSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  email: z.string(),
  full_name: z.string().nullable(),
  role: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED']),
  invited_by: z.string().nullable(),
  invited_at: z.string(),
  accepted_at: z.string().nullable(),
  token: z.string(),
}).passthrough();
export type InvitationRow = z.infer<typeof invitationRowSchema>;

/* ---------------------------------------------- Users ---------- */

export async function listUsers(): Promise<AppUserRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, hotel_id, auth_id, full_name, email, role, is_active, last_login_at, created_at')
    .order('full_name', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => appUserRowSchema.parse(d));
}

export async function setUserActive(id: string, isActive: boolean): Promise<AppUserRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('users') as any;
  const { data, error } = await builder
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id, hotel_id, auth_id, full_name, email, role, is_active, last_login_at, created_at')
    .single();
  if (error) throw mapSupabaseError(error);
  return appUserRowSchema.parse(data);
}

export async function setUserRole(id: string, role: AppUserRole): Promise<AppUserRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('users') as any;
  const { data, error } = await builder
    .update({ role })
    .eq('id', id)
    .select('id, hotel_id, auth_id, full_name, email, role, is_active, last_login_at, created_at')
    .single();
  if (error) throw mapSupabaseError(error);
  return appUserRowSchema.parse(data);
}

/* ---------------------------------------------- Invitations ---------- */

export async function listInvitations(): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from('user_invitations')
    .select('*')
    .order('invited_at', { ascending: false });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => invitationRowSchema.parse(d));
}

export interface CreateInvitationInput {
  email: string;
  fullName?: string | null;
  role: AppUserRole;
}

export async function createInvitation(
  hotelId: string,
  invitedBy: string | null,
  input: CreateInvitationInput,
): Promise<InvitationRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('user_invitations') as any;
  const { data, error } = await builder
    .insert({
      hotel_id: hotelId,
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName?.trim() || null,
      role: input.role,
      status: 'PENDING',
      invited_by: invitedBy,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return invitationRowSchema.parse(data);
}

export async function revokeInvitation(id: string): Promise<InvitationRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('user_invitations') as any;
  const { data, error } = await builder
    .update({ status: 'REVOKED' })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return invitationRowSchema.parse(data);
}
