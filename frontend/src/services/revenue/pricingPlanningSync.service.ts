/**
 * FLOWTYM RMS — Synchronisation Pricing ↔ Planning
 *
 * Synchronise la disponibilité affichée dans « Pricing & Recommandations »
 * avec la ligne disponibilité du module Planning.
 *
 * Règles métier :
 *   - Par défaut : la disponibilité vient automatiquement du Planning
 *     (via useOperationalData → reservations live + rooms actives)
 *   - Si l'utilisateur modifie manuellement la dispo dans Pricing, sa
 *     valeur prime sur la valeur automatique pendant 15 minutes
 *   - Pendant ce délai, un badge « Simulation manuelle active — sync
 *     planning suspendue 15 min » est affiché et l'auto-sync est bloquée
 *   - L'utilisateur peut réactiver la sync immédiatement (bouton)
 *   - Chaque mutation manuelle est journalisée (rmsAuditLogger)
 *
 * Exclusions de capacité (calcul du TO) :
 *   - Chambres hors service (status = 'out_of_order')
 *   - Chambres bloquées (status = 'blocked')
 *   - Chambres inactives (active = false)
 *
 * Formule TO :
 *   chambres vendues / chambres disponibles vendables
 *   où "vendables" = totalActives - horsService - bloquees
 */

import { rmsAuditLogger } from './rmsAuditLogger';
import { emitRmsEvent } from '@/src/lib/rms/eventBus';

export const SUSPEND_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface PricingOverride {
  date: string;             // YYYY-MM-DD
  availability: number;     // chambres dispo override
  setAt: number;            // timestamp ms
  expiresAt: number;        // timestamp ms (setAt + SUSPEND_DURATION_MS)
  reason?: string;          // optionnel
}

interface SyncState {
  overrides: Map<string, PricingOverride>;
}

const state: SyncState = {
  overrides: new Map(),
};

const listeners = new Set<(s: SyncState) => void>();
let version = 0;

function notify() {
  version++;
  listeners.forEach((l) => l(state));
}

function nowMs(): number { return Date.now(); }

export const pricingPlanningSync = {
  version(): number { return version; },

  subscribe(listener: (s: SyncState) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Vrai si une override manuelle non-expirée existe pour cette date. */
  isOverrideActive(date: string): boolean {
    const o = state.overrides.get(date);
    if (!o) return false;
    if (nowMs() >= o.expiresAt) {
      // Expiré : nettoyage
      state.overrides.delete(date);
      notify();
      return false;
    }
    return true;
  },

  /** Retourne le timestamp d'expiration de l'override actif (ou null). */
  expiresAt(date: string): number | null {
    const o = state.overrides.get(date);
    if (!o || nowMs() >= o.expiresAt) return null;
    return o.expiresAt;
  },

  /** Retourne la valeur surchargée (ou null si pas d'override actif). */
  getOverride(date: string): PricingOverride | null {
    if (!this.isOverrideActive(date)) return null;
    return state.overrides.get(date) ?? null;
  },

  /**
   * Applique une override manuelle pour 15 minutes.
   * Journalise et émet un événement pour notification.
   */
  setOverride(date: string, availability: number, reason?: string): PricingOverride {
    const o: PricingOverride = {
      date,
      availability: Math.max(0, Math.floor(availability)),
      setAt: nowMs(),
      expiresAt: nowMs() + SUSPEND_DURATION_MS,
      reason,
    };
    state.overrides.set(date, o);
    rmsAuditLogger.log({
      type: 'rule_adjusted',
      actor: 'Pricing Override',
      context: date,
      detail: `Disponibilité manuelle : ${o.availability} chambres (sync planning suspendue 15 min)`,
      impact: o.availability,
    });
    try {
      emitRmsEvent('tactical-rule:triggered', {
        ruleId: 'pricing_override',
        ruleName: 'Override disponibilité',
        matchedTriggers: [reason ?? 'Modification manuelle'],
        revenueImpact: 0,
        date,
      });
    } catch {/* bus indisponible */}
    notify();
    return o;
  },

  /** Force la réactivation immédiate de la sync auto pour une date donnée. */
  resumeSync(date: string) {
    if (!state.overrides.has(date)) return;
    state.overrides.delete(date);
    rmsAuditLogger.log({
      type: 'rule_adjusted',
      actor: 'Pricing Override',
      context: date,
      detail: 'Sync planning réactivée manuellement',
    });
    notify();
  },

  /** Réactive la sync sur toutes les dates. */
  resumeAll() {
    if (state.overrides.size === 0) return;
    state.overrides.clear();
    rmsAuditLogger.log({
      type: 'rule_adjusted',
      actor: 'Pricing Override',
      context: 'all',
      detail: 'Sync planning réactivée sur toutes les dates',
    });
    notify();
  },

  /** Nettoie les overrides expirés (à appeler périodiquement). */
  cleanupExpired() {
    let removed = 0;
    const cutoff = nowMs();
    for (const [date, o] of state.overrides.entries()) {
      if (cutoff >= o.expiresAt) {
        state.overrides.delete(date);
        removed++;
      }
    }
    if (removed > 0) notify();
  },

  /** Toutes les overrides actives (utile pour debug + UI). */
  all(): PricingOverride[] {
    this.cleanupExpired();
    return Array.from(state.overrides.values());
  },
};

/**
 * Calcule la capacité vendable d'un hôtel à partir des chambres en base.
 *
 * Sellable = total - hors_service - blocked - inactive
 *
 * Statuts considérés comme « non vendables » :
 *   - active = false
 *   - status = 'out_of_order' | 'OOO' | 'hors_service'
 *   - status = 'blocked' | 'bloque' | 'maintenance'
 */
interface RoomRow {
  active?: boolean;
  status?: string | null;
}

const OUT_OF_ORDER_STATUSES = new Set(['out_of_order', 'OOO', 'hors_service', 'OOS', 'maintenance']);
const BLOCKED_STATUSES = new Set(['blocked', 'bloque', 'blocked_for_event']);

export function isRoomSellable(room: RoomRow): boolean {
  if (room.active === false) return false;
  const s = (room.status ?? '').toLowerCase();
  if (OUT_OF_ORDER_STATUSES.has(s)) return false;
  if (BLOCKED_STATUSES.has(s)) return false;
  return true;
}

export function computeSellableCapacity(rooms: RoomRow[]): number {
  return rooms.reduce((n, r) => (isRoomSellable(r) ? n + 1 : n), 0);
}

/**
 * Calcule le TO selon la formule :
 *   TO = chambres vendues / chambres disponibles vendables
 *
 * Tient compte de :
 *   - exclusion des chambres hors service / bloquées
 *   - override manuel (si actif pour la date)
 *
 * @param roomsSold        chambres réellement vendues sur la date
 * @param sellableCapacity capacité vendable (cf. computeSellableCapacity)
 * @param overrideAvail    disponibilité si override manuel actif (optionnel)
 */
export function computeOccupancyRate(
  roomsSold: number,
  sellableCapacity: number,
  overrideAvail?: number,
): number {
  if (overrideAvail !== undefined) {
    // Override manuel : on dérive le TO à partir de la dispo surchargée
    const newRoomsSold = Math.max(0, sellableCapacity - overrideAvail);
    if (sellableCapacity <= 0) return 0;
    return Math.min(100, (newRoomsSold / sellableCapacity) * 100);
  }
  if (sellableCapacity <= 0) return 0;
  return Math.min(100, (roomsSold / sellableCapacity) * 100);
}
