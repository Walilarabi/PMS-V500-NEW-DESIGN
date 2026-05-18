/**
 * FLOWTYM — Salons/Events Excel Parser
 *
 * Parse le fichier "Dates Salons" et extrait :
 *   - nom de l'événement
 *   - date de début
 *   - date de fin
 *   - lieu (optionnel)
 *   - impact (optionnel)
 *
 * La feuille 2026 a une structure différente des feuilles 2024/2025 :
 *   2026 : col A=Mois, B=Événement, C=Début, D=Fin, E=Lieu, F=Impact
 *   2024 : col A=Nom, B=Début, C=Fin (mois implicite)
 *   2025 : col A=Nom, B=Début, C=Fin, D=Pays
 *
 * Le parser autodétecte le format en cherchant la ligne avec "Début"/"Fin"
 * dans les headers et identifie les colonnes en conséquence.
 */

import * as XLSX from 'xlsx';

export interface SalonEvent {
  name: string;
  startDate: string;    // ISO YYYY-MM-DD
  endDate: string;      // ISO YYYY-MM-DD
  location?: string;
  impact?: string;
  source?: string;
}

export interface SalonImport {
  fileName: string;
  importedAt: string;       // ISO
  events: SalonEvent[];
  sheetsProcessed: string[];
  warnings: string[];
}

function cellToDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (!parsed) return null;
    const m = String(parsed.m).padStart(2, '0');
    const d = String(parsed.d).padStart(2, '0');
    return `${parsed.y}-${m}-${d}`;
  }
  if (typeof v === 'string') {
    const s = v.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  return null;
}

/**
 * Détecte les indices de colonnes en cherchant les libellés
 * "Début" et "Fin" dans les 5 premières lignes.
 */
function detectColumnIndices(rows: unknown[][]): {
  nameCol: number;
  startCol: number;
  endCol: number;
  locationCol: number;
  impactCol: number;
  dataStart: number;
} | null {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i] ?? [];
    const lower = row.map(v => String(v ?? '').toLowerCase().trim());

    const startCol = lower.findIndex(v => v === 'début' || v === 'debut' || v === 'start');
    const endCol = lower.findIndex(v => v === 'fin' || v === 'end');

    if (startCol >= 0 && endCol >= 0) {
      // On considère que la colonne nom est généralement startCol - 1 (ou 0 si pas de "Mois")
      // Cherchons "Événement" / "Salon" / "Nom" en priorité
      let nameCol = lower.findIndex(v =>
        v === 'événement' || v === 'evenement' || v === 'salon' || v === 'nom' || v === 'name'
      );
      if (nameCol < 0) {
        // Fallback : la colonne juste avant "Début"
        nameCol = Math.max(0, startCol - 1);
      }

      const locationCol = lower.findIndex(v =>
        v === 'lieu' || v === 'location' || v === 'venue' || v === 'pays' || v === 'ville'
      );
      const impactCol = lower.findIndex(v =>
        v === 'impact' || v === 'priorité' || v === 'priority'
      );

      return {
        nameCol,
        startCol,
        endCol,
        locationCol: locationCol >= 0 ? locationCol : -1,
        impactCol: impactCol >= 0 ? impactCol : -1,
        dataStart: i + 1,
      };
    }
  }
  return null;
}

function parseSheet(ws: XLSX.WorkSheet, sheetName: string, warnings: string[]): SalonEvent[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const cols = detectColumnIndices(raw);
  if (!cols) {
    warnings.push(`Feuille "${sheetName}" : impossible de détecter les colonnes "Début"/"Fin" → ignorée`);
    return [];
  }

  const events: SalonEvent[] = [];

  for (let i = cols.dataStart; i < raw.length; i++) {
    const row = raw[i] ?? [];

    const name = String(row[cols.nameCol] ?? '').trim();
    const startDate = cellToDate(row[cols.startCol]);
    const endDate = cellToDate(row[cols.endCol]);

    if (!name || !startDate) continue;

    const event: SalonEvent = {
      name,
      startDate,
      endDate: endDate ?? startDate,
    };

    if (cols.locationCol >= 0 && row[cols.locationCol]) {
      const loc = String(row[cols.locationCol]).trim();
      if (loc) event.location = loc;
    }
    if (cols.impactCol >= 0 && row[cols.impactCol]) {
      const imp = String(row[cols.impactCol]).trim();
      // Nettoyer emojis "🟠 Moyen" → "Moyen"
      const cleaned = imp.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      if (cleaned) event.impact = cleaned;
    }

    events.push(event);
  }

  return events;
}

export async function parseSalonsExcel(file: File): Promise<SalonImport> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const events: SalonEvent[] = [];
  const sheetsProcessed: string[] = [];
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const parsed = parseSheet(ws, sheetName, warnings);
    if (parsed.length > 0) {
      events.push(...parsed);
      sheetsProcessed.push(sheetName);
    }
  }

  if (events.length === 0) {
    throw new Error(
      'Aucun événement extrait. Vérifiez que le fichier contient des feuilles avec "Début"/"Fin" en headers.'
    );
  }

  return {
    fileName: file.name,
    importedAt: new Date().toISOString(),
    events,
    sheetsProcessed,
    warnings,
  };
}

/**
 * Pour une date donnée, retourne les noms d'événements actifs ce jour-là.
 * Plusieurs événements peuvent se chevaucher.
 */
export function getEventsForDate(events: SalonEvent[], date: string): SalonEvent[] {
  return events.filter(e => date >= e.startDate && date <= e.endDate);
}
