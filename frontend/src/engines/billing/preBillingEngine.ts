/**
 * FLOWTYM — Pre-Billing Control Engine (T12).
 * 8 contrôles purs avant émission de facture.
 * Aucune dépendance réseau — entrées typées, sorties déterministes.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CheckSeverity = 'error' | 'warning' | 'info';

export interface PreBillingCheck {
  id: string;
  label: string;
  severity: CheckSeverity;
  passed: boolean;
  message?: string;
}

export interface PreBillingReport {
  canIssue: boolean;
  checks: PreBillingCheck[];
  errorCount: number;
  warningCount: number;
}

export interface PreBillingInput {
  invoice: {
    id: string;
    status: string;
    total_ht: number;
    total_tva: number;
    total_ttc: number;
    paid_amount: number;
    balance: number | null;
    bill_to_name: string | null;
    bill_to_address: string | null;
    due_date: string | null;
    reservation_id: string | null;
    guest_id: string | null;
  };
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price_ht: number;
    tva_rate: number;
    total_ht: number | null;
    total_ttc: number | null;
    service_date: string;
  }>;
  folios: Array<{
    id: string;
    label: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
  }>;
  reservation?: {
    check_in: string;
    check_out: string;
    status: string;
  } | null;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

const TVA_RATES = [0, 5.5, 10, 20];
const MAX_BALANCE_TOLERANCE = 0.02; // 2 centimes de tolérance d'arrondi

/**
 * runPreBillingChecks — Exécute les 8 contrôles de pré-facturation.
 * Retourne un rapport avec canIssue = true seulement si aucune erreur.
 */
export function runPreBillingChecks(input: PreBillingInput): PreBillingReport {
  const checks: PreBillingCheck[] = [
    checkStatus(input),
    checkBillTo(input),
    checkHasLines(input),
    checkTvaRates(input),
    checkTotalsConsistency(input),
    checkServiceDates(input),
    checkReservationStatus(input),
    checkBalance(input),
  ];

  const errorCount   = checks.filter(c => !c.passed && c.severity === 'error').length;
  const warningCount = checks.filter(c => !c.passed && c.severity === 'warning').length;

  return {
    canIssue: errorCount === 0,
    checks,
    errorCount,
    warningCount,
  };
}

// ─── Individual Checks ────────────────────────────────────────────────────────

function checkStatus({ invoice }: PreBillingInput): PreBillingCheck {
  const passed = invoice.status === 'draft';
  return {
    id: 'status',
    label: 'Statut de la facture',
    severity: 'error',
    passed,
    message: passed ? undefined : `La facture ne peut être émise qu'à l'état brouillon (état actuel : ${invoice.status}).`,
  };
}

function checkBillTo({ invoice }: PreBillingInput): PreBillingCheck {
  const passed = !!(invoice.bill_to_name?.trim() || invoice.guest_id || invoice.reservation_id);
  return {
    id: 'bill_to',
    label: 'Destinataire défini',
    severity: 'error',
    passed,
    message: passed ? undefined : 'Le destinataire de la facture est obligatoire (nom ou client lié).',
  };
}

function checkHasLines({ lines, folios }: PreBillingInput): PreBillingCheck {
  const positiveLines = lines.filter(l => l.quantity > 0);
  const passed = positiveLines.length > 0 && folios.length > 0;
  return {
    id: 'has_lines',
    label: 'Au moins une ligne de facturation',
    severity: 'error',
    passed,
    message: passed ? undefined : 'La facture doit contenir au moins une ligne non annulée.',
  };
}

function checkTvaRates({ lines }: PreBillingInput): PreBillingCheck {
  const invalid = lines.filter(l => !TVA_RATES.includes(l.tva_rate));
  const passed = invalid.length === 0;
  return {
    id: 'tva_rates',
    label: 'Taux de TVA valides',
    severity: 'error',
    passed,
    message: passed
      ? undefined
      : `${invalid.length} ligne(s) avec taux TVA non standard (attendu : ${TVA_RATES.join('%, ')}%).`,
  };
}

function checkTotalsConsistency({ invoice, lines }: PreBillingInput): PreBillingCheck {
  const computedHt  = lines.reduce((s, l) => s + (l.total_ht ?? l.quantity * l.unit_price_ht), 0);
  const computedTtc = lines.reduce((s, l) => s + (l.total_ttc ?? 0), 0);
  const htDiff  = Math.abs(computedHt  - invoice.total_ht);
  const ttcDiff = Math.abs(computedTtc - invoice.total_ttc);
  const passed  = htDiff <= MAX_BALANCE_TOLERANCE && ttcDiff <= MAX_BALANCE_TOLERANCE;
  return {
    id: 'totals_consistency',
    label: 'Cohérence des totaux',
    severity: 'error',
    passed,
    message: passed
      ? undefined
      : `Totaux incohérents : écart HT=${htDiff.toFixed(2)}€, TTC=${ttcDiff.toFixed(2)}€.`,
  };
}

function checkServiceDates({ lines, reservation }: PreBillingInput): PreBillingCheck {
  if (!reservation) {
    return { id: 'service_dates', label: 'Dates de prestation', severity: 'info', passed: true };
  }
  const checkIn  = new Date(reservation.check_in);
  const checkOut = new Date(reservation.check_out);
  const outsideRange = lines.filter(l => {
    if (!l.service_date) return false;
    const d = new Date(l.service_date);
    return d < new Date(checkIn.getTime() - 24 * 3600 * 1000) ||
           d > new Date(checkOut.getTime() + 24 * 3600 * 1000);
  });
  const passed = outsideRange.length === 0;
  return {
    id: 'service_dates',
    label: 'Dates de prestation cohérentes',
    severity: 'warning',
    passed,
    message: passed
      ? undefined
      : `${outsideRange.length} ligne(s) avec des dates hors du séjour (±1j tolérance).`,
  };
}

function checkReservationStatus({ invoice, reservation }: PreBillingInput): PreBillingCheck {
  if (!invoice.reservation_id || !reservation) {
    return { id: 'reservation_status', label: 'Statut de la réservation', severity: 'info', passed: true };
  }
  const cancelled = reservation.status === 'cancelled';
  return {
    id: 'reservation_status',
    label: 'Réservation non annulée',
    severity: 'warning',
    passed: !cancelled,
    message: cancelled ? 'La réservation liée est annulée — vérifiez si la facturation est intentionnelle.' : undefined,
  };
}

function checkBalance({ invoice }: PreBillingInput): PreBillingCheck {
  const hasOverpay  = invoice.paid_amount > invoice.total_ttc + MAX_BALANCE_TOLERANCE;
  const passed      = !hasOverpay;
  return {
    id: 'balance',
    label: 'Solde cohérent',
    severity: 'warning',
    passed,
    message: passed
      ? undefined
      : `Paiements (${invoice.paid_amount.toFixed(2)}€) supérieurs au total TTC (${invoice.total_ttc.toFixed(2)}€).`,
  };
}
