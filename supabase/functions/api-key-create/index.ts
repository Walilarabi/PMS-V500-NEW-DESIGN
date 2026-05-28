// FLOWTYM — Edge Function : génère + hashe une clé API tenant-scoped.
//
// Appelée par ApiKeysPage.createKey(). La clé en clair n'est JAMAIS
// stockée en base — seul le hash SHA-256 est persisté. Le secret est
// retourné UNE SEULE FOIS au client (qui doit le copier immédiatement).
//
// Le tenant est dérivé de la session via get_user_hotel_id().

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Allowed origins: set ALLOWED_ORIGIN in Supabase Edge Function secrets.
// Multiple origins can be separated by commas.
const ALLOWED_ORIGINS = new Set<string>([
  ...(Deno.env.get('ALLOWED_ORIGIN') ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  'http://localhost:3000',
  'http://localhost:5173',
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : [...ALLOWED_ORIGINS][0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

interface CreateKeyRequest {
  label: string;
  scopes: string[];
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: hotelId } = await userClient.rpc('get_user_hotel_id');
    if (!hotelId) {
      return new Response(JSON.stringify({ error: 'no_hotel' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body: CreateKeyRequest = await req.json();
    if (!body.label?.trim()) {
      return new Response(JSON.stringify({ error: 'label_required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const secret = `flwt_${randomToken()}`;
    const secretHash = await sha256(secret);
    const prefix = secret.slice(0, 12); // pour identification visuelle côté UI

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data: row, error: insertErr } = await adminClient
      .from('api_keys')
      .insert({
        hotel_id: hotelId,
        label: body.label.trim(),
        prefix,
        secret_hash: secretHash,
        scopes: body.scopes ?? ['read'],
        created_by: user.id,
        revoked: false,
      })
      .select('id, label, prefix, scopes, created_at')
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: 'insert_failed', message: insertErr.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Audit (critical — création de credentials)
    await adminClient.from('settings_audit_log').insert({
      hotel_id: hotelId,
      entry_id: `apikey_${row.id}`,
      at: new Date().toISOString(),
      action: 'partner_added', // closest semantic
      severity: 'warning',
      module: 'integrations',
      detail: `Clé API "${body.label}" créée (prefix ${prefix})`,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      meta: { keyId: row.id, scopes: body.scopes, source: 'edge:api-key-create' },
    });

    // Réponse : on retourne le secret en clair UNE SEULE FOIS
    return new Response(JSON.stringify({
      id: row.id,
      label: row.label,
      prefix: row.prefix,
      secret,                // visible une seule fois — le client doit copier
      scopes: row.scopes,
      createdAt: row.created_at,
      warning: 'Cette clé ne sera plus jamais affichée. Copiez-la maintenant.',
    }), {
      status: 201,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal', message: (err as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
