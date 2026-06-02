/**
 * FLOWTYM — Edge Function: send-email
 * Envoie un email AU CLIENT depuis l'adresse de l'hôtel (jamais une adresse
 * Flowtym générique). La configuration et les secrets sont lus côté serveur :
 *   - public.hotel_email_settings        (config non-secrète, RLS hôtel)
 *   - public._hotel_communication_secrets (tokens / mot de passe SMTP, service_role only)
 *
 * Providers supportés : 'smtp' | 'resend' | 'gmail_oauth' | 'microsoft_graph'.
 *
 * POST /functions/v1/send-email
 * Headers: Authorization: Bearer <jwt utilisateur>
 * Body: {
 *   to: string, subject: string, body: string,
 *   reservationId?: string, guestId?: string, templateKind?: string,
 *   preview?: boolean
 * }
 *
 * Sécurité : le hotel_id est dérivé du JWT appelant (get_user_hotel_id),
 * jamais du body → isolation multi-tenant garantie.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// OAuth client credentials (optionnels — requis pour refresh token).
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const MS_CLIENT_ID = Deno.env.get('MS_CLIENT_ID') ?? '';
const MS_CLIENT_SECRET = Deno.env.get('MS_CLIENT_SECRET') ?? '';
const MS_TENANT_ID = Deno.env.get('MS_TENANT_ID') ?? 'common';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Encode une string UTF-8 en base64url (pour Gmail raw). */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildRfc822(from: string, to: string, subject: string, html: string): string {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n');
}

/** Récupère un secret depuis la table privée (service_role). */
async function getSecret(svc: Json, hotelId: string, key: string): Promise<string | null> {
  const { data } = await svc
    .from('_hotel_communication_secrets')
    .select('secret_value')
    .eq('hotel_id', hotelId)
    .eq('channel', 'email')
    .eq('secret_key', key)
    .maybeSingle();
  return data?.secret_value ?? null;
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function sendViaResend(
  apiKey: string, from: string, to: string, subject: string, html: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: JSON.stringify(data) };
  return { ok: true, id: data.id };
}

async function sendViaSmtp(
  cfg: { host: string; port: number; secure: boolean; username: string; password: string },
  from: string, to: string, subject: string, html: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts');
    const client = new SMTPClient({
      connection: {
        hostname: cfg.host,
        port: cfg.port,
        tls: cfg.secure,
        auth: { username: cfg.username, password: cfg.password },
      },
    });
    await client.send({ from, to, subject, content: 'text/html', html });
    await client.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `SMTP: ${String(err)}` };
  }
}

async function refreshOAuth(
  tokenUrl: string, clientId: string, clientSecret: string, refreshToken: string,
): Promise<string | null> {
  if (!clientId || !clientSecret || !refreshToken) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.access_token ?? null;
}

async function sendViaGmail(
  svc: Json, hotelId: string, from: string, to: string, subject: string, html: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let accessToken = await getSecret(svc, hotelId, 'access_token');
  const refreshToken = await getSecret(svc, hotelId, 'refresh_token');
  const raw = toBase64Url(buildRfc822(from, to, subject, html));

  const send = async (token: string) =>
    fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

  if (!accessToken && !refreshToken) {
    return { ok: false, error: 'Gmail non connecté : aucun token. Reconnectez le compte Google de l\'hôtel.' };
  }
  let res = accessToken ? await send(accessToken) : new Response(null, { status: 401 });
  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshOAuth(
      'https://oauth2.googleapis.com/token', GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, refreshToken,
    );
    if (refreshed) {
      accessToken = refreshed;
      await svc.from('_hotel_communication_secrets').upsert({
        hotel_id: hotelId, channel: 'email', secret_key: 'access_token',
        secret_value: refreshed, updated_at: new Date().toISOString(),
      });
      res = await send(refreshed);
    }
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return { ok: false, error: 'Token Gmail expiré et non renouvelable. Reconnectez le compte.' };
    return { ok: false, error: `Gmail API: ${JSON.stringify(data)}` };
  }
  const data = await res.json().catch(() => ({}));
  return { ok: true, id: data.id };
}

