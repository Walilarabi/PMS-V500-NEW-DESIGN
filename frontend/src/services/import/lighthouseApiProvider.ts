/**
 * FLOWTYM — Provider Lighthouse (mode API, FUTUR)
 *
 * Stub volontairement incomplet : l'API Lighthouse n'est pas encore active,
 * mais le contrat est en place et l'UI peut déjà afficher cette source comme
 * « API à venir ». La logique de credentials et de mapping est conçue ici pour
 * éviter une réécriture le jour où l'API arrive.
 *
 * Si l'API tombe (panne, quota), un fallback automatique sur le provider
 * fichier est prévu via `connectLighthouseApi()` qui retourne `null`.
 */

import type {
  ImportResult,
  ImportSourceMeta,
  MarketDataProvider,
  ParseOutcome,
} from './types';
import { ImportSourceUnavailableError } from './types';
import type { LighthouseImport } from '../lighthouse-parser.service';

const META: ImportSourceMeta = {
  id: 'lighthouse-api',
  label: 'Lighthouse API',
  shortLabel: 'API',
  description:
    'Synchronisation continue avec l\'API Lighthouse — disponible prochainement. La couche est déjà câblée.',
  acceptedFormats: [],
  acceptedMime: '',
  status: 'api-coming-soon',
  icon: 'lighthouse',
  rmsTargets: [
    'Synchronisation horaire automatique',
    'Pression marché temps réel',
    'Compset multi-zones',
  ],
};

// ─── Stockage credentials (préparé, non utilisé tant que l'API n'est pas active)

const CREDENTIALS_KEY = 'flowtym_lighthouse_api_credentials';

export interface LighthouseApiCredentials {
  apiKey: string;
  hotelId: string;
  region?: string;
}

export function saveLighthouseApiCredentials(creds: LighthouseApiCredentials): void {
  // NOTE : aucune information secrète n'est encore poussée sur localStorage tant
  // que l'API n'est pas activée — on accepte la signature, on logue, on ne
  // persiste pas. Quand l'API sera active, on protégera avec un wrapper crypto.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[lighthouseApiProvider] saveCredentials() called — API not active yet.');
  }
  void creds;
  // Placeholder délibéré : ne PAS écrire en clair dans localStorage.
  // À l'activation : passer par un wrapper crypto (WebCrypto subtle).
  void CREDENTIALS_KEY;
}

/**
 * Tente d'ouvrir une connexion API. Retourne null tant que l'API n'est pas
 * en production — l'UI doit alors basculer sur le mode fichier.
 */
export async function connectLighthouseApi(): Promise<null | {
  fetchSnapshot: () => Promise<LighthouseImport>;
}> {
  // Hook prêt — branchement effectif à venir.
  return null;
}

export const lighthouseApiProvider: MarketDataProvider<LighthouseImport> = {
  meta: META,

  async parse(): Promise<ParseOutcome<LighthouseImport>> {
    throw new ImportSourceUnavailableError(
      META.id,
      'L\'API Lighthouse n\'est pas encore active. Utilisez l\'import fichier en attendant.'
    );
  },

  async commit(): Promise<ImportResult> {
    throw new ImportSourceUnavailableError(
      META.id,
      'L\'API Lighthouse n\'est pas encore active.'
    );
  },
};
