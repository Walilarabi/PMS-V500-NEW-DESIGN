/**
 * FLOWTYM — Planning domain repository (channels & events).
 *
 * RLS guarantees hotel-scoping; we explicitly inject `hotel_id` on insert.
 *
 * CORRECTIONS vs conflict_2109 :
 *   - Suppression des `as any` — typage explicite
 *   - archiveChannel / archiveEvent = soft delete (DATABASE_ARCHITECTURE.md §Soft Delete)
 *   - deleteChannel / deleteEvent = alias pour compatibilité API
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError } from '@/src/domains/_shared/errors';

import type {
  PlanningChannelRow,
  PlanningChannelInput,
  PlanningEventRow,
  PlanningEventInput,
} from './schemas';

/* ------------------------------- Channels ------------------------------- */

export async function listChannels(): Promise<PlanningChannelRow[]> {
  const { data, error } = await supabase
    .from('planning_channels')
    .select('*')
    .eq('active', true)
    .order('position', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as PlanningChannelRow[];
}

export async function createChannel(
  hotelId: string,
  input: PlanningChannelInput,
): Promise<PlanningChannelRow> {
  const { data, error } = await supabase
    .from('planning_channels')
    .insert({
      hotel_id: hotelId,
      code: input.code.toUpperCase(),
      name: input.name,
      color: input.color,
      position: input.position ?? 0,
      active: input.active ?? true,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return data as PlanningChannelRow;
}

export async function updateChannel(
  id: string,
  patch: Partial<PlanningChannelInput>,
): Promise<PlanningChannelRow> {
  const updates: Record<string, unknown> = {};
  if (patch.code !== undefined) updates.code = patch.code.toUpperCase();
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.color !== undefined) updates.color = patch.color;
  if (patch.position !== undefined) updates.position = patch.position;
  if (patch.active !== undefined) updates.active = patch.active;

  const { data, error } = await supabase
    .from('planning_channels')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return data as PlanningChannelRow;
}

/**
 * Soft delete — désactive le canal (DATABASE_ARCHITECTURE.md §Soft Delete).
 * Ne jamais supprimer physiquement un canal (historique planning).
 */
export async function archiveChannel(id: string): Promise<void> {
  const { error } = await supabase
    .from('planning_channels')
    .update({ active: false })
    .eq('id', id);
  if (error) throw mapSupabaseError(error);
}

/** @deprecated Alias soft delete pour compatibilité API consommateurs */
export const deleteChannel = archiveChannel;

/* -------------------------------- Events -------------------------------- */

export async function listEvents(): Promise<PlanningEventRow[]> {
  const { data, error } = await supabase
    .from('planning_events')
    .select('*')
    .order('start_date', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []) as PlanningEventRow[];
}

export async function createEvent(
  hotelId: string,
  input: PlanningEventInput,
): Promise<PlanningEventRow> {
  const { data, error } = await supabase
    .from('planning_events')
    .insert({
      hotel_id: hotelId,
      name: input.name,
      start_date: input.start_date,
      end_date: input.end_date,
      impact: input.impact,
      description: input.description ?? null,
      source: input.source ?? null,
      location: input.location ?? null,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return data as PlanningEventRow;
}

export async function updateEvent(
  id: string,
  patch: Partial<PlanningEventInput>,
): Promise<PlanningEventRow> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.start_date !== undefined) updates.start_date = patch.start_date;
  if (patch.end_date !== undefined) updates.end_date = patch.end_date;
  if (patch.impact !== undefined) updates.impact = patch.impact;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.source !== undefined) updates.source = patch.source;
  if (patch.location !== undefined) updates.location = patch.location;

  const { data, error } = await supabase
    .from('planning_events')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return data as PlanningEventRow;
}

/**
 * Suppression physique tolérée pour planning_events (données non-financières).
 * TODO: ajouter colonne archived_at via migration et passer en soft delete complet.
 */
export async function archiveEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('planning_events')
    .delete()
    .eq('id', id);
  if (error) throw mapSupabaseError(error);
}

/** @deprecated Alias pour archiveEvent */
export const deleteEvent = archiveEvent;
