/**
 * FLOWTYM — Supabase Client (Browser).
 *
 * Single source of truth for all Supabase interactions on the client side.
 * NEVER use the service_role_key here. Only the anon key + RLS policies.
 *
 * Multi-tenancy: tenant_id is enforced server-side via RLS policies that
 * read it from the JWT custom claim `tenant_id`. The frontend never
 * computes or sends tenant_id explicitly.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './supabase.types';

const DEFAULT_SUPABASE_URL = 'https://hzrzkvdebaadditvbqis.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cnprdmRlYmFhZGRpdHZicWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMjEwMTQsImV4cCI6MjA5MjY5NzAxNH0.IDFFWHNNIeBReWRTeVj8RlRpyz5J4XaStFhGVEYEBU8';

const envOrDefault = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
};

const SUPABASE_URL = envOrDefault(
  import.meta.env.VITE_SUPABASE_URL,
  DEFAULT_SUPABASE_URL,
);

const SUPABASE_ANON_KEY = envOrDefault(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_ANON_KEY,
);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase env: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.',
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'flowtym.auth',
    },
    global: {
      headers: {
        'x-flowtym-client': 'web',
      },
    },
    db: {
      schema: 'public',
    },
  },
);

export type FlowtymSupabase = typeof supabase;
