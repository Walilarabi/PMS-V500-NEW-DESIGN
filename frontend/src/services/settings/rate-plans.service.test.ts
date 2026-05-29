/**
 * FLOWTYM — Tests du service rate-plans.service.
 *
 * Couverture :
 *   - listRatePlansWithRooms  : mapping plan→room, hotel_id isolation
 *   - listRoomTypeRows        : liste simple avec hotel_id
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

/** Builds a thenable Supabase-style query chain that resolves to `result`. */
function makeChain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  // Make it thenable so `await chain` resolves correctly
  chain.then = (onfulfilled: (v: unknown) => unknown, onrejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onfulfilled, onrejected);
  chain.catch = (onrejected: (e: unknown) => unknown) =>
    Promise.resolve(result).catch(onrejected);
  return chain;
}

vi.mock('@/src/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/src/lib/hotelId', () => ({
  resolveHotelId: vi.fn().mockResolvedValue('hotel-test'),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { listRatePlansWithRooms, listRoomTypeRows } from './rate-plans.service';
import { resolveHotelId } from '@/src/lib/hotelId';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('listRoomTypeRows', () => {
  it('retourne un tableau vide si hotel_id absent', async () => {
    vi.mocked(resolveHotelId).mockResolvedValueOnce(null);
    const result = await listRoomTypeRows();
    expect(result).toEqual([]);
  });

  it('retourne les données Supabase', async () => {
    const rows = [
      { id: 'rt1', room_type_code: 'STD', room_type_name: 'Standard' },
      { id: 'rt2', room_type_code: 'SUP', room_type_name: 'Supérieure' },
    ];
    vi.mocked(resolveHotelId).mockResolvedValueOnce('hotel-test');
    const { supabase } = await import('@/src/lib/supabase');
    (supabase as any).from = vi.fn().mockReturnValue(makeChain({ data: rows }));
    const result = await listRoomTypeRows();
    expect(result).toEqual(rows);
  });

  it('retourne [] sur data null (table vide)', async () => {
    vi.mocked(resolveHotelId).mockResolvedValueOnce('hotel-test');
    const { supabase } = await import('@/src/lib/supabase');
    (supabase as any).from = vi.fn().mockReturnValue(makeChain({ data: null }));
    const result = await listRoomTypeRows();
    expect(result).toEqual([]);
  });
});

describe('listRatePlansWithRooms', () => {
  it('retourne un tableau vide si hotel_id absent', async () => {
    vi.mocked(resolveHotelId).mockResolvedValueOnce(null);
    const result = await listRatePlansWithRooms();
    expect(result).toEqual([]);
  });

  it('associe le bon room à chaque plan via room_type_id', async () => {
    vi.mocked(resolveHotelId).mockResolvedValueOnce('hotel-test');
    const plans = [
      { id: 'p1', plan_code: 'BB', plan_name: 'Bed & Breakfast', room_type_id: 'rt1', pension_type: 'BB', channel_type: 'Direct', connectivity_type: null, is_active: true, is_reference: false, calc_mode: 'fixed' },
      { id: 'p2', plan_code: 'RO', plan_name: 'Room Only', room_type_id: 'rt2', pension_type: 'RO', channel_type: 'OTA', connectivity_type: null, is_active: true, is_reference: true, calc_mode: 'fixed' },
      { id: 'p3', plan_code: 'HB', plan_name: 'Half Board', room_type_id: null, pension_type: 'HB', channel_type: 'Direct', connectivity_type: null, is_active: true, is_reference: false, calc_mode: 'fixed' },
    ];
    const rooms = [
      { id: 'rt1', room_type_code: 'STD', room_type_name: 'Standard' },
      { id: 'rt2', room_type_code: 'SUP', room_type_name: 'Supérieure' },
    ];

    const { supabase } = await import('@/src/lib/supabase');
    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'rate_plans') {
        return makeChain({ data: plans });
      }
      return makeChain({ data: rooms });
    });

    const result = await listRatePlansWithRooms();
    expect(result).toHaveLength(3);
    const p1 = result.find((p) => p.id === 'p1');
    const p2 = result.find((p) => p.id === 'p2');
    const p3 = result.find((p) => p.id === 'p3');
    expect(p1?.room?.room_type_code).toBe('STD');
    expect(p2?.room?.room_type_code).toBe('SUP');
    expect(p3?.room).toBeNull();
  });
});
