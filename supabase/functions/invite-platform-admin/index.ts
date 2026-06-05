// ============================================================================
// FLOWTYM — Edge Function: invite-platform-admin
// Corrige le bug de création Super Admin (AdminTeam.tsx insérait sans auth_id).
// Flux : appelant DOIT être super_admin actif → invite/lookup auth user par
//        email → insert/upsert public.platform_admins avec auth_id.
// Déploiement : verify_jwt=false (auth manuelle ci-dessous), comme invite-user.
//   supabase functions deploy invite-platform-admin --no-verify-jwt
// Câblage front (AdminTeam.tsx, inviteMut.mutationFn) :
//   const { data, error } = await supabase.functions.invoke('invite-platform-admin',
//     { body: { email, role } });
//   if (error) throw error;
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const REDIRECT = 'https://app.flowtym.com/admin';
const VALID_ROLES = ['super_admin', 'billing_admin', 'support_agent'];

const ALLOWED = ['http://localhost:5173', 'https://app.flowtym.com', 'https://flowtym.com'];
const cors = (o: string | null) => ({
  'Access-Control-Allow-Origin': (o && ALLOWED.some(a => o.startsWith(a))) ? o : ALLOWED[1],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

Deno.serve(async (req) => {
  const h = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...h, 'Content-Type': 'application/json' } });

  try {
    const { email, role = 'support_agent', full_name = '' } = await req.json();
    if (!email) return json({ error: 'email requis' }, 400);
    if (!VALID_ROLES.includes(role)) return json({ error: `Rôle inconnu : ${role}` }, 400);

    // --- Authentifier l'appelant ---
    const authHdr = req.headers.get('Authorization');
    if (!authHdr) return json({ error: 'Non authentifié' }, 401);
    const anon = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHdr } } });
    const { data: { user }, error: authErr } = await anon.auth.getUser();
    if (authErr || !user) return json({ error: 'Token invalide' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- L'appelant DOIT être super_admin actif ---
    const { data: caller } = await admin.from('platform_admins')
      .select('role, is_active').eq('auth_id', user.id).eq('is_active', true).maybeSingle();
    if (!caller || caller.role !== 'super_admin')
      return json({ error: 'Réservé au super_admin' }, 403);

    // --- Trouver ou inviter le compte Auth cible ---
    const { data: listData } = await admin.auth.admin.listUsers();
    const existing = (listData?.users ?? []).find((u: { email?: string; id: string }) =>
      (u.email ?? '').toLowerCase() === email.toLowerCase());

    let targetAuthId: string | null = existing?.id ?? null;
    let invited = false;
    if (!existing) {
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: REDIRECT, data: { full_name, platform_role: role },
      });
      if (invErr) return json({ error: 'Erreur invitation : ' + invErr.message }, 500);
      targetAuthId = inv?.user?.id ?? null;
      invited = true;
    } else {
      // compte existant : envoyer un magic link vers /admin
      await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: REDIRECT } });
    }
    if (!targetAuthId) return json({ error: "Impossible de résoudre l'utilisateur Auth" }, 500);

    // --- Upsert platform_admins AVEC auth_id (le bug initial) ---
    const { error: upErr } = await admin.from('platform_admins').upsert({
      auth_id: targetAuthId, email, full_name: full_name || null, role, is_active: true,
    }, { onConflict: 'auth_id' });
    if (upErr) return json({ error: 'Erreur base : ' + upErr.message }, 500);

    return json({ success: true, auth_id: targetAuthId, invited });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
