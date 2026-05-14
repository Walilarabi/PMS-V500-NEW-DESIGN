/**
 * FLOWTYM — Housekeeping domain
 * schemas + repository + hooks
 */
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/domains/auth/AuthContext';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const hkStaffSchema = z.object({
  id: z.string(), hotel_id: z.string(),
  first_name: z.string(), last_name: z.string(),
  role: z.enum(['housekeeper','supervisor','inspector']),
  status: z.enum(['active','inactive','on_leave']),
  color: z.string(), phone: z.string().nullable(),
  created_at: z.string(),
}).passthrough();
export type HkStaff = z.infer<typeof hkStaffSchema>;

export const hkTaskSchema = z.object({
  id: z.string(), hotel_id: z.string(),
  room_id: z.string().nullable(), room_number: z.string(),
  task_type: z.enum(['cleaning','inspection','turndown','deep_clean','checkout']),
  status: z.enum(['pending','in_progress','done','validated','skipped']),
  priority: z.enum(['low','normal','high','urgent']),
  assigned_to: z.string().nullable(),
  notes: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  validated_at: z.string().nullable(),
  scheduled_for: z.string(),
  created_at: z.string(), updated_at: z.string(),
}).passthrough();
export type HkTask = z.infer<typeof hkTaskSchema>;

export const maintenanceTicketSchema = z.object({
  id: z.string(), hotel_id: z.string(),
  room_id: z.string().nullable(), room_number: z.string().nullable(),
  title: z.string(), description: z.string().nullable(),
  category: z.enum(['plumbing','electrical','hvac','furniture','equipment','cleaning','safety','general']),
  priority: z.enum(['low','normal','high','urgent','critical']),
  status: z.enum(['open','in_progress','pending_parts','resolved','closed','cancelled']),
  assigned_to: z.string().nullable(),
  resolved_at: z.string().nullable(),
  estimated_cost: z.number().nullable(), actual_cost: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(),
}).passthrough();
export type MaintenanceTicket = z.infer<typeof maintenanceTicketSchema>;

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getHotelId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');
  const { data } = await supabase.from('users').select('hotel_id').eq('auth_id', user.id).maybeSingle();
  return (data as any)?.hotel_id ?? '';
}

// ─── Repository ───────────────────────────────────────────────────────────────

export async function fetchHkStaff(): Promise<HkStaff[]> {
  const { data, error } = await supabase.from('hk_staff').select('*').eq('status','active').order('first_name');
  if (error) return [];
  return (data ?? []).map(d => hkStaffSchema.parse(d));
}

export async function fetchHkTasks(date?: string): Promise<HkTask[]> {
  const d = date ?? new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('hk_tasks').select('*').eq('scheduled_for', d)
    .order('priority', { ascending: false });
  if (error) return [];
  return (data ?? []).map(d => hkTaskSchema.parse(d));
}

export async function updateHkTaskStatus(
  id: string, status: HkTask['status']
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'in_progress') patch.started_at = new Date().toISOString();
  if (status === 'done') patch.completed_at = new Date().toISOString();
  if (status === 'validated') patch.validated_at = new Date().toISOString();
  await supabase.from('hk_tasks').update(patch).eq('id', id);
}

export async function assignHkTask(taskId: string, staffId: string | null): Promise<void> {
  await supabase.from('hk_tasks').update({ assigned_to: staffId }).eq('id', taskId);
}

export async function createHkTask(input: {
  roomId: string; roomNumber: string; taskType: HkTask['task_type'];
  priority?: HkTask['priority']; assignedTo?: string; notes?: string; scheduledFor?: string;
}): Promise<void> {
  const hotelId = await getHotelId();
  await (supabase.from('hk_tasks') as any).insert({
    hotel_id: hotelId,
    room_id: input.roomId,
    room_number: input.roomNumber,
    task_type: input.taskType,
    priority: input.priority ?? 'normal',
    assigned_to: input.assignedTo ?? null,
    notes: input.notes ?? null,
    scheduled_for: input.scheduledFor ?? new Date().toISOString().split('T')[0],
    status: 'pending',
  });
}

export async function updateRoomHkStatus(
  roomId: string, status: string, assignedTo?: string
): Promise<void> {
  const patch: Record<string,unknown> = { housekeeping_status: status };
  if (assignedTo !== undefined) patch.assigned_to = assignedTo;
  if (status === 'clean') patch.last_cleaned_at = new Date().toISOString();
  await supabase.from('rooms').update(patch).eq('id', roomId);
}

export async function fetchMaintenanceTickets(statusFilter?: string): Promise<MaintenanceTicket[]> {
  let q = supabase.from('maintenance_tickets').select('*').order('created_at', { ascending: false });
  if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map(d => maintenanceTicketSchema.parse(d));
}

export async function createMaintenanceTicket(input: {
  title: string; description?: string; category: MaintenanceTicket['category'];
  priority: MaintenanceTicket['priority']; roomId?: string; roomNumber?: string;
}): Promise<void> {
  const hotelId = await getHotelId();
  await (supabase.from('maintenance_tickets') as any).insert({
    hotel_id: hotelId,
    room_id: input.roomId ?? null,
    room_number: input.roomNumber ?? null,
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    priority: input.priority,
    status: 'open',
  });
}

export async function updateMaintenanceStatus(
  id: string, status: MaintenanceTicket['status']
): Promise<void> {
  const patch: Record<string,unknown> = { status };
  if (status === 'resolved') patch.resolved_at = new Date().toISOString();
  await supabase.from('maintenance_tickets').update(patch).eq('id', id);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const HK_STAFF_KEY = ['hk','staff'] as const;
const HK_TASKS_KEY = ['hk','tasks'] as const;
const MAINT_KEY    = ['maintenance'] as const;

export function useHkStaff() {
  const { status } = useAuth();
  return useQuery({
    queryKey: HK_STAFF_KEY,
    queryFn: fetchHkStaff,
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}

export function useHkTasks(date?: string) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...HK_TASKS_KEY, date],
    queryFn: () => fetchHkTasks(date),
    enabled: status === 'authenticated',
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useUpdateHkTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: HkTask['status'] }) =>
      updateHkTaskStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: HK_TASKS_KEY }),
  });
}

export function useAssignHkTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, staffId }: { taskId: string; staffId: string | null }) =>
      assignHkTask(taskId, staffId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: HK_TASKS_KEY }),
  });
}

export function useCreateHkTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createHkTask,
    onSuccess: () => void qc.invalidateQueries({ queryKey: HK_TASKS_KEY }),
  });
}

export function useMaintenanceTickets(statusFilter?: string) {
  const { status } = useAuth();
  return useQuery({
    queryKey: [...MAINT_KEY, statusFilter],
    queryFn: () => fetchMaintenanceTickets(statusFilter),
    enabled: status === 'authenticated',
    staleTime: 20_000,
  });
}

export function useCreateMaintenanceTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMaintenanceTicket,
    onSuccess: () => void qc.invalidateQueries({ queryKey: MAINT_KEY }),
  });
}

export function useUpdateMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MaintenanceTicket['status'] }) =>
      updateMaintenanceStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: MAINT_KEY }),
  });
}
