/**
 * FLOWTYM — Provider Événements (salons, concerts, jours fériés, etc.)
 *
 * Règle métier critique : un import n'écrase JAMAIS l'historique.
 *   - les événements passés (endDate < aujourd'hui) sont conservés tels quels
 *   - les événements futurs (endDate ≥ aujourd'hui) sont mis à jour ou ajoutés
 *   - les nouveaux événements futurs sont insérés
 *
 * La clé de dédoublonnage est `name + startDate + endDate` (insensible casse,
 * tolérante aux espaces multiples). Les variations d'impact / lieu sont
 * considérées comme une mise à jour de l'événement existant.
 */

import {
  parseSalonsExcel,
  type SalonImport,
  type SalonEvent,
} from '../salons-parser.service';
import { useSalonsStore } from '../../store/salonsStore';
import type {
  ImportPreview,
  ImportResult,
  ImportSourceMeta,
  MarketDataProvider,
  ParseOutcome,
} from './types';
import { validateFileShape, countInconsistentDateRanges } from './importValidator';
import { appendAuditEntry, captureRollbackSnapshot, applyRollback } from './importAuditLogger';
import { buildEventsSamples, describeEventsImpact } from './importMapper';

const META: ImportSourceMeta = {
  id: 'events',
  label: 'Événements',
  shortLabel: 'Événements',
  description:
    'Import des salons / événements / jours fériés. Préserve l\'historique passé, met à jour le futur.',
  acceptedFormats: ['.xlsx', '.xls', '.csv'],
  acceptedMime:
    '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv',
  status: 'file',
  icon: 'events',
  rmsTargets: [
    'Tableau RMS — colonne Événement',
    'Stratégie automatique (pondération demande)',
    'Pression marché — pic événementiel',
    'Calendrier tarifaire (indirect via recommandations)',
  ],
};

const STORE_KEY = 'flowtym_salons_import';

interface EventsPayload {
  raw: SalonImport;
  /** Résultat de la fusion calculée pendant `parse`, conservé pour le commit. */
  merged: SalonEvent[];
  stats: {
    newEvents: number;
    updatedFuture: number;
    preservedPast: number;
  };
}

function eventKey(e: SalonEvent): string {
  return [
    e.name.toLowerCase().replace(/\s+/g, ' ').trim(),
    e.startDate,
    e.endDate,
  ].join('|');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fusionne les événements importés avec ceux déjà présents dans le store.
 * - passé existant : préservé
 * - futur existant (même clé) : remplacé par la version importée
 * - futur nouveau : ajouté
 *
 * Cette fonction est pure ; elle est testable indépendamment de l'UI.
 */
export function mergeEvents(
  existing: SalonEvent[],
  incoming: SalonEvent[]
): EventsPayload['stats'] & { merged: SalonEvent[] } {
  const cutoff = today();
  const pastExisting = existing.filter((e) => e.endDate < cutoff);
  const futureExisting = existing.filter((e) => e.endDate >= cutoff);

  const futureExistingByKey = new Map(futureExisting.map((e) => [eventKey(e), e]));

  let newEvents = 0;
  let updatedFuture = 0;

  const mergedFuture: SalonEvent[] = [];
  const seenKeys = new Set<string>();

  for (const ev of incoming) {
    const key = eventKey(ev);
    if (seenKeys.has(key)) continue; // dédupe intra-import
    seenKeys.add(key);

    if (futureExistingByKey.has(key)) {
      updatedFuture++;
      mergedFuture.push(ev);
      futureExistingByKey.delete(key);
    } else if (ev.endDate >= cutoff) {
      newEvents++;
      mergedFuture.push(ev);
    }
    // Les événements passés présents dans l'import sont ignorés
    // (la source de vérité reste le store existant pour le passé).
  }

  // On rajoute les événements futurs existants non touchés par l'import,
  // pour ne pas perdre les futurs déjà connus mais absents du nouveau fichier.
  for (const remaining of futureExistingByKey.values()) {
    mergedFuture.push(remaining);
  }

  const merged = [...pastExisting, ...mergedFuture].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  return {
    merged,
    newEvents,
    updatedFuture,
    preservedPast: pastExisting.length,
  };
}

export const eventsProvider: MarketDataProvider<EventsPayload> = {
  meta: META,

  async parse(file, onProgress): Promise<ParseOutcome<EventsPayload>> {
    validateFileShape(file, META);
    onProgress?.(8);

    let raw: SalonImport;
    try {
      raw = await parseSalonsExcel(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de parsing événements.';
      const emptyPreview: ImportPreview = {
        source: META.id,
        fileName: file.name,
        fileSize: file.size,
        totalRows: 0,
        validRows: 0,
        ignoredRows: 0,
        duplicates: 0,
        inconsistencies: 0,
        outliers: 0,
        warnings: [],
        errors: [message],
        columns: [],
        samples: [],
        rmsImpact: [],
      };
      return {
        preview: emptyPreview,
        payload: undefined as unknown as EventsPayload,
      };
    }

    onProgress?.(50);

    const existing =
      useSalonsStore.getState().importData?.events ?? [];

    const { merged, newEvents, updatedFuture, preservedPast } = mergeEvents(
      existing,
      raw.events
    );

    const inconsistencies = countInconsistentDateRanges(
      raw.events.map((e) => ({ start: e.startDate, end: e.endDate }))
    );

    const duplicates = raw.events.length - new Set(raw.events.map(eventKey)).size;

    const preview: ImportPreview = {
      source: META.id,
      fileName: file.name,
      fileSize: file.size,
      totalRows: raw.events.length,
      validRows: newEvents + updatedFuture,
      ignoredRows: raw.events.length - (newEvents + updatedFuture),
      duplicates,
      inconsistencies,
      outliers: 0,
      warnings: raw.warnings,
      errors: [],
      columns: ['Événement', 'Début', 'Fin', 'Lieu', 'Impact'],
      samples: buildEventsSamples(raw),
      rmsImpact: describeEventsImpact(newEvents, updatedFuture, preservedPast),
    };

    onProgress?.(100);

    return {
      preview,
      payload: {
        raw,
        merged,
        stats: { newEvents, updatedFuture, preservedPast },
      },
    };
  },

  async commit(payload, meta) {
    const rollbackToken = captureRollbackSnapshot({
      source: META.id,
      storeKey: STORE_KEY,
    });

    const mergedImport: SalonImport = {
      fileName: meta.fileName,
      importedAt: new Date().toISOString(),
      events: payload.merged,
      sheetsProcessed: payload.raw.sheetsProcessed,
      warnings: payload.raw.warnings,
    };
    useSalonsStore.getState().setImportData(mergedImport);

    const { newEvents, updatedFuture, preservedPast } = payload.stats;

    return appendAuditEntry({
      source: META.id,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      status:
        payload.raw.warnings.length > 0 ? 'partial' : 'success',
      totalRows: payload.raw.events.length,
      importedRows: newEvents + updatedFuture,
      ignoredRows:
        payload.raw.events.length - (newEvents + updatedFuture),
      duplicates: 0,
      errors: [],
      warnings: payload.raw.warnings,
      importedAt: new Date().toISOString(),
      rollbackToken,
      rmsImpact: describeEventsImpact(newEvents, updatedFuture, preservedPast),
    });
  },

  async rollback(token) {
    applyRollback(token);
  },
};
