/**
 * FLOWTYM — Modèles de communication (email / WhatsApp).
 *
 * Les modèles par défaut sont fournis ici (fallback hors-ligne). Un hôtel peut
 * surcharger via la table communication_templates (chargée par fetchHotelTemplates).
 */
import { supabase } from '@/src/lib/supabase';
import { resolveHotelId } from '@/src/lib/hotelId';
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
  /** Présent pour les modèles enregistrés en base (modèles propres à l'hôtel). */
  isCustom?: boolean;
  /** Activé pour l'envoi (paramétrage d'envoi). DB only. */
  isActive?: boolean;
  language?: string;
}

/**
 * Métadonnées des « types » (= déclencheur d'envoi) de modèle. Le `kind`
 * indique QUAND le modèle est utilisé — c'est le paramétrage d'envoi de base.
 */
export const TEMPLATE_KIND_META: Record<TemplateKind, { label: string; trigger: string }> = {
  confirmation: { label: 'Confirmation', trigger: 'À la confirmation de la réservation' },
  pre_arrival: { label: 'Pré-arrivée', trigger: 'Quelques jours avant l\'arrivée' },
  checkin: { label: 'Check-in', trigger: 'Le jour de l\'arrivée / à l\'enregistrement' },
  invoice: { label: 'Facture', trigger: 'À l\'émission de la facture' },
  reminder: { label: 'Relance', trigger: 'En relance (paiement, avis, document…)' },
  free: { label: 'Message libre', trigger: 'Envoi manuel, à la demande' },
};

export const TEMPLATE_KINDS: TemplateKind[] = [
  'confirmation', 'pre_arrival', 'checkin', 'invoice', 'reminder', 'free',
];

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

// ─── Bibliothèque de modèles pour le milieu hôtelier ──────────────────────────
//
// Prête à l'emploi : sélectionnez un modèle, personnalisez-le, enregistrez-le
// comme modèle propre à l'hôtel. `category` sert au regroupement dans l'UI.

export interface LibraryTemplate extends CommTemplate {
  description: string;
  category: string;
}

