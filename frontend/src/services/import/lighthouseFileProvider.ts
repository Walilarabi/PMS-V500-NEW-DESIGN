/**
 * FLOWTYM — Provider Lighthouse (mode fichier Excel)
 *
 * Wrap le parser existant et le store Lighthouse pour respecter le contrat
 * `MarketDataProvider`. Aucune logique UI ici.
 */

import { parseLighthouseExcel, type LighthouseImport } from '../lighthouse-parser.service';
import { persistLighthouseImport } from '../lighthouse-persistence.service';
import { useLighthouseStore } from '../../store/lighthouseStore';
import type {
  ImportPreview,
  ImportResult,
  ImportSourceMeta,
  MarketDataProvider,
  ParseOutcome,
} from './types';
import { validateFileShape, countDuplicateKeys, countOutliers } from './importValidator';
import {
  appendAuditEntry,
  applyRollback,
  captureRollbackSnapshot,
} from './importAuditLogger';
import { buildLighthouseSamples, describeLighthouseImpact } from './importMapper';

const META: ImportSourceMeta = {
  id: 'lighthouse-file',
  label: 'Lighthouse',
  shortLabel: 'Lighthouse',
  description:
    'Import du fichier Excel Lighthouse (aperçu compset, tarifs, variations). API Lighthouse en préparation.',
  acceptedFormats: ['.xlsx', '.xls'],
  acceptedMime:
    '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
  status: 'file',
  icon: 'lighthouse',
  rmsTargets: [
    'Veille Concurrentielle',
    'Tableau RMS (médiane compset, ranking)',
    'Pression marché & demande',
    'Moteur de recommandations',
  ],
};

const STORE_KEY = 'flowtym_lighthouse_import';

export const lighthouseFileProvider: MarketDataProvider<LighthouseImport> = {
  meta: META,

  async parse(file, onProgress) {
    validateFileShape(file, META);
    onProgress?.(8);

    let parsed: LighthouseImport;
    try {
      parsed = await parseLighthouseExcel(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de parsing inconnue.';
      const preview: ImportPreview = {
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
      return { preview, payload: undefined as unknown as LighthouseImport };
    }

    onProgress?.(70);

    const dates = parsed.days.map((d) => d.date);
    const duplicates = countDuplicateKeys(dates);
    const outliers = countOutliers(parsed.days.map((d) => d.ourPrice));

    const validRows = parsed.days.length;
    const totalRows = validRows + duplicates;

    const preview: ImportPreview = {
      source: META.id,
      fileName: file.name,
      fileSize: file.size,
      totalRows,
      validRows,
      ignoredRows: duplicates,
      duplicates,
      inconsistencies: 0,
      outliers,
      warnings: parsed.warnings,
      errors: [],
      columns: [
        'Date',
        'Jour',
        'Notre prix',
        'Médiane compset',
        'Demande',
        'Ranking',
        'Concurrents (×' + parsed.competitorNames.length + ')',
      ],
      samples: buildLighthouseSamples(parsed),
      rmsImpact: describeLighthouseImpact(parsed),
    };

    onProgress?.(100);
    return { preview, payload: parsed };
  },

  async commit(payload, meta): Promise<ImportResult> {
    const rollbackToken = captureRollbackSnapshot({
      source: META.id,
      storeKey: STORE_KEY,
    });

    useLighthouseStore.getState().setImportData(payload);

    persistLighthouseImport(payload).then((persistResult) => {
      if (persistResult.errors.length > 0) {
        console.warn('[lighthouse] persistLighthouseImport errors:', persistResult.errors);
      } else {
        console.info(
          `[lighthouse] Persisted: importId=${persistResult.importId}, days=${persistResult.daysInserted}, archived=${persistResult.archivedCount}`,
        );
      }
    }).catch((err) => {
      console.error('[lighthouse] persistLighthouseImport threw:', err);
    });

    const result: Omit<ImportResult, 'id'> = {
      source: META.id,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      status: payload.warnings.length > 0 ? 'partial' : 'success',
      totalRows: payload.days.length,
      importedRows: payload.days.length,
      ignoredRows: 0,
      duplicates: 0,
      errors: [],
      warnings: payload.warnings,
      importedAt: new Date().toISOString(),
      rollbackToken,
      rmsImpact: describeLighthouseImpact(payload),
    };
    return appendAuditEntry(result);
  },

  async rollback(token) {
    applyRollback(token);
  },
};
