/**
 * FLOWTYM — Auth repository (Supabase Auth).
 *
 * The repository is the only place that talks directly to Supabase Auth APIs.
 * All higher-level layers (services, hooks, components) consume domain types.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, NotFoundError } from '@/src/domains/_shared/errors';

import type { AuthSession, LoginInput, SignUpInput } from './schemas';

interface AppUserProfile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: string;
}

async function fetchProfile(authUserId: string): Promise<AppUserProfile | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('id, tenant_id, email, full_name, role')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function loginWithPassword(input: LoginInput): Promise<AuthSession> {
  const { data, error } = await supabase.auth.signInWithPassword(input);
  if (error) throw mapSupabaseError(error);
  if (!data.user) throw new NotFoundError('AuthUser', input.email);
  const profile = await fetchProfile(data.user.id);
  return {
    userId: data.user.id,
    email: data.user.email ?? input.email,
    tenantId: profile?.tenant_id ?? null,
    role: profile?.role ?? null,
    fullName: profile?.full_name ?? null,
  };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw mapSupabaseError(error);
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw mapSupabaseError(error);
  if (!data.session?.user) return null;
  const profile = await fetchProfile(data.session.user.id);
  return {
    userId: data.session.user.id,
    email: data.session.user.email ?? '',
    tenantId: profile?.tenant_id ?? null,
    role: profile?.role ?? null,
    fullName: profile?.full_name ?? null,
  };
}

/** Self-service signup that creates a new tenant + admin user.
 *  Requires SECURITY DEFINER RPC `provision_tenant` on the database. */
export async function signUpAndProvisionTenant(input: SignUpInput): Promise<AuthSession> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName } },
  });
  if (authError) throw mapSupabaseError(authError);
  if (!authData.user) throw new NotFoundError('AuthUser', input.email);

  const { error: rpcError } = await supabase.rpc('provision_tenant', {
    p_auth_user_id: authData.user.id,
    p_email: input.email,
    p_full_name: input.fullName,
    p_tenant_slug: input.tenantSlug,
    p_hotel_name: input.hotelName,
  });
  if (rpcError) throw mapSupabaseError(rpcError);

  const profile = await fetchProfile(authData.user.id);
  return {
    userId: authData.user.id,
    email: input.email,
    tenantId: profile?.tenant_id ?? null,
    role: profile?.role ?? 'owner',
    fullName: input.fullName,
  };
}

export function onAuthStateChange(cb: (session: AuthSession | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      cb(null);
      return;
    }
    try {
      const profile = await fetchProfile(session.user.id);
      cb({
        userId: session.user.id,
        email: session.user.email ?? '',
        tenantId: profile?.tenant_id ?? null,
        role: profile?.role ?? null,
        fullName: profile?.full_name ?? null,
      });
    } catch {
      cb(null);
    }
  });
  return () => data.subscription.unsubscribe();
}
