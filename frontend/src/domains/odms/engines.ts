/**
 * FLOWTYM — ODMS engines (pure TypeScript).
 *
 * Three engines :
 *   * DisputeWorkflowEngine  — finite state machine on DisputeStatus.
 *   * DisputeEmailGenerator  — templated, multilingual, fully data-driven.
 *   * DisputeReminderEngine  — produces the next due_at + reminder_step.
 *
 * No I/O, no Supabase access. Repositories load all required configuration
 * upfront and pass it to these engines. Easy to unit-test.
 */
import type { Decision, ValidationOutcome } from '@/src/domains/rie/types';
import type {
  DisputeMessageKind,
  DisputeStatus,
  DraftEmail,
  ParticipantRole,
} from './types';

/* ------------------------------------------------------------------ FSM */

const TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  DRAFT: ['SENT'],
  SENT: ['ACKNOWLEDGED', 'IN_REVIEW', 'CORRECTED', 'REJECTED'],
  ACKNOWLEDGED: ['IN_REVIEW', 'CORRECTED', 'REJECTED'],
  IN_REVIEW: ['CORRECTED', 'REJECTED'],
  CORRECTED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
};

export const DisputeWorkflowEngine = {
  canTransition(from: DisputeStatus, to: DisputeStatus): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
  },
  next(from: DisputeStatus): DisputeStatus[] {
    return TRANSITIONS[from] ?? [];
  },
  isTerminal(status: DisputeStatus): boolean {
    return status === 'CLOSED' || status === 'REJECTED' || status === 'CORRECTED';
  },
};

/* ----------------------------------------------------------- Reminders */

export interface ReminderPlan {
  next_due_at: string | null;     // ISO
  next_step: number;              // 1=J+2, 2=J+5, 3=J+10, 0 = no more
  next_message_kind: DisputeMessageKind;
  escalation_role?: ParticipantRole;
}

const REMINDER_STEPS: { days: number; kind: DisputeMessageKind; role?: ParticipantRole }[] = [
  { days: 2,  kind: 'REMINDER' },
  { days: 5,  kind: 'REMINDER', role: 'HOTEL_OPERATIONS_DIRECTOR' },
  { days: 10, kind: 'REMINDER', role: 'HOTEL_REVENUE_MANAGER' },
];

export const DisputeReminderEngine = {
  computeFromSent(sentAt: Date, currentStep: number): ReminderPlan {
    const upcoming = REMINDER_STEPS[currentStep];
    if (!upcoming) {
      return { next_due_at: null, next_step: 0, next_message_kind: 'REMINDER' };
    }
    const due = new Date(sentAt.getTime() + upcoming.days * 24 * 60 * 60 * 1000);
    return {
      next_due_at: due.toISOString(),
      next_step: currentStep + 1,
      next_message_kind: upcoming.kind,
      escalation_role: upcoming.role,
    };
  },
};

/* ---------------------------------------------------- Email generator */

export interface EmailGenerationContext {
  hotelName: string;
  partnerName: string;
  partnerCode: string;
  partnerSupportEmail: string | null;
  partnerAccountingEmail: string | null;
  partnerAccountManagerEmail: string | null;
  reservationReference: string | null;
  reservationOtaReference: string | null;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  roomNumber: string | null;
  ratePlan: string | null;
  nights: number | null;
  currency: string;
  collectionType: string | null;
  promotionsApplied: string[];
  expectedAmount: number;
  receivedAmount: number;
  claimedAmount: number;
  deltaAmount: number;
  commissionExpected: number | null;
  commissionReceived: number | null;
  taxes: number | null;
  promotionDiscount: number | null;
  anomalyCodes: string[];
  score: number;
  language: 'fr-FR' | 'en-GB';
  signatureName: string;
  signatureRole: string;
}

const fmt = (n: number | null | undefined, currency = 'EUR'): string => {
  if (typeof n !== 'number') return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n);
};

const codeToHumanFR: Record<string, string> = {
  PRICE_MISMATCH: 'écart de tarif',
  COMMISSION_ERROR: 'commission incorrecte',
  TAX_ERROR: 'taxes incohérentes',
  PROMOTION_ERROR: 'promotion mal appliquée',
  PAYOUT_ERROR: 'écart de payout',
  CURRENCY_ERROR: 'incohérence de devise',
  ROUNDING_ERROR: 'erreur d\u2019arrondi',
  MAPPING_ERROR: 'mauvais mapping',
  COLLECTION_MODEL_ERROR: 'mauvais modèle de collecte',
};

