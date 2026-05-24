/**
 * FLOWTYM — Couche de persistance Supabase pour le module Paramètres.
 *
 * Pattern "best-effort sync" :
 *   • lecture / écriture localStorage immédiate (UX instantanée, mode offline)
 *   • synchro Supabase en arrière-plan (best-effort, ne bloque jamais l'UI)
 *   • réconciliation au prochain chargement (Supabase = source de vérité)
 *
 * Toute fonction de ce module est sûre à appeler hors session : si l'auth
 * n'est pas prête (`hotelId` null), seule la branche localStorage tourne.
 */
import { supabase } from '@/src/lib/supabase';
import type { EventSource } from '@/src/types/events';
import type { VirtualRoomKind } from '@/src/components/rms/types';
import type { AccessLevel, RoleId } from './permissionsService';

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getCurrentHotelIdSafe(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_user_hotel_id');
    if (error || !data) return null;
    return String(data);
  } catch {
    return null;
  }
}

function logSyncError(table: string, op: string, err: unknown) {
  if (typeof console !== 'undefined') {
    console.warn(`[settingsPersistence] ${table}.${op} failed (offline?)`, err);
  }
}

// ─── settings_virtual_rooms ────────────────────────────────────────────────

export interface VirtualRoomRow {
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  virtualKind: VirtualRoomKind;
  componentRoomTypeIds: string[];
  componentsRequired: 'all' | 'any';
  capacity: number;
  bathroom: string;
  description: string;
  isActive: boolean;
}

export async function syncVirtualRoomToSupabase(row: VirtualRoomRow): Promise<boolean> {
  const hotelId = await getCurrentHotelIdSafe();
  if (!hotelId) return false;
  try {
    const { error } = await supabase
      .from('settings_virtual_rooms')
      .upsert(
        {
          hotel_id: hotelId,
          room_type_id: row.roomTypeId,
          room_type_name: row.roomTypeName,
          room_type_code: row.roomTypeCode,
          virtual_kind: row.virtualKind,
          component_room_type_ids: row.componentRoomTypeIds,
          components_required: row.componentsRequired,
          capacity: row.capacity,
          bathroom: row.bathroom,
          description: row.description,
          is_active: row.isActive,
        },
        { onConflict: 'hotel_id,room_type_code' },
      );
    if (error) {
      logSyncError('settings_virtual_rooms', 'upsert', error);
      return false;
    }
    return true;
  } catch (err) {
    logSyncError('settings_virtual_rooms', 'upsert', err);
    return false;
  }
}

export async function deleteVirtualRoomFromSupabase(roomTypeCode: string): Promise<boolean> {
  const hotelId = await getCurrentHotelIdSafe();
  if (!hotelId) return false;
  try {
    const { error } = await supabase
      .from('settings_virtual_rooms')
      .delete()
      .eq('hotel_id', hotelId)
      .eq('room_type_code', roomTypeCode);
    if (error) {
      logSyncError('settings_virtual_rooms', 'delete', error);
      return false;
    }
    return true;
  } catch (err) {
    logSyncError('settings_virtual_rooms', 'delete', err);
    return false;
  }
}

export async function fetchVirtualRoomsFromSupabase(): Promise<VirtualRoomRow[]> {
  const hotelId = await getCurrentHotelIdSafe();
  if (!hotelId) return [];
  try {
    const { data, error } = await supabase
      .from('settings_virtual_rooms')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('is_active', true);
    if (error || !data) {
      if (error) logSyncError('settings_virtual_rooms', 'select', error);
      return [];
    }
    return data.map((r: Record<string, unknown>) => ({
      roomTypeId: String(r.room_type_id),
      roomTypeName: String(r.room_type_name),
      roomTypeCode: String(r.room_type_code),
      virtualKind: r.virtual_kind as VirtualRoomKind,
      componentRoomTypeIds: (r.component_room_type_ids as string[]) ?? [],
      componentsRequired: r.components_required as 'all' | 'any',
      capacity: Number(r.capacity ?? 2),
      bathroom: String(r.bathroom ?? 'Douche'),
      description: String(r.description ?? ''),
      isActive: Boolean(r.is_active),
    }));
  } catch (err) {
    logSyncError('settings_virtual_rooms', 'select', err);
    return [];
  }
}

// ─── settings_event_sources ────────────────────────────────────────────────

