/**
 * FLOWTYM — RMS ↔ Calendrier Tarifaire Sync
 *
 * Pont entre la prise de décision RMS (RateManager, Kanban, Cards, DecisionHistory)
 * et le Calendrier Tarifaire (rateCalendarStore).
 *
 * Quand une recommandation est acceptée / refusée / maintenue, le prix final
 * est injecté dans le Calendrier sur la chambre référente + plan référent.
 * Le statut (En attente / Acceptée / Refusée / Maintenue) est conservé pour
 * synchronisation temps réel.
 */

import { useRateCalendarStore } from '../components/rms/store/rateCalendarStore';
import { pushToAllChannels } from './channel-manager.service';

export type RMSDecisionStatus = 'En attente' | 'Acceptée' | 'Refusée' | 'Maintenue';

export interface RMSDecisionPayload {
  date: string;
  finalPrice: number;
  status: RMSDecisionStatus;
  source: 'table' | 'kanban' | 'cards' | 'history' | 'autopilot' | 'manual';
  roomTypeId?: string;
  planId?: string;
  reason?: string;
}

interface SyncRecord {
  id: string;
  timestamp: string;
  payload: RMSDecisionPayload;
  resolvedRoomTypeId: string | null;
  resolvedPlanId: string | null;
  applied: boolean;
  error?: string;
}

const SYNC_LOG_KEY = 'flowtym_rms_calendar_sync_log';
const MAX_LOG_ENTRIES = 200;

function loadLog(): SyncRecord[] {
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLog(log: SyncRecord[]) {
  try {
    const trimmed = log.slice(0, MAX_LOG_ENTRIES);
    localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

function resolveTargets(payload: RMSDecisionPayload): {
  roomTypeId: string | null;
  planId: string | null;
} {
  const state = useRateCalendarStore.getState();
  const rooms = state.roomTypes;

  const referenceRoom = rooms.find((r) => r.isReference) ?? rooms[0];
  const roomTypeId = payload.roomTypeId ?? referenceRoom?.roomTypeId ?? null;
  if (!roomTypeId) return { roomTypeId: null, planId: null };

  const room = rooms.find((r) => r.roomTypeId === roomTypeId);
  if (!room) return { roomTypeId, planId: null };

  const referencePlan = room.ratePlans.find((p) => p.isReference) ?? room.ratePlans[0];
  const planId = payload.planId ?? referencePlan?.planId ?? null;
  return { roomTypeId, planId };
}

/**
 * Inject une décision RMS dans le Calendrier Tarifaire.
 * - Détermine room + rate plan (référents par défaut)
 * - Met à jour le prix (updatePrice) si statut Acceptée ou Maintenue avec prix changé
 * - Journalise l'opération (localStorage)
 */
export function syncRMSDecision(payload: RMSDecisionPayload): SyncRecord {
  const { roomTypeId, planId } = resolveTargets(payload);
  const record: SyncRecord = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    payload,
    resolvedRoomTypeId: roomTypeId,
    resolvedPlanId: planId,
    applied: false,
  };

  if (!roomTypeId || !planId) {
    record.error = 'Aucune chambre/plan référent disponible dans le Calendrier';
    const log = loadLog();
    log.unshift(record);
    persistLog(log);
    return record;
  }

  // Refusée → on garde le prix actuel, pas d'injection
  // En attente → pas d'injection
  // Acceptée / Maintenue → injection du finalPrice
  if (payload.status === 'Acceptée' || payload.status === 'Maintenue') {
    try {
      useRateCalendarStore
        .getState()
        .updatePrice(roomTypeId, planId, payload.date, payload.finalPrice);
      record.applied = true;

      // Push automatique vers les Channel Managers (fire-and-forget)
      void pushToAllChannels({
        date: payload.date,
        roomTypeId,
        planId,
        price: payload.finalPrice,
      });
    } catch (e) {
      record.error = e instanceof Error ? e.message : String(e);
    }
  } else {
    record.applied = false;
  }

  const log = loadLog();
  log.unshift(record);
  persistLog(log);
  return record;
}

/**
 * Récupère l'historique de synchronisation (le plus récent en premier).
 */
export function getSyncHistory(limit = 50): SyncRecord[] {
  return loadLog().slice(0, limit);
}

/**
 * Purge l'historique de synchronisation.
 */
export function clearSyncHistory() {
  localStorage.removeItem(SYNC_LOG_KEY);
}
