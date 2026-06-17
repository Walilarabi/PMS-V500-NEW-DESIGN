/**
 * FLOWTYM — Observabilité minimale (frontend).
 *
 * Wrapper unique pour la télémétrie frontend :
 *   - reportError(err, context) : capture erreur runtime → console + Sentry (si configuré)
 *   - log(level, message, context) : log structuré JSON
 *
 * Le projet n'a PAS de Sentry/Datadog branché. Ce module pose les fondations
 * pour brancher en une seule ligne (`installSentry(DSN)`) le jour où on
 * achète une licence. En attendant, les erreurs sont au moins captées en
 * console et bufferisées pour debugging post-mortem (window.__flowtymErrors).
 *
 * Aucune PII (email, phone, body de message) ne doit être loggée. Voir
 * `redactPII()` ci-dessous.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogEvent {
  level: Level;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// Buffer en mémoire pour les 100 derniers events (utile pour debugging post-mortem).
const RING_BUFFER_SIZE = 100;
const ringBuffer: LogEvent[] = [];

declare global {
  interface Window {
    __flowtymErrors?: LogEvent[];
  }
}

if (typeof window !== 'undefined') {
  window.__flowtymErrors = ringBuffer;
}

// Sink optionnel branché par installSentry() / installCustomSink().
let externalSink: ((evt: LogEvent) => void) | null = null;

/**
 * Supprime les champs PII des objets de contexte avant log/transmission.
 * Le set est volontairement conservateur — préférer trop redact que trop leak.
 */
// IMPORTANT : toutes les clés DOIVENT être en lowercase. La comparaison se
// fait sur `k.toLowerCase()` pour matcher `firstName` ↔ `firstname`,
// `apiKey` ↔ `apikey`, etc.
const PII_KEYS = new Set([
  'email', 'phone', 'password', 'token', 'jwt', 'refreshtoken',
  'authorization', 'cookie', 'api_key', 'apikey', 'secret',
  'address', 'firstname', 'lastname', 'fullname',
  'passport', 'iban', 'cardnumber',
]);

function redactPII(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Redact emails et numéros qui ressemblent à du PII même si la key
    // n'est pas dans PII_KEYS.
    return value
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED_EMAIL]')
      .replace(/(\+?\d{1,3}[ -]?)?\(?\d{2,4}\)?[ -]?\d{2,4}[ -]?\d{2,4}[ -]?\d{2,4}/g, (m) =>
        m.length >= 9 ? '[REDACTED_PHONE]' : m,
      );
  }
  if (Array.isArray(value)) return value.map(redactPII);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as object)) {
      out[k] = PII_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactPII(v);
    }
    return out;
  }
  return value;
}

function emit(evt: LogEvent) {
  // 1. Ring buffer (debugging post-mortem)
  ringBuffer.push(evt);
  if (ringBuffer.length > RING_BUFFER_SIZE) ringBuffer.shift();

  // 2. Console (lecture humaine en dev / capture par Vercel logs en prod)
  const fn = evt.level === 'error' ? console.error
           : evt.level === 'warn'  ? console.warn
           : console.info;
  fn(`[${evt.level.toUpperCase()}] ${evt.message}`, evt.context ?? '');

  // 3. Sink externe (Sentry / Datadog / OTel) si branché
  try { externalSink?.(evt); } catch {/* swallow — observabilité ne doit jamais casser l'app */}
}

export function log(level: Level, message: string, context?: Record<string, unknown>) {
  emit({
    level, message,
    timestamp: new Date().toISOString(),
    context: context ? (redactPII(context) as Record<string, unknown>) : undefined,
  });
}

export function reportError(err: unknown, context?: Record<string, unknown>) {
  const msg = err instanceof Error ? err.message : String(err);
  emit({
    level: 'error',
    message: msg,
    timestamp: new Date().toISOString(),
    context: {
      ...(context ? (redactPII(context) as Record<string, unknown>) : {}),
      stack: err instanceof Error ? err.stack : undefined,
    },
  });
}

/**
 * Branche un sink externe (Sentry, OTel, Datadog). Idempotent — un seul sink
 * actif à la fois. Le payload reçu a déjà été PII-redacted.
 */
export function installCustomSink(sink: (evt: LogEvent) => void) {
  externalSink = sink;
}

/** Désactive le sink (utile en tests). */
export function clearSink() {
  externalSink = null;
}

/**
 * Type minimal d'un module Sentry. On le passe en argument à
 * `installSentry(Sentry)` plutôt que d'importer `@sentry/browser` ici, pour :
 *   1. Éviter d'ajouter une dépendance lourde tant qu'aucun DSN n'est défini
 *   2. Garder ce module testable sans mocker Vite import resolver
 */
export interface SentryLike {
  init(cfg: object): void;
  captureMessage(msg: string, opts?: object): void;
  captureException(err: Error, opts?: object): void;
}

/**
 * Branche un Sentry-like sink. Le DSN est lu depuis VITE_SENTRY_DSN. Si
 * absent → no-op silencieux. À appeler une fois au boot dans main.tsx :
 *
 *   if (import.meta.env.VITE_SENTRY_DSN) {
 *     const Sentry = await import('@sentry/browser');
 *     installSentry(Sentry, import.meta.env.VITE_SENTRY_DSN);
 *   }
 */
export function installSentry(Sentry: SentryLike, dsn: string): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    release: (import.meta.env as Record<string, string>).VITE_APP_VERSION ?? 'dev',
    environment: (import.meta.env as Record<string, string>).MODE ?? 'production',
    tracesSampleRate: 0.1,
    beforeSend(event: unknown) {
      // Defense en profondeur : re-redact côté Sentry au cas où.
      return redactPII(event);
    },
  });
  installCustomSink((evt) => {
    if (evt.level === 'error' && evt.context?.stack) {
      const e = new Error(evt.message);
      e.stack = String(evt.context.stack);
      Sentry.captureException(e, { extra: evt.context });
    } else {
      Sentry.captureMessage(evt.message, { level: evt.level, extra: evt.context });
    }
  });
  log('info', 'Sentry installé', {});
}

// Tests-only export
export const __test = { redactPII, ringBuffer };
