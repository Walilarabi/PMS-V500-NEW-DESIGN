/**
 * FLOWTYM — Tests du service Journal Unifié (L3).
 * Mock @/src/lib/supabase (rpc) — aucun réseau.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('@/src/lib/supabase', () => ({ supabase: { rpc: rpcMock } }));
vi.mock('@/src/domains/_shared/errors', () => ({ mapSupabaseError: (e: unknown) => e }));

import { fetchCommunicationTimeline, addInternalNote } from './timeline.service';

beforeEach(() => rpcMock.mockReset());

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
