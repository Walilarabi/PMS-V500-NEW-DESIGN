/**
 * FLOWTYM RMS Enterprise — Persistance Supabase
 *
 * Couche d'abstraction qui :
 *   - hydrate les engines au boot (load* puis seed côté JS si vide)
 *   - persiste les mutations engagées par l'UI
 *
 * Conventions :
 *   - Échec silencieux si pas d'auth/hotel_id (le moteur en mémoire continue)
 *   - Multi-tenant via hotel_users + RLS côté DB
 *   - Append-only pour rms_audit_log (UPDATE/DELETE refusés par trigger)
 */

import type { TacticalRule } from '@/src/types/revenue/tacticalRules.types';
import type { Guardrail } from '@/src/types/revenue/guardrails.types';
import type { PriorityLevel } from '@/src/types/revenue/conflicts.types';
import type { AuditEvent } from '@/src/services/revenue/rmsAuditLogger';

// Import lazy : éviter de charger lib/supabase au boot des engines en
// environnement Node (tests, SSR) où import.meta.env n'existe pas.
type SupabaseLike = { from: (table: string) => any; rpc: (name: string, args?: any) => any; auth: { getUser: () => any } };
let supabasePromise: Promise<SupabaseLike | null> | null = null;
async function getSupabase(): Promise<SupabaseLike | null> {
  if (typeof window === 'undefined') return null; // Node : no-op
  if (!supabasePromise) {
    supabasePromise = import('@/src/lib/supabase')
      .then((m) => m.supabase as unknown as SupabaseLike)
      .catch(() => null);
  }
  return supabasePromise;
}

// ── Garde-fou anti-cascade ──────────────────────────────────────────────────
// Si Supabase est inaccessible (pas d'auth, CORS, certificat invalide…) la
// première résolution `hotelId === null` met un cache TTL 60s. Pendant ce
// délai, toutes les fonctions de persistance court-circuitent et retournent
// immédiatement sans tenter d'appel Supabase. Évite que la cascade de logs
// d'audit (Autopilote × 30 jours × règles fired) ne génère des centaines de
// requêtes échouées simultanées.
const NO_AUTH_TTL_MS = 60_000;
let noAuthUntil = 0;
function markNoAuth() { noAuthUntil = Date.now() + NO_AUTH_TTL_MS; }
function isNoAuthCached(): boolean { return Date.now() < noAuthUntil; }

// ─── Hôtel + user résolution (identique à rms-decisions.service) ───────────
async function resolveHotelAndUser(): Promise<{ hotelId: string | null; userId: string | null; supabase: SupabaseLike | null }> {
  // Court-circuit si Supabase est connu indisponible (TTL 60s)
  if (isNoAuthCached()) return { hotelId: null, userId: null, supabase: null };

  const supabase = await getSupabase();
  if (!supabase) {
    markNoAuth();
    return { hotelId: null, userId: null, supabase: null };
  }
  let hotelId: string | null = null;
  let userId: string | null = null;
  try {
    const { data } = await supabase.rpc('get_user_hotel_id');
    if (data) hotelId = String(data);
  } catch {/* ignore */}
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) userId = data.user.id;
  } catch {/* ignore */}
  if (!hotelId) markNoAuth();
  return { hotelId, userId, supabase };
}

// ═══════════════════════════════════════════════════════════════════════════
// TACTICAL RULES
// ═══════════════════════════════════════════════════════════════════════════

interface DbTacticalRule {
  id: string;
  name: string;
  description: string;
  category: TacticalRule['category'];
  priority: number;
  status: TacticalRule['status'];
  triggers: TacticalRule['triggers'];
  actions: TacticalRule['actions'];
  connectivity: string[];
  ia_confidence: number;
  revenue_impact_30d: number;
  revpar_impact_30d: number;
  triggers_count_30d: number;
  success_count: number;
  adjusted_count: number;
  blocked_count: number;
  last_triggered_at: string | null;
}

