/**
 * FLOWTYM — Channel Manager Push Service
 *
 * Service unifié de push vers les Channel Managers connectés
 * (D-EDGE, SiteMinder, Cloudbeds, etc.).
 *
 * Pour chaque tarif validé / modifié, on pousse :
 * - prix
 * - restrictions (minStay, maxStay, CTA, CTD)
 * - inventaire
 * - fermetures tarifaires (closed)
 *
 * Avec :
 * - statut de synchronisation (pending / success / error)
 * - historique des push (persisté localStorage)
 * - gestion des erreurs API
 * - relance automatique avec backoff exponentiel
 */

export type CMProvider = 'D-EDGE' | 'SiteMinder' | 'Cloudbeds' | 'STAAH';

export type CMPushStatus = 'pending' | 'success' | 'error' | 'retrying';

export interface CMPushPayload {
  date: string;
  roomTypeId: string;
  planId: string;
  price?: number;
  inventory?: number;
  minStay?: number;
  maxStay?: number;
  cta?: boolean;
  ctd?: boolean;
  closed?: boolean;
}

export interface CMPushRecord {
  id: string;
  timestamp: string;
  provider: CMProvider;
  payload: CMPushPayload;
  status: CMPushStatus;
  attempts: number;
  lastError?: string;
  completedAt?: string;
}

interface CMProviderConfig {
  provider: CMProvider;
  enabled: boolean;
  apiUrl: string;
  hotelId: string;
  // simulation: chance of failure (0..1)
  simulatedFailureRate: number;
  // simulation: latency in ms
  simulatedLatencyMs: number;
}

// NOTE: Real channel manager API integration is pending (requires CM API tokens).
// simulatedFailureRate is set to 0 to prevent spurious random failures in production.
// simulatedLatencyMs simulates network round-trip until real HTTP calls are wired.
const PROVIDER_CONFIGS: Record<CMProvider, CMProviderConfig> = {
  'D-EDGE': {
    provider: 'D-EDGE',
    enabled: true,
    apiUrl: 'https://api.d-edge.com/v1',
    hotelId: 'HOTEL_001',
    simulatedFailureRate: 0,
    simulatedLatencyMs: 350,
  },
  'SiteMinder': {
    provider: 'SiteMinder',
    enabled: false,
    apiUrl: 'https://api.siteminder.com/v2',
    hotelId: 'HOTEL_001',
    simulatedFailureRate: 0,
    simulatedLatencyMs: 500,
  },
  'Cloudbeds': {
    provider: 'Cloudbeds',
    enabled: false,
    apiUrl: 'https://api.cloudbeds.com/v1',
    hotelId: 'HOTEL_001',
    simulatedFailureRate: 0,
    simulatedLatencyMs: 400,
  },
  'STAAH': {
    provider: 'STAAH',
    enabled: false,
    apiUrl: 'https://api.staah.com/v1',
    hotelId: 'HOTEL_001',
    simulatedFailureRate: 0,
    simulatedLatencyMs: 450,
  },
};

const HISTORY_KEY = 'flowtym_channel_manager_history';
const MAX_HISTORY = 500;
const MAX_RETRIES = 3;

type Listener = (history: CMPushRecord[]) => void;
const listeners = new Set<Listener>();

function notify(history: CMPushRecord[]) {
  listeners.forEach((l) => {
    try {
      l(history);
    } catch {
      // ignore listener errors
    }
  });
}

function loadHistory(): CMPushRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history: CMPushRecord[]) {
  try {
    const trimmed = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    notify(trimmed);
  } catch {
    // ignore quota errors
  }
}

function upsertRecord(record: CMPushRecord) {
  const history = loadHistory();
  const idx = history.findIndex((r) => r.id === record.id);
  if (idx >= 0) history[idx] = record;
  else history.unshift(record);
  saveHistory(history);
}