export async function syncEventSourceToSupabase(source: EventSource): Promise<boolean> {
  const hotelId = await getCurrentHotelIdSafe();
  if (!hotelId) return false;
  try {
    const { error } = await supabase
      .from('settings_event_sources')
      .upsert(
        {
          hotel_id: hotelId,
          source_id: source.id,
          city: source.city,
          country: source.country ?? 'France',
          name: source.name,
          method: source.method,
          url: source.url ?? null,
          sync_frequency: source.syncFrequency,
          reliability_score: source.reliabilityScore,
          is_active: source.active,
          notes: source.notes ?? null,
        },
        { onConflict: 'hotel_id,source_id' },
      );
    if (error) {
      logSyncError('settings_event_sources', 'upsert', error);
      return false;
    }
    return true;
  } catch (err) {
    logSyncError('settings_event_sources', 'upsert', err);
    return false;
  }
}

export async function deleteEventSourceFromSupabase(sourceId: string): Promise<boolean> {
  const hotelId = await getCurrentHotelIdSafe();
  if (!hotelId) return false;
  try {
    const { error } = await supabase
      .from('settings_event_sources')
      .delete()
      .eq('hotel_id', hotelId)
      .eq('source_id', sourceId);
    if (error) {
      logSyncError('settings_event_sources', 'delete', error);
      return false;
    }
    return true;
  } catch (err) {
    logSyncError('settings_event_sources', 'delete', err);
    return false;
  }
}

// ─── settings_permissions_matrix ───────────────────────────────────────────

export async function syncPermissionsMatrixToSupabase(
  matrix: Record<RoleId, Record<string, AccessLevel>>,
): Promise<boolean> {
  const hotelId = await getCurrentHotelIdSafe();
  if (!hotelId) return false;
  try {
    const rows: Array<{
      hotel_id: string;
      role_id: string;
      capability_id: string;
      access_level: string;
    }> = [];
    for (const [roleId, caps] of Object.entries(matrix)) {
      if (roleId === 'admin') continue; // admin verrouillé en code
      for (const [capabilityId, level] of Object.entries(caps)) {
        rows.push({
          hotel_id: hotelId,
          role_id: roleId,
          capability_id: capabilityId,
          access_level: level,
        });
      }
    }
    if (rows.length === 0) return true;
    const { error } = await supabase
      .from('settings_permissions_matrix')
      .upsert(rows, { onConflict: 'hotel_id,role_id,capability_id' });
    if (error) {
      logSyncError('settings_permissions_matrix', 'upsert', error);
      return false;
    }
    return true;
  } catch (err) {
    logSyncError('settings_permissions_matrix', 'upsert', err);
    return false;
  }
}

export async function fetchPermissionsMatrixFromSupabase(): Promise<
  Record<RoleId, Record<string, AccessLevel>> | null
> {
  const hotelId = await getCurrentHotelIdSafe();
  if (!hotelId) return null;
  try {
    const { data, error } = await supabase
      .from('settings_permissions_matrix')
      .select('role_id, capability_id, access_level')
      .eq('hotel_id', hotelId);
    if (error || !data || data.length === 0) {
      if (error) logSyncError('settings_permissions_matrix', 'select', error);
      return null;
    }
    const matrix: Record<string, Record<string, AccessLevel>> = {};
    for (const row of data as Array<Record<string, unknown>>) {
      const r = String(row.role_id);
      if (!matrix[r]) matrix[r] = {};
      matrix[r][String(row.capability_id)] = row.access_level as AccessLevel;
    }
    return matrix as Record<RoleId, Record<string, AccessLevel>>;
  } catch (err) {
    logSyncError('settings_permissions_matrix', 'select', err);
    return null;
  }
}

// ─── settings_imported_rate_plans ──────────────────────────────────────────

export interface ImportedRatePlanReportRow {
  fileName: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  rejectedCount: number;
  requiresMappingCount: number;
  roomMapping: Record<string, string>;
  mealMapping: Record<string, string>;
  report: unknown;
  warnings: string[];
}

export async function logImportedRatePlanReport(row: ImportedRatePlanReportRow): Promise<boolean> {
  const hotelId = await getCurrentHotelIdSafe();
  if (!hotelId) return false;
  try {
    const { error } = await supabase
      .from('settings_imported_rate_plans')
      .insert({
        hotel_id: hotelId,
        file_name: row.fileName,
        total_rows: row.totalRows,
        created_count: row.createdCount,
        updated_count: row.updatedCount,
        rejected_count: row.rejectedCount,
        requires_mapping_count: row.requiresMappingCount,
        room_mapping: row.roomMapping,
        meal_mapping: row.mealMapping,
        report: row.report,
        warnings: row.warnings,
      });
    if (error) {
      logSyncError('settings_imported_rate_plans', 'insert', error);
      return false;
    }
    return true;
  } catch (err) {
    logSyncError('settings_imported_rate_plans', 'insert', err);
    return false;
  }
}
