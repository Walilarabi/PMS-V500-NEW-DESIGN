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
 * via environment variables:
 *   - Local dev  : frontend/.env.local (non commité — voir .env.example)
 *   - Production : Vercel Dashboard > Settings > Environment Variables
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './supabase.types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

// En développement : crash immédiat pour forcer la configuration.
// En production (Vercel) : crash avec message lisible dans la console,
// la page blanche est préférable à une app partiellement initialisée.
if (!SUPABASE_URL) {
  const msg =
    '[FLOWTYM] VITE_SUPABASE_URL manquant.\n' +
    '• Local  : créer frontend/.env.local  →  VITE_SUPABASE_URL=https://<ref>.supabase.co\n' +
    '• Vercel : Dashboard → Settings → Environment Variables';
  console.error(msg);
  throw new Error(msg);
}

if (!SUPABASE_ANON_KEY) {
  const msg =
    '[FLOWTYM] VITE_SUPABASE_ANON_KEY manquant.\n' +
    '• Local  : créer frontend/.env.local  →  VITE_SUPABASE_ANON_KEY=<clé-anon>\n' +
    '• Vercel : Dashboard → Settings → Environment Variables';
  console.error(msg);
  throw new Error(msg);
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
