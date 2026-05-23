/**
 * FLOWTYM RMS — Event Bus typé
 *
 * Bus léger pour la communication cross-module à l'intérieur du Revenue.
 * Implémenté au-dessus de `window` (EventTarget natif) pour éviter une
 * dépendance externe et permettre l'écoute depuis n'importe quel composant
 * sans hoisting d'un contexte React.
 *
 * Convention : un événement RMS porte toujours un payload typé. Les chaînes
 * d'événements sont déclarées dans `RmsEventMap` ci-dessous pour garder le
 * système strictement typé côté émetteurs et abonnés.
 *
 * Cas d'usage :
 *   - une promo s'active → AlertsPage recalcule
 *   - une recommandation est acceptée → DecisionHistory affiche
 *   - un fichier Lighthouse est importé → Veille met à jour
 */

import { useEffect, useState } from 'react';

/* ────────────────────────────────────────────────────────────────────────── */
/* TYPES D'ÉVÉNEMENTS                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RmsEventMap {
  /** Statut d'une promotion changé (active ↔ paused/scheduled/draft). */
  'promotion:status-changed': {
    promotionId: string;
    nextStatus: string;
    previousStatus: string;
  };
  /** Promotion créée. */
  'promotion:created': { promotionId: string; name: string };
  /** Promotion mise à jour (édition). */
  'promotion:updated': { promotionId: string };
  /** Promotion supprimée. */
  'promotion:deleted': { promotionId: string };
  /** Promotion dupliquée. */
  'promotion:duplicated': { sourceId: string; newId: string };

  /** Import de données marché terminé. */
  'market-data:imported': {
    source: 'lighthouse' | 'expedia' | 'events';
    rows: number;
  };

  /** Décision RMS acceptée (recommandation appliquée). */
  'rms-decision:accepted': {
    decisionId: string;
    date: string;
    delta: number;
  };
  /** Décision RMS rejetée. */
  'rms-decision:rejected': { decisionId: string };

  /** Une alerte a été acquittée / résolue / rejetée / rouverte. */
  'alert:action': {
    alertId: string;
    action: 'acknowledged' | 'resolved' | 'dismissed' | 'reopened';
  };

  /** Une stratégie tarifaire a été activée. */
  'strategy:activated': { strategyId: string };
}

export type RmsEventType = keyof RmsEventMap;

/* ────────────────────────────────────────────────────────────────────────── */
/* PRIMITIVES                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

const TARGET: EventTarget =
  typeof window !== 'undefined' ? window : new EventTarget();

const EVENT_NAMESPACE = 'rms:';

function fullEventName(type: RmsEventType): string {
  return `${EVENT_NAMESPACE}${type}`;
}

/**
 * Émet un événement RMS typé. Les abonnés synchrones sont notifiés
 * immédiatement ; les abonnés via hook réagissent au prochain effet React.
 */
export function emitRmsEvent<T extends RmsEventType>(
  type: T,
  detail: RmsEventMap[T]
): void {
  TARGET.dispatchEvent(new CustomEvent(fullEventName(type), { detail }));
}

/**
 * S'abonne à un événement RMS. Retourne une fonction de désabonnement.
 * Préférer le hook `useRmsEventListener` côté React.
 */
export function subscribeRmsEvent<T extends RmsEventType>(
  type: T,
  handler: (detail: RmsEventMap[T]) => void
): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<RmsEventMap[T]>).detail);
  };
  TARGET.addEventListener(fullEventName(type), listener);
  return () => TARGET.removeEventListener(fullEventName(type), listener);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HOOK REACT                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Hook React : écoute un événement RMS avec gestion du cycle de vie.
 * Le handler est ré-attaché si sa référence change — pensez à le mémoriser
 * avec `useCallback` si nécessaire pour éviter des cycles inutiles.
 */
export function useRmsEventListener<T extends RmsEventType>(
  type: T,
  handler: (detail: RmsEventMap[T]) => void
): void {
  useEffect(() => {
    return subscribeRmsEvent(type, handler);
  }, [type, handler]);
}

/**
 * Hook utilitaire : déclenche un re-render quand l'un des événements écoutés
 * survient. Idéal pour invalider un calcul `useMemo` dépendant d'un store
 * externe non observé via `useSyncExternalStore`.
 */
export function useRmsEventTick(types: RmsEventType[]): number {
  const [tick, setTick] = useState(0);
  // Joindre la liste en chaîne stable pour les deps — l'ordre est conservé.
  const key = types.join('|');
  useEffect(() => {
    const unsubs = types.map((t) =>
      subscribeRmsEvent(t, () => setTick((n) => n + 1))
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return tick;
}
