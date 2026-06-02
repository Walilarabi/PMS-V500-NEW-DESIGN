/**
 * FLOWTYM — Tests du socle Conversations (L2).
 *
 * Stratégie : mock @/src/lib/supabase (builder chaînable + rpc) — aucun réseau.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock('@/src/lib/supabase', () => ({ supabase: { from: fromMock, rpc: rpcMock } }));
vi.mock('@/src/domains/_shared/errors', () => ({ mapSupabaseError: (e: unknown) => e }));

import {
  listThreads, listMessages, listUnifiedTimeline, getOrCreateThread,
} from './conversations.service';

/** Builder chaînable thenable : chaque méthode renvoie le builder ; await → result. */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const b: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {};
  for (const m of ['select', 'order', 'limit', 'eq', 'in']) b[m] = vi.fn(() => b);
  (b as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return b;
}

beforeEach(() => { fromMock.mockReset(); rpcMock.mockReset(); });

describe('listThreads', () => {
  it('interroge conversation_threads, applique les filtres et renvoie les données', async () => {
    const b = makeBuilder({ data: [{ id: 't1', channel: 'email' }], error: null });
    fromMock.mockReturnValue(b);

    const rows = await listThreads({ guestId: 'g1', reservationId: 'r1', channel: 'whatsapp', status: 'open' });

    expect(fromMock).toHaveBeenCalledWith('conversation_threads');
    expect(b.eq).toHaveBeenCalledWith('guest_id', 'g1');
    expect(b.eq).toHaveBeenCalledWith('reservation_id', 'r1');
    expect(b.eq).toHaveBeenCalledWith('channel', 'whatsapp');
    expect(b.eq).toHaveBeenCalledWith('status', 'open');
    expect(rows).toEqual([{ id: 't1', channel: 'email' }]);
  });

  it('propage une erreur Supabase', async () => {
    fromMock.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
    await expect(listThreads()).rejects.toEqual({ message: 'boom' });
  });
});

describe('listMessages', () => {
  it('filtre par thread_id et trie chronologiquement', async () => {
    const b = makeBuilder({ data: [{ id: 'm1' }], error: null });
    fromMock.mockReturnValue(b);

    const rows = await listMessages('thread-9');

    expect(fromMock).toHaveBeenCalledWith('conversation_messages');
    expect(b.eq).toHaveBeenCalledWith('thread_id', 'thread-9');
    expect(b.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(rows).toHaveLength(1);
  });
});

describe('listUnifiedTimeline', () => {
  it('combine plusieurs canaux via .in et renvoie la timeline', async () => {
    const b = makeBuilder({ data: [{ id: 'm1', channel: 'email' }, { id: 'm2', channel: 'sms' }], error: null });
    fromMock.mockReturnValue(b);

    const rows = await listUnifiedTimeline({ guestId: 'g1', channels: ['email', 'sms', 'whatsapp'] });

    expect(fromMock).toHaveBeenCalledWith('conversation_messages');
    expect(b.eq).toHaveBeenCalledWith('guest_id', 'g1');
    expect(b.in).toHaveBeenCalledWith('channel', ['email', 'sms', 'whatsapp']);
    expect(rows).toHaveLength(2);
  });

  it('n\'ajoute pas de filtre canal si la liste est vide', async () => {
    const b = makeBuilder({ data: [], error: null });
    fromMock.mockReturnValue(b);
    await listUnifiedTimeline({ channels: [] });
    expect(b.in).not.toHaveBeenCalled();
  });
});

describe('getOrCreateThread', () => {
  it('appelle la RPC avec les bons paramètres et renvoie l\'id', async () => {
    rpcMock.mockResolvedValue({ data: 'thread-uuid', error: null });

    const id = await getOrCreateThread({
      channel: 'whatsapp', contactAddress: '+33612345678', guestId: 'g1', reservationId: 'r1', subject: 'Hello',
    });

    expect(rpcMock).toHaveBeenCalledWith('conversation_get_or_create_thread', {
      p_channel: 'whatsapp', p_contact_address: '+33612345678',
      p_guest_id: 'g1', p_reservation_id: 'r1', p_subject: 'Hello',
    });
    expect(id).toBe('thread-uuid');
  });

  it('propage une erreur RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'rpc fail' } });
    await expect(getOrCreateThread({ channel: 'email', contactAddress: 'a@b.com' })).rejects.toEqual({ message: 'rpc fail' });
  });
});
