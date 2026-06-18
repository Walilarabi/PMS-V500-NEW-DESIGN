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
 *
 * ⚠️ Config volontairement RESTRICTIVE pour la conformité RGPD :
 *   - sendDefaultPii: false → pas d'IP, pas d'User-Agent
 *   - tracesSampleRate: 0 → pas de tracing (peut leak URLs avec query params)
 *   - autoSessionTracking: false → pas de session ID rattaché aux events
 *   - integrations filtrées → pas de Replay (capture DOM), pas de
 *     BrowserTracing, pas de console capture, pas de breadcrumbs fetch/xhr
 *     non filtrés
 *   - beforeSend + beforeBreadcrumb → double couche de redaction PII
 */
export function installSentry(Sentry: SentryLike, dsn: string): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    release: (import.meta.env as Record<string, string>).VITE_APP_VERSION ?? 'dev',
    environment: (import.meta.env as Record<string, string>).MODE ?? 'production',
    // Pas de traces (URLs/query params potentiellement sensibles)
    tracesSampleRate: 0,
    // Pas d'IP, pas d'User-Agent, pas de cookies envoyés par Sentry SDK
    sendDefaultPii: false,
    // Pas de session tracking (user ID + temps de session sont du PII)
    autoSessionTracking: false,
    // Filtrer les intégrations par défaut : retirer Replay (capture DOM),
    // BrowserTracing (URLs sensibles), CaptureConsole (console.log peut leak),
    // BrowserApiErrors (parsing fetch).
    integrations(defaultIntegrations: Array<{ name: string }>) {
      const BLOCKED = new Set([
        'Replay',           // capture DOM screenshots
        'BrowserTracing',   // URLs + perf metrics
        'BrowserProfiling', // CPU profile
        'CaptureConsole',   // console.* — risque PII
        'HttpClient',       // body de requêtes
      ]);
      return defaultIntegrations.filter((i) => !BLOCKED.has(i.name));
    },
    beforeSend(event: unknown) {
      // Defense en profondeur : re-redact côté Sentry côté envoi de l'event final.
      // Le redactPII parcourt récursivement (couvre user, extra, contexts,
      // tags, breadcrumbs résiduels).
      return redactPII(event);
    },
    beforeBreadcrumb(breadcrumb: Record<string, unknown>) {
      // Filtrer les breadcrumbs automatiques :
      const category = String(breadcrumb.category ?? '');
      // 1. Bloquer console (peut contenir PII via console.log(user))
      if (category === 'console') return null;
      // 2. Pour XHR/fetch : conserver méthode + URL nettoyée, retirer body
      if (category === 'xhr' || category === 'fetch') {
        const data = (breadcrumb.data ?? {}) as Record<string, unknown>;
        // Nettoyer l'URL des query params sensibles
        if (typeof data.url === 'string') {
          data.url = data.url.replace(
            /([?&])(access_token|refresh_token|token|jwt|password|apikey|api_key|secret)=[^&]*/gi,
            '$1$2=[REDACTED]',
          );
        }
        // Retirer body si présent (Sentry ne le capture pas par défaut mais
        // ceinture + bretelles)
        delete data.body;
        delete data.requestBody;
        delete data.responseBody;
        breadcrumb.data = data;
      }
      // 3. Pour UI events (clicks) : retirer le texte des inputs (peut être PII)
      if (category === 'ui.click' || category === 'ui.input') {
        const msg = String(breadcrumb.message ?? '');
        // Retirer les valeurs > 3 caractères (heuristique)
        breadcrumb.message = msg.replace(/value="[^"]{4,}"/g, 'value="[REDACTED]"');
      }
      return breadcrumb;
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
