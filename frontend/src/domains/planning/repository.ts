/**
 * FLOWTYM — Planning domain repository (channels & events).
 *
 * Talks to Supabase for the `planning_channels` and `planning_events` tables.
 * RLS guarantees hotel-scoping; we explicitly inject `hotel_id` on insert.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  const builder = supabase.from('planning_channels') as any;
  const { data, error } = await builder
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
  const builder = supabase.from('planning_channels') as any;
  const { data, error } = await builder
    .update({
      ...(patch.code !== undefined ? { code: patch.code.toUpperCase() } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return data as PlanningChannelRow;
}

export async function deleteChannel(id: string): Promise<void> {
  const { error } = await supabase.from('planning_channels').delete().eq('id', id);
  if (error) throw mapSupabaseError(error);
}

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
  const builder = supabase.from('planning_events') as any;
  const { data, error } = await builder
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
  const builder = supabase.from('planning_events') as any;
  const { data, error } = await builder
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.start_date !== undefined ? { start_date: patch.start_date } : {}),
      ...(patch.end_date !== undefined ? { end_date: patch.end_date } : {}),
      ...(patch.impact !== undefined ? { impact: patch.impact } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return data as PlanningEventRow;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('planning_events').delete().eq('id', id);
  if (error) throw mapSupabaseError(error);
}
