/**
 * FLOWTYM — Tests du service Journal Unifié (L3).
 * Mock @/src/lib/supabase (rpc) — aucun réseau.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpcMock, fromMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), fromMock: vi.fn() }));
vi.mock('@/src/lib/supabase', () => ({ supabase: { rpc: rpcMock, from: fromMock } }));
vi.mock('@/src/domains/_shared/errors', () => ({ mapSupabaseError: (e: unknown) => e }));

import {
  fetchCommunicationTimeline, addInternalNote, fetchTimeline360, resolveReservationRefIds,
} from './timeline.service';

function makeBuilder(result: { data: unknown; error: unknown }) {
  const b: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {};
  for (const m of ['select', 'eq', 'limit']) b[m] = vi.fn(() => b);
  (b as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return b;
}

beforeEach(() => { rpcMock.mockReset(); fromMock.mockReset(); });

describe('fetchCommunicationTimeline', () => {
  it('ne fait aucun appel et renvoie [] sans scope', async () => {
    const rows = await fetchCommunicationTimeline({});
    expect(rows).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('appelle la RPC avec les bons paramètres et normalise attachments/metadata', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { entry_type: 'message', entry_id: 'm1', occurred_at: '2026-06-02T09:12:00Z', channel: 'email', attachments: null, metadata: null },
        { entry_type: 'note', entry_id: 'n1', occurred_at: '2026-06-02T09:45:00Z', channel: 'internal', attachments: [{ name: 'a.pdf' }], metadata: { x: 1 } },
      ],
      error: null,
    });

    const rows = await fetchCommunicationTimeline({ guestId: 'g1', reservationId: 'r1', limit: 10 });

    expect(rpcMock).toHaveBeenCalledWith('communication_timeline', {
      p_guest_id: 'g1', p_reservation_id: 'r1', p_limit: 10, p_before: null,
    });
    expect(rows[0].attachments).toEqual([]);       // null → []
    expect(rows[0].metadata).toEqual({});           // null → {}
    expect(rows[1].attachments).toEqual([{ name: 'a.pdf' }]);
  });

  it('plafonne la limite à 200', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await fetchCommunicationTimeline({ guestId: 'g1', limit: 9999 });
    expect(rpcMock).toHaveBeenCalledWith('communication_timeline', expect.objectContaining({ p_limit: 200 }));
  });

  it('propage une erreur RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchCommunicationTimeline({ guestId: 'g1' })).rejects.toEqual({ message: 'boom' });
  });
});

describe('fetchTimeline360', () => {
  it('ne fait aucun appel sans scope', async () => {
    expect(await fetchTimeline360({})).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('mappe les filtres (catégories/canaux/période/recherche) vers la RPC v2', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await fetchTimeline360({
      guestId: 'g1', categories: ['finance', 'reservation'], channels: ['email'],
      actor: 'u1', from: '2026-01-01T00:00:00Z', to: '2026-12-31T23:59:59Z', search: 'facture', limit: 40,
    });
    expect(rpcMock).toHaveBeenCalledWith('communication_timeline_v2', expect.objectContaining({
      p_guest_id: 'g1', p_categories: ['finance', 'reservation'], p_channels: ['email'],
      p_actor: 'u1', p_search: 'facture', p_limit: 40,
    }));
  });

  it('convertit les tableaux de filtres vides en null', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await fetchTimeline360({ guestId: 'g1', categories: [], channels: [] });
    expect(rpcMock).toHaveBeenCalledWith('communication_timeline_v2', expect.objectContaining({
      p_categories: null, p_channels: null,
    }));
  });
});

describe('resolveReservationRefIds', () => {
  it('renvoie les UUID sur correspondance unique', async () => {
    fromMock.mockReturnValue(makeBuilder({ data: [{ id: 'res-uuid', guest_id: 'guest-uuid' }], error: null }));
    const r = await resolveReservationRefIds('FLW-2026-001');
    expect(fromMock).toHaveBeenCalledWith('reservations');
    expect(r).toEqual({ reservationId: 'res-uuid', guestId: 'guest-uuid' });
  });

  it('renvoie null si 0 ou plusieurs correspondances (jamais ambigu)', async () => {
    fromMock.mockReturnValue(makeBuilder({ data: [{ id: 'a' }, { id: 'b' }], error: null }));
    expect(await resolveReservationRefIds('DUP')).toBeNull();
    fromMock.mockReturnValue(makeBuilder({ data: [], error: null }));
    expect(await resolveReservationRefIds('NONE')).toBeNull();
  });

  it('renvoie null pour une référence vide', async () => {
    expect(await resolveReservationRefIds('')).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('addInternalNote', () => {
  it('appelle add_internal_note et renvoie l\'id', async () => {
    rpcMock.mockResolvedValue({ data: 'note-uuid', error: null });
    const id = await addInternalNote({ guestId: 'g1', reservationId: null, body: '  Allergie arachides  ' });
    expect(rpcMock).toHaveBeenCalledWith('add_internal_note', {
      p_guest_id: 'g1', p_reservation_id: null, p_body: '  Allergie arachides  ',
    });
    expect(id).toBe('note-uuid');
  });

  it('propage une erreur RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(addInternalNote({ guestId: 'g1', body: 'x' })).rejects.toEqual({ message: 'denied' });
  });
});
