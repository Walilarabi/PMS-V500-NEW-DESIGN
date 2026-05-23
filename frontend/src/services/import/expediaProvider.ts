/**
 * FLOWTYM — Provider Expedia (Revenue Management)
 *
 * Wrap le parser Expedia existant + store. Aucune logique UI.
 */

import { parseExpediaExcel, type ExpediaImport } from '../expedia-parser.service';
import { useExpediaStore } from '../../store/expediaStore';
import type {
  ImportPreview,
  ImportResult,
  ImportSourceMeta,
  MarketDataProvider,
} from './types';
import { validateFileShape, countDuplicateKeys, countOutliers } from './importValidator';
import { appendAuditEntry, captureRollbackSnapshot, applyRollback } from './importAuditLogger';
import { buildExpediaSamples, describeExpediaImpact } from './importMapper';

const META: ImportSourceMeta = {
  id: 'expedia',
  label: 'Expedia',
  shortLabel: 'Expedia',
  description:
    'Import du rapport Expedia "Revenue Management" (pression marché zone + quartier, compset, recherches).',
  acceptedFormats: ['.xlsx', '.xls'],
  acceptedMime:
    '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
  status: 'file',
  icon: 'expedia',
  rmsTargets: [
    'Pression marché zone + quartier',
    'Compset Expedia (complément Lighthouse)',
    'Volumes de recherche & visibilité',
    'Stratégie automatique RMS',
  ],
};

const STORE_KEY = 'flowtym_expedia_import';

export const expediaProvider: MarketDataProvider<ExpediaImport> = {
  meta: META,

  async parse(file, onProgress) {
    validateFileShape(file, META);
    onProgress?.(8);

    let parsed: ExpediaImport;
    try {
      parsed = await parseExpediaExcel(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de parsing Expedia.';
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
      return { preview: emptyPreview, payload: undefined as unknown as ExpediaImport };
    }

    onProgress?.(70);

    const dates = parsed.days.map((d) => d.date);
    const duplicates = countDuplicateKeys(dates);
    const outliers = countOutliers(
      parsed.days.map((d) => d.ourPrice ?? 0).filter((v) => v > 0)
    );

    const preview: ImportPreview = {
      source: META.id,
      fileName: file.name,
      fileSize: file.size,
      totalRows: parsed.days.length + duplicates,
      validRows: parsed.days.length,
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
        'Compset moyen',
        'Pression marché (zone)',
        'Pression marché (quartier)',
      ],
      samples: buildExpediaSamples(parsed),
      rmsImpact: describeExpediaImpact(parsed),
    };

    onProgress?.(100);
    return { preview, payload: parsed };
  },

  async commit(payload, meta) {
    const rollbackToken = captureRollbackSnapshot({
      source: META.id,
      storeKey: STORE_KEY,
    });

    useExpediaStore.getState().setImportData(payload);

    return appendAuditEntry({
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
      rmsImpact: describeExpediaImpact(payload),
    });
  },

  async rollback(token) {
    applyRollback(token);
  },
};
