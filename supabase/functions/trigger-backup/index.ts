// FLOWTYM — Edge Function : déclenche un backup logique du tenant courant.
//
// ⚠️ V8 SECURITY SPRINT 1 — Option B retenue : 501 explicite.
// Le worker `pg_dump tenant-scoped + upload S3` n'est PAS implémenté. Plutôt
// que de renvoyer 202 « scheduled » et faire croire au client que la
// sauvegarde est partie (faux sentiment de sécurité), on retourne 501 avec
// un code d'erreur exploitable côté UI.
//
// Pour ré-activer : implémenter le worker (pg_cron + Edge Function externe
// signée → pg_dump + S3) puis remplacer ce stub par l'enqueue réel.
//
// Auth requis : token Supabase de l'utilisateur (vérification RLS) — conservé
// pour que la fonction ne soit jamais accessible anonymement même après
// implémentation.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

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

interface BackupRequest {
  scope: 'full' | 'daily' | 'critical';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const body: BackupRequest = await req.json().catch(() => ({ scope: 'daily' as const }));

    // Service-role client pour insérer la trace dans le journal d'audit.
    // On loggue la TENTATIVE d'invocation (utile pour détecter du polling
    // client qui croirait que la fonctionnalité existe).
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const at = new Date().toISOString();
    await adminClient.from('settings_audit_log').insert({
      hotel_id: hotelId,
      entry_id: `backup_attempt_${crypto.randomUUID()}`,
      at,
      action: 'module_inspected',
      severity: 'warning',
      module: 'security_backups',
      detail: `Tentative de sauvegarde ${body.scope} — fonctionnalité non implémentée (501).`,
      meta: { scope: body.scope, source: 'edge:trigger-backup', status: 'not_implemented' },
    }).then(() => {/* best effort, ne pas bloquer la réponse */});

    // ⚠️ V8 : refus explicite. Pas de mensonge `scheduled`. L'UI doit afficher
    // que la fonctionnalité n'est pas active et orienter l'admin vers les
    // snapshots Supabase managés en attendant le worker pg_dump.
    return new Response(JSON.stringify({
      error: 'backup_worker_not_implemented',
      code: 'BACKUP_NOT_IMPLEMENTED',
      message:
        "La sauvegarde tenant-scoped n'est pas encore active sur cet environnement. " +
        "Les snapshots Supabase managés (rétention plan-dépendante) restent en place. " +
        "Le worker pg_dump + S3 sera activé en Phase production.",
      docs: 'https://docs.flowtym.com/ops/backups',
    }), {
      status: 501,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal', message: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
