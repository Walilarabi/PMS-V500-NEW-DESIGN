/**
 * Tests observability — focus sur la redaction PII (RGPD).
 *
 * Un leak d'email/token dans un log Sentry = amende CNIL potentielle.
 * Ces tests verrouillent le comportement du `redactPII()`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { log, reportError, __test, installCustomSink, clearSink } from './observability';

describe('redactPII — fields', () => {
  it('redacte les clés PII conservatrices', () => {
    const out = __test.redactPII({
      email: 'foo@bar.com',
      phone: '+33612345678',
      password: 'secret',
      token: 'eyJhbGciOiJ',
      authorization: 'Bearer abc',
      passport: 'AB12345',
      firstName: 'Wali',
      address: '12 rue de la Paix',
      // champs neutres : conservés
      hotelId: 'abc-def',
      count: 42,
    });
    expect(out).toMatchObject({
      email: '[REDACTED]',
      phone: '[REDACTED]',
      password: '[REDACTED]',
      token: '[REDACTED]',
      authorization: '[REDACTED]',
      passport: '[REDACTED]',
      firstName: '[REDACTED]',
      address: '[REDACTED]',
      hotelId: 'abc-def',
      count: 42,
    });
  });

  it('redacte les emails dans les strings brutes (defense en profondeur)', () => {
    const out = __test.redactPII({ note: 'Email du client: jean@dupont.fr suite à incident' });
    expect((out as Record<string, string>).note).toContain('[REDACTED_EMAIL]');
    expect((out as Record<string, string>).note).not.toContain('jean@dupont.fr');
  });

  it('redacte les numéros qui ressemblent à du téléphone (≥9 chiffres)', () => {
    const out = __test.redactPII({ note: 'Appeler le 06 12 34 56 78' });
    expect((out as Record<string, string>).note).toContain('[REDACTED_PHONE]');
  });

  it('ne casse pas sur null/undefined', () => {
    expect(__test.redactPII(null)).toBeNull();
    expect(__test.redactPII(undefined)).toBeUndefined();
  });

  it('traverse récursivement les arrays', () => {
    const out = __test.redactPII([{ email: 'a@b.c' }, { email: 'd@e.f' }]);
    expect((out as Array<Record<string, string>>)[0].email).toBe('[REDACTED]');
    expect((out as Array<Record<string, string>>)[1].email).toBe('[REDACTED]');
  });
});

describe('log/reportError', () => {
  beforeEach(() => {
    __test.ringBuffer.length = 0;
    clearSink();
  });

  it('append au ring buffer', () => {
    log('info', 'test message');
    expect(__test.ringBuffer).toHaveLength(1);
    expect(__test.ringBuffer[0].message).toBe('test message');
    expect(__test.ringBuffer[0].level).toBe('info');
  });

  it('reportError capture la stack', () => {
    const err = new Error('boom');
    reportError(err, { hotelId: 'h1' });
    const last = __test.ringBuffer[__test.ringBuffer.length - 1];
    expect(last.level).toBe('error');
    expect(last.message).toBe('boom');
    expect(last.context?.stack).toBeTruthy();
  });

  it('reportError redacte les PII du contexte', () => {
    reportError(new Error('boom'), { email: 'leak@me.com', hotelId: 'h1' });
    const last = __test.ringBuffer[__test.ringBuffer.length - 1];
    expect(last.context?.email).toBe('[REDACTED]');
    expect(last.context?.hotelId).toBe('h1');
  });

  it('un sink externe reçoit l’événement après redaction', () => {
    const received: unknown[] = [];
    installCustomSink((evt) => received.push(evt));
    reportError(new Error('boom'), { email: 'leak@me.com' });
    expect(received).toHaveLength(1);
    expect((received[0] as { context: Record<string, string> }).context.email).toBe('[REDACTED]');
  });

  it("un sink qui throw ne casse pas l'app", () => {
    installCustomSink(() => { throw new Error('sink crashed'); });
    // Doit ne pas lever
    expect(() => reportError(new Error('boom'))).not.toThrow();
  });

  it('le ring buffer plafonne à 100 events (anti-OOM)', () => {
    for (let i = 0; i < 150; i++) log('info', `msg ${i}`);
    expect(__test.ringBuffer.length).toBe(100);
    expect(__test.ringBuffer[0].message).toBe('msg 50');
  });
});
