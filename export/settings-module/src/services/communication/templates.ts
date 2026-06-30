/**
 * FLOWTYM — Modèles de communication (email / WhatsApp).
 *
 * Les modèles par défaut sont fournis ici (fallback hors-ligne). Un hôtel peut
 * surcharger via la table communication_templates (chargée par fetchHotelTemplates).
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';

export type TemplateKind = 'confirmation' | 'pre_arrival' | 'checkin' | 'invoice' | 'reminder' | 'free';
export type TemplateChannel = 'email' | 'whatsapp';

export interface CommTemplate {
  id: string;
  kind: TemplateKind;
  channel: TemplateChannel;
  label: string;
  icon: string;
  subject?: string;
  body: string;
}

/** Variables disponibles dans les modèles. */
export interface TemplateVars {
  guest: string;
  room: string;
  reservation: string;
  checkin: string;
  checkout: string;
  hotel: string;
}

export function fillTemplate(text: string, vars: Partial<TemplateVars>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v ?? `{{${key}}}`;
  });
}

export const DEFAULT_EMAIL_TEMPLATES: CommTemplate[] = [
  {
    id: 'email-confirmation', kind: 'confirmation', channel: 'email', label: 'Confirmation', icon: '✅',
    subject: 'Confirmation de votre réservation — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nNous confirmons votre réservation {{reservation}} du {{checkin}} au {{checkout}} (chambre {{room}}).\n\nAu plaisir de vous accueillir,\nL\'équipe {{hotel}}',
  },
  {
    id: 'email-pre_arrival', kind: 'pre_arrival', channel: 'email', label: 'Pré-arrivée', icon: '📅',
    subject: 'Votre arrivée approche — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nVotre séjour débute le {{checkin}}. Le check-in est possible à partir de 15h00. N\'hésitez pas à nous indiquer votre heure d\'arrivée.\n\nÀ très bientôt,\nL\'équipe {{hotel}}',
  },
  {
    id: 'email-invoice', kind: 'invoice', channel: 'email', label: 'Facture', icon: '🧾',
    subject: 'Votre facture — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nVeuillez trouver votre facture relative à la réservation {{reservation}}.\n\nMerci de votre confiance,\nL\'équipe {{hotel}}',
  },
  {
    id: 'email-reminder', kind: 'reminder', channel: 'email', label: 'Relance', icon: '🔔',
    subject: 'Rappel — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nNous revenons vers vous concernant votre réservation {{reservation}}.\n\nCordialement,\nL\'équipe {{hotel}}',
  },
  {
    id: 'email-free', kind: 'free', channel: 'email', label: 'Message libre', icon: '✍️',
    subject: 'Message de {{hotel}}',
    body: 'Bonjour {{guest}},\n\n',
  },
];

export const DEFAULT_WHATSAPP_TEMPLATES: CommTemplate[] = [
  {
    id: 'wa-confirmation', kind: 'confirmation', channel: 'whatsapp', label: 'Confirmation', icon: '✅',
    body: 'Bonjour {{guest}} 👋 Votre réservation {{reservation}} ({{checkin}} → {{checkout}}, chambre {{room}}) est confirmée. À bientôt ! — {{hotel}}',
  },
  {
    id: 'wa-pre_arrival', kind: 'pre_arrival', channel: 'whatsapp', label: 'Pré-arrivée', icon: '📅',
    body: 'Bonjour {{guest}}, votre séjour à {{hotel}} débute le {{checkin}}. Check-in dès 15h. Indiquez-nous votre heure d\'arrivée 🙂',
  },
  {
    id: 'wa-checkin', kind: 'checkin', channel: 'whatsapp', label: 'Check-in', icon: '🔑',
    body: 'Bienvenue {{guest}} ! Votre chambre {{room}} est prête. Bon séjour à {{hotel}} 🔑',
  },
  {
    id: 'wa-invoice', kind: 'invoice', channel: 'whatsapp', label: 'Facture disponible', icon: '🧾',
    body: 'Bonjour {{guest}}, votre facture pour la réservation {{reservation}} est disponible. — {{hotel}}',
  },
  {
    id: 'wa-free', kind: 'free', channel: 'whatsapp', label: 'Message libre', icon: '✍️',
    body: 'Bonjour {{guest}}, ',
  },
];

export function defaultTemplates(channel: TemplateChannel): CommTemplate[] {
  return channel === 'email' ? DEFAULT_EMAIL_TEMPLATES : DEFAULT_WHATSAPP_TEMPLATES;
}

/**
 * Charge les modèles personnalisés de l'hôtel pour un canal. Si aucun n'est
 * défini, retourne les modèles par défaut. Fusionne par `kind` (override).
 */
export async function fetchTemplates(channel: TemplateChannel): Promise<CommTemplate[]> {
  const { data, error } = await supabase
    .from('communication_templates')
    .select('id, channel, kind, name, subject, body, is_active')
    .eq('channel', channel)
    .eq('is_active', true);
  if (error) throw mapSupabaseError(error);

  const defaults = defaultTemplates(channel);
  if (!data || data.length === 0) return defaults;

  const custom: CommTemplate[] = data.map((r) => ({
    id: r.id as string,
    channel,
    kind: r.kind as TemplateKind,
    label: (r.name as string) ?? r.kind,
    icon: defaults.find((d) => d.kind === r.kind)?.icon ?? '✉️',
    subject: (r.subject as string | null) ?? undefined,
    body: r.body as string,
  }));

  // Override des defaults par kind, puis ajoute les kinds custom non couverts
  const byKind = new Map<string, CommTemplate>();
  for (const d of defaults) byKind.set(d.kind, d);
  for (const c of custom) byKind.set(c.kind, c);
  return [...byKind.values()];
}
