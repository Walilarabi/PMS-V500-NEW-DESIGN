/**
 * FLOWTYM — Supabase Client (Browser).
 *
 * Single source of truth for all Supabase interactions on the client side.
 * NEVER use the service_role_key here. Only the anon key + RLS policies.
 *
 * Multi-tenancy: tenant_id is enforced server-side via RLS policies that
 * read it from the JWT custom claim `tenant_id`. The frontend never
 * computes or sends tenant_id explicitly.
 *
 * SECURITY: No credentials are hardcoded here. All values must be supplied
 * via environment variables. Create frontend/.env.local for local dev
 * (see frontend/.env.example). For production, configure secrets in Vercel.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './supabase.types';

// SECURITY: env vars obligatoires — aucun fallback hardcodé (SECURITY_RULES §6)
// Conflit résolu en faveur de Phase 1 : Cursor réintroduisait les credentials
// hardcodés que Phase 1 a explicitement supprimés. Notre version est supérieure.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL?.trim()) {
  throw new Error(
    '[FLOWTYM] VITE_SUPABASE_URL manquant.\n' +
    'Créer frontend/.env.local avec VITE_SUPABASE_URL=https://<ref>.supabase.co\n' +
    'Voir frontend/.env.example pour le template complet.',
  );
}

if (!SUPABASE_ANON_KEY?.trim()) {
  throw new Error(
    '[FLOWTYM] VITE_SUPABASE_ANON_KEY manquant.\n' +
    'Créer frontend/.env.local avec VITE_SUPABASE_ANON_KEY=<anon-key>\n' +
    'Voir frontend/.env.example pour le template complet.',
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
