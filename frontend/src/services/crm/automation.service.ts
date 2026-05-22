/**
 * FLOWTYM — CRM Automation Service (Wave C7)
 *
 * Façade for the automation-rules engine: trigger → action workflows
 * evaluated against the live guest base.
 */

import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Automation {
  id:             string;
  hotel_id:       string;
  name:           string;
  description:    string | null;
  trigger_type:   string;
  trigger_config: Record<string, unknown>;
  action_type:    string;
  action_config:  Record<string, unknown>;
  enabled:        boolean;
  run_count:      number;
  last_matched:   number;
  last_run_at:    string | null;
  created_at:     string;
  updated_at:     string;
}

export interface AutomationRun {
  id:         string;
  status:     string;
  detail:     string | null;
  ran_at:     string;
  guest_name: string;
}

export interface RunResult {
  matched: number;
  applied: number;
  queued:  number;
}

export interface SaveAutomationInput {
  id:             string | null;
  name:           string;
  description:    string | null;
  trigger_type:   string;
  trigger_config: Record<string, unknown>;
  action_type:    string;
  action_config:  Record<string, unknown>;
  enabled:        boolean;
}

// ─── Metadata (drives the form & display) ─────────────────────────────────────

export interface ConfigField {
  key:          string;
  label:        string;
  type:         'number' | 'text' | 'textarea' | 'select';
  default:      string | number;
  options?:     string[];
  placeholder?: string;
}

export interface TriggerMeta {
  key:         string;
  label:       string;
  description: string;
  fields:      ConfigField[];
}

export interface ActionMeta {
  key:         string;
  label:       string;
  description: string;
  fields:      ConfigField[];
}

export const TRIGGERS: TriggerMeta[] = [
  {
    key: 'new_guest',
    label: 'Nouveau client',
    description: 'Le client a été créé récemment',
    fields: [{ key: 'days', label: 'Créé depuis (jours)', type: 'number', default: 30 }],
  },
  {
    key: 'loyalty_tier',
    label: 'Niveau de fidélité',
    description: 'Le client a atteint un niveau de fidélité',
    fields: [{
      key: 'tier', label: 'Niveau', type: 'select', default: 'Gold',
      options: ['Silver', 'Gold', 'Platinum'],
    }],
  },
  {
    key: 'birthday',
    label: 'Anniversaire',
    description: 'Le client fête son anniversaire ce mois-ci',
    fields: [],
  },
  {
    key: 'dormant',
    label: 'Client dormant',
    description: 'Le client n\'a aucun séjour récent',
    fields: [{ key: 'months', label: 'Inactif depuis (mois)', type: 'number', default: 6 }],
  },
  {
    key: 'low_satisfaction',
    label: 'Satisfaction faible',
    description: 'Le score de satisfaction est sous le seuil',
    fields: [{ key: 'threshold', label: 'Seuil (0–10)', type: 'number', default: 6 }],
  },
  {
    key: 'high_risk',
    label: 'Risque élevé',
    description: 'Le client est à risque élevé ou critique',
    fields: [],
  },
  {
    key: 'vip',
    label: 'Clients VIP',
    description: 'Tous les clients marqués VIP',
    fields: [],
  },
];

export const ACTIONS: ActionMeta[] = [
  {
    key: 'email',
    label: 'Envoyer un email',
    description: 'Email mis en file d\'attente',
    fields: [
      { key: 'subject', label: 'Objet',   type: 'text',     default: '', placeholder: 'Objet de l\'email' },
      { key: 'body',    label: 'Message', type: 'textarea', default: '', placeholder: 'Corps du message…' },
    ],
  },
  {
    key: 'sms',
    label: 'Envoyer un SMS',
    description: 'SMS mis en file d\'attente',
    fields: [{ key: 'message', label: 'Message', type: 'textarea', default: '', placeholder: 'Texte du SMS…' }],
  },
  {
    key: 'tag',
    label: 'Ajouter une étiquette',
    description: 'Étiquette ajoutée à la fiche client',
    fields: [{ key: 'tag', label: 'Étiquette', type: 'text', default: '', placeholder: 'ex: relance-fidelite' }],
  },
  {
    key: 'notify',
    label: 'Notifier l\'équipe',
    description: 'Note interne enregistrée dans le journal',
    fields: [{ key: 'message', label: 'Note', type: 'textarea', default: '', placeholder: 'Message pour l\'équipe…' }],
  },
];

export const triggerMeta = (key: string) => TRIGGERS.find((t) => t.key === key);
export const actionMeta  = (key: string) => ACTIONS.find((a) => a.key === key);

// ─── RPCs ─────────────────────────────────────────────────────────────────────

export async function listAutomations(): Promise<Automation[]> {
  const { data, error } = await (supabase.rpc as any)('crm_list_automations');
  if (error) return [];
  return (data ?? []) as Automation[];
}

export async function saveAutomation(a: SaveAutomationInput): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('crm_save_automation', {
    p_id:             a.id,
    p_name:           a.name,
    p_description:    a.description,
    p_trigger_type:   a.trigger_type,
    p_trigger_config: a.trigger_config,
    p_action_type:    a.action_type,
    p_action_config:  a.action_config,
    p_enabled:        a.enabled,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteAutomation(id: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('crm_delete_automation', { p_id: id });
  if (error) throw error;
}

export async function toggleAutomation(id: string, enabled: boolean): Promise<void> {
  const { error } = await (supabase.rpc as any)('crm_toggle_automation', {
    p_id: id, p_enabled: enabled,
  });
  if (error) throw error;
}

export async function previewAutomation(
  triggerType: string,
  config: Record<string, unknown>,
): Promise<{ count: number }> {
  const { data, error } = await (supabase.rpc as any)('crm_automation_preview', {
    p_trigger_type: triggerType,
    p_config:       config,
  });
  if (error) return { count: 0 };
  return data as { count: number };
}

export async function runAutomation(id: string): Promise<RunResult> {
  const { data, error } = await (supabase.rpc as any)('crm_run_automation', { p_id: id });
  if (error) throw error;
  return data as RunResult;
}

export async function getAutomationRuns(id: string): Promise<AutomationRun[]> {
  const { data, error } = await (supabase.rpc as any)('crm_automation_recent_runs', {
    p_automation_id: id,
    p_limit:         25,
  });
  if (error) return [];
  return (data ?? []) as AutomationRun[];
}