function rowToTacticalRule(r: DbTacticalRule): TacticalRule {
  return {
    id: r.id as TacticalRule['id'],
    name: r.name,
    description: r.description,
    category: r.category,
    priority: r.priority,
    status: r.status,
    triggers: r.triggers ?? [],
    actions: r.actions ?? [],
    connectivity: r.connectivity ?? [],
    iaConfidence: r.ia_confidence,
    revenueImpact30d: Number(r.revenue_impact_30d),
    revparImpact30d: Number(r.revpar_impact_30d),
    triggersCount30d: r.triggers_count_30d,
    successCount: r.success_count,
    adjustedCount: r.adjusted_count,
    blockedCount: r.blocked_count,
    lastTriggeredAt: r.last_triggered_at ?? undefined,
    history: [],
  };
}

function tacticalRuleToRow(rule: TacticalRule, hotelId: string) {
  return {
    id: rule.id,
    hotel_id: hotelId,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    priority: rule.priority,
    status: rule.status,
    triggers: rule.triggers,
    actions: rule.actions,
    connectivity: rule.connectivity,
    ia_confidence: rule.iaConfidence,
    revenue_impact_30d: rule.revenueImpact30d,
    revpar_impact_30d: rule.revparImpact30d,
    triggers_count_30d: rule.triggersCount30d,
    success_count: rule.successCount,
    adjusted_count: rule.adjustedCount,
    blocked_count: rule.blockedCount,
    last_triggered_at: rule.lastTriggeredAt ?? null,
  };
}

export async function loadTacticalRules(): Promise<TacticalRule[] | null> {
  const { hotelId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from('rms_tactical_rules')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('priority', { ascending: true });
    if (error) {
      console.warn('[rms-enterprise] loadTacticalRules failed:', error.message);
      return null;
    }
    return (data as DbTacticalRule[]).map(rowToTacticalRule);
  } catch (err) {
    console.warn('[rms-enterprise] loadTacticalRules exception:', err);
    return null;
  }
}

export async function persistTacticalRule(rule: TacticalRule): Promise<boolean> {
  const { hotelId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('rms_tactical_rules')
      .upsert(tacticalRuleToRow(rule, hotelId), { onConflict: 'id' });
    if (error) console.warn('[rms-enterprise] persistTacticalRule:', error.message);
    return !error;
  } catch (err) {
    console.warn('[rms-enterprise] persistTacticalRule exception:', err);
    return false;
  }
}