export const DisputeEmailGenerator = {
  build(ctx: EmailGenerationContext): DraftEmail {
    const to = [ctx.partnerSupportEmail, ctx.partnerAccountingEmail]
      .filter(Boolean)
      .map((s) => s as string);
    const cc = [ctx.partnerAccountManagerEmail].filter(Boolean).map((s) => s as string);

    const reasonsList = ctx.anomalyCodes
      .map((c) => `• ${codeToHumanFR[c] ?? c} (${c})`)
      .join('\n');

    const subject = `[FLOWTYM][${ctx.partnerCode}] Demande de correction tarifaire — ${ctx.reservationOtaReference ?? ctx.reservationReference ?? 'réservation'} — écart ${fmt(ctx.deltaAmount, ctx.currency)}`;

    const bodyText = `Bonjour,

Une incohérence tarifaire a été détectée par notre moteur de Revenue Integrity sur la réservation ci-dessous. Après recalcul selon les paramètres contractuels configurés pour votre canal, le montant transmis présente un écart par rapport au montant théorique attendu.

— Informations réservation —
Référence ${ctx.partnerName} : ${ctx.reservationOtaReference ?? '—'}
Référence FLOWTYM        : ${ctx.reservationReference ?? '—'}
Client                   : ${ctx.guestName ?? '—'}
Dates de séjour          : ${ctx.checkIn ?? '—'} → ${ctx.checkOut ?? '—'} (${ctx.nights ?? '—'} nuits)
Chambre                  : ${ctx.roomNumber ?? '—'}
Plan tarifaire           : ${ctx.ratePlan ?? '—'}
Devise                   : ${ctx.currency}
Mode de collecte         : ${ctx.collectionType ?? '—'}
Promotions détectées     : ${ctx.promotionsApplied.join(', ') || '—'}

— Synthèse financière —
Montant ${ctx.partnerName} reçu     : ${fmt(ctx.receivedAmount, ctx.currency)}
Montant théorique attendu          : ${fmt(ctx.expectedAmount, ctx.currency)}
Montant réclamé                    : ${fmt(ctx.claimedAmount, ctx.currency)}
Différence détectée                : ${fmt(ctx.deltaAmount, ctx.currency)}
Commission OTA déclarée / attendue : ${fmt(ctx.commissionReceived, ctx.currency)} / ${fmt(ctx.commissionExpected, ctx.currency)}
Promotions appliquées              : ${fmt(ctx.promotionDiscount, ctx.currency)}
Taxes                              : ${fmt(ctx.taxes, ctx.currency)}
Score d'anomalie                   : ${ctx.score}/100

— Anomalies détectées —
${reasonsList || '• Anomalies détaillées en pièce jointe'}

Vous trouverez en pièce jointe le rapport d'audit horodaté FLOWTYM, le détail du calcul (commissions, promotions, taxes), le payload OTA original et la capture du tarif PMS.

Nous vous remercions de procéder à la correction sous votre SLA habituel ou de nous indiquer la justification commerciale de cet écart.

Cordialement,
${ctx.signatureName}
${ctx.signatureRole}
${ctx.hotelName} — via FLOWTYM PMS
`;

    const bodyHtml = bodyText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    const attachments: DraftEmail['attachments'] = [
      { kind: 'PDF_AUDIT', filename: 'flowtym-audit-report.pdf', mime_type: 'application/pdf' },
      { kind: 'PMS_RATE', filename: 'pms-rate-snapshot.png', mime_type: 'image/png' },
      { kind: 'OTA_PAYLOAD', filename: 'ota-payload.json', mime_type: 'application/json' },
      { kind: 'COMMISSION', filename: 'commission-breakdown.json', mime_type: 'application/json' },
      { kind: 'PROMOTION', filename: 'promotion-detail.json', mime_type: 'application/json' },
    ];

    return { to, cc, subject, body_text: bodyText, body_html: bodyHtml, attachments };
  },

  /** Inline summary used for UI preview cards. */
  summarize(ctx: EmailGenerationContext): string {
    const reasons = ctx.anomalyCodes.map((c) => codeToHumanFR[c] ?? c).join(', ') || 'écart tarifaire';
    return `Réclamation auprès de ${ctx.partnerName} pour ${reasons} — écart ${fmt(ctx.deltaAmount, ctx.currency)}`;
  },
};

/* ---------------------------------------------------- helpers ---------- */

export function decisionToDisputeRecommendation(decision: Decision, outcome: ValidationOutcome): boolean {
  // Auto-suggest dispute creation when validation triggered manual review or quarantine
  if (decision === 'QUARANTINE' || decision === 'MANUAL_REVIEW') return true;
  if (Math.abs(outcome.breakdown.delta_amount) >= 5) return true;
  return false;
}
