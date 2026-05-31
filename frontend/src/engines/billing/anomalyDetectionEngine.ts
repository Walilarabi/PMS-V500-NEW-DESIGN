/**
 * FLOWTYM — Anomaly Detection Engine (T12).
 * 7 anomalies de facturation détectées purement côté client.
 * Aucune dépendance réseau — entrées typées, sorties déterministes.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface BillingAnomaly {
  id: string;
  type: string;
  severity: AnomalySeverity;
  title: string;
  description: string;
  affectedEntityId?: string;
  affectedEntityType?: 'invoice' | 'payment' | 'line' | 'deposit';
  suggestedAction?: string;
}

export interface AnomalyDetectionInput {
  invoices: Array<{
    id: string;
    invoice_number: string;
    status: string;
    total_ttc: number;
    paid_amount: number;
    balance: number | null;
    due_date: string | null;
    issued_at: string | null;
    created_at: string;
  }>;
  payments: Array<{
    id: string;
    invoice_id: string;
    amount: number;
    status: string;
    method: string;
    collected_at: string;
  }>;
  lines: Array<{
    id: string;
    invoice_id: string;
    description: string;
    quantity: number;
    unit_price_ht: number;
    tva_rate: number;
    service_date: string;
    source: string;
    reversal_of: string | null;
  }>;
  deposits: Array<{
    id: string;
    amount: number;
    status: string;
    reservation_id: string | null;
  }>;
  today?: Date;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

const OVERDUE_GRACE_DAYS = 0;
const DUPLICATE_WINDOW_HOURS = 24;
const HIGH_VALUE_THRESHOLD = 5000;
const ROUND_AMOUNT_THRESHOLD = 10;

/**
 * detectAnomalies — Analyse les données de facturation et retourne les anomalies détectées.
 */
export function detectAnomalies(input: AnomalyDetectionInput): BillingAnomaly[] {
  const today = input.today ?? new Date();
  const anomalies: BillingAnomaly[] = [
    ...detectOverdueInvoices(input.invoices, today),
    ...detectOrphanPayments(input.payments, input.invoices),
    ...detectDuplicatePayments(input.payments),
    ...detectNegativeBalances(input.invoices),
    ...detectStuckDeposits(input.deposits),
    ...detectRoundAmountLines(input.lines),
    ...detectUnlinkedLines(input.lines),
  ];
  return anomalies;
}

// ─── Anomaly #1: Invoices overdue ─────────────────────────────────────────────

function detectOverdueInvoices(
  invoices: AnomalyDetectionInput['invoices'],
  today: Date,
): BillingAnomaly[] {
  const todayStr = today.toISOString().split('T')[0];
  return invoices
    .filter(inv =>
      inv.status === 'issued' &&
      inv.due_date &&
      inv.due_date < todayStr &&
      daysUntil(inv.due_date, today) < -OVERDUE_GRACE_DAYS,
    )
    .map(inv => ({
      id:                  `overdue_${inv.id}`,
      type:                'overdue_invoice',
      severity:            'high' as const,
      title:               'Facture en retard de paiement',
      description:         `Facture ${inv.invoice_number} : échéance ${inv.due_date}, solde ${(inv.balance ?? 0).toFixed(2)}€.`,
      affectedEntityId:    inv.id,
      affectedEntityType:  'invoice' as const,
      suggestedAction:     'Envoyer une relance ou saisir le paiement.',
    }));
}

// ─── Anomaly #2: Payments without matching invoice ────────────────────────────

function detectOrphanPayments(
  payments: AnomalyDetectionInput['payments'],
  invoices: AnomalyDetectionInput['invoices'],
): BillingAnomaly[] {
  const invoiceIds = new Set(invoices.map(i => i.id));
  return payments
    .filter(p => p.status === 'completed' && !invoiceIds.has(p.invoice_id))
    .map(p => ({
      id:                  `orphan_pmt_${p.id}`,
      type:                'orphan_payment',
      severity:            'critical' as const,
      title:               'Paiement sans facture associée',
      description:         `Paiement de ${p.amount.toFixed(2)}€ (${p.method}) du ${p.collected_at.split('T')[0]} sans facture visible.`,
      affectedEntityId:    p.id,
      affectedEntityType:  'payment' as const,
      suggestedAction:     'Associer ce paiement à la facture correspondante.',
    }));
}

// ─── Anomaly #3: Duplicate payments ───────────────────────────────────────────