export async function deleteTacticalRule(id: string): Promise<boolean> {
  const { hotelId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('rms_tactical_rules')
      .delete()
      .eq('hotel_id', hotelId)
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GUARDRAILS
// ═══════════════════════════════════════════════════════════════════════════

interface DbGuardrail {
  id: string;
  name: string;
  category: Guardrail['category'];
  severity: Guardrail['severity'];
  condition_text: string;
  threshold: string;
  threshold_value: number;
  action_text: string;
  coverage: Guardrail['coverage'];
  status: Guardrail['status'];
  blocks_count_30d: number;
  warnings_count_30d: number;
  adjustments_count_30d: number;
  average_delta_limited: number;
}

function rowToGuardrail(r: DbGuardrail): Guardrail {
  return {
    id: r.id as Guardrail['id'],
    name: r.name,
    category: r.category,
    severity: r.severity,
    condition: r.condition_text,
    threshold: r.threshold,
    thresholdValue: Number(r.threshold_value),
    action: r.action_text,
    coverage: r.coverage ?? { scope: 'all', detail: '', percentage: 100 },
    status: r.status,
    blocksCount30d: r.blocks_count_30d,
    warningsCount30d: r.warnings_count_30d,
    adjustmentsCount30d: r.adjustments_count_30d,
    averageDeltaLimited: Number(r.average_delta_limited),
    history: [],
  };
}

function guardrailToRow(g: Guardrail, hotelId: string) {
  return {
    id: g.id,
    hotel_id: hotelId,
    name: g.name,
    category: g.category,
    severity: g.severity,
    condition_text: g.condition,
    threshold: g.threshold,
    threshold_value: g.thresholdValue,
    action_text: g.action,
    coverage: g.coverage,
    status: g.status,
    blocks_count_30d: g.blocksCount30d,
    warnings_count_30d: g.warningsCount30d,
    adjustments_count_30d: g.adjustmentsCount30d,
    average_delta_limited: g.averageDeltaLimited,
  };
}

export async function loadGuardrails(): Promise<Guardrail[] | null> {
  const { hotelId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from('rms_guardrails')
      .select('*')
      .eq('hotel_id', hotelId);
    if (error) return null;
    return (data as DbGuardrail[]).map(rowToGuardrail);
  } catch {
    return null;
  }
}

export async function persistGuardrail(g: Guardrail): Promise<boolean> {
  const { hotelId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('rms_guardrails')
      .upsert(guardrailToRow(g, hotelId), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteGuardrail(id: string): Promise<boolean> {
  const { hotelId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('rms_guardrails')
      .delete()
      .eq('hotel_id', hotelId)
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIORITY HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════

interface DbPriorityLevel {
  id: string;
  priority: number;
  kind: PriorityLevel['kind'];
  name: string;
  category: string;
  type_label: string;
  objective: string;
  preemption: string;
  revenue_impact_30d: number;
}

function rowToPriorityLevel(r: DbPriorityLevel): PriorityLevel {
  return {
    priority: r.priority,
    kind: r.kind,
    id: r.id,
    name: r.name,
    category: r.category,
    type: r.type_label,
    objective: r.objective,
    preemption: r.preemption,
    revenueImpact30d: Number(r.revenue_impact_30d),
  };
}

function priorityToRow(p: PriorityLevel, hotelId: string) {
  return {
    id: p.id,
    hotel_id: hotelId,
    priority: p.priority,
    kind: p.kind,
    name: p.name,
    category: p.category,
    type_label: p.type,
    objective: p.objective,
    preemption: p.preemption,
    revenue_impact_30d: p.revenueImpact30d,
  };
}

export async function loadPriorityHierarchy(): Promise<PriorityLevel[] | null> {
  const { hotelId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from('rms_priority_hierarchy')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('priority', { ascending: true });
    if (error) return null;
    return (data as DbPriorityLevel[]).map(rowToPriorityLevel);
  } catch {
    return null;
  }
}

/**
 * Persiste la hiérarchie complète (atomique via upsert sur (hotel_id, id)).
 * Conserve l'ordre passé en argument (priority = index + 1).
 */
export async function persistPriorityHierarchy(levels: PriorityLevel[]): Promise<boolean> {
  const { hotelId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('rms_priority_hierarchy')
      .upsert(levels.map((l, idx) => priorityToRow({ ...l, priority: idx + 1 }, hotelId)), {
        onConflict: 'id',
      });
    return !error;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG (append-only)
// ═══════════════════════════════════════════════════════════════════════════

export async function persistAuditEvent(event: AuditEvent): Promise<boolean> {
  const { hotelId, userId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('rms_audit_log')
      .insert({
        hotel_id: hotelId,
        event_type: event.type,
        actor: event.actor,
        context: event.context,
        detail: event.detail,
        impact: event.impact ?? null,
        metadata: event.metadata ?? {},
        created_by: userId,
      });
    return !error;
  } catch {
    return false;
  }
}

export async function loadAuditLog(limit = 100): Promise<AuditEvent[] | null> {
  const { hotelId, supabase } = await resolveHotelAndUser();
  if (!hotelId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from('rms_audit_log')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return null;
    return (data as Array<{
      id: string;
      event_type: AuditEvent['type'];
      actor: string;
      context: string;
      detail: string;
      impact: number | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>).map((r) => ({
      id: r.id,
      timestamp: r.created_at,
      type: r.event_type,
      actor: r.actor,
      context: r.context,
      detail: r.detail,
      impact: r.impact ?? undefined,
      metadata: r.metadata ?? undefined,
    }));
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HYDRATION (boot)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tente de charger l'état depuis Supabase. Retourne true si l'hydratation
 * a réussi, false sinon (l'appelant gardera le seed JS en mémoire).
 */
export async function hydrateRmsEnterprise(): Promise<{
  rules: TacticalRule[] | null;
  guardrails: Guardrail[] | null;
  hierarchy: PriorityLevel[] | null;
  audit: AuditEvent[] | null;
}> {
  const [rules, guardrails, hierarchy, audit] = await Promise.all([
    loadTacticalRules(),
    loadGuardrails(),
    loadPriorityHierarchy(),
    loadAuditLog(50),
  ]);
  return { rules, guardrails, hierarchy, audit };
}
