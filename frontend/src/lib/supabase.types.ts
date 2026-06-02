/**
 * FLOWTYM — Database typings (aligned with the live Supabase schema).
 *
 * The schema is hotel-scoped (multi-tenant via hotel_id). RLS policies in
 * 0010_flowtym_align.sql guarantee that a user only sees rows belonging to
 * their own hotel via `public.get_user_hotel_id()`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Roles defined as a Postgres enum `admin_user_role`. */
export type AdminUserRole =
  | 'reception'
  | 'gouvernante'
  | 'femme_de_chambre'
  | 'maintenance'
  | 'breakfast'
  | 'direction';

/** `reservation_status` enum (DB) + free-text statuses observed in the app. */
export type ReservationStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

export interface UserRow {
  id: string;
  auth_id: string;
  hotel_id: string;
  email: string;
  full_name: string;
  role: AdminUserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HotelRow {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  tva_number: string | null;
  logo_url: string | null;
  timezone: string | null;
  currency: string | null;
  city_tax_rate: number | null;
  active: boolean | null;
  created_at: string | null;
}

export interface RoomRow {
  id: string;
  hotel_id: string | null;
  number: string;
  type: string | null;
  category: string | null;
  floor: number | null;
  surface_m2: number | null;
  max_occupancy: number | null;
  base_price: number | null;
  status: string | null;
  housekeeping_status: string | null;
  assigned_to: string | null;
  amenities: Json | null;
  notes: string | null;
  active: boolean | null;
  created_at: string | null;
}

export interface GuestRow {
  id: string;
  hotel_id: string | null;
  legacy_id: number;
  first_name: string | null;
  last_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  nationality: string | null;
  segment: string | null;
  loyalty_level: string | null;
  total_spent: number | null;
  total_stays: number | null;
  blacklisted: boolean | null;
  vip: boolean | null;
  badges: string[] | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ReservationRow {
  id: string;
  reference: string | null;
  hotel_id: string | null;
  room_id: string | null;
  room_number: string | null;
  guest_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  group_id: string | null;
  rate_plan_id: string | null;
  check_in: string;
  check_out: string;
  nights: number | null;
  status: ReservationStatus | string | null;
  checkin_status: string | null;
  adults: number | null;
  children: number | null;
  pax: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  solde: number | null;
  city_tax: number | null;
  source: string | null;
  segment: string | null;
  payment_status: string | null;
  notes: string | null;
  special_requests: string | null;
  room_type: string | null;
  room_category: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AuditLogRow {
  id: string;
  hotel_id: string;
  actor_user_id: string | null;
  entity: string;
  entity_id: string;
  action: string;
  payload: Json;
  correlation_id: string | null;
  created_at: string;
}

export interface HotelEmailSettingsRow {
  hotel_id: string;
  provider: 'smtp' | 'resend' | 'gmail_oauth' | 'microsoft_graph';
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_secure: boolean;
  oauth_account: string | null;
  is_active: boolean;
  connection_status: 'disconnected' | 'connected' | 'error';
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface HotelWhatsappSettingsRow {
  hotel_id: string;
  meta_business_id: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  is_active: boolean;
  connection_status: 'disconnected' | 'connected' | 'error';
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationTemplateRow {
  id: string;
  hotel_id: string;
  channel: 'email' | 'whatsapp';
  kind: 'confirmation' | 'pre_arrival' | 'checkin' | 'invoice' | 'reminder' | 'free';
  name: string;
  subject: string | null;
  body: string;
  language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunicationLogRow {
  id: string;
  hotel_id: string;
  channel: 'email' | 'whatsapp';
  direction: 'outbound' | 'inbound';
  guest_id: string | null;
  reservation_id: string | null;
  to_address: string | null;
  from_address: string | null;
  subject: string | null;
  body: string | null;
  template_kind: string | null;
  status: 'queued' | 'sent' | 'failed';
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface GuestBadgeHistoryRow {
  id: string;
  hotel_id: string;
  guest_id: string;
  reservation_id: string | null;
  old_badges: string[];
  new_badges: string[];
  changed_by: string | null;
  source: string;
  changed_at: string;
}

export interface Database {
  public: {
    Tables: {
      hotel_email_settings: {
        Row: HotelEmailSettingsRow;
        Insert: Partial<HotelEmailSettingsRow> & { hotel_id: string };
        Update: Partial<HotelEmailSettingsRow>;
      };
      hotel_whatsapp_settings: {
        Row: HotelWhatsappSettingsRow;
        Insert: Partial<HotelWhatsappSettingsRow> & { hotel_id: string };
        Update: Partial<HotelWhatsappSettingsRow>;
      };
      communication_templates: {
        Row: CommunicationTemplateRow;
        Insert: Partial<CommunicationTemplateRow> & { hotel_id: string; channel: string; kind: string; name: string; body: string };
        Update: Partial<CommunicationTemplateRow>;
      };
      communication_logs: {
        Row: CommunicationLogRow;
        Insert: Partial<CommunicationLogRow> & { hotel_id: string; channel: string };
        Update: Partial<CommunicationLogRow>;
      };
      guest_badge_history: {
        Row: GuestBadgeHistoryRow;
        Insert: Partial<GuestBadgeHistoryRow> & { hotel_id: string; guest_id: string };
        Update: never;
      };
      hotels: {
        Row: HotelRow;
        Insert: Partial<HotelRow> & { name: string };
        Update: Partial<HotelRow>;
      };
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, 'id' | 'created_at' | 'updated_at' | 'last_login_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: Partial<UserRow>;
      };
      rooms: {
        Row: RoomRow;
        Insert: Partial<RoomRow> & { number: string };
        Update: Partial<RoomRow>;
      };
      guests: {
        Row: GuestRow;
        Insert: Partial<GuestRow> & { last_name: string };
        Update: Partial<GuestRow>;
      };
      reservations: {
        Row: ReservationRow;
        Insert: Partial<ReservationRow> & { check_in: string; check_out: string };
        Update: Partial<ReservationRow>;
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_user_hotel_id: { Args: Record<string, never>; Returns: string };
      get_user_role: { Args: Record<string, never>; Returns: AdminUserRole };
      set_guest_badges: {
        Args: { p_guest_id: string; p_badges: string[]; p_reservation_id?: string | null; p_source?: string };
        Returns: string[];
      };
      set_communication_secret: {
        Args: { p_channel: string; p_secret_key: string; p_value: string };
        Returns: undefined;
      };
      has_communication_secret: {
        Args: { p_channel: string; p_secret_key: string };
        Returns: boolean;
      };
      provision_user_for_hotel: {
        Args: {
          p_auth_user_id: string;
          p_email: string;
          p_full_name: string;
          p_hotel_id: string;
          p_role: AdminUserRole;
        };
        Returns: string;
      };
    };
    Enums: {
      admin_user_role: AdminUserRole;
      reservation_status: ReservationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
