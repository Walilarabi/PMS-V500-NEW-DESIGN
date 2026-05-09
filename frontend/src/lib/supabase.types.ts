/**
 * FLOWTYM — Database typings.
 *
 * Hand-curated for the multi-tenant PMS schema. To regenerate from the live
 * Supabase project run:
 *
 *   yarn supabase gen types typescript --project-id hzrzkvdebaadditvbqis \
 *     > src/lib/supabase.types.ts
 *
 * Until then, this file is the contract between the domain layer and Postgres.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ReservationStatus =
  | 'draft'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export type RoomStatus = 'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'maintenance';

export type UserRole = 'owner' | 'admin' | 'manager' | 'receptionist' | 'housekeeping' | 'accountant';

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      hotels: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          slug: string;
          stars: number;
          address: string | null;
          city: string | null;
          zip: string | null;
          country: string;
          phone: string | null;
          email: string | null;
          timezone: string;
          currency: string;
          locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          slug: string;
          stars?: number;
          address?: string | null;
          city?: string | null;
          zip?: string | null;
          country?: string;
          phone?: string | null;
          email?: string | null;
          timezone?: string;
          currency?: string;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['hotels']['Insert']>;
      };
      app_users: {
        Row: {
          id: string;
          tenant_id: string;
          auth_user_id: string;
          email: string;
          full_name: string;
          role: UserRole;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          auth_user_id: string;
          email: string;
          full_name: string;
          role?: UserRole;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['app_users']['Insert']>;
      };
      room_types: {
        Row: {
          id: string;
          tenant_id: string;
          hotel_id: string;
          code: string;
          label: string;
          base_capacity: number;
          max_capacity: number;
          base_price_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          hotel_id: string;
          code: string;
          label: string;
          base_capacity?: number;
          max_capacity?: number;
          base_price_cents?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['room_types']['Insert']>;
      };
      rooms: {
        Row: {
          id: string;
          tenant_id: string;
          hotel_id: string;
          room_type_id: string | null;
          number: string;
          floor: string | null;
          status: RoomStatus;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          hotel_id: string;
          room_type_id?: string | null;
          number: string;
          floor?: string | null;
          status?: RoomStatus;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>;
      };
      guests: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          nationality: string | null;
          segment: string | null;
          loyalty_tier: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          nationality?: string | null;
          segment?: string | null;
          loyalty_tier?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['guests']['Insert']>;
      };
      reservations: {
        Row: {
          id: string;
          tenant_id: string;
          hotel_id: string;
          reference: string;
          guest_id: string | null;
          room_id: string | null;
          status: ReservationStatus;
          payment_status: PaymentStatus;
          check_in: string;
          check_out: string;
          adults: number;
          children: number;
          channel: string;
          rate_plan: string | null;
          total_cents: number;
          currency: string;
          notes: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          hotel_id: string;
          reference: string;
          guest_id?: string | null;
          room_id?: string | null;
          status?: ReservationStatus;
          payment_status?: PaymentStatus;
          check_in: string;
          check_out: string;
          adults?: number;
          children?: number;
          channel?: string;
          rate_plan?: string | null;
          total_cents?: number;
          currency?: string;
          notes?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reservations']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          actor_user_id: string | null;
          entity: string;
          entity_id: string;
          action: string;
          payload: Json;
          correlation_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          actor_user_id?: string | null;
          entity: string;
          entity_id: string;
          action: string;
          payload?: Json;
          correlation_id?: string | null;
          created_at?: string;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_tenant_id: { Args: Record<string, never>; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
