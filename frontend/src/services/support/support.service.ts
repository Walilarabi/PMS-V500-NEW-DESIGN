import { supabase } from '@/src/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TicketStatus =
  | 'nouveau'
  | 'en_analyse'
  | 'attente_utilisateur'
  | 'en_correction'
  | 'resolu'
  | 'ferme';

export type TicketPriority = 'bloquant' | 'eleve' | 'moyen' | 'faible';
export type TicketClassification = 'bug' | 'amelioration' | 'question';

export interface BrowserInfo {
  userAgent: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
}

export interface SupportTicket {
  id: string;
  hotel_id: string;
  ticket_number: string;
  module: string;
  feature: string;
  problem_type: string;
  description: string;
  steps: string[];
  expected_result: string | null;
  actual_result: string | null;
  priority: TicketPriority;
  attachment_url: string | null;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  current_module: string | null;
  current_page: string | null;
  browser_info: BrowserInfo | null;
  related_entity_id: string | null;
  status: TicketStatus;
  assigned_to: string | null;
  claude_response: string | null;
  classification: TicketClassification | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketInput {
  hotel_id: string;
  module: string;
  feature: string;
  problem_type: string;
  description: string;
  steps: string[];
  expected_result?: string;
  actual_result?: string;
  priority: TicketPriority;
  attachment_url?: string;
  // auto-context
  user_email?: string;
  user_role?: string;
  current_module?: string;
  current_page?: string;
  browser_info?: BrowserInfo;
  related_entity_id?: string;
}

// ─── Repository ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from('support_tickets');

export async function listTickets(hotelId: string): Promise<SupportTicket[]> {
  const { data, error } = await table()
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

export async function createTicket(input: CreateTicketInput): Promise<SupportTicket> {
  const { data, error } = await table()
    .insert({
      hotel_id:          input.hotel_id,
      module:            input.module,
      feature:           input.feature,
      problem_type:      input.problem_type,
      description:       input.description,
      steps:             input.steps,
      expected_result:   input.expected_result ?? null,
      actual_result:     input.actual_result ?? null,
      priority:          input.priority,
      attachment_url:    input.attachment_url ?? null,
      user_email:        input.user_email ?? null,
      user_role:         input.user_role ?? null,
      current_module:    input.current_module ?? null,
      current_page:      input.current_page ?? null,
      browser_info:      input.browser_info ?? null,
      related_entity_id: input.related_entity_id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as SupportTicket;
}

export async function updateTicketStatus(
  id: string,
  status: TicketStatus,
  assignedTo?: string,
): Promise<void> {
  const { error } = await table()
    .update({ status, assigned_to: assignedTo ?? null })
    .eq('id', id);
  if (error) throw error;
}

export async function saveClaudeResponse(
  id: string,
  response: string,
  classification: TicketClassification,
): Promise<void> {
  const { error } = await table()
    .update({ claude_response: response, classification, status: 'en_analyse' })
    .eq('id', id);
  if (error) throw error;
}

// ─── Auto-context collector ───────────────────────────────────────────────────

export function collectBrowserInfo(): BrowserInfo {
  return {
    userAgent:    navigator.userAgent,
    language:     navigator.language,
    screenWidth:  window.screen.width,
    screenHeight: window.screen.height,
  };
}
