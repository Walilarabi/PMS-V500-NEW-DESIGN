/**
 * Repro (root cause): every store setter used to recurse infinitely through
 * safeSet → "Maximum call stack size exceeded" → all action buttons
 * (Créer chambre / Créer tarif …) silently did nothing.
 *
 * These tests exercise the store actions DIRECTLY — exactly what the page
 * buttons call (openRoomPanel / openRatePanel / addRoomType / addRatePlan).
 * Before the fix they threw RangeError; after the fix state updates cleanly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({ supabase: { rpc: () => Promise.resolve({ data: null, error: null }) } }));
vi.mock('@/src/services/rms/rmsSupabasePersistence', () => ({
  upsertRoomTypeToSupabase: vi.fn(() => Promise.resolve()),
  deleteRoomTypeFromSupabase: vi.fn(() => Promise.resolve()),
  upsertRatePlanToSupabase: vi.fn(() => Promise.resolve()),
  deleteRatePlanFromSupabase: vi.fn(() => Promise.resolve()),
}));

import { useRateCalendarStore } from '../store/rateCalendarStore';

describe('rateCalendarStore — safeSet ne récurse plus (cause racine des boutons morts)', () => {
  beforeEach(() => {
    useRateCalendarStore.getState().closeAllPanels();
  });

  it('openRoomPanel(null) bascule roomPanelOpen sans dépasser la pile', () => {
    expect(useRateCalendarStore.getState().roomPanelOpen).toBe(false);
    expect(() => useRateCalendarStore.getState().openRoomPanel(null)).not.toThrow();
    expect(useRateCalendarStore.getState().roomPanelOpen).toBe(true);
  });

  it('openRatePanel(null) bascule ratePanelOpen sans dépasser la pile', () => {
    expect(() => useRateCalendarStore.getState().openRatePanel(null)).not.toThrow();
    expect(useRateCalendarStore.getState().ratePanelOpen).toBe(true);
    expect(useRateCalendarStore.getState().roomPanelOpen).toBe(false);
  });

  it('addRoomType crée bien un type dans le store (passe par safeSet + dedup)', () => {
    const before = useRateCalendarStore.getState().roomTypes.length;
    useRateCalendarStore.getState().addRoomType({
      roomName: 'Repro Suite', roomCode: 'REPRO1', capacity: 2, bathroom: 'Douche',
      equipment: ['wifi'], view: 'Ville', description: '', isReference: false,
      assignedRatePlanIds: [], partnerIds: ['direct'], diffFromRef: 0, diffType: 'fixed',
    } as Parameters<ReturnType<typeof useRateCalendarStore.getState>['addRoomType']>[0]);
    const after = useRateCalendarStore.getState().roomTypes;
    expect(after.length).toBe(before + 1);
    expect(after.some((r) => r.roomTypeCode === 'REPRO1')).toBe(true);
  });

  it('dedup toujours actif : pas de doublon de roomTypeCode après double add', () => {
    const s = useRateCalendarStore.getState();
    s.addRoomType({ roomName: 'Dup', roomCode: 'DUP1', capacity: 1, bathroom: 'Douche', equipment: [], view: '', description: '', isReference: false, assignedRatePlanIds: [], partnerIds: [], diffFromRef: 0, diffType: 'fixed' } as never);
    s.addRoomType({ roomName: 'Dup', roomCode: 'DUP1', capacity: 1, bathroom: 'Douche', equipment: [], view: '', description: '', isReference: false, assignedRatePlanIds: [], partnerIds: [], diffFromRef: 0, diffType: 'fixed' } as never);
    const dup1 = useRateCalendarStore.getState().roomTypes.filter((r) => r.roomTypeCode === 'DUP1');
    expect(dup1.length).toBe(1);
  });
});
