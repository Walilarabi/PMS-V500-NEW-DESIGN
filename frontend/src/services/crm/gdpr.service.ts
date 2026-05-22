/**
 * FLOWTYM — GDPR compliance service (Wave C8)
 *
 * Consent tracking, data export, anonymisation, and request lifecycle.
 */

import { supabase } from '@/src/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GdprRequestType =
  | 'access'
  | 'erasure'
  | 'portability'
  | 'rectification'
  | 'objection';

export type GdprRequestStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'rejected';

export interface GdprRequest {
  id: string;
  guest_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  request_type: GdprRequestType;
  status: GdprRequestStatus;
  notes: string | null;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GdprConsentRow {
  id: string;
  full_name: string;
  email: string | null;
  gdpr_consent: boolean | null;
  gdpr_date: string | null;
  total_stays: number | null;
  segment: string | null;
  created_at: string;
}

export interface GdprConsentOverview {
  total: number;
  consented: number;
  refused: number;
  unknown: number;
  consent_rate: number | null;
}

// ─── Request type metadata ────────────────────────────────────────────────────

export const REQUEST_TYPE_META: Record<
  GdprRequestType,
  { label: string; description: string; color: string }
> = {
  access:        { label: "Droit d'accès",       description: 'Obtenir une copie des données personnelles', color: '#3B82F6' },
  erasure:       { label: "Droit à l'effacement", description: 'Supprimer toutes les données personnelles',  color: '#EF4444' },
  portability:   { label: 'Portabilité',          description: 'Exporter les données dans un format lisible', color: '#8B5CF6' },
  rectification: { label: 'Rectification',        description: 'Corriger des données inexactes ou incomplètes', color: '#F59E0B' },
  objection:     { label: 'Opposition',           description: "S'opposer au traitement des données",         color: '#6B7280' },
};

export const REQUEST_STATUS_META: Record<
  GdprRequestStatus,
  { label: string; color: string; bg: string }
> = {
  pending:    { label: 'En attente',   color: '#F59E0B', bg: '#FFFBEB' },
  processing: { label: 'En cours',     color: '#3B82F6', bg: '#EFF6FF' },
  completed:  { label: 'Complété',     color: '#10B981', bg: '#ECFDF5' },
  rejected:   { label: 'Refusé',       color: '#EF4444', bg: '#FEF2F2' },
};

// ─── Consent ──────────────────────────────────────────────────────────────────

export async function setGdprConsent(
  guestId: string,
  consent: boolean,
  channel = 'manual',
  notes?: string,
): Promise<void> {
  const { error } = await (supabase.rpc as any)('crm_set_gdpr_consent', {
    p_guest_id: guestId,
    p_consent:  consent,
    p_channel:  channel,
    p_notes:    notes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getConsentOverview(): Promise<GdprConsentOverview> {
  const { data, error } = await (supabase.rpc as any)('crm_gdpr_consent_overview');
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data as any;
  return {
    total:        Number(row?.total        ?? 0),
    consented:    Number(row?.consented    ?? 0),
    refused:      Number(row?.refused      ?? 0),
    unknown:      Number(row?.unknown      ?? 0),
    consent_rate: row?.consent_rate != null ? Number(row.consent_rate) : null,
  };
}

export async function listGuestsConsent(
  filter: 'consented' | 'refused' | 'unknown' | null = null,
  limit = 100,
  offset = 0,
): Promise<GdprConsentRow[]> {
  const { data, error } = await (supabase.rpc as any)('crm_list_guests_consent', {
    p_filter: filter,
    p_limit:  limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as GdprConsentRow[];
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export async function listGdprRequests(
  status?: GdprRequestStatus,
): Promise<GdprRequest[]> {
  const { data, error } = await (supabase.rpc as any)('crm_list_gdpr_requests', {
    p_status: status ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as GdprRequest[];
}

export async function createGdprRequest(
  guestId: string,
  requestType: GdprRequestType,
  notes?: string,
): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('crm_create_gdpr_request', {
    p_guest_id:     guestId,
    p_request_type: requestType,
    p_notes:        notes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function resolveGdprRequest(
  requestId: string,
  status: GdprRequestStatus,
  resolution?: string,
): Promise<void> {
  const { error } = await (supabase.rpc as any)('crm_resolve_gdpr_request', {
    p_request_id: requestId,
    p_status:     status,
    p_resolution: resolution ?? null,
  });
  if (error) throw new Error(error.message);
}

// ─── Export & Erase ───────────────────────────────────────────────────────────

export async function exportGuestData(guestId: string): Promise<object> {
  const { data, error } = await (supabase.rpc as any)('crm_gdpr_export_guest', {
    p_guest_id: guestId,
  });
  if (error) throw new Error(error.message);
  return data as object;
}

export async function eraseGuestData(
  guestId: string,
  reason = 'GDPR erasure request',
): Promise<void> {
  const { error } = await (supabase.rpc as any)('crm_gdpr_erase_guest', {
    p_guest_id: guestId,
    p_reason:   reason,
  });
  if (error) throw new Error(error.message);
}