export const HOSPITALITY_LIBRARY: LibraryTemplate[] = [
  // ── Email ────────────────────────────────────────────────────────────────
  {
    id: 'lib-email-confirmation', kind: 'confirmation', channel: 'email', icon: '✅',
    category: 'Réservation', label: 'Confirmation de réservation',
    description: 'Confirme la réservation avec les dates et la chambre.',
    subject: 'Confirmation de votre réservation — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nNous avons le plaisir de confirmer votre réservation {{reservation}} du {{checkin}} au {{checkout}} (chambre {{room}}).\n\nNous restons à votre disposition pour préparer au mieux votre séjour.\n\nÀ très bientôt,\nL\'équipe {{hotel}}',
  },
  {
    id: 'lib-email-prearrival', kind: 'pre_arrival', channel: 'email', icon: '📅',
    category: 'Avant le séjour', label: 'Préparation de l\'arrivée',
    description: 'Rappel J-3 avec horaires de check-in et demande d\'heure d\'arrivée.',
    subject: 'Votre arrivée approche — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nVotre séjour débute le {{checkin}}. Le check-in est possible à partir de 15h00.\n\nPour préparer votre accueil, pourriez-vous nous indiquer votre heure d\'arrivée approximative ? N\'hésitez pas à nous signaler toute demande particulière.\n\nÀ très bientôt,\nL\'équipe {{hotel}}',
  },
  {
    id: 'lib-email-checkin', kind: 'checkin', channel: 'email', icon: '🔑',
    category: 'Pendant le séjour', label: 'Informations de check-in',
    description: 'Instructions d\'accès et bienvenue le jour de l\'arrivée.',
    subject: 'Bienvenue à {{hotel}} — informations pratiques',
    body: 'Bonjour {{guest}},\n\nNous sommes ravis de vous accueillir aujourd\'hui. Votre chambre {{room}} vous attend.\n\nLa réception est ouverte 24h/24 pour toute question. Le petit-déjeuner est servi de 7h à 10h30.\n\nExcellent séjour parmi nous,\nL\'équipe {{hotel}}',
  },
  {
    id: 'lib-email-upsell', kind: 'free', channel: 'email', icon: '⭐',
    category: 'Avant le séjour', label: 'Proposition de surclassement',
    description: 'Offre commerciale (surclassement / services) avant l\'arrivée.',
    subject: 'Sublimez votre séjour — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nÀ l\'approche de votre arrivée le {{checkin}}, nous serions heureux de rendre votre séjour encore plus mémorable :\n\n• Surclassement en chambre supérieure\n• Petit-déjeuner gourmand en chambre\n• Arrivée anticipée / départ tardif\n\nRépondez simplement à cet email, nous nous occupons du reste.\n\nL\'équipe {{hotel}}',
  },
  {
    id: 'lib-email-invoice', kind: 'invoice', channel: 'email', icon: '🧾',
    category: 'Facturation', label: 'Envoi de facture',
    description: 'Transmet la facture liée à la réservation.',
    subject: 'Votre facture — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nVeuillez trouver ci-joint votre facture relative à la réservation {{reservation}}.\n\nNous vous remercions de votre confiance et restons à votre disposition pour toute question.\n\nCordialement,\nL\'équipe {{hotel}}',
  },
  {
    id: 'lib-email-thanks', kind: 'free', channel: 'email', icon: '💛',
    category: 'Après le séjour', label: 'Remerciement après départ',
    description: 'Message de remerciement le jour du départ.',
    subject: 'Merci pour votre visite — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nMerci d\'avoir choisi {{hotel}} pour votre séjour. Nous espérons que tout s\'est déroulé à la hauteur de vos attentes.\n\nAu plaisir de vous accueillir à nouveau très prochainement.\n\nBien chaleureusement,\nL\'équipe {{hotel}}',
  },
  {
    id: 'lib-email-review', kind: 'free', channel: 'email', icon: '🌟',
    category: 'Après le séjour', label: 'Demande d\'avis',
    description: 'Sollicite un avis client après le départ.',
    subject: 'Votre avis compte pour nous — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nNous espérons que votre séjour à {{hotel}} vous a séduit. Votre retour nous aide à nous améliorer chaque jour.\n\nAuriez-vous quelques instants pour partager votre expérience ? Cela compte énormément pour notre équipe.\n\nMerci infiniment,\nL\'équipe {{hotel}}',
  },
  {
    id: 'lib-email-reminder', kind: 'reminder', channel: 'email', icon: '🔔',
    category: 'Facturation', label: 'Relance de paiement',
    description: 'Relance courtoise en cas de solde en attente.',
    subject: 'Rappel concernant votre réservation — {{hotel}}',
    body: 'Bonjour {{guest}},\n\nNous revenons vers vous concernant la réservation {{reservation}}. Un solde reste en attente de règlement.\n\nVous pouvez régulariser en répondant à cet email ou en contactant la réception.\n\nMerci par avance,\nL\'équipe {{hotel}}',
  },

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  {
    id: 'lib-wa-confirmation', kind: 'confirmation', channel: 'whatsapp', icon: '✅',
    category: 'Réservation', label: 'Confirmation de réservation',
    description: 'Confirmation courte et chaleureuse.',
    body: 'Bonjour {{guest}} 👋 Votre réservation {{reservation}} ({{checkin}} → {{checkout}}, chambre {{room}}) est bien confirmée. Au plaisir de vous accueillir ! — {{hotel}}',
  },
  {
    id: 'lib-wa-prearrival', kind: 'pre_arrival', channel: 'whatsapp', icon: '📅',
    category: 'Avant le séjour', label: 'Rappel avant arrivée',
    description: 'Rappel J-2 et demande d\'heure d\'arrivée.',
    body: 'Bonjour {{guest}} 🙂 Votre séjour à {{hotel}} débute le {{checkin}}. Check-in dès 15h. Pourriez-vous nous indiquer votre heure d\'arrivée ?',
  },
  {
    id: 'lib-wa-checkin', kind: 'checkin', channel: 'whatsapp', icon: '🔑',
    category: 'Pendant le séjour', label: 'Bienvenue / chambre prête',
    description: 'Message de bienvenue à l\'arrivée.',
    body: 'Bienvenue {{guest}} ! 🔑 Votre chambre {{room}} est prête. La réception reste à votre écoute 24h/24. Excellent séjour à {{hotel}} !',
  },
  {
    id: 'lib-wa-checkout', kind: 'free', channel: 'whatsapp', icon: '💛',
    category: 'Après le séjour', label: 'Remerciement de départ',
    description: 'Petit mot le jour du départ.',
    body: 'Merci {{guest}} d\'avoir séjourné à {{hotel}} 💛 Nous espérons vous revoir très vite. Bon retour !',
  },
  {
    id: 'lib-wa-review', kind: 'free', channel: 'whatsapp', icon: '🌟',
    category: 'Après le séjour', label: 'Demande d\'avis',
    description: 'Sollicitation d\'avis légère après le départ.',
    body: 'Bonjour {{guest}} 🌟 Votre avis sur votre séjour à {{hotel}} nous serait précieux. Auriez-vous un instant pour le partager ? Merci beaucoup !',
  },
  {
    id: 'lib-wa-invoice', kind: 'invoice', channel: 'whatsapp', icon: '🧾',
    category: 'Facturation', label: 'Facture disponible',
    description: 'Notification de facture disponible.',
    body: 'Bonjour {{guest}}, votre facture pour la réservation {{reservation}} est disponible. — {{hotel}}',
  },
];

