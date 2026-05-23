/**
 * FLOWTYM RMS — Parser Excel des fichiers de référence événements.
 *
 * Supporte deux formats :
 *
 *   A. `DATES SALONS — MISE A JOUR …` (3 feuilles 2024 / 2025 / 2026 / 2027)
 *      • feuilles 2024/2025 : Nom | Début | Fin | (Pays) — pas de lieu
 *      • feuilles 2026/2027 : Mois | Événement | Début | Fin | Lieu |
 *                              Impact | Source (Lien/Preuve)
 *
 *   B. `salon 2026.xlsx` (une seule feuille « Feuil1 ») — même schéma que
 *      la feuille 2026 du fichier A.
 *
 * Le parser :
 *   • extrait les colonnes par détection des en-têtes ;
 *   • normalise les dates (string `MM/DD/YY`, ISO ou serial Excel) ;
 *   • normalise les lieux (mappage abrégé → zone canonique) ;
 *   • résout chaque ligne vers une source de la bibliothèque ;
 *   • calcule l'impact (coefficients + niveau) ;
 *   • applique la règle « jamais d'événements passés modifiés » au moment
 *     de l'upsert dans le store.
 */

import * as XLSX from 'xlsx';
import type { RMSMarketEvent } from '../types/events';
import {
  EVENT_SOURCE_LIBRARY,
  categoryForSource,
  impactFromBadge,
  normalizeVenue,
  resolveSourceId,
} from '../data/eventSourceLibrary';

export interface ParseReport {
  fileName: string;
  parsedAt: string;
  sheets: string[];
  rows: number;
  events: RMSMarketEvent[];
  warnings: string[];
}

// ─── Normalisation cellule date ───────────────────────────────────────────

function cellToIso(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    if (!p) return null;
    return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // formats M/D/YY ou MM/DD/YYYY
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      let year = parseInt(m[3], 10);
      if (year < 100) year = 2000 + year;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    // formats `14-Jan`, `1-Mar`, etc. (sheet 2027) — on ne tente pas, le
    // parser remontera un warning pour ces lignes.
    return null;
  }
  return null;
}

function impactCoefs(level: 'low' | 'medium' | 'high' | 'critical') {
  switch (level) {
    case 'critical': return { demand: 38, adr: 32, occupancy: 20, pickup: 30, revpar: 38, compression: 88, confidence: 95 };
    case 'high':     return { demand: 26, adr: 22, occupancy: 14, pickup: 22, revpar: 24, compression: 72, confidence: 90 };
    case 'medium':   return { demand: 14, adr: 11, occupancy: 8,  pickup: 12, revpar: 13, compression: 50, confidence: 86 };
    case 'low':      return { demand: 6,  adr: 4,  occupancy: 3,  pickup: 5,  revpar: 5,  compression: 22, confidence: 80 };
  }
}

// ─── Détection des indices de colonnes ────────────────────────────────────

interface ColumnLayout {
  name: number;
  start: number;
  end: number;
  venue?: number;
  impact?: number;
  source?: number;
}

function detectLayout(rows: unknown[][]): { layout: ColumnLayout | null; headerRow: number } {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i].map((c) => (typeof c === 'string' ? c.toLowerCase() : ''));
    const findIdx = (re: RegExp) => row.findIndex((c) => re.test(c));
    const nameIdx = findIdx(/^(événement|evenement|salon|nom)/i);
    const startIdx = findIdx(/^d[ée]but/i);
    const endIdx = findIdx(/^fin/i);
    if (nameIdx >= 0 && startIdx >= 0 && endIdx >= 0) {
      return {
        layout: {
          name: nameIdx,
          start: startIdx,
          end: endIdx,
          venue: findIdx(/^lieu/i) >= 0 ? findIdx(/^lieu/i) : undefined,
          impact: findIdx(/^impact/i) >= 0 ? findIdx(/^impact/i) : undefined,
          source: findIdx(/^source/i) >= 0 ? findIdx(/^source/i) : undefined,
        },
        headerRow: i,
      };
    }
  }
  return { layout: null, headerRow: -1 };
}

// ─── Parse une feuille ────────────────────────────────────────────────────

function parseSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
  fileName: string,
  warnings: string[],
): RMSMarketEvent[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' });
  const { layout, headerRow } = detectLayout(rows);
  if (!layout) {
    warnings.push(`Feuille « ${sheetName} » : en-têtes non détectés (ignorée).`);
    return [];
  }

  const events: RMSMarketEvent[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r[layout.name] ?? '').trim();
    if (!name) continue;
    const start = cellToIso(r[layout.start]);
    const end = cellToIso(r[layout.end] ?? r[layout.start]);
    if (!start || !end) {
      warnings.push(`« ${name} » (${sheetName}) : dates illisibles — ignoré.`);
      continue;
    }
    const venueRaw = layout.venue != null ? String(r[layout.venue] ?? '').trim() : '';
    const impactBadge = layout.impact != null ? String(r[layout.impact] ?? '').trim() : '';
    const sourceRaw = layout.source != null ? String(r[layout.source] ?? '').trim() : '';

    const sourceId = resolveSourceId(sourceRaw) ?? 'src_paris_je_taime';
    const source = EVENT_SOURCE_LIBRARY.find((s) => s.id === sourceId)!;
    const venue = venueRaw ? normalizeVenue(venueRaw) : { zone: '', venue: '' };
    const impact = impactFromBadge(impactBadge);
    const coefs = impactCoefs(impact.level);

    const id = `evt_paris_${start}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`.slice(0, 80);
    events.push({
      id,
      name,
      category: categoryForSource(sourceId, name),
      status: 'active',
      city: 'Paris',
      country: 'FR',
      zone: venue.zone || undefined,
      venue: venue.venue || undefined,
      startDate: start,
      endDate: end,
      impact: { ...coefs, level: impact.level },
      influencePrice: impact.price,
      sources: [sourceId],
      primarySource: source.name,
      rmsSynced: false,
      history: [
        { at: new Date().toISOString(), action: 'imported', source: `${fileName} → ${sheetName}` },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return events;
}

// ─── Entry point ──────────────────────────────────────────────────────────

export function parseEventExcel(buffer: ArrayBuffer, fileName: string): ParseReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const warnings: string[] = [];
  const events: RMSMarketEvent[] = [];
  for (const sh of wb.SheetNames) {
    const sheet = wb.Sheets[sh];
    events.push(...parseSheet(sheet, sh, fileName, warnings));
  }
  return {
    fileName,
    parsedAt: new Date().toISOString(),
    sheets: wb.SheetNames,
    rows: events.length,
    events,
    warnings,
  };
}
