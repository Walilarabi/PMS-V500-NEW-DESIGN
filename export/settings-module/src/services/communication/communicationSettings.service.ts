/**
 * FLOWTYM — Paramètres de communication par hôtel (email + WhatsApp).
 *
 * Config non-secrète : tables hotel_email_settings / hotel_whatsapp_settings (RLS).
 * Secrets (tokens, mot de passe SMTP) : RPC set_communication_secret →
 * table privée _hotel_communication_secrets, jamais relue par le frontend.
 * Le statut "secret présent" est obtenu via has_communication_secret().
 */
import { supabase } from '@/src/lib/supabase';
import { resolveHotelId } from '@/src/lib/hotelId';
import { mapSupabaseError } from '@/src/domains/_shared/errors';

export type EmailProvider = 'smtp' | 'resend' | 'gmail_oauth' | 'microsoft_graph';
export type ConnectionStatus = 'disconnected' | 'connected' | 'error';

export interface EmailSettings {
  hotel_id: string;
  provider: EmailProvider;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_secure: boolean;
  oauth_account: string | null;
  is_active: boolean;
  connection_status: ConnectionStatus;
  last_tested_at: string | null;
  last_error: string | null;
}

export interface WhatsAppSettings {
  hotel_id: string;
  meta_business_id: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  is_active: boolean;
  connection_status: ConnectionStatus;
  last_tested_at: string | null;
  last_error: string | null;
}

// ─── EMAIL ────────────────────────────────────────────────────────────────────

export async function getEmailSettings(): Promise<EmailSettings | null> {
  const { data, error } = await supabase.from('hotel_email_settings').select('*').maybeSingle();
  if (error) throw mapSupabaseError(error);
  return (data as EmailSettings | null) ?? null;
}

export async function saveEmailSettings(patch: Partial<EmailSettings>): Promise<EmailSettings> {
  const hotelId = await resolveHotelId();
  if (!hotelId) throw mapSupabaseError({ message: 'Aucun hôtel actif' });
  const payload = { ...patch, hotel_id: hotelId };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('hotel_email_settings') as any)
    .upsert(payload, { onConflict: 'hotel_id' })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return data as EmailSettings;
}

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────

export async function getWhatsAppSettings(): Promise<WhatsAppSettings | null> {
  const { data, error } = await supabase.from('hotel_whatsapp_settings').select('*').maybeSingle();
  if (error) throw mapSupabaseError(error);
  return (data as WhatsAppSettings | null) ?? null;
}

export async function saveWhatsAppSettings(patch: Partial<WhatsAppSettings>): Promise<WhatsAppSettings> {
  const hotelId = await resolveHotelId();
  if (!hotelId) throw mapSupabaseError({ message: 'Aucun hôtel actif' });
  const payload = { ...patch, hotel_id: hotelId };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('hotel_whatsapp_settings') as any)
    .upsert(payload, { onConflict: 'hotel_id' })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return data as WhatsAppSettings;
}

// ─── SECRETS (jamais relus au frontend) ───────────────────────────────────────

export type Channel = 'email' | 'whatsapp';

/** Stocke (ou supprime si vide) un secret côté serveur. */
export async function setSecret(channel: Channel, key: string, value: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('set_communication_secret', {
    p_channel: channel, p_secret_key: key, p_value: value,
  });
  if (error) throw mapSupabaseError(error);
}

/** Indique si un secret est présent (sans jamais exposer sa valeur). */
export async function hasSecret(channel: Channel, key: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('has_communication_secret', {
    p_channel: channel, p_secret_key: key,
  });
  if (error) throw mapSupabaseError(error);
  return Boolean(data);
}

// ─── TEST D'ENVOI ─────────────────────────────────────────────────────────────

export interface TestResult { ok: boolean; message: string }

/** Envoie un email de test à l'adresse fournie via l'edge function send-email. */
export async function testEmail(to: string): Promise<TestResult> {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      to,
      subject: 'Test de configuration email — Flowtym',
      body: '<p>Ceci est un email de test envoyé depuis Flowtym. Votre configuration email fonctionne. ✅</p>',
      templateKind: 'free',
    },
  });
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any)?.context;
    let msg = (error as Error).message;
    if (ctx && typeof ctx.json === 'function') {
      try { const p = await ctx.json(); msg = p?.message ?? msg; } catch { /* ignore */ }
    }
    return { ok: false, message: msg };
  }
  return { ok: true, message: `Email de test envoyé à ${to}.` + (data?.provider ? ` (${data.provider})` : '') };
}

/** Envoie un message WhatsApp de test (texte libre — nécessite fenêtre 24h ouverte). */
export async function testWhatsApp(to: string): Promise<TestResult> {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { to, text: 'Test de configuration WhatsApp — Flowtym ✅', templateKind: 'free' },
  });
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any)?.context;
    let msg = (error as Error).message;
    if (ctx && typeof ctx.json === 'function') {
      try { const p = await ctx.json(); msg = p?.message ?? msg; } catch { /* ignore */ }
    }
    return { ok: false, message: msg };
  }
  return { ok: true, message: `Message WhatsApp de test envoyé à ${to}.` + (data?.messageId ? ` (id: ${data.messageId})` : '') };
}
