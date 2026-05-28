/**
 * FLOWTYM RMS — Feedback recommandations (raisons de refus).
 *
 * Journal des actions utilisateur sur les recommandations RMS :
 *   - acceptée → enregistrée via rms-decisions.service.recordRmsDecision
 *   - refusée  → enregistrée ici avec raison structurée + commentaire libre
 *   - maintenue → enregistrée comme « maintained » côté rms-decisions
 *
 * Le feedback alimente l'algorithme d'apprentissage : les raisons les plus
 * fréquentes sont visibles dans le journal et peuvent ajuster la confiance IA
 * des règles tactiques (à venir).
 *
 * Persistance : Supabase si dispo (table rms_decisions + metadata JSON),
 * sinon journal en mémoire (idempotent et observable).
 */

import { emitRmsEvent } from '@/src/lib/rms/eventBus';

export type RejectionReasonCode =
  | 'tarif_trop_eleve'
  | 'tarif_trop_bas'
  | 'concurrence_mal_interpretee'
  | 'evenement_non_pertinent'
  | 'decision_commerciale_autre';

export const REJECTION_REASONS: { code: RejectionReasonCode; label: string }[] = [
  { code: 'tarif_trop_eleve', label: 'Tarif trop élevé' },
  { code: 'tarif_trop_bas', label: 'Tarif trop bas' },
  { code: 'concurrence_mal_interpretee', label: 'Concurrence mal interprétée' },
  { code: 'evenement_non_pertinent', label: 'Événement non pertinent' },
  { code: 'decision_commerciale_autre', label: 'Décision commerciale / autre' },
];

export interface FeedbackEntry {
  id: string;
  timestamp: string;
  date: string;                // YYYY-MM-DD — date du séjour
  action: 'accept' | 'reject' | 'maintain';
  reasonCode?: RejectionReasonCode;
  reasonLabel?: string;
  comment?: string;
  // Snapshot du contexte au moment de la décision (utilisé pour l'apprentissage)
  context?: {
    ourPrice?: number;
    recommendedPrice?: number;
    median?: number;
    rank?: number;
    pressure?: 'low' | 'medium' | 'high' | 'extreme';
    strategy?: string;
  };
}

const MAX_ENTRIES = 500;
let store: FeedbackEntry[] = [];
const listeners = new Set<(entries: FeedbackEntry[]) => void>();
let version = 0;

function notify() {
  version++;
  listeners.forEach((l) => l(store));
}

export const recommendationFeedback = {
  all(): FeedbackEntry[] { return store; },
  version(): number { return version; },

  /** Compte par raison sur les N derniers refus. */
  countByReason(limit = 100): Record<RejectionReasonCode, number> {
    const counts: Record<string, number> = {};
    for (const r of REJECTION_REASONS) counts[r.code] = 0;
    store
      .filter((e) => e.action === 'reject' && e.reasonCode)
      .slice(0, limit)
      .forEach((e) => {
        if (e.reasonCode) counts[e.reasonCode] = (counts[e.reasonCode] ?? 0) + 1;
      });
    return counts as Record<RejectionReasonCode, number>;
  },

  log(entry: Omit<FeedbackEntry, 'id' | 'timestamp'>): FeedbackEntry {
    const full: FeedbackEntry = {
      id: `fb_${Date.now()}_${Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    store = [full, ...store].slice(0, MAX_ENTRIES);
    try {
      if (entry.action === 'accept' || entry.action === 'maintain') {
        emitRmsEvent('rms-decision:accepted', {
          decisionId: full.id,
          date: entry.date,
          delta: (entry.context?.recommendedPrice ?? 0) - (entry.context?.ourPrice ?? 0),
        });
      } else {
        emitRmsEvent('rms-decision:rejected', { decisionId: full.id });
      }
    } catch {/* bus indisponible */}
    notify();
    return full;
  },

  subscribe(listener: (entries: FeedbackEntry[]) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  clear() {
    store = [];
    notify();
  },
};
