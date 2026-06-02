/**
 * FLOWTYM — Edge Function: send-whatsapp
 * Envoie un message WhatsApp AU CLIENT via la WhatsApp Business Cloud API
 * (Meta). Chaque hôtel utilise SON PROPRE WhatsApp Business Account — jamais
 * un compte Flowtym commun. Config + secret lus côté serveur :
 *   - public.hotel_whatsapp_settings      (config non-secrète, RLS hôtel)
 *   - public._hotel_communication_secrets (access_token Meta, service_role only)
 *
 * POST /functions/v1/send-whatsapp
 * Headers: Authorization: Bearer <jwt utilisateur>
 * Body: {
 *   to: string,                       // numéro E.164 (ex +33612345678)
 *   text?: string,                    // message libre (fenêtre 24h ouverte)
 *   template?: { name: string, language?: string, components?: unknown[] },
 *   reservationId?: string, guestId?: string, templateKind?: string
 * }
 *
 * Hors fenêtre client de 24h, Meta exige un template approuvé → fournir
 * `template`. Le hotel_id est dérivé du JWT (isolation multi-tenant).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GRAPH_VERSION = Deno.env.get('META_GRAPH_VERSION') ?? 'v21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Normalise un numéro en E.164 sans le '+' (format attendu par Cloud API). */
function normalizePhone(raw: string): string | null {
  const digits = String(raw).replace(/[^\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits.slice(1) : digits;
  if (!/^\d{8,15}$/.test(e164)) return null;
  return e164;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json({ error: 'Edge function mal configurée (SUPABASE_URL / SERVICE_ROLE_KEY manquant)' }, 500);
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Non authentifié' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: hotelId, error: hotelErr } = await userClient.rpc('get_user_hotel_id');
    if (hotelErr || !hotelId) return json({ error: 'Aucun hôtel actif pour cet utilisateur' }, 401);

    const { data: userRow } = await userClient
      .from('users').select('id')
      .eq('auth_id', (await userClient.auth.getUser()).data.user?.id ?? '').maybeSingle();
    const createdBy = userRow?.id ?? null;

    const body = await req.json();
    const { to, text, template, reservationId, guestId, templateKind } = body ?? {};

    const phone = to ? normalizePhone(to) : null;
    if (!phone) {
      return json({ error: 'invalid_phone', message: 'Numéro WhatsApp invalide ou manquant (format attendu : +33612345678).' }, 400);
    }
    if (!text && !template) {
      return json({ error: 'empty_message', message: 'Fournir soit `text` (fenêtre 24h), soit `template` (hors fenêtre).' }, 400);
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Config WhatsApp de l'hôtel ─────────────────────────────────────────────
    const { data: settings } = await svc
      .from('hotel_whatsapp_settings').select('*').eq('hotel_id', hotelId).maybeSingle();

    if (!settings || !settings.is_active || !settings.phone_number_id) {
      return json({
        error: 'whatsapp_not_configured',
        message: 'WhatsApp Business non configuré. Connectez le compte WhatsApp Business de l\'hôtel dans Paramètres > Communication.',
      }, 422);
    }

    const { data: secretRow } = await svc
      .from('_hotel_communication_secrets')
      .select('secret_value')
      .eq('hotel_id', hotelId).eq('channel', 'whatsapp').eq('secret_key', 'access_token')
      .maybeSingle();
    const accessToken = secretRow?.secret_value ?? null;

    if (!accessToken) {
      return json({
        error: 'whatsapp_not_configured',
        message: 'Token d\'accès Meta manquant. Renseignez l\'Access Token dans Paramètres > Communication > WhatsApp.',
      }, 422);
    }

    // ── Construire le payload Cloud API ────────────────────────────────────────
    const payload = template
      ? {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: template.name,
            language: { code: template.language ?? 'fr' },
            components: template.components ?? [],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { preview_url: false, body: text },
        };

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${settings.phone_number_id}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    const ok = res.ok && !data.error;
    const providerMessageId = data?.messages?.[0]?.id ?? null;
    let errorMessage: string | null = null;
    if (!ok) {
      const metaErr = data?.error;
      if (metaErr?.code === 190) errorMessage = 'Token Meta expiré ou invalide. Reconnectez WhatsApp Business.';
      else if (metaErr?.code === 131047 || metaErr?.code === 131051) errorMessage = 'Hors fenêtre 24h : un template approuvé est requis.';
      else errorMessage = metaErr?.message ? `Meta: ${metaErr.message}` : `Cloud API: ${JSON.stringify(data)}`;
    }

    // ── Journaliser ────────────────────────────────────────────────────────────
    await svc.from('communication_logs').insert({
      hotel_id: hotelId,
      channel: 'whatsapp',
      direction: 'outbound',
      guest_id: guestId ?? null,
      reservation_id: reservationId ?? null,
      to_address: `+${phone}`,
      from_address: settings.display_phone_number ?? settings.phone_number_id,
      subject: null,
      body: template ? `[template:${template.name}]` : text,
      template_kind: templateKind ?? (template ? 'template' : 'free'),
      status: ok ? 'sent' : 'failed',
      provider: 'whatsapp_cloud',
      provider_message_id: providerMessageId,
      error_message: errorMessage,
      created_by: createdBy,
      sent_at: ok ? new Date().toISOString() : null,
    });

    if (!ok) {
      await svc.from('hotel_whatsapp_settings')
        .update({ connection_status: 'error', last_error: errorMessage })
        .eq('hotel_id', hotelId);
      return json({ error: 'send_failed', message: errorMessage }, 502);
    }

    return json({ success: true, messageId: providerMessageId, to: `+${phone}` });
  } catch (err) {
    console.error('[send-whatsapp]', err);
    return json({ error: 'internal_error', message: String(err) }, 500);
  }
});
