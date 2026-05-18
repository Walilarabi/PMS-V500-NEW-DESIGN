/**
 * FLOWTYM — Guests repository.
 *
 * RLS guarantees hotel_id isolation (server-side). The client always passes
 * hotel_id so Postgres can validate the policy `with check (hotel_id = ...)`
 * against the JWT claim.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import type { GuestRow } from '@/src/lib/supabase.types';
import { guestRowSchema } from './schemas';

interface FindOrCreateInput {
  hotelId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  segment: string | null;
}

/** Splits a "First Last" string into (first, last) — last word goes to last_name. */
function splitName(fullName: string): { first: string | null; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first: null, last: parts[0] || '—' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export interface ListGuestsParams {
  limit?: number;
  offset?: number;
  search?: string;
  segment?: string;
  loyalty?: string;
  country?: string;
}

export async function listGuests(
  params: ListGuestsParams = {},
): Promise<{ rows: GuestRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabase
    .from('guests')
    .select(
      'id,hotel_id,legacy_id,first_name,last_name,email,phone,country,nationality,segment,loyalty_level,total_spent,total_stays,blacklisted,notes,created_at,updated_at',
      { count: 'exact' },
    )
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.search?.trim()) {
    const t = params.search.trim();
    q = q.or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`);
  }
  if (params.segment && params.segment !== 'ALL') q = q.eq('segment', params.segment);
  if (params.loyalty && params.loyalty !== 'ALL') q = q.eq('loyalty_level', params.loyalty);
  if (params.country && params.country !== 'ALL') q = q.eq('country', params.country);

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);

  const rows = (data ?? []).map((row) => guestRowSchema.parse(row)) as GuestRow[];
  return { rows, total: count ?? rows.length };
}

/**
 * Looks up an existing guest by (hotel_id + email) when an email is provided,
 * else creates one. When no email is provided, always creates a new guest.
 */
export async function findOrCreateGuest(input: FindOrCreateInput): Promise<GuestRow> {
  if (input.email) {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('hotel_id', input.hotelId)
      .ilike('email', input.email)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    if (data) return data as GuestRow;
  }
  const { first, last } = splitName(input.fullName);
  const insertPayload: Record<string, unknown> = {
    hotel_id: input.hotelId,
    first_name: first,
    last_name: last,
    email: input.email,
    phone: input.phone,
    nationality: input.nationality,
    segment: input.segment,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('guests') as any;
  const { data, error } = await builder.insert(insertPayload).select('*').single();
  if (error) throw mapSupabaseError(error);
  return data as GuestRow;
}
