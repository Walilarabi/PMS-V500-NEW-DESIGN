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
  upsertRoomTypeToSupabase: vi.fn(() => Promise.resolve({ error: null })),
  deleteRoomTypeFromSupabase: vi.fn(() => Promise.resolve({ error: null })),
  upsertRatePlanToSupabase: vi.fn(() => Promise.resolve({ error: null })),
  deleteRatePlanFromSupabase: vi.fn(() => Promise.resolve({ error: null })),
}));
// loadData() reconciles from the "DB" — here the mock echoes the store's current
// state, simulating a backend that has exactly what was just persisted.
vi.mock('../data/supabaseAdapter', () => ({
  fetchCalendarDataFromSupabase: vi.fn(async () => {
    const { useRateCalendarStore } = await import('../store/rateCalendarStore');
    return { roomTypes: useRateCalendarStore.getState().roomTypes, dateColumns: [] };
  }),
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

  it('addRoomType persiste AVANT de confirmer : succès Supabase → reste, échoue → annulé', async () => {
    const persist = await import('@/src/services/rms/rmsSupabasePersistence');
    const before = useRateCalendarStore.getState().roomTypes.length;

    // Cas succès : upsert OK → la chambre reste dans le store
    (persist.upsertRoomTypeToSupabase as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null });
    const ok = await useRateCalendarStore.getState().addRoomType({
      roomName: 'Repro Suite', roomCode: 'REPRO1', capacity: 2, bathroom: 'Douche',
      equipment: ['wifi'], view: 'Ville', description: '', isReference: false,
      assignedRatePlanIds: [], partnerIds: ['direct'], diffFromRef: 0, diffType: 'fixed',
    } as never);
    expect(ok.error).toBeNull();
    expect(useRateCalendarStore.getState().roomTypes.some((r) => r.roomTypeCode === 'REPRO1')).toBe(true);

    // Cas échec : upsert renvoie une erreur → ajout optimiste ANNULÉ (pas de fantôme)
    (persist.upsertRoomTypeToSupabase as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'RLS denied' });
    const ko = await useRateCalendarStore.getState().addRoomType({
      roomName: 'Ghost', roomCode: 'GHOST1', capacity: 1, bathroom: 'Douche',
      equipment: [], view: '', description: '', isReference: false,
      assignedRatePlanIds: [], partnerIds: [], diffFromRef: 0, diffType: 'fixed',
    } as never);
    expect(ko.error).toBe('RLS denied');
    expect(useRateCalendarStore.getState().roomTypes.some((r) => r.roomTypeCode === 'GHOST1')).toBe(false);
    expect(useRateCalendarStore.getState().roomTypes.length).toBeGreaterThanOrEqual(before);
  });
});