async function sendViaGraph(
  svc: Json, hotelId: string, from: string, to: string, subject: string, html: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let accessToken = await getSecret(svc, hotelId, 'access_token');
  const refreshToken = await getSecret(svc, hotelId, 'refresh_token');

  const payload = {
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  };
  const send = async (token: string) =>
    fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  if (!accessToken && !refreshToken) {
    return { ok: false, error: 'Microsoft 365 non connecté : aucun token. Reconnectez le compte.' };
  }
  let res = accessToken ? await send(accessToken) : new Response(null, { status: 401 });
  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshOAuth(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      MS_CLIENT_ID, MS_CLIENT_SECRET, refreshToken,
    );
    if (refreshed) {
      accessToken = refreshed;
      await svc.from('_hotel_communication_secrets').upsert({
        hotel_id: hotelId, channel: 'email', secret_key: 'access_token',
        secret_value: refreshed, updated_at: new Date().toISOString(),
      });
      res = await send(refreshed);
    }
  }
  // Graph sendMail renvoie 202 Accepted sans corps
  if (res.status === 202) return { ok: true };
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return { ok: false, error: 'Token Microsoft expiré et non renouvelable. Reconnectez le compte.' };
    return { ok: false, error: `Graph API: ${JSON.stringify(data)}` };
  }
  return { ok: true };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json({ error: 'Edge function mal configurée (SUPABASE_URL / SERVICE_ROLE_KEY manquant)' }, 500);
  }

  try {
    // ── Auth : dériver hotel_id du JWT appelant ────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Non authentifié' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: hotelId, error: hotelErr } = await userClient.rpc('get_user_hotel_id');
    if (hotelErr || !hotelId) return json({ error: 'Aucun hôtel actif pour cet utilisateur' }, 401);

    const { data: userRow } = await userClient
      .from('users').select('id').eq('auth_id', (await userClient.auth.getUser()).data.user?.id ?? '').maybeSingle();
    const createdBy = userRow?.id ?? null;

    const body = await req.json();
    const { to, subject, body: htmlBody, reservationId, guestId, templateKind, preview } = body ?? {};

    if (!to || !subject || !htmlBody) {
      return json({ error: 'Champs requis manquants : to, subject, body' }, 400);
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Charger la config email de l'hôtel ─────────────────────────────────────
    const { data: settings } = await svc
      .from('hotel_email_settings').select('*').eq('hotel_id', hotelId).maybeSingle();

    if (!settings || !settings.is_active) {
      return json({
        error: 'email_not_configured',
        message: 'Email hôtel non configuré. Connectez l\'email de l\'hôtel dans Paramètres > Communication.',
      }, 422);
    }
    if (!settings.from_email) {
      return json({ error: 'email_not_configured', message: 'Adresse expéditeur (from_email) manquante.' }, 422);
    }

    const fromHeader = settings.from_name
      ? `${settings.from_name} <${settings.from_email}>`
      : settings.from_email;

    if (preview) {
      return json({ preview: true, from: fromHeader, to, subject, provider: settings.provider });
    }

    // ── Dispatch provider ──────────────────────────────────────────────────────
    let result: { ok: boolean; id?: string; error?: string };
    switch (settings.provider) {
      case 'resend': {
        const apiKey = await getSecret(svc, hotelId, 'api_key');
        if (!apiKey) { result = { ok: false, error: 'Clé API Resend manquante.' }; break; }
        result = await sendViaResend(apiKey, fromHeader, to, subject, htmlBody);
        break;
      }
      case 'smtp': {
        const password = await getSecret(svc, hotelId, 'smtp_password');
        if (!settings.smtp_host || !settings.smtp_port || !settings.smtp_username || !password) {
          result = { ok: false, error: 'Configuration SMTP incomplète (host/port/username/password).' };
          break;
        }
        result = await sendViaSmtp(
          { host: settings.smtp_host, port: settings.smtp_port, secure: settings.smtp_secure ?? true,
            username: settings.smtp_username, password },
          fromHeader, to, subject, htmlBody,
        );
        break;
      }
      case 'gmail_oauth':
        result = await sendViaGmail(svc, hotelId, fromHeader, to, subject, htmlBody);
        break;
      case 'microsoft_graph':
        result = await sendViaGraph(svc, hotelId, fromHeader, to, subject, htmlBody);
        break;
      default:
        result = { ok: false, error: `Provider inconnu : ${settings.provider}` };
    }

    // ── Journaliser ────────────────────────────────────────────────────────────
    await svc.from('communication_logs').insert({
      hotel_id: hotelId,
      channel: 'email',
      direction: 'outbound',
      guest_id: guestId ?? null,
      reservation_id: reservationId ?? null,
      to_address: to,
      from_address: settings.from_email,
      subject,
      body: htmlBody,
      template_kind: templateKind ?? null,
      status: result.ok ? 'sent' : 'failed',
      provider: settings.provider,
      provider_message_id: result.id ?? null,
      error_message: result.ok ? null : result.error ?? 'Erreur inconnue',
      created_by: createdBy,
      sent_at: result.ok ? new Date().toISOString() : null,
    });

    // Mettre à jour le statut de connexion en cas d'échec d'auth
    if (!result.ok) {
      await svc.from('hotel_email_settings')
        .update({ connection_status: 'error', last_error: result.error ?? null })
        .eq('hotel_id', hotelId);
      return json({ error: 'send_failed', message: result.error }, 502);
    }

    return json({ success: true, messageId: result.id ?? null, provider: settings.provider, to });
  } catch (err) {
    console.error('[send-email]', err);
    return json({ error: 'internal_error', message: String(err) }, 500);
  }
});
