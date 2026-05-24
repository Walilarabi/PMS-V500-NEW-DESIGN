// FLOWTYM — Edge Function : révoque une session Supabase Auth.
//
// Appelée par SessionsPage.revokeSession() / revokeAll(). Utilise le
// service-role pour appeler admin.signOut(uid, scope='others') et
// invalider les refresh tokens des sessions autres que celle en cours.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RevokeRequest {
  /** 'others' = toutes sauf la session courante | 'all' = y compris la courante */
  scope?: 'others' | 'all';
  /** Optionnel : id de session spécifique à révoquer */
  sessionId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { data: hotelId } = await userClient.rpc('get_user_hotel_id');
    const body: RevokeRequest = await req.json().catch(() => ({ scope: 'others' as const }));

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // signOut scope='others' invalide tous les refresh tokens du user
    // sauf celui de la session courante. signOut scope='global' invalide tout.
    const scope = body.scope === 'all' ? 'global' : 'others';
    const { error: signOutErr } = await adminClient.auth.admin.signOut(user.id, scope as any);

    if (signOutErr) {
      return new Response(JSON.stringify({ error: 'signout_failed', message: signOutErr.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Journalise dans l'audit avec severity critical (action sensible)
    await adminClient.from('settings_audit_log').insert({
      hotel_id: hotelId ?? null,
      entry_id: `revoke_${crypto.randomUUID()}`,
      at: new Date().toISOString(),
      action: 'user_updated',
      severity: 'critical',
      module: 'security_backups',
      detail: `Sessions ${scope} révoquées pour ${user.email}`,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      meta: { scope, sessionId: body.sessionId ?? null, source: 'edge:revoke-session' },
    });

    return new Response(JSON.stringify({
      revoked: true,
      scope,
      userId: user.id,
      revokedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal', message: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
