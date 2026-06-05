// ============================================================================
// FLOWTYM SaaS — Edge Function: invite-hotel-primary-contact
// Onboarding d'un hôtel client par le Super Admin :
//   (créer/retrouver hôtel) → activer les apps souscrites → inviter le premier
//   contact → rattacher hôtel + rôle + accès applicatifs → audit → résultat clair.
//
// Sécurité : verify_jwt=false (préflight CORS) + contrôle serveur strict :
//   l'appelant DOIT être platform_admins.role='super_admin' actif.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const REDIRECT_PMS = 'https://app.flowtym.com/auth/callback';
const REDIRECT_RH  = 'https://rh.flowtym.com/auth/callback';

// rôle initial UI -> rôle hôtel (admin_user_role) + apps accordées
const ROLE_MAP: Record<string, { db_role: string; apps: 'ALL' | string[] }> = {
  hotel_admin: { db_role: 'admin_hotel', apps: 'ALL' },
  pms_manager: { db_role: 'direction',   apps: ['PMS'] },
  rh_manager:  { db_role: 'direction',   apps: ['RH'] },
};

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
    const body = await req.json();
    const { hotel = {}, hotel_id: existingHotelId, apps = [], contact = {} } = body;
    const role = String(contact.role ?? 'hotel_admin');

    if (!Array.isArray(apps) || apps.length === 0) return json({ error: 'Au moins une application requise (PMS/RH).' }, 400);
    if (!contact.email) return json({ error: 'Email du contact requis.' }, 400);
    if (!ROLE_MAP[role]) return json({ error: `Rôle initial inconnu : ${role}` }, 400);
    if (!existingHotelId && !hotel.name) return json({ error: "Nom de l'hôtel requis." }, 400);

    // --- Auth appelant ---
    const authHdr = req.headers.get('Authorization');
    if (!authHdr) return json({ error: 'Non authentifié' }, 401);
    const anon = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHdr } } });
    const { data: { user }, error: authErr } = await anon.auth.getUser();
    if (authErr || !user) return json({ error: 'Token invalide' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: caller } = await admin.from('platform_admins')
      .select('id, role, is_active').eq('auth_id', user.id).eq('is_active', true).maybeSingle();
    if (!caller || caller.role !== 'super_admin') return json({ error: 'Réservé au Super Admin.' }, 403);

    // --- Catalogue apps demandées (uniquement les disponibles) ---
    const { data: appRows } = await admin.from('platform_apps')
      .select('id, code, is_available').in('code', apps);
    const validApps = (appRows ?? []).filter((a: any) => a.is_available);
    if (validApps.length === 0) return json({ error: 'Aucune application valide/disponible sélectionnée.' }, 400);

    // --- 1) Créer ou retrouver l'hôtel ---
    let hotelId = existingHotelId as string | undefined;
    let hotelCreated = false;
    if (!hotelId) {
      const { data: newHotel, error: hErr } = await admin.from('hotels').insert({
        name: hotel.name,
        company: hotel.company ?? null,
        siret: hotel.siret ?? null,
        address: hotel.address ?? null,
        city: hotel.city ?? null,
        country: hotel.country ?? null,
        email: hotel.email ?? contact.email,
        phone: hotel.phone ?? null,
        internal_notes: hotel.notes ?? null,
        active: true,
      }).select('id').single();
      if (hErr) return json({ error: 'Création hôtel : ' + hErr.message }, 500);
      hotelId = newHotel.id;
      hotelCreated = true;
    }

    // --- 2) Activer les apps souscrites (trial 30j) ---
    const trialEnds = new Date(Date.now() + 30 * 864e5).toISOString();
    for (const a of validApps) {
      await admin.from('hotel_app_subscriptions').upsert({
        hotel_id: hotelId, app_id: a.id, status: 'trial',
        trial_ends_at: trialEnds, created_by: caller.id,
      }, { onConflict: 'hotel_id,app_id' });
    }

    // --- 3) Inviter / retrouver le contact Auth ---
    const wantsPMS = validApps.some((a: any) => a.code === 'PMS');
    const redirectTo = wantsPMS ? REDIRECT_PMS : REDIRECT_RH;
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();

    const { data: listData } = await admin.auth.admin.listUsers();
    const existing = (listData?.users ?? []).find((u: any) =>
      (u.email ?? '').toLowerCase() === String(contact.email).toLowerCase());

    let targetAuthId: string | null = existing?.id ?? null;
    let alreadyExisted = !!existing;
    if (!existing) {
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(contact.email, {
        redirectTo, data: { full_name: fullName, invited_hotel_id: hotelId, invited_role: ROLE_MAP[role].db_role },
      });
      if (invErr) return json({ error: 'Invitation email : ' + invErr.message }, 500);
      targetAuthId = inv?.user?.id ?? null;
    } else {
      await admin.auth.admin.generateLink({ type: 'magiclink', email: contact.email, options: { redirectTo } });
    }
    if (!targetAuthId) return json({ error: "Utilisateur Auth introuvable." }, 500);

    // --- 4) Rattacher hôtel + rôle (RPC atomique existante) ---
    const { data: userId, error: rpcErr } = await admin.rpc('rh_grant_hotel_access', {
      p_auth_id: targetAuthId, p_email: contact.email, p_full_name: fullName,
      p_hotel_id: hotelId, p_role: ROLE_MAP[role].db_role,
    });
    if (rpcErr) return json({ error: 'Rattachement hôtel : ' + rpcErr.message }, 500);

    // --- 5) Accorder l'accès applicatif selon le rôle ---
    const grantCodes = ROLE_MAP[role].apps === 'ALL'
      ? validApps.map((a: any) => a.code)
      : validApps.filter((a: any) => (ROLE_MAP[role].apps as string[]).includes(a.code)).map((a: any) => a.code);
    const grantAppIds = validApps.filter((a: any) => grantCodes.includes(a.code));
    for (const a of grantAppIds) {
      await admin.from('user_app_access').upsert({
        user_id: userId, hotel_id: hotelId, app_id: a.id, granted_by: caller.id,
      }, { onConflict: 'user_id,hotel_id,app_id' });
    }

    // --- 6) Audit back-office (platform_logs) ---
    await admin.from('platform_logs').insert({
      admin_id: caller.id, admin_email: user.email,
      action: 'hotel_primary_contact_invited', entity: 'hotel', entity_id: hotelId,
      hotel_id: hotelId, hotel_name: hotel.name ?? null, level: 'info',
      payload: { contact_email: contact.email, role, apps: validApps.map((a: any) => a.code),
                 hotel_created: hotelCreated, already_existed: alreadyExisted },
    });

    return json({
      success: true, hotel_id: hotelId, hotel_created: hotelCreated,
      user_id: userId, already_existed: alreadyExisted,
      apps_activated: validApps.map((a: any) => a.code), apps_granted: grantCodes,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
