/**
 * FLOWTYM — Mapper d'import vers données RMS normalisées
 *
 * Convertit les données brutes des providers (Lighthouse / Expedia / Events)
 * en `SamplePreviewRow` pour l'aperçu UI, ainsi qu'en descriptions humaines
 * d'impact RMS.
 *
 * Aucune dépendance UI. Aucun appel au store ici.
 */

import type { LighthouseImport } from '../lighthouse-parser.service';
import type { ExpediaImport } from '../expedia-parser.service';
import type { SalonImport } from '../salons-parser.service';
import type { SamplePreviewRow } from './types';

const SAMPLE_LIMIT = 6;

export function buildLighthouseSamples(data: LighthouseImport): SamplePreviewRow[] {
  return data.days.slice(0, SAMPLE_LIMIT).map((d) => ({
    cells: {
      Date: d.date,
      Jour: d.dayName,
      'Notre prix': d.ourPrice ?? null,
      'Médiane compset': d.compsetMedian ?? null,
      Demande: `${Math.round(d.marketDemandPercent)}%`,
      Ranking: d.ranking,
      Événements: d.events || '—',
    },
  }));
}

export function buildExpediaSamples(data: ExpediaImport): SamplePreviewRow[] {
  return data.days.slice(0, SAMPLE_LIMIT).map((d) => ({
    cells: {
      Date: d.date,
      Jour: d.dayName,
      'Notre prix': d.ourPrice,
      'Moyenne compset': d.compsetAverage,
      'Pression marché (zone)': `${Math.round(d.marketPressureBroaderPercent)}%`,
      'Pression marché (quartier)': `${Math.round(d.marketPressureNeighborhoodPercent)}%`,
    },
  }));
}

export function buildEventsSamples(data: SalonImport): SamplePreviewRow[] {
  return data.events.slice(0, SAMPLE_LIMIT).map((e) => ({
    cells: {
      Événement: e.name,
      Début: e.startDate,
      Fin: e.endDate,
      Lieu: e.location ?? '—',
      Impact: e.impact ?? '—',
    },
  }));
}

export function describeLighthouseImpact(data: LighthouseImport): string[] {
  return [
    `${data.days.length} journées de tarifs compset alimenteront la Veille Concurrentielle.`,
    `Le tableau RMS récupèrera la médiane compset et la position ranking par jour.`,
    `Les recommandations tarifaires intègreront la pression marché et la demande Lighthouse.`,
    `Mode actuel : import fichier. Mode futur : API Lighthouse (provider prêt).`,
  ];
}

export function describeExpediaImpact(data: ExpediaImport): string[] {
  return [
    `${data.days.length} journées de pression marché Expedia seront synchronisées.`,
    `Les indicateurs de pression marché (zone + quartier) alimenteront le moteur Autopilote.`,
    `Les tarifs compset Expedia compléteront ceux de Lighthouse dans la Veille.`,
    `Recommandations RMS : intégration immédiate dans le scoring de stratégie.`,
  ];
}

export function describeEventsImpact(
  newEvents: number,
  updatedFuture: number,
  preservedPast: number
): string[] {
  return [
    `${newEvents} nouveaux événements ajoutés à la base RMS.`,
    `${updatedFuture} événements futurs déjà connus seront mis à jour.`,
    `${preservedPast} événements passés conservés intacts (historique préservé).`,
    `Impact RMS : événements injectés dans la colonne "Événement" du tableau et utilisés par le moteur de stratégie.`,
  ];
}

/**
 * Pour Expedia : conversion d'un volume de recherche brut en pourcentage
 * exploitable RMS, relatif au volume max observé sur la période importée.
 * La normalisation est faite côté parser, mais ce helper permet aux providers
 * de re-normaliser si on agrège plusieurs sources.
 */
export function normalizeToPercent(values: number[], target: number): number {
  if (!values.length || !Number.isFinite(target)) return 0;
  const max = Math.max(...values.filter((v) => Number.isFinite(v)));
  if (max <= 0) return 0;
  return Math.min(100, Math.round((target / max) * 100));
}
