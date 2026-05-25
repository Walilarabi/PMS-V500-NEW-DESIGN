/**
 * FLOWTYM Events — Import Analyzer
 *
 * Analyse les événements parsés par event-excel-parser.service avant tout
 * import. Compare avec le store existant pour détecter :
 *   • doublons sémantiques (nom similaire + période proche)
 *   • mises à jour (même ID)
 *   • données incomplètes (nom/dates/ville manquants)
 *   • conflits (chevauchement avec événement haute priorité existant)
 *
 * Résultat : un rapport avec un statut + score de confiance par ligne,
 * exploitable directement dans la table de prévisualisation de la modale.
 */

import type { RMSMarketEvent, EventImpactLevel } from '../types/events';
import { IMPACT_LEVEL_ORDER } from '../types/events';
import type { ParseReport } from './event-excel-parser.service';

export type ImportStatus =
  | 'valid'       // nouveau, complet, pas de conflit
  | 'duplicate'   // très similaire à un événement existant
  | 'update'      // même ID → mise à jour
  | 'incomplete'  // champs obligatoires manquants
  | 'conflict'    // chevauche un événement haute priorité existant
  | 'invalid';    // dates incohérentes ou nom vide

export type AutoAction = 'import' | 'update' | 'skip' | 'review';

export interface AnalyzedEvent {
  event: RMSMarketEvent;
  status: ImportStatus;
  /** Confiance IA 0-100 dans l'analyse (haut = certain). */
  confidence: number;
  /** Événement existant le plus proche (pour doublons / conflits / mises à jour). */
  existingMatch?: RMSMarketEvent;
  issues: string[];
  autoAction: AutoAction;
  /** Sélectionné par défaut pour l'import. */
  selected: boolean;
}

export interface ImportAnalysisReport {
  fileName: string;
  analyzedAt: string;
  sheets: string[];
  totalRows: number;
  items: AnalyzedEvent[];
  warnings: string[];
  stats: Record<ImportStatus, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_'()'«»]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.88;
  const longer = na.length >= nb.length ? na : nb;
  const shorter = na.length < nb.length ? na : nb;
  if (longer.length === 0) return 1;
  const dist = levenshtein(longer, shorter);
  return (longer.length - dist) / longer.length;
}

function datesOverlap(a: RMSMarketEvent, b: RMSMarketEvent): boolean {
  return a.startDate <= b.endDate && a.endDate >= b.startDate;
}

function sameYear(a: RMSMarketEvent, b: RMSMarketEvent): boolean {
  return a.startDate.slice(0, 4) === b.startDate.slice(0, 4);
}

const HIGH_IMPACT: EventImpactLevel[] = ['high', 'critical', 'hyper_compression'];

// ─── Moteur d'analyse ─────────────────────────────────────────────────────────

export function analyzeImport(
  parsed: ParseReport,
  existingEvents: RMSMarketEvent[],
): ImportAnalysisReport {
  const today = new Date().toISOString().slice(0, 10);
  const stats: Record<ImportStatus, number> = {
    valid: 0,
    duplicate: 0,
    update: 0,
    incomplete: 0,
    conflict: 0,
    invalid: 0,
  };

  const items: AnalyzedEvent[] = parsed.events.map((ev): AnalyzedEvent => {
    const issues: string[] = [];

    // ── 1. Validité de base ───────────────────────────────────────────────
    if (!ev.name || ev.name.trim().length < 2) issues.push('Nom manquant ou trop court');
    if (!ev.startDate) issues.push('Date de début manquante');
    if (!ev.endDate) issues.push('Date de fin manquante');
    if (ev.startDate && ev.endDate && ev.startDate > ev.endDate) {
      issues.push('Date début postérieure à date fin');
    }

    const criticalMissing = issues.filter(
      (i) => i.includes('manquant') || i.includes('postérieure'),
    );
    if (criticalMissing.length >= 2) {
      stats.invalid++;
      return {
        event: ev,
        status: 'invalid',
        confidence: 10,
        issues,
        autoAction: 'skip',
        selected: false,
      };
    }

    if (!ev.city || !ev.venue) {
      issues.push('Lieu ou ville manquant(e)');
    }

    // ── 2. Mise à jour par ID exact ───────────────────────────────────────
    const exactIdMatch = existingEvents.find((e) => e.id === ev.id);
    if (exactIdMatch) {
      const isPast = exactIdMatch.endDate < today;
      if (isPast) issues.push('Événement passé — mise à jour bloquée par règle historique');
      stats.update++;
      return {
        event: ev,
        status: 'update',
        confidence: 99,
        existingMatch: exactIdMatch,
        issues,
        autoAction: isPast ? 'skip' : 'update',
        selected: !isPast,
      };
    }

    // ── 3. Détection de doublon sémantique ────────────────────────────────
    let bestMatch: RMSMarketEvent | undefined;
    let bestScore = 0;

    for (const existing of existingEvents) {
      const nameSim = nameSimilarity(ev.name, existing.name);
      const overlap = datesOverlap(ev, existing) ? 0.3 : 0;
      const yearBonus = sameYear(ev, existing) ? 0.1 : 0;
      const score = nameSim * 0.6 + overlap + yearBonus;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = existing;
      }
    }

    if (bestScore >= 0.82 && bestMatch) {
      const isPast = bestMatch.endDate < today;
      issues.push(
        isPast
          ? `Similaire à "${bestMatch.name}" (passé)`
          : `Similaire à "${bestMatch.name}" — vérifiez avant fusion`,
      );
      stats.duplicate++;
      return {
        event: ev,
        status: 'duplicate',
        confidence: Math.round(bestScore * 100),
        existingMatch: bestMatch,
        issues,
        autoAction: 'skip',
        selected: false,
      };
    }

    // ── 4. Détection de conflit (chevauchement haute priorité) ────────────
    const conflictingEvents = existingEvents.filter(
      (e) =>
        datesOverlap(ev, e) &&
        HIGH_IMPACT.includes(e.impact.level) &&
        e.id !== ev.id,
    );

    if (conflictingEvents.length > 0) {
      const names = conflictingEvents.map((e) => `"${e.name}"`).join(', ');
      issues.push(`Chevauchement avec événement fort : ${names}`);
      stats.conflict++;
      return {
        event: ev,
        status: 'conflict',
        confidence: 88,
        existingMatch: conflictingEvents[0],
        issues,
        autoAction: 'review',
        selected: true,
      };
    }

    // ── 5. Incomplet (manque lieu) ────────────────────────────────────────
    if (issues.length > 0) {
      stats.incomplete++;
      return {
        event: ev,
        status: 'incomplete',
        confidence: 60,
        issues,
        autoAction: 'review',
        selected: true,
      };
    }

    // ── 6. Valide ─────────────────────────────────────────────────────────
    stats.valid++;
    return {
      event: ev,
      status: 'valid',
      confidence: Math.max(75, ev.impact.confidence ?? 85),
      issues: [],
      autoAction: 'import',
      selected: true,
    };
  });

  return {
    fileName: parsed.fileName,
    analyzedAt: new Date().toISOString(),
    sheets: parsed.sheets,
    totalRows: parsed.rows,
    items,
    warnings: parsed.warnings,
    stats,
  };
}
