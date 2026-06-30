/**
 * FLOWTYM — Supabase Client (Browser).
 *
 * Les valeurs VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont injectées
 * au moment du build par vite.config.ts via define{}.
 * Elles proviennent de :
 *   - vercel.json -> env{} (production Vercel)
 *   - frontend/.env.local (développement local)
 *
 * La clé anon est publique par conception Supabase — la sécurité
 * réelle est assurée par les RLS PostgreSQL côté serveur.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

// Ces valeurs sont remplacées par des strings littéraux au build (Vite define{})
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // En développement : indiquer comment configurer
  if (import.meta.env.DEV) {
    console.error(
      '[FLOWTYM] Variables Supabase manquantes.\n' +
      'Créer frontend/.env.local :\n' +
      '  VITE_SUPABASE_URL=https://hzrzkvdebaadditvbqis.supabase.co\n' +
      '  VITE_SUPABASE_ANON_KEY=<clé anon>',
    );
  }
  throw new Error(
    '[FLOWTYM] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant. ' +
    'Vérifier vercel.json env{} ou frontend/.env.local.',
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
      headers: { 'x-flowtym-client': 'web' },
    },
    db: { schema: 'public' },
  },
);

export type FlowtymSupabase = typeof supabase;
