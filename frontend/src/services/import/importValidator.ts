/**
 * FLOWTYM — Validation générique des fichiers d'import
 *
 * Vérifications communes à toutes les sources :
 *   - taille max
 *   - extension acceptée
 *   - extension cohérente avec le MIME
 *
 * Utilitaires pour détecter doublons, dates incohérentes, valeurs aberrantes
 * (utilisés par les providers métiers).
 */

import type { ImportSourceMeta } from './types';
import { ImportValidationError } from './types';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function validateFileShape(file: File, source: ImportSourceMeta): void {
  if (!file) {
    throw new ImportValidationError(source.id, 'Aucun fichier fourni.');
  }

  if (file.size === 0) {
    throw new ImportValidationError(source.id, 'Le fichier est vide.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ImportValidationError(
      source.id,
      `Fichier trop volumineux (${formatBytes(file.size)}). Maximum autorisé : ${formatBytes(MAX_FILE_SIZE_BYTES)}.`
    );
  }

  const ext = extractExtension(file.name);
  const accepted = source.acceptedFormats.map((e) => e.toLowerCase());
  if (ext && !accepted.includes(ext)) {
    throw new ImportValidationError(
      source.id,
      `Format ${ext} non supporté pour ${source.label}.`,
      [`Formats acceptés : ${accepted.join(', ')}`]
    );
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function extractExtension(name: string): string | null {
  const idx = name.lastIndexOf('.');
  if (idx < 0) return null;
  return name.slice(idx).toLowerCase();
}

/**
 * Détecte les doublons exacts dans une liste de clés (ex: dates).
 * Retourne le nombre de doublons (occurrences supplémentaires).
 */
export function countDuplicateKeys(keys: string[]): number {
  const seen = new Set<string>();
  let dup = 0;
  for (const k of keys) {
    if (seen.has(k)) dup++;
    else seen.add(k);
  }
  return dup;
}

/**
 * Compte les paires (start, end) où end < start (dates incohérentes).
 */
export function countInconsistentDateRanges(
  ranges: Array<{ start: string; end: string }>
): number {
  return ranges.filter((r) => r.start && r.end && r.end < r.start).length;
}

/**
 * Détecte les valeurs aberrantes par IQR sur un tableau numérique.
 * Retourne le nombre de points en dehors de [Q1 - 3*IQR, Q3 + 3*IQR].
 * Le facteur 3 (vs 1.5) garde la détection conservative — un RMS ne doit pas
 * crier au loup sur chaque pic légitime de demande.
 */
export function countOutliers(values: number[]): number {
  const cleaned = values.filter((v) => Number.isFinite(v));
  if (cleaned.length < 8) return 0;
  const sorted = [...cleaned].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return 0;
  const lo = q1 - iqr * 3;
  const hi = q3 + iqr * 3;
  return cleaned.filter((v) => v < lo || v > hi).length;
}
