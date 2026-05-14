/**
 * FLOWTYM — SAS repository.
 * Partners · Incoming · Validations · Quarantine · ODMS · Nav badges
 */
import { supabase } from '@/src/lib/supabase';
import { mapSupabaseError, NotFoundError } from '@/src/domains/_shared/errors';
import { writeAuditLog } from '@/src/domains/finance/repository';
import {
  sasPartnerRowSchema, sasPaymentModelRowSchema, sasCommissionRowSchema,
  sasIncomingRowSchema, sasValidationRowSchema, sasQuarantineRowSchema,
  sasDisputeRowSchema, sasDisputeMessageRowSchema, sasStatusHistoryRowSchema,
  sasScoringRuleRowSchema, sasReliabilityRowSchema, sasNavBadgeSchema,
  type SasPartnerRow, type SasPaymentModelRow, type SasCommissionRow,
  type SasIncomingRow, type SasValidationRow, type SasQuarantineRow,
  type SasDisputeRow, type SasDisputeMessageRow, type SasStatusHistoryRow,
  type SasScoringRuleRow, type SasReliabilityRow, type SasNavBadge,
  type CreateIncomingReservationInput, type CreateDisputeInput,
  type RieDecision, type DisputeStatus,
} from './schemas';

// ─── Helper : résoudre hotel_id depuis auth.uid() ────────────────────────────
async function resolveHotelId(hotelId?: string): Promise<string> {
  if (hotelId && hotelId !== '') return hotelId;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Non authentifié');
  const { data: profile } = await supabase
    .from('users')
    .select('hotel_id')
    .eq('auth_id', user.id)
    .maybeSingle();
  const hid = (profile as any)?.hotel_id ?? '';
  if (!hid) throw new Error("Hôtel introuvable pour cet utilisateur");
  return hid;
}


// ─── Nav Badges ───────────────────────────────────────────────────────────────

export async function getSasNavBadges(): Promise<SasNavBadge> {
  try {
    const { data, error } = await supabase
      .from('sas_nav_badges')
      .select('*')
      .maybeSingle();
    if (error || !data) return { hotel_id: '', pending_count: 0, anomaly_count: 0 };
    return sasNavBadgeSchema.parse(data);
  } catch {
    return { hotel_id: '', pending_count: 0, anomaly_count: 0 };
  }
}

// ─── Partners ─────────────────────────────────────────────────────────────────

export async function listPartners(): Promise<SasPartnerRow[]> {
  try {
    const { data, error } = await supabase
      .from('sas_partners')
      .select('*')
      .order('name');
    if (error) return [];
    return (data ?? []).map((d) => sasPartnerRowSchema.parse(d));
  } catch {
    return [];
  }
}

export async function getPartner(id: string): Promise<SasPartnerRow> {
  const { data, error } = await supabase
    .from('sas_partners')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw mapSupabaseError(error);
  return sasPartnerRowSchema.parse(data);
}

export async function upsertPartner(
  hotelId: string,
  input: {
    code: string; name: string; currency?: string;
    country?: string; apiProvider?: string; metadata?: Record<string, unknown>;
  },
): Promise<SasPartnerRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sas_partners') as any)
    .upsert({
      hotel_id: hotelId,
      code: input.code,
      name: input.name,
      currency: input.currency ?? 'EUR',
      country: input.country ?? null,
      api_provider: input.apiProvider ?? null,
      metadata: input.metadata ?? {},
    }, { onConflict: 'hotel_id,code' })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return sasPartnerRowSchema.parse(data);
}

export async function listCommissions(partnerId: string): Promise<SasCommissionRow[]> {
  const { data, error } = await supabase
    .from('sas_partner_commissions')
    .select('*')
    .eq('partner_id', partnerId)
    .order('valid_from', { ascending: false });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => sasCommissionRowSchema.parse(d));
}

