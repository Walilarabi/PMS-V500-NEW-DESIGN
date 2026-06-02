/**
 * FLOWTYM — Tests du service de communication (envoi via edge functions).
 *
 * Stratégie : mock @/src/lib/supabase (functions.invoke) — aucun réseau.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock('@/src/lib/supabase', () => ({
  supabase: { functions: { invoke: mockInvoke }, from: vi.fn() },
}));

import { sendEmail, sendWhatsApp } from './communicationService';

beforeEach(() => mockInvoke.mockReset());

describe('sendEmail', () => {
  it('renvoie success + messageId quand l\'edge function réussit', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, messageId: 'abc123' }, error: null });
    const r = await sendEmail({ to: 'a@b.com', subject: 'Hi', body: '<p>x</p>' });
    expect(r.success).toBe(true);
    expect(r.messageId).toBe('abc123');
    expect(mockInvoke).toHaveBeenCalledWith('send-email', expect.objectContaining({ body: expect.any(Object) }));
  });

  it('extrait le code et le message métier depuis le corps d\'erreur', async () => {
    const error = {
      message: 'HTTP 422',
      context: { json: async () => ({ error: 'email_not_configured', message: 'Email hôtel non configuré.' }) },
    };
    mockInvoke.mockResolvedValue({ data: null, error });
    const r = await sendEmail({ to: 'a@b.com', subject: 'Hi', body: 'x' });
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('email_not_configured');
    expect(r.message).toBe('Email hôtel non configuré.');
  });

  it('retombe sur error.message si le corps n\'est pas lisible', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    const r = await sendEmail({ to: 'a@b.com', subject: 'Hi', body: 'x' });
    expect(r.success).toBe(false);
    expect(r.message).toBe('Network error');
  });
});

describe('sendWhatsApp', () => {
  it('réussit', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, messageId: 'wamid.1' }, error: null });
    const r = await sendWhatsApp({ to: '+33612345678', text: 'Salut' });
    expect(r.success).toBe(true);
    expect(r.messageId).toBe('wamid.1');
    expect(mockInvoke).toHaveBeenCalledWith('send-whatsapp', expect.any(Object));
  });

  it('remonte invalid_phone', async () => {
    const error = { message: 'HTTP 400', context: { json: async () => ({ error: 'invalid_phone', message: 'Numéro invalide.' }) } };
    mockInvoke.mockResolvedValue({ data: null, error });
    const r = await sendWhatsApp({ to: 'xx', text: 'Salut' });
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('invalid_phone');
  });
});
