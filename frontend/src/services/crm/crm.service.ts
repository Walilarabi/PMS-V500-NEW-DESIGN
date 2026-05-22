/**
 * FLOWTYM — CRM Service (Wave C1)
 *
 * Façade for guest syncing, profile 360° and company management RPCs.
 */

import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuestKpis {
  total_stays:        number;
  total_reservations: number;
  cancellations:      number;
  no_shows:           number;
  total_revenue:      number;
  avg_los:            number;
  avg_adr:            number;
  avg_lead_time_days: number;
}

export interface StaySummary {
  check_in:     string;
  check_out:    string;
  room_number:  string | null;
  total_amount: number;
  source:       string | null;
}

export interface HistoryEntry {
  id:           string;
  reference:    string;
  check_in:     string;
  check_out:    string;
  nights:       number;
  room_number:  string | null;
  room_type:    string | null;
  total_amount: number;
  paid_amount:  number;
  status:       string;
  source:       string | null;
}

export interface GuestProfile360 {
  guest: {
    id:               string;
    first_name:       string | null;
    last_name:        string;
    email:            string | null;
    phone:            string | null;
    whatsapp:         string | null;
    country:          string | null;
    nationality:      string | null;
    language:         string | null;
    segment:          string | null;
    loyalty_level:    string | null;
    vip:              boolean;
    blacklisted:      boolean;
    risk_level:       string;
    satisfaction_score: number | null;
    tags:             string[] | null;
    languages:        string[] | null;
    acquisition_source: string | null;
    notes:            string | null;
    gdpr_consent:     boolean;
    gdpr_date:        string | null;
    passport:         string | null;
    date_of_birth:    string | null;
    doc_expiry_date:  string | null;
    created_at:       string | null;
  };
  kpis:            GuestKpis;
  favorite_source: string | null;
  seasonality:     Record<string, number>;
  last_stay:       StaySummary | null;
  next_stay:       StaySummary | null;
  history:         HistoryEntry[];
}

export interface SyncResult {
  created:         number;
  linked:          number;
  total_processed: number;
}

export interface Company {
  id:              string;
  hotel_id:        string;
  name:            string;
  type:            'agency' | 'corporate' | 'tour_operator' | 'other';
  siret:           string | null;
  tva_number:      string | null;
  address:         string | null;
  city:            string | null;
  zip:             string | null;
  country:         string | null;
  email:           string | null;
  phone:           string | null;
  website:         string | null;
  contract_type:   string | null;
  negotiated_rate: number;
  credit_limit:    number;
  notes:           string | null;
  created_at:      string;
  updated_at:      string;
}

// ─── RPCs ─────────────────────────────────────────────────────────────────────

export async function syncGuestsFromReservations(): Promise<SyncResult> {
  const { data, error } = await (supabase.rpc as any)('crm_sync_guests_from_reservations');
  if (error) throw error;
  return data as SyncResult;
}

export async function computeGuestKpis(guestId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('crm_compute_guest_kpis', {
    p_guest_id: guestId,
  });
  if (error) throw error;
}

export async function getGuestProfile360(guestId: string): Promise<GuestProfile360> {
  const { data, error } = await (supabase.rpc as any)('crm_guest_profile_360', {
    p_guest_id: guestId,
  });
  if (error) throw error;
  return data as GuestProfile360;
}

export async function listCompanies(): Promise<Company[]> {
  const { data, error } = await (supabase.rpc as any)('crm_list_companies');
  if (error) return [];
  return (data ?? []) as Company[];
}

export async function saveCompany(
  company: Omit<Company, 'id' | 'hotel_id' | 'created_at' | 'updated_at'> & { id?: string | null },
): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('crm_save_company', {
    p_id:              company.id ?? null,
    p_name:            company.name,
    p_type:            company.type,
    p_siret:           company.siret,
    p_tva_number:      company.tva_number,
    p_address:         company.address,
    p_city:            company.city,
    p_zip:             company.zip,
    p_country:         company.country,
    p_email:           company.email,
    p_phone:           company.phone,
    p_website:         company.website,
    p_contract_type:   company.contract_type,
    p_negotiated_rate: company.negotiated_rate,
    p_credit_limit:    company.credit_limit,
    p_notes:           company.notes,
  });
  if (error) throw error;
  return data as string;
}
