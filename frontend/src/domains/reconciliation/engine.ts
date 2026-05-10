/**
 * FLOWTYM — Reconciliation auto-match engine.
 *
 * Pure TypeScript : given a list of bank lines and a list of payouts +
 * reservations, returns suggested matches based on amount + date proximity.
 * No I/O — easy to unit test.
 */
import type { BankStatement } from './repository';

export interface PayoutLite {
  id: string;
  validation_id: string | null;
  reservation_id: string | null;
  partner_id: string | null;
  expected_payout: number | null;
  currency: string;
  created_at: string;
}

export interface ReservationLite {
  id: string;
  total_amount: number | null;
  paid_amount: number | null;
  payment_status: string | null;
  source: string | null;
  check_in: string;
  check_out: string;
}

export interface MatchSuggestion {
  bankStatementId: string;
  kind: 'PAYOUT' | 'RESERVATION';
  targetId: string;
  targetReference: string;
  amountDiff: number;
  daysDiff: number;
  confidence: number; // 0–100
}

const DAY_MS = 86_400_000;

const isOtaSource = (s: string) =>
  s === 'BOOKING' || s === 'EXPEDIA' || s === 'AIRBNB' || s === 'AGODA';

export function suggestMatches(
  statements: BankStatement[],
  payouts: PayoutLite[],
  reservations: ReservationLite[],
): MatchSuggestion[] {
  const out: MatchSuggestion[] = [];

  for (const s of statements) {
    if (s.status !== 'UNMATCHED') continue;
    const stmtDate = new Date(s.posted_at).getTime();

    if (isOtaSource(s.source)) {
      for (const p of payouts) {
        if (p.expected_payout == null) continue;
        if ((p.currency ?? 'EUR') !== s.currency) continue;
        const amountDiff = Math.abs((p.expected_payout ?? 0) - s.amount);
        const daysDiff = Math.abs((stmtDate - new Date(p.created_at).getTime()) / DAY_MS);
        if (daysDiff > 30) continue;
        let confidence = 100;
        confidence -= Math.min(50, amountDiff * 2);          // 1€ off = -2 pts
        confidence -= Math.min(30, Math.round(daysDiff * 2)); // 1d off = -2 pts
        if (confidence > 40) {
          out.push({
            bankStatementId: s.id,
            kind: 'PAYOUT',
            targetId: p.id,
            targetReference: `payout:${p.id.slice(0, 8)}`,
            amountDiff,
            daysDiff,
            confidence,
          });
        }
      }
    } else {
      // BANK_HOTEL : match against direct reservations with similar total
      for (const r of reservations) {
        if (r.total_amount == null) continue;
        const amountDiff = Math.abs((r.total_amount ?? 0) - s.amount);
        const daysDiff = Math.min(
          Math.abs((stmtDate - new Date(r.check_in).getTime()) / DAY_MS),
          Math.abs((stmtDate - new Date(r.check_out).getTime()) / DAY_MS),
        );
        if (daysDiff > 30) continue;
        let confidence = 90;
        confidence -= Math.min(40, amountDiff * 2);
        confidence -= Math.min(30, Math.round(daysDiff * 2));
        if (r.payment_status === 'paid') confidence += 5;
        if (confidence > 40) {
          out.push({
            bankStatementId: s.id,
            kind: 'RESERVATION',
            targetId: r.id,
            targetReference: `réservation:${r.id.slice(0, 8)}`,
            amountDiff,
            daysDiff,
            confidence: Math.min(100, confidence),
          });
        }
      }
    }
  }

  // Keep only the best suggestion per statement
  const bestByStmt = new Map<string, MatchSuggestion>();
  for (const s of out) {
    const prev = bestByStmt.get(s.bankStatementId);
    if (!prev || s.confidence > prev.confidence) bestByStmt.set(s.bankStatementId, s);
  }
  return Array.from(bestByStmt.values()).sort((a, b) => b.confidence - a.confidence);
}
