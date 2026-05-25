/**
 * FLOWTYM — Market Data Provider Registry
 *
 * Point d'entrée unique pour l'UI Veille Concurrentielle : on choisit un
 * `ImportSourceId`, on récupère le provider associé, on l'utilise via le
 * contrat `MarketDataProvider`. L'UI ne connaît ni XLSX, ni les stores
 * Zustand internes.
 *
 * NOTE : L'import des événements (salons, concerts, jours fériés) est
 * désormais centralisé dans le module Événements (page Revenue → Événements).
 * Le provider `events` a été retiré de ce registry pour éviter tout
 * doublon fonctionnel et toute logique parallèle entre les modules.
 * Voir : `frontend/src/pages/revenue/events/EventImportModal.tsx`
 */

import { lighthouseFileProvider } from './lighthouseFileProvider';
import { lighthouseApiProvider } from './lighthouseApiProvider';
import { expediaProvider } from './expediaProvider';
import type { ImportSourceId, ImportSourceMeta, MarketDataProvider } from './types';

const REGISTRY: Record<ImportSourceId, MarketDataProvider<any>> = {
  'lighthouse-file': lighthouseFileProvider,
  'lighthouse-api': lighthouseApiProvider,
  expedia: expediaProvider,
};

/**
 * Ordre d'affichage de référence dans le sélecteur de source Veille.
 * Note : `events` retiré — l'import événements vit dans le module Événements.
 */
export const DEFAULT_SOURCE_ORDER: ImportSourceId[] = [
  'lighthouse-file',
  'expedia',
  'lighthouse-api',
];

export function getProvider<T = unknown>(id: ImportSourceId): MarketDataProvider<T> {
  const p = REGISTRY[id] as MarketDataProvider<T> | undefined;
  if (!p) throw new Error(`Provider d'import inconnu : ${id}`);
  return p;
}

export function listImportSources(): ImportSourceMeta[] {
  return DEFAULT_SOURCE_ORDER.map((id) => REGISTRY[id].meta);
}

export type { MarketDataProvider, ImportSourceMeta, ImportSourceId };
export type { ImportPreview, ImportResult } from './types';