export async function getActiveCommission(
  partnerId: string,
  date: string,
): Promise<SasCommissionRow | null> {
  const { data, error } = await supabase
    .from('sas_partner_commissions')
    .select('*')
    .eq('partner_id', partnerId)
    .lte('valid_from', date)
    .or(`valid_to.is.null,valid_to.gte.${date}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  return data ? sasCommissionRowSchema.parse(data) : null;
}

export async function listScoringRules(partnerId?: string): Promise<SasScoringRuleRow[]> {
  let q = supabase.from('sas_scoring_rules').select('*').eq('active', true);
  if (partnerId) {
    q = q.or(`partner_id.eq.${partnerId},partner_id.is.null`);
  }
  const { data, error } = await q.order('partner_id', { ascending: false });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => sasScoringRuleRowSchema.parse(d));
}

// ─── Incoming Reservations ────────────────────────────────────────────────────

export async function listIncoming(params: {
  status?: string;
  partnerId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ rows: SasIncomingRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = supabase
    .from('sas_incoming_reservations')
    .select('*', { count: 'exact' })
    .order('received_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) q = q.eq('rie_status', params.status);
  if (params.partnerId) q = q.eq('partner_id', params.partnerId);

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);
  return {
    rows: (data ?? []).map((d) => sasIncomingRowSchema.parse(d)),
    total: count ?? 0,
  };
}

export async function getIncoming(id: string): Promise<SasIncomingRow> {
  const { data, error } = await supabase
    .from('sas_incoming_reservations')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw mapSupabaseError(error);
  return sasIncomingRowSchema.parse(data);
}

export async function createIncoming(
  hotelId: string,
  input: CreateIncomingReservationInput,
): Promise<SasIncomingRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sas_incoming_reservations') as any)
    .insert({
      hotel_id:        hotelId,
      partner_id:      input.partnerId ?? null,
      ota_reference:   input.otaReference,
      raw_payload:     input.rawPayload,
      guest_name:      input.guestName ?? null,
      check_in:        input.checkIn ?? null,
      check_out:       input.checkOut ?? null,
      room_type:       input.roomType ?? null,
      adults:          input.adults,
      children:        input.children,
      ota_amount:      input.otaAmount ?? null,
      ota_currency:    input.otaCurrency,
      ota_commission:  input.otaCommission ?? null,
      rie_status:      'pending',
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);

  const row = sasIncomingRowSchema.parse(data);
  await writeAuditLog({
    entity: 'sas_incoming',
    entity_id: row.id,
    action: 'INSERT',
    payload: { ota_reference: input.otaReference, ota_amount: input.otaAmount },
  });
  return row;
}

export async function updateIncomingStatus(
  id: string,
  status: string,
  score?: number,
  reservationId?: string,
): Promise<SasIncomingRow> {
  const patch: Record<string, unknown> = {
    rie_status: status,
    processed_at: new Date().toISOString(),
  };
  if (score !== undefined) patch.rie_score = score;
  if (reservationId) patch.reservation_id = reservationId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sas_incoming_reservations') as any)
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return sasIncomingRowSchema.parse(data);
}

// ─── Validations RIE ─────────────────────────────────────────────────────────

export async function listValidations(params: {
  decision?: string;
  partnerId?: string;
  limit?: number;
} = {}): Promise<{ rows: SasValidationRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 200);

  let q = supabase
    .from('sas_validations')
    .select('*', { count: 'exact' })
    .order('validated_at', { ascending: false })
    .limit(limit);

  if (params.decision) q = q.eq('decision', params.decision);
  if (params.partnerId) q = q.eq('partner_id', params.partnerId);

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);
  return {
    rows: (data ?? []).map((d) => sasValidationRowSchema.parse(d)),
    total: count ?? 0,
  };
}

export async function saveValidation(
  hotelId: string,
  payload: {
    incomingId: string;
    partnerId?: string;
    pmsBaseRate?: number;
    promoDeduction?: number;
    taxAmount?: number;
    commissionRate?: number;
    commissionAmount?: number;
    expectedAmount: number;
    receivedAmount: number;
    deviation: number;
    deviationPct: number;
    score: number;
    decision: RieDecision;
    anomalies: unknown[];
    calculationDetail: Record<string, unknown>;
    promotionsApplied: unknown[];
    collectionType?: string;
  },
): Promise<SasValidationRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sas_validations') as any)
    .insert({
      hotel_id:           hotelId,
      incoming_id:        payload.incomingId,
      partner_id:         payload.partnerId ?? null,
      pms_base_rate:      payload.pmsBaseRate ?? null,
      promo_deduction:    payload.promoDeduction ?? 0,
      tax_amount:         payload.taxAmount ?? 0,
      commission_rate:    payload.commissionRate ?? null,
      commission_amount:  payload.commissionAmount ?? null,
      expected_amount:    payload.expectedAmount,
      received_amount:    payload.receivedAmount,
      deviation:          payload.deviation,
      deviation_pct:      payload.deviationPct,
      score:              payload.score,
      decision:           payload.decision,
      anomalies:          payload.anomalies,
      calculation_detail: payload.calculationDetail,
      promotions_applied: payload.promotionsApplied,
      collection_type:    payload.collectionType ?? null,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return sasValidationRowSchema.parse(data);
}

// ─── Quarantine ───────────────────────────────────────────────────────────────

export async function listQuarantine(params: {
  status?: string;
  limit?: number;
} = {}): Promise<{ rows: SasQuarantineRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 100);

  let q = supabase
    .from('sas_quarantine')
    .select('*, sas_incoming_reservations(ota_reference, guest_name, ota_amount, rie_score)', { count: 'exact' })
    .order('quarantined_at', { ascending: false })
    .limit(limit);

  if (params.status) q = q.eq('status', params.status);
  else q = q.eq('status', 'QUARANTINED');

  const { data, error, count } = await q;
  if (error) throw mapSupabaseError(error);
  return {
    rows: (data ?? []).map((d) => sasQuarantineRowSchema.parse(d)),
    total: count ?? 0,
  };
}

export async function quarantineIncoming(
  hotelId: string,
  incomingId: string,
  validationId: string,
  reason: string,
  otaRef: string,
): Promise<SasQuarantineRow> {
  const virtualRoom = `Q-${otaRef.slice(0, 12).toUpperCase()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sas_quarantine') as any)
    .insert({
      hotel_id:      hotelId,
      incoming_id:   incomingId,
      validation_id: validationId,
      virtual_room:  virtualRoom,
      reason,
      status:        'QUARANTINED',
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return sasQuarantineRowSchema.parse(data);
}

export async function releaseQuarantine(
  id: string,
  userId: string,
  note: string,
): Promise<SasQuarantineRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sas_quarantine') as any)
    .update({
      status:       'RELEASED',
      released_at:  new Date().toISOString(),
      released_by:  userId,
      release_note: note,
    })
    .eq('id', id)
    .eq('status', 'QUARANTINED')
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return sasQuarantineRowSchema.parse(data);
}

// ─── ODMS Disputes ────────────────────────────────────────────────────────────

export async function listDisputes(params: {
  status?: string;
  partnerId?: string;
  limit?: number;
} = {}): Promise<{ rows: SasDisputeRow[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 200);

  let q = supabase
    .from('sas_disputes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.status) q = q.eq('status', params.status);
  if (params.partnerId) q = q.eq('partner_id', params.partnerId);

  const { data, error, count } = await q;
  if (error) return { rows: [], total: 0 };
  return {
    rows: (data ?? []).map((d) => sasDisputeRowSchema.parse(d)),
    total: count ?? 0,
  };
}

export async function getDispute(id: string): Promise<SasDisputeRow> {
  const { data, error } = await supabase
    .from('sas_disputes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw mapSupabaseError(error);
  return sasDisputeRowSchema.parse(data);
}

export async function createDispute(
  hotelId: string,
  input: CreateDisputeInput,
): Promise<SasDisputeRow> {
  // ── Résolution hotel_id — source of truth : public.users ─────────────────
  // session.tenantId peut être null si le profil n'est pas encore chargé.
  // On le résout directement depuis la DB avec l'auth.uid() courant.
  let resolvedHotelId = hotelId;

  if (!resolvedHotelId || resolvedHotelId === '') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: profile } = await supabase
        .from('users')
        .select('hotel_id')
        .eq('auth_id', user.id)
        .maybeSingle();
      resolvedHotelId = (profile as any)?.hotel_id ?? '';
    }
  }

  if (!resolvedHotelId || resolvedHotelId === '') {
    throw new Error('Impossible de déterminer l\'hôtel. Reconnectez-vous.');
  }

  // ── Génération référence ──────────────────────────────────────────────────
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-5);
  const reference = `DISP-${year}-${seq}`;

  // ── Insert ────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sas_disputes') as any)
    .insert({
      hotel_id:        resolvedHotelId,
      reference,
      incoming_id:     input.incomingId ?? null,
      validation_id:   input.validationId ?? null,
      partner_id:      input.partnerId ?? null,
      expected_amount: input.expectedAmount ?? null,
      received_amount: input.receivedAmount ?? null,
      claimed_amount:  input.claimedAmount ?? null,
      subject:         input.subject ?? null,
      explanation:     input.explanation ?? null,
      recipients:      input.recipients ?? [],
      status:          'DRAFT',
    })
    .select('*')
    .single();

  if (error) throw mapSupabaseError(error);

  const dispute = sasDisputeRowSchema.parse(data);

  // Historique statut (best-effort)
  try {
    await addDisputeStatusHistory(resolvedHotelId, dispute.id, null, 'DRAFT', 'Création du litige');
  } catch { /* ignore */ }

  return dispute;
}

export async function updateDisputeStatus(
  hotelId: string,
  id: string,
  newStatus: DisputeStatus,
  reason?: string,
  userId?: string,
): Promise<SasDisputeRow> {
  const current = await getDispute(id);

  const patch: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'SENT') patch.sent_at = new Date().toISOString();
  if (newStatus === 'ACKNOWLEDGED') patch.acknowledged_at = new Date().toISOString();
  if (['CORRECTED', 'REJECTED', 'CLOSED'].includes(newStatus)) {
    patch.resolved_at = new Date().toISOString();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sas_disputes') as any)
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);

  await addDisputeStatusHistory(hotelId, id, current.status, newStatus, reason ?? '', userId);

  return sasDisputeRowSchema.parse(data);
}

