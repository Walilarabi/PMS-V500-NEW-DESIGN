/**
 * FLOWTYM — Auth repository (Supabase Auth + public.users profile).
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, NotFoundError } from '@/src/domains/_shared/errors';
import type { AdminUserRole } from '@/src/lib/supabase.types';

import type { AccessibleHotel, AuthSession, LoginInput } from './schemas';

interface AppUserProfile {
  id: string;
  hotel_id: string;
  email: string;
  full_name: string;
  role: AdminUserRole;
}

interface ListUserHotelsRow {
  hotel_id: string;
  name: string;
  city: string | null;
  country: string | null;
  role: string;
  is_default: boolean;
  is_active: boolean;
}

async function fetchProfile(authUserId: string): Promise<AppUserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, hotel_id, email, full_name, role')
    .eq('auth_id', authUserId)
    .maybeSingle();
  if (error) {
    // RLS may block a not-yet-provisioned user. Treat as "no profile yet".
    if (error.code === 'PGRST301' || error.code === 'PGRST116') return null;
    throw mapSupabaseError(error);
  }
  return data;
}

/**
 * Fetch the list of hotels accessible to the current user via RPC.
 * Never throws — returns empty list on any error (graceful degradation:
 * the legacy single-hotel codepath still works via users.hotel_id).
 */
async function fetchAccessibleHotels(): Promise<AccessibleHotel[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('list_user_hotels');
    if (error) return [];
    if (!Array.isArray(data)) return [];
    return (data as ListUserHotelsRow[]).map((row) => ({
      hotelId: row.hotel_id,
      name: row.name,
      city: row.city,
      country: row.country,
      role: row.role,
      isDefault: row.is_default,
      isActive: row.is_active,
    }));
  } catch {
    return [];
  }
}

function buildSession(
  authUserId: string,
  email: string,
  profile: AppUserProfile | null,
  accessibleHotels: AccessibleHotel[],
): AuthSession {
  // tenantId = l'hôtel actif (is_active=true), sinon fallback sur profile.hotel_id (legacy)
  const activeHotel = accessibleHotels.find((h) => h.isActive);
  const resolvedTenantId = activeHotel?.hotelId ?? profile?.hotel_id ?? null;
  return {
    userId: authUserId,
    email,
    tenantId: resolvedTenantId,
    role: profile?.role ?? null,
    fullName: profile?.full_name ?? null,
    accessibleHotels,
  };
}

export async function loginWithPassword(input: LoginInput): Promise<AuthSession> {
  const { data, error } = await supabase.auth.signInWithPassword(input);
  if (error) throw mapSupabaseError(error);
  if (!data.user) throw new NotFoundError('AuthUser', input.email);
  let profile: AppUserProfile | null = null;
  try {
    profile = await fetchProfile(data.user.id);
  } catch {
    profile = null;
  }
  const accessibleHotels = await fetchAccessibleHotels();
  return buildSession(data.user.id, data.user.email ?? input.email, profile, accessibleHotels);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw mapSupabaseError(error);
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw mapSupabaseError(error);
  if (!data.session?.user) return null;
  let profile: AppUserProfile | null = null;
  try {
    profile = await fetchProfile(data.session.user.id);
  } catch {
    profile = null;
  }
  const accessibleHotels = await fetchAccessibleHotels();
  return buildSession(
    data.session.user.id,
    data.session.user.email ?? '',
    profile,
    accessibleHotels,
  );
}

export function onAuthStateChange(cb: (session: AuthSession | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      cb(null);
      return;
    }
    let profile: AppUserProfile | null = null;
    try {
      profile = await fetchProfile(session.user.id);
    } catch {
      profile = null;
    }
    const accessibleHotels = await fetchAccessibleHotels();
    cb(buildSession(session.user.id, session.user.email ?? '', profile, accessibleHotels));
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Change the user's active hotel via RPC set_active_hotel.
 * Throws if the user does not have access to the requested hotel.
 */
export async function switchActiveHotel(hotelId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('set_active_hotel', { p_hotel_id: hotelId });
  if (error) throw mapSupabaseError(error);
}

/**
 * Reload the session after switching hotels (useful to refresh accessibleHotels
 * and tenantId without a full page reload).
 */
export async function refreshSession(): Promise<AuthSession | null> {
  return getCurrentSession();
}

/** Self-service signup is disabled in this iteration: hotel provisioning is
 *  done via Supabase Admin scripts only. The API surface is kept so that
 *  the existing signup form fails predictably until we wire a full RPC. */
export async function signUpAndProvisionTenant(): Promise<AuthSession> {
  throw new NotFoundError(
    'SignUp',
    "self-service indisponible — contactez votre direction pour être ajouté au tenant.",
  );
}