function detectDuplicatePayments(
  payments: AnomalyDetectionInput['payments'],
): BillingAnomaly[] {
  const seen = new Map<string, typeof payments[number]>();
  const anomalies: BillingAnomaly[] = [];
  const active = payments.filter(p => p.status === 'completed');

  for (const p of active) {
    const windowMs = DUPLICATE_WINDOW_HOURS * 3600 * 1000;
    const key = `${p.invoice_id}_${p.amount}_${p.method}`;
    const existing = seen.get(key);
    if (existing) {
      const diff = Math.abs(
        new Date(p.collected_at).getTime() - new Date(existing.collected_at).getTime(),
      );
      if (diff < windowMs) {
        anomalies.push({
          id:                 `dup_pmt_${p.id}`,
          type:               'duplicate_payment',
          severity:           'critical' as const,
          title:              'Paiement potentiellement en double',
          description:        `Deux paiements de ${p.amount.toFixed(2)}€ (${p.method}) sur la même facture en moins de ${DUPLICATE_WINDOW_HOURS}h.`,
          affectedEntityId:   p.id,
          affectedEntityType: 'payment' as const,
          suggestedAction:    'Vérifier et annuler le doublon via un remboursement.',
        });
      }
    }
    seen.set(key, p);
  }
  return anomalies;
}

// ─── Anomaly #4: Negative balance on paid invoices ────────────────────────────

function detectNegativeBalances(
  invoices: AnomalyDetectionInput['invoices'],
): BillingAnomaly[] {
  return invoices
    .filter(inv =>
      inv.status === 'paid' &&
      inv.balance !== null &&
      inv.balance < -0.05,
    )
    .map(inv => ({
      id:                  `neg_balance_${inv.id}`,
      type:                'negative_balance',
      severity:            'high' as const,
      title:               'Surpaiement détecté',
      description:         `Facture ${inv.invoice_number} : solde négatif de ${Math.abs(inv.balance ?? 0).toFixed(2)}€ (trop-perçu).`,
      affectedEntityId:    inv.id,
      affectedEntityType:  'invoice' as const,
      suggestedAction:     'Créer un avoir ou rembourser le trop-perçu.',
    }));
}

// ─── Anomaly #5: Deposits stuck in pending state ──────────────────────────────

function detectStuckDeposits(
  deposits: AnomalyDetectionInput['deposits'],
): BillingAnomaly[] {
  return deposits
    .filter(d => d.status === 'pending')
    .map(d => ({
      id:                  `stuck_dep_${d.id}`,
      type:                'stuck_deposit',
      severity:            'medium' as const,
      title:               'Dépôt non capturé',
      description:         `Acompte/garantie de ${d.amount.toFixed(2)}€ en attente de capture.`,
      affectedEntityId:    d.id,
      affectedEntityType:  'deposit' as const,
      suggestedAction:     'Capturer ou libérer ce dépôt.',
    }));
}

// ─── Anomaly #6: Round amount invoice lines (possible estimation) ─────────────

function detectRoundAmountLines(
  lines: AnomalyDetectionInput['lines'],
): BillingAnomaly[] {
  return lines
    .filter(l =>
      l.quantity > 0 &&
      l.source !== 'reversal' &&
      l.unit_price_ht >= HIGH_VALUE_THRESHOLD &&
      l.unit_price_ht % ROUND_AMOUNT_THRESHOLD === 0 &&
      !l.reversal_of,
    )
    .map(l => ({
      id:                  `round_${l.id}`,
      type:                'round_amount_line',
      severity:            'low' as const,
      title:               'Montant rond élevé',
      description:         `Ligne "${l.description}" : ${l.unit_price_ht.toFixed(2)}€ HT. Montant élevé et rond — à vérifier.`,
      affectedEntityId:    l.id,
      affectedEntityType:  'line' as const,
      suggestedAction:     'Confirmer que ce montant est bien exact.',
    }));
}

// ─── Anomaly #7: Lines without service date in the past ──────────────────────

function detectUnlinkedLines(
  lines: AnomalyDetectionInput['lines'],
): BillingAnomaly[] {
  const today = new Date().toISOString().split('T')[0];
  return lines
    .filter(l =>
      l.quantity > 0 &&
      l.source === 'manual' &&
      !l.reversal_of &&
      l.service_date > today,
    )
    .map(l => ({
      id:                  `future_svc_${l.id}`,
      type:                'future_service_date',
      severity:            'medium' as const,
      title:               'Prestation dans le futur',
      description:         `Ligne "${l.description}" : date de prestation ${l.service_date} est dans le futur.`,
      affectedEntityId:    l.id,
      affectedEntityType:  'line' as const,
      suggestedAction:     'Vérifier la date de prestation avant émission.',
    }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string, from: Date): number {
  const target = new Date(dateStr);
  return Math.floor((target.getTime() - from.getTime()) / (1000 * 3600 * 24));
}
