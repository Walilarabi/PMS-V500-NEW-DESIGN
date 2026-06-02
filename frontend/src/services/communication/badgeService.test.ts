/**
 * FLOWTYM — Tests du service badges (RPC set_guest_badges + historique).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRpc, mockFrom } = vi.hoisted(() => ({ mockRpc: vi.fn(), mockFrom: vi.fn() }));

vi.mock('@/src/lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

import { setGuestBadges, listBadgeHistory } from './badgeService';

beforeEach(() => { mockRpc.mockReset(); mockFrom.mockReset(); });

describe('setGuestBadges', () => {
  it('appelle la RPC avec les bons paramètres et renvoie les badges normalisés', async () => {
    mockRpc.mockResolvedValue({ data: ['vip', 'pmr'], error: null });
    const out = await setGuestBadges({ guestId: 'g1', badges: ['vip', 'pmr'], reservationId: 'r1' });
    expect(out).toEqual(['vip', 'pmr']);
    expect(mockRpc).toHaveBeenCalledWith('set_guest_badges', {
      p_guest_id: 'g1', p_badges: ['vip', 'pmr'], p_reservation_id: 'r1', p_source: 'flowday',
    });
  });

  it('normalise les badges legacy retournés par la base', async () => {
    mockRpc.mockResolvedValue({ data: ['incident', 'nouveau'], error: null });
    const out = await setGuestBadges({ guestId: 'g1', badges: [] });
    expect(out).toEqual(['litige', 'habitue']);
  });

  it('lève une erreur si la RPC échoue', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Accès refusé', code: '42501' } });
    await expect(setGuestBadges({ guestId: 'g1', badges: ['vip'] })).rejects.toThrow();
  });
});

describe('listBadgeHistory', () => {
  it('interroge guest_badge_history filtré par guest', async () => {
    const rows = [{ id: 'h1', guest_id: 'g1', new_badges: ['vip'] }];
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    mockFrom.mockReturnValue(chain);
    const out = await listBadgeHistory('g1');
    expect(mockFrom).toHaveBeenCalledWith('guest_badge_history');
    expect(chain.eq).toHaveBeenCalledWith('guest_id', 'g1');
    expect(out).toEqual(rows);
  });
});