export function libraryFor(channel: TemplateChannel): LibraryTemplate[] {
  return HOSPITALITY_LIBRARY.filter((t) => t.channel === channel);
}

// ─── CRUD — modèles propres à l'hôtel ─────────────────────────────────────────

/** Charge uniquement les modèles enregistrés par l'hôtel (sans defaults). */
export async function fetchHotelTemplates(channel: TemplateChannel): Promise<CommTemplate[]> {
  const { data, error } = await supabase
    .from('communication_templates')
    .select('id, channel, kind, name, subject, body, is_active, language')
    .eq('channel', channel)
    .order('created_at', { ascending: true });
  if (error) throw mapSupabaseError(error);
  const defaults = defaultTemplates(channel);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    channel,
    kind: r.kind as TemplateKind,
    label: (r.name as string) ?? r.kind,
    icon: defaults.find((d) => d.kind === r.kind)?.icon ?? '✉️',
    subject: (r.subject as string | null) ?? undefined,
    body: r.body as string,
    isActive: Boolean(r.is_active),
    language: (r.language as string | null) ?? 'fr',
    isCustom: true,
  }));
}

export interface TemplateInput {
  channel: TemplateChannel;
  kind: TemplateKind;
  name: string;
  subject?: string | null;
  body: string;
  language?: string;
  is_active?: boolean;
}

export async function createTemplate(input: TemplateInput): Promise<void> {
  const hotelId = await resolveHotelId();
  if (!hotelId) throw mapSupabaseError({ message: 'Aucun hôtel actif' });
  const payload = {
    hotel_id: hotelId,
    channel: input.channel,
    kind: input.kind,
    name: input.name,
    subject: input.channel === 'email' ? (input.subject ?? null) : null,
    body: input.body,
    language: input.language ?? 'fr',
    is_active: input.is_active ?? true,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('communication_templates') as any).insert(payload);
  if (error) throw mapSupabaseError(error);
}

export async function updateTemplate(id: string, patch: Partial<TemplateInput>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.language !== undefined) update.language = patch.language;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('communication_templates') as any)
    .update(update).eq('id', id);
  if (error) throw mapSupabaseError(error);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('communication_templates').delete().eq('id', id);
  if (error) throw mapSupabaseError(error);
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
