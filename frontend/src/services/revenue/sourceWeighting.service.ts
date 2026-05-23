/**
 * FLOWTYM RMS — Pondération des sources de données marché
 *
 * Les tarifs collectés via Lighthouse / Expedia / autres OTAs sont
 * généralement non remboursables (NRF / NANR) ou plus agressifs
 * commercialement. Ils sous-évaluent donc systématiquement la valeur d'un
 * tarif flexible de référence.
 *
 * Ce service applique une pondération configurable avant que le moteur RMS
 * ne calcule ses recommandations.
 *
 * Granularité :
 *   - Source (lighthouse / expedia / mix / direct)
 *   - Canal (Booking, Direct, …)
 *   - Type de chambre (room_type_code)
 *   - Saison (low / mid / high / very_high)
 *   - Stratégie active (aggressive / balanced / defensive)
 *
 * Persistance : localStorage (peut être étendu à Supabase plus tard).
 * Défaut : +5% sur Lighthouse et Expedia, 0% sur direct/mix.
 */

export type WeightingSource = 'lighthouse' | 'expedia' | 'mix' | 'direct';
export type WeightingSeason = 'low' | 'mid' | 'high' | 'very_high';
export type WeightingStrategy = 'aggressive' | 'balanced' | 'defensive';

export interface WeightingRule {
  /** Identifiant unique (concat de scopes ou 'default'). */
  id: string;
  /** Pourcentage appliqué (+5 = +5%). */
  percent: number;
  /** Source ciblée — null = toutes. */
  source: WeightingSource | null;
  /** Canal ciblé — null = tous. */
  channel: string | null;
  /** Type de chambre ciblé — null = tous. */
  roomTypeCode: string | null;
  /** Saison ciblée — null = toutes. */
  season: WeightingSeason | null;
  /** Stratégie ciblée — null = toutes. */
  strategy: WeightingStrategy | null;
  /** Activer / désactiver cette règle sans la supprimer. */
  enabled: boolean;
}

export interface WeightingConfig {
  /** Activation globale de la pondération. */
  globalEnabled: boolean;
  /** Liste des règles, évaluées par ordre de spécificité (plus spécifique gagne). */
  rules: WeightingRule[];
  /** Activation par source — court-circuit rapide. */
  sourceEnabled: Record<WeightingSource, boolean>;
}

const STORAGE_KEY = 'flowtym.rms.weighting';

const DEFAULT_CONFIG: WeightingConfig = {
  globalEnabled: true,
  sourceEnabled: {
    lighthouse: true,
    expedia: true,
    mix: true,
    direct: false, // direct = pas de pondération (tarif fl déjà)
  },
  rules: [
    {
      id: 'default_lighthouse',
      percent: 5,
      source: 'lighthouse',
      channel: null,
      roomTypeCode: null,
      season: null,
      strategy: null,
      enabled: true,
    },
    {
      id: 'default_expedia',
      percent: 5,
      source: 'expedia',
      channel: null,
      roomTypeCode: null,
      season: null,
      strategy: null,
      enabled: true,
    },
  ],
};

function loadConfig(): WeightingConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

let config: WeightingConfig = loadConfig();
const listeners = new Set<(c: WeightingConfig) => void>();
let version = 0;

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {/* quota / disabled */}
}

function notify() {
  version++;
  listeners.forEach((l) => l(config));
}

export const sourceWeighting = {
  version(): number { return version; },
  config(): WeightingConfig { return config; },

  subscribe(listener: (c: WeightingConfig) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setGlobalEnabled(enabled: boolean) {
    config = { ...config, globalEnabled: enabled };
    persist();
    notify();
  },

  setSourceEnabled(source: WeightingSource, enabled: boolean) {
    config = {
      ...config,
      sourceEnabled: { ...config.sourceEnabled, [source]: enabled },
    };
    persist();
    notify();
  },

  upsertRule(rule: WeightingRule) {
    const rules = config.rules.filter((r) => r.id !== rule.id);
    config = { ...config, rules: [...rules, rule] };
    persist();
    notify();
  },

  removeRule(id: string) {
    config = { ...config, rules: config.rules.filter((r) => r.id !== id) };
    persist();
    notify();
  },

  resetDefaults() {
    config = { ...DEFAULT_CONFIG };
    persist();
    notify();
  },

  /**
   * Calcule la pondération applicable à un tarif marché brut.
   *
   * Stratégie de résolution :
   *   1. Si globalEnabled = false → 0%
   *   2. Si sourceEnabled[source] = false → 0%
   *   3. Sinon, parmi les règles `enabled = true` qui matchent le scope,
   *      retourne celle avec le plus de critères spécifiés (plus précise).
   *
   * Retourne `{ percent, ruleId, applied }`.
   */
  resolve(scope: {
    source: WeightingSource;
    channel?: string | null;
    roomTypeCode?: string | null;
    season?: WeightingSeason | null;
    strategy?: WeightingStrategy | null;
  }): { percent: number; ruleId: string | null; applied: boolean } {
    if (!config.globalEnabled) return { percent: 0, ruleId: null, applied: false };
    if (!config.sourceEnabled[scope.source]) return { percent: 0, ruleId: null, applied: false };

    const candidates = config.rules
      .filter((r) => r.enabled)
      .filter((r) => r.source === null || r.source === scope.source)
      .filter((r) => r.channel === null || r.channel === scope.channel)
      .filter((r) => r.roomTypeCode === null || r.roomTypeCode === scope.roomTypeCode)
      .filter((r) => r.season === null || r.season === scope.season)
      .filter((r) => r.strategy === null || r.strategy === scope.strategy);

    if (candidates.length === 0) return { percent: 0, ruleId: null, applied: false };

    // Spécificité : plus le nombre de critères non-null est élevé, plus la règle est précise.
    const specificity = (r: WeightingRule) =>
      [r.source, r.channel, r.roomTypeCode, r.season, r.strategy].filter((v) => v !== null).length;

    candidates.sort((a, b) => specificity(b) - specificity(a));
    const best = candidates[0];
    return { percent: best.percent, ruleId: best.id, applied: true };
  },

  /**
   * Applique la pondération sur un prix marché brut.
   */
  apply(rawPrice: number, scope: Parameters<typeof sourceWeighting.resolve>[0]): {
    weightedPrice: number;
    percent: number;
    delta: number;
    applied: boolean;
    ruleId: string | null;
  } {
    if (!isFinite(rawPrice) || rawPrice <= 0) {
      return { weightedPrice: rawPrice, percent: 0, delta: 0, applied: false, ruleId: null };
    }
    const { percent, ruleId, applied } = this.resolve(scope);
    const weightedPrice = Math.round(rawPrice * (1 + percent / 100));
    return { weightedPrice, percent, delta: weightedPrice - rawPrice, applied, ruleId };
  },
};

/**
 * Détermine la saison depuis une date ISO (heuristique simple pour le marché
 * hôtelier parisien — peut être étendu par config calendrier).
 */
export function seasonFromDate(dateISO: string): WeightingSeason {
  const month = Number(dateISO.slice(5, 7));
  if (month === 6 || month === 9) return 'very_high';        // Vivatech, Mode...
  if (month === 5 || month === 7 || month === 10) return 'high';
  if (month === 4 || month === 8 || month === 11) return 'mid';
  return 'low'; // jan, fév, mars, déc
}