export async function addDisputeMessage(
  hotelId: string,
  disputeId: string,
  direction: 'OUTBOUND' | 'INBOUND' | 'INTERNAL',
  content: string,
  userId?: string,
): Promise<SasDisputeMessageRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sas_dispute_messages') as any)
    .insert({
      hotel_id:   hotelId,
      dispute_id: disputeId,
      direction,
      content,
      created_by: userId ?? null,
    })
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error);
  return sasDisputeMessageRowSchema.parse(data);
}

export async function listDisputeMessages(disputeId: string): Promise<SasDisputeMessageRow[]> {
  const { data, error } = await supabase
    .from('sas_dispute_messages')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => sasDisputeMessageRowSchema.parse(d));
}

export async function listDisputeStatusHistory(disputeId: string): Promise<SasStatusHistoryRow[]> {
  const { data, error } = await supabase
    .from('sas_dispute_status_history')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('changed_at', { ascending: true });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => sasStatusHistoryRowSchema.parse(d));
}

async function addDisputeStatusHistory(
  hotelId: string,
  disputeId: string,
  oldStatus: string | null,
  newStatus: string,
  reason: string,
  userId?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('sas_dispute_status_history') as any).insert({
    hotel_id:   hotelId,
    dispute_id: disputeId,
    old_status: oldStatus,
    new_status: newStatus,
    reason,
    changed_by: userId ?? null,
  });
}