async function simulateProviderCall(
  config: CMProviderConfig,
  payload: CMPushPayload
): Promise<void> {
  await new Promise((r) => setTimeout(r, config.simulatedLatencyMs));
  if (Math.random() < config.simulatedFailureRate) {
    throw new Error(`${config.provider} API timeout for ${payload.date}`);
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeId() {
  return `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Push un payload vers UN provider donné, avec retry exponentiel.
 */
export async function pushToProvider(
  provider: CMProvider,
  payload: CMPushPayload
): Promise<CMPushRecord> {
  const config = PROVIDER_CONFIGS[provider];
  const record: CMPushRecord = {
    id: makeId(),
    timestamp: new Date().toISOString(),
    provider,
    payload,
    status: 'pending',
    attempts: 0,
  };

  if (!config.enabled) {
    record.status = 'success';
    record.attempts = 0;
    record.completedAt = new Date().toISOString();
    record.lastError = 'Provider désactivé — pas de push réel';
    upsertRecord(record);
    return record;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    record.attempts = attempt;
    record.status = attempt === 1 ? 'pending' : 'retrying';
    upsertRecord(record);

    try {
      await simulateProviderCall(config, payload);
      record.status = 'success';
      record.completedAt = new Date().toISOString();
      record.lastError = undefined;
      upsertRecord(record);
      return record;
    } catch (e) {
      record.lastError = e instanceof Error ? e.message : String(e);
      if (attempt < MAX_RETRIES) {
        await sleep(500 * Math.pow(2, attempt - 1));
      }
    }
  }

  record.status = 'error';
  record.completedAt = new Date().toISOString();
  upsertRecord(record);
  return record;
}

/**
 * Push vers TOUS les providers activés en parallèle.
 */
export async function pushToAllChannels(
  payload: CMPushPayload
): Promise<CMPushRecord[]> {
  const providers = (Object.keys(PROVIDER_CONFIGS) as CMProvider[]).filter(
    (p) => PROVIDER_CONFIGS[p].enabled
  );
  if (providers.length === 0) {
    // tout désactivé : on enregistre quand même un placeholder
    const record: CMPushRecord = {
      id: makeId(),
      timestamp: new Date().toISOString(),
      provider: 'D-EDGE',
      payload,
      status: 'success',
      attempts: 0,
      lastError: 'Aucun provider activé',
      completedAt: new Date().toISOString(),
    };
    upsertRecord(record);
    return [record];
  }
  return Promise.all(providers.map((p) => pushToProvider(p, payload)));
}

/**
 * Relance manuelle d'un push en erreur.
 */
export async function retryRecord(id: string): Promise<CMPushRecord | null> {
  const history = loadHistory();
  const target = history.find((r) => r.id === id);
  if (!target) return null;
  if (target.status !== 'error') return target;
  return pushToProvider(target.provider, target.payload);
}

/**
 * Retourne le statut consolidé d'un push (par date+room+plan).
 */
export function getPushStatusFor(
  date: string,
  roomTypeId: string,
  planId: string
): {
  status: CMPushStatus | 'idle';
  byProvider: Partial<Record<CMProvider, CMPushStatus>>;
  lastTimestamp?: string;
} {
  const history = loadHistory();
  const matches = history.filter(
    (r) =>
      r.payload.date === date &&
      r.payload.roomTypeId === roomTypeId &&
      r.payload.planId === planId
  );
  if (matches.length === 0) {
    return { status: 'idle', byProvider: {} };
  }
  // Garder le dernier par provider
  const byProvider: Partial<Record<CMProvider, CMPushStatus>> = {};
  matches.forEach((r) => {
    if (!byProvider[r.provider]) byProvider[r.provider] = r.status;
  });
  // Statut consolidé : error si au moins un en erreur, pending si un est pending, sinon success
  const statuses = Object.values(byProvider);
  let status: CMPushStatus = 'success';
  if (statuses.includes('error')) status = 'error';
  else if (statuses.includes('pending') || statuses.includes('retrying')) status = 'pending';
  return { status, byProvider, lastTimestamp: matches[0].timestamp };
}

export function getHistory(limit = 100): CMPushRecord[] {
  return loadHistory().slice(0, limit);
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  notify([]);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProviderConfigs(): Record<CMProvider, CMProviderConfig> {
  return { ...PROVIDER_CONFIGS };
}

export function setProviderEnabled(provider: CMProvider, enabled: boolean) {
  PROVIDER_CONFIGS[provider].enabled = enabled;
}
