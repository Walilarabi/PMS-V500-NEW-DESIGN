/**
 * FLOWTYM — Service Pièces jointes (L3.1).
 *
 * Upload sur Supabase Storage (bucket privé, chemin hôtel-scopé) + métadonnée
 * en base via RPC register_attachment. Download par URL signée temporaire.
 * Données réelles uniquement ; isolation hôtel via RLS Storage + RLS table.
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';

export const ATTACHMENTS_BUCKET = 'communication-attachments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcFn = (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;

export interface UploadAttachmentParams {
  file: File;
  guestId?: string | null;
  reservationId?: string | null;
  messageId?: string | null;
  kind?: string;
  direction?: 'inbound' | 'outbound' | 'internal';
}

/** Limite de taille (25 Mo). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Upload un fichier puis enregistre sa métadonnée. Renvoie l'id d'attachment. */
export async function uploadAttachment(params: UploadAttachmentParams): Promise<string> {
  if (params.file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('Fichier trop volumineux (max 25 Mo).');
  }
  const { data: hotelId, error: hErr } = await (supabase.rpc as unknown as RpcFn)('get_user_hotel_id');
  if (hErr || !hotelId) throw new Error('Hôtel actif introuvable.');

  const scopeId = params.guestId ?? params.reservationId ?? 'misc';
  const fileId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const safeName = params.file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${hotelId}/${scopeId}/${fileId}/${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, params.file, { upsert: false, contentType: params.file.type || undefined });
  if (upErr) throw mapSupabaseError(upErr);

  const { data, error } = await (supabase.rpc as unknown as RpcFn)('register_attachment', {
    p_storage_path: path,
    p_filename: params.file.name,
    p_mime_type: params.file.type || 'application/octet-stream',
    p_size_bytes: params.file.size,
    p_kind: params.kind ?? 'other',
    p_message_id: params.messageId ?? null,
    p_communication_log_id: null,
    p_guest_id: params.guestId ?? null,
    p_reservation_id: params.reservationId ?? null,
    p_direction: params.direction ?? 'internal',
  });
  if (error) {
    // rollback best-effort de l'objet stocké si la métadonnée échoue
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]).catch(() => undefined);
    throw mapSupabaseError(error);
  }
  return data as string;
}

/** URL signée temporaire pour télécharger/afficher une pièce jointe. */
export async function getAttachmentUrl(storagePath: string, expiresInSec = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Supprime la métadonnée puis l'objet Storage. */
export async function deleteAttachment(id: string): Promise<void> {
  const { data: path, error } = await (supabase.rpc as unknown as RpcFn)('delete_attachment', { p_id: id });
  if (error) throw mapSupabaseError(error);
  if (path) await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path as string]).catch(() => undefined);
}