// ─── Partner Reliability ──────────────────────────────────────────────────────

export async function listReliability(): Promise<SasReliabilityRow[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sas_partner_reliability')
    .select('*')
    .gte('period_start', thirtyDaysAgo)
    .order('computed_at', { ascending: false });
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((d) => sasReliabilityRowSchema.parse(d));
}

// ─── SAS Stats ────────────────────────────────────────────────────────────────

export async function getSasStats(): Promise<{
  pendingCount: number;
  quarantineCount: number;
  anomalyCount: number;
  approvedToday: number;
  totalDeviation: number;
  openDisputes: number;
  recoveredAmount: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [incomingRes, quarantineRes, disputesRes] = await Promise.all([
    supabase.from('sas_incoming_reservations').select('rie_status, received_at'),
    supabase.from('sas_quarantine').select('status'),
    supabase.from('sas_disputes').select('status, recovered_amount'),
  ]);

  const incoming = incomingRes.data ?? [];
  const quarantine = quarantineRes.data ?? [];
  const disputes = disputesRes.data ?? [];

  return {
    pendingCount:    incoming.filter(r => r.rie_status === 'pending').length,
    quarantineCount: quarantine.filter(r => r.status === 'QUARANTINED').length,
    anomalyCount:    incoming.filter(r => ['quarantined','manual_review','warning'].includes(r.rie_status)).length,
    approvedToday:   incoming.filter(r => r.rie_status === 'approved' && r.received_at >= todayStart.toISOString()).length,
    totalDeviation:  0, // calculé depuis sas_validations
    openDisputes:    disputes.filter(r => !['CLOSED','REJECTED'].includes(r.status)).length,
    recoveredAmount: disputes.reduce((s, r) => s + (r.recovered_amount ?? 0), 0),
  };
}
