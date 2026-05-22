/**
 * FLOWTYM — Guests repository.
 *
 * RLS guarantees hotel_id isolation (server-side). The client always passes
 * hotel_id so Postgres can validate the policy `with check (hotel_id = ...)`
 * against the JWT claim.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';
import { guestRowSchema, type GuestRowDto } from './schemas';

// DB loyalty values — UI labels map to these exact strings
const LOYALTY_DB_VALUES: Record<string, string> = {
  Standard:  'Standard',
  Silver:    'Silver',
  Gold:      'Gold',
  Platinum:  'Platinum',
};

const ALL_GUEST_COLUMNS = [
  'id', 'hotel_id', 'legacy_id',
  'first_name', 'last_name', 'email', 'phone',
  'country', 'nationality', 'passport', 'date_of_birth',
  'address', 'city', 'zip', 'language',
  'segment', 'loyalty_level',
  'total_spent', 'total_stays',
  'id_verified', 'gdpr_consent', 'gdpr_date',
  'blacklisted', 'notes', 'tags',
  // Wave C1 enterprise columns
  'gender', 'whatsapp', 'social_links', 'photo_url',
  'profession', 'employer', 'job_title',
  'visa', 'doc_expiry_date', 'languages',
  'acquisition_source', 'vip', 'risk_level',
  'satisfaction_score', 'ai_scores',
  'created_at', 'updated_at',
].join(',');

interface FindOrCreateInput {
  hotelId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  segment: string | null;
}

function splitName(fullName: string): { first: string | null; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first: null, last: parts[0] || '—' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export interface ListGuestsParams {
  limit?: number;
  offset?: number;
  search?: string;
  /** DB value: 'Leisure' | 'Business' | 'VIP' | 'ALL' */
  segment?: string;
  /** DB value: 'Standard' | 'Silver' | 'Gold' | 'Platinum' | 'ALL' */
  loyalty?: string;
  country?: string;
  vipOnly?: boolean;
  blacklisted?: boolean;
  /** Filter to specific risk_level values, e.g. ['medium','high','critical'] */
  riskLevels?: string[];
}

export async function listGuests(
  params: ListGuestsParams = {},
): Promise<{ rows: GuestRowDto[]; total: number }> {
  const limit  = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabase
    .from('guests')
    .select(ALL_GUEST_COLUMNS, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.search?.trim()) {
    const t = params.search.trim();
    q = q.or(
      `first_name.ilike.%${t}%,last_name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`,
    );
  }

  // segment: DB stores e.g. 'Leisure' — use ilike for case-tolerance
  if (params.segment && params.segment !== 'ALL') {
    q = q.ilike('segment', params.segment);
  }

  // loyalty: DB stores 'Gold' / 'Silver' / 'Platinum' / 'Standard'
  if (params.loyalty && params.loyalty !== 'ALL') {
    const dbVal = LOYALTY_DB_VALUES[params.loyalty] ?? params.loyalty;
    q = q.eq('loyalty_level', dbVal);
  }

  if (params.country && params.country !== 'ALL') {
    q = q.eq('country', params.country);
  }

  if (params.vipOnly) {
    q = q.eq('vip', true);
  }

  if (params.blacklisted !== undefined) {
    q = q.eq('blacklisted', params.blacklisted);
  }

  if (params.riskLevels?.length) {
    q = q.in('risk_level', params.riskLevels);
  }

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);

  const rows = (data ?? []).map(
    (row) => guestRowSchema.parse(row) as unknown as GuestRowDto,
  );
  return { rows, total: count ?? rows.length };
}

export async function findOrCreateGuest(input: FindOrCreateInput): Promise<GuestRowDto> {
  if (input.email) {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('hotel_id', input.hotelId)
      .ilike('email', input.email)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    if (data) return guestRowSchema.parse(data) as unknown as GuestRowDto;
  }
  const { first, last } = splitName(input.fullName);
  const insertPayload: Record<string, unknown> = {
    hotel_id:    input.hotelId,
    first_name:  first,
    last_name:   last,
    email:       input.email,
    phone:       input.phone,
    nationality: input.nationality,
    segment:     input.segment,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = supabase.from('guests') as any;
  const { data, error } = await builder.insert(insertPayload).select('*').single();
  if (error) throw mapSupabaseError(error);
  return guestRowSchema.parse(data) as unknown as GuestRowDto;
}
