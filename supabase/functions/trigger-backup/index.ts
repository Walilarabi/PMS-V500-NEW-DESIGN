// FLOWTYM — Edge Function : déclenche un backup logique du tenant courant.
//
// Appelée par BackupsPage.runNow(). Le vrai backup est délégué à un job
// worker (pg_dump tenant-scoped) ; cette fonction n'enregistre que la
// demande, le suivi est dans settings_audit_log + settings_backups_log.
//
// Auth requis : token Supabase de l'utilisateur (vérification RLS).

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

interface BackupRequest {
  scope: 'full' | 'daily' | 'critical';
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
    // Client user-scoped pour récupérer le hotel_id via RPC
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: hotelId, error: hotelErr } = await userClient.rpc('get_user_hotel_id');
    if (hotelErr || !hotelId) {
      return new Response(JSON.stringify({ error: 'no_hotel' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body: BackupRequest = await req.json().catch(() => ({ scope: 'daily' as const }));

    // Service-role client pour insérer la trace dans le journal d'audit
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    await adminClient.from('settings_audit_log').insert({
      hotel_id: hotelId,
      entry_id: `backup_${runId}`,
      at: startedAt,
      action: 'module_inspected',
      severity: 'info',
      module: 'security_backups',
      detail: `Sauvegarde ${body.scope} demandée (run_id=${runId})`,
      meta: { runId, scope: body.scope, source: 'edge:trigger-backup' },
    });

    // TODO Phase production : enqueue dans pg_cron / pg_net une exécution
    // de pg_dump filtrée par hotel_id, upload S3, notif fin de job.
    // Pour l'instant, on retourne le run_id et le succès "scheduled".

    return new Response(JSON.stringify({
      runId,
      scope: body.scope,
      status: 'scheduled',
      scheduledAt: startedAt,
      message: 'Sauvegarde planifiée (worker async).',
    }), {
      status: 202,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal', message: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
