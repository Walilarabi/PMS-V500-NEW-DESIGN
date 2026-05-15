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
