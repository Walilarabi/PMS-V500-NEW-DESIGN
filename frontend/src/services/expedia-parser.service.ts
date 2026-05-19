/**
 * FLOWTYM — Expedia Revenue Management Excel Parser
 *
 * Parse le fichier "Expedia - Revenue Management" exporté depuis
 * Expedia Partner Central et extrait :
 *   - prix de notre hôtel par date
 *   - moyenne du compset
 *   - prix de 13 concurrents nommés
 *   - volume de recherches "Paris (and vicinity)"
 *   - volume de recherches voisinage (ex: "8th Arrondissement")
 *   - normalisation pression marché (% relatif)
 *
 * STRUCTURE FICHIER ATTENDUE :
 *   Ligne 1 : date d'export (ex: "2026-05-19 15:16")
 *   Ligne 2 : marché (ex: "France - Expedia.fr (EUR) | 1 night | 2 adults")
 *   Ligne 3 : verdict global (ex: "Your competitors' rates are lower than yours")
 *   Ligne 5 : mois (sparse, 1 cellule par changement de mois)
 *   Ligne 6 : jour de la semaine ("Tue", "Wed", ...)
 *   Ligne 7 : numéro du jour (1-31)
 *   Ligne 8 : "Your Property" + prix par date
 *   Ligne 9 : "Competitive set average" + valeurs
 *   Ligne 10-22 : 13 concurrents (variable selon export)
 *   Ligne 24 : "Paris (and vicinity), France" + volumes
 *   Ligne 26 : voisinage spécifique + volumes
 *
 * VALEURS SPÉCIALES :
 *   - Nombre  → prix disponible
 *   - "Sold out"          → status: 'sold_out'
 *   - "Min. N nights"     → status: 'restricted'
 *
 * Ce parser est ISOLÉ : il n'est appelé nulle part dans l'app.
 * L'intégration UI/store viendra dans des commits ultérieurs séparés.
 */

import * as XLSX from 'xlsx';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ExpediaPriceStatus = 'available' | 'restricted' | 'sold_out';

export interface ExpediaCompetitor {
  hotelName: string;
  price: number | null;
  status: ExpediaPriceStatus;
  restriction?: string;     // ex: "Min. 2 nights"
  rawValue: string;         // valeur brute pour debug
}

export interface ExpediaDayData {
  date: string;             // ISO YYYY-MM-DD
  dayName: string;          // "Tue", "Wed", ...

  // Notre hôtel
  ourPrice: number | null;
  ourPriceStatus: ExpediaPriceStatus;
  ourPriceRestriction?: string;

  // Compset
  compsetAverage: number | null;
  competitors: ExpediaCompetitor[];

  // Pression marché — bruts (volumes de recherche)
  searchVolumeBroader: number | null;       // ex: Paris (and vicinity)
  searchVolumeNeighborhood: number | null;  // ex: 8th Arrondissement

  // Pression marché — normalisée (% relatif, calculé après parsing)
  marketPressureBroaderPercent: number;
  marketPressureNeighborhoodPercent: number;
}

export interface ExpediaImport {
  fileName: string;
  importedAt: string;       // ISO timestamp du moment de l'import dans Flowtym
  exportedAt: string;       // depuis ligne 1 du fichier
  market: string;           // depuis ligne 2
  globalVerdict: string;    // depuis ligne 3
  ourHotelName: string;     // "Your Property" (label fixe Expedia)
  competitorNames: string[];
  broaderZoneName: string;  // "Paris (and vicinity), France"
  neighborhoodName: string; // "8th Arrondissement - L'Europe"
  days: ExpediaDayData[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const MONTH_MAP: Record<string, number> = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

/**
 * Parse une cellule de prix Expedia.
 * Renvoie un statut + prix + restriction éventuelle.
 */
function parsePriceCell(raw: unknown): {
  price: number | null;
  status: ExpediaPriceStatus;
  restriction?: string;
  rawValue: string;
} {
  if (raw == null) {
    return { price: null, status: 'sold_out', rawValue: '' };
  }

  if (typeof raw === 'number') {
    return { price: raw, status: 'available', rawValue: String(raw) };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    if (lower.includes('sold out')) {
      return { price: null, status: 'sold_out', rawValue: trimmed };
    }

    if (lower.includes('min.') && lower.includes('night')) {
      return {
        price: null,
        status: 'restricted',
        restriction: trimmed,
        rawValue: trimmed,
      };
    }

    // Tentative de parsing d'un nombre dans la chaîne
    const num = parseFloat(trimmed.replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (!isNaN(num)) {
      return { price: num, status: 'available', rawValue: trimmed };
    }
  }

  return { price: null, status: 'sold_out', rawValue: String(raw) };
}

/**
 * Parse une cellule de volume de recherche.
 * Renvoie un entier ou null.
 */
function parseSearchVolume(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Math.round(raw);
  if (typeof raw === 'string') {
    const num = parseInt(raw.replace(/[^\d]/g, ''), 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Reconstitue les dates ISO depuis les lignes 5 (mois sparse) + 7 (jour).
 * Renvoie un tableau aligné sur les colonnes de données.
 */
function buildDateMap(
  rows: unknown[][],
  warnings: string[],
): Map<number, { date: string; dayName: string }> {
  const result = new Map<number, { date: string; dayName: string }>();

  // Ligne 5 = mois sparse, ligne 6 = jour semaine, ligne 7 = numéro jour
  const monthRow = rows[4] ?? [];
  const dayNameRow = rows[5] ?? [];
  const dayNumRow = rows[6] ?? [];

  let currentYear = new Date().getFullYear();
  let currentMonth = 1;
  let monthDetected = false;

  // Parcours horizontal des colonnes (col 1 = label, col 2+ = données)
  const maxCol = Math.max(monthRow.length, dayNameRow.length, dayNumRow.length);

  for (let col = 1; col < maxCol; col++) {
    // Si nouvelle valeur dans ligne mois, on met à jour le contexte
    const monthCell = monthRow[col];
    if (monthCell != null && typeof monthCell === 'string') {
      const match = monthCell.trim().toUpperCase().match(/^([A-Z]+)\s+(\d{4})$/);
      if (match) {
        const monthName = match[1];
        const year = parseInt(match[2], 10);
        if (MONTH_MAP[monthName] && !isNaN(year)) {
          currentMonth = MONTH_MAP[monthName];
          currentYear = year;
          monthDetected = true;
        }
      }
    }

    if (!monthDetected) continue;

    const dayNum = dayNumRow[col];
    const dayName = dayNameRow[col];

    if (typeof dayNum === 'number' && dayNum >= 1 && dayNum <= 31) {
      const isoDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      result.set(col, {
        date: isoDate,
        dayName: typeof dayName === 'string' ? dayName.trim() : '',
      });
    }
  }

  if (result.size === 0) {
    warnings.push('Aucune date détectée : vérifiez le format des lignes 5-7 du fichier Expedia.');
  }

  return result;
}

/**
 * Normalise la pression marché en pourcentage relatif au maximum sur la période.
 * Mutation in-place pour simplicité.
 */
function normalizeMarketPressure(days: ExpediaDayData[]): void {
  const broaderValues = days.map(d => d.searchVolumeBroader ?? 0);
  const neighborhoodValues = days.map(d => d.searchVolumeNeighborhood ?? 0);

  const maxBroader = Math.max(...broaderValues, 0);
  const maxNeighborhood = Math.max(...neighborhoodValues, 0);

  days.forEach(day => {
    day.marketPressureBroaderPercent = maxBroader > 0
      ? Math.round(((day.searchVolumeBroader ?? 0) / maxBroader) * 100)
      : 0;

    day.marketPressureNeighborhoodPercent = maxNeighborhood > 0
      ? Math.round(((day.searchVolumeNeighborhood ?? 0) / maxNeighborhood) * 100)
      : 0;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export async function parseExpediaExcel(file: File): Promise<ExpediaImport> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

  // Le fichier Expedia n'a qu'une feuille typiquement
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('Fichier Expedia vide : aucune feuille trouvée.');
  }
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  if (rows.length < 26) {
    throw new Error(
      `Fichier Expedia incomplet : ${rows.length} lignes trouvées, attendu au moins 26. ` +
      `Vérifiez que c'est bien un export "Revenue Management" récent.`
    );
  }

  const warnings: string[] = [];

  // ─── Métadonnées (lignes 1-3) ─────────────────────────────────────────
  const exportedAt = String(rows[0]?.[0] ?? '').trim();
  const market = String(rows[1]?.[0] ?? '').trim();
  const globalVerdict = String(rows[2]?.[0] ?? '').trim();

  if (!exportedAt) warnings.push('Date d\'export Expedia manquante (ligne 1).');
  if (!market) warnings.push('Marché de référence Expedia manquant (ligne 2).');

  // ─── Reconstitution des dates ─────────────────────────────────────────
  const dateMap = buildDateMap(rows, warnings);
  if (dateMap.size === 0) {
    throw new Error('Aucune date exploitable trouvée dans le fichier Expedia.');
  }

  // ─── Identification des lignes de données ─────────────────────────────
  // Ligne 8 = "Your Property" (notre hôtel)
  // Ligne 9 = "Competitive set average"
  // Lignes 10+ = concurrents jusqu'à une ligne vide
  // Puis lignes de pression marché
  const ourHotelName = String(rows[7]?.[0] ?? 'Your Property').trim();
  const compsetLabel = String(rows[8]?.[0] ?? '').trim();

  if (!compsetLabel.toLowerCase().includes('competitive')) {
    warnings.push(`Ligne 9 attendue "Competitive set average", trouvé "${compsetLabel}".`);
  }

  // Identifier la plage des concurrents (ligne 10 jusqu'à première ligne vide)
  const competitorRowIndices: number[] = [];
  for (let i = 9; i < rows.length; i++) {
    const label = rows[i]?.[0];
    if (label == null || String(label).trim() === '') break;
    competitorRowIndices.push(i);
  }

  const competitorNames = competitorRowIndices.map(i =>
    String(rows[i]?.[0] ?? '').trim()
  );

  // Identifier les lignes de pression marché (après les concurrents)
  // Typiquement : "Paris (and vicinity)..." et "8th Arrondissement..."
  let broaderRow = -1;
  let broaderName = '';
  let neighborhoodRow = -1;
  let neighborhoodName = '';

  for (let i = competitorRowIndices[competitorRowIndices.length - 1] + 1; i < rows.length; i++) {
    const label = rows[i]?.[0];
    if (label == null) continue;
    const labelStr = String(label).trim();
    if (!labelStr) continue;

    if (broaderRow === -1) {
      broaderRow = i;
      broaderName = labelStr;
    } else if (neighborhoodRow === -1) {
      neighborhoodRow = i;
      neighborhoodName = labelStr;
      break;
    }
  }

  if (broaderRow === -1) {
    warnings.push('Ligne "Paris (and vicinity)" introuvable : pression marché élargie indisponible.');
  }
  if (neighborhoodRow === -1) {
    warnings.push('Ligne voisinage introuvable : pression marché locale indisponible.');
  }

  // ─── Construction des données jour par jour ───────────────────────────
  const days: ExpediaDayData[] = [];

  for (const [col, { date, dayName }] of dateMap.entries()) {
    // Notre hôtel (ligne 8)
    const ourCell = parsePriceCell(rows[7]?.[col]);

    // Compset average (ligne 9)
    const compsetCell = parsePriceCell(rows[8]?.[col]);

    // Concurrents
    const competitors: ExpediaCompetitor[] = competitorRowIndices.map((rowIdx, i) => {
      const cell = parsePriceCell(rows[rowIdx]?.[col]);
      return {
        hotelName: competitorNames[i],
        price: cell.price,
        status: cell.status,
        restriction: cell.restriction,
        rawValue: cell.rawValue,
      };
    });

    // Volumes de recherche
    const searchVolumeBroader = broaderRow >= 0
      ? parseSearchVolume(rows[broaderRow]?.[col])
      : null;
    const searchVolumeNeighborhood = neighborhoodRow >= 0
      ? parseSearchVolume(rows[neighborhoodRow]?.[col])
      : null;

    days.push({
      date,
      dayName,
      ourPrice: ourCell.price,
      ourPriceStatus: ourCell.status,
      ourPriceRestriction: ourCell.restriction,
      compsetAverage: compsetCell.price,
      competitors,
      searchVolumeBroader,
      searchVolumeNeighborhood,
      // Initialisé à 0, sera normalisé juste après
      marketPressureBroaderPercent: 0,
      marketPressureNeighborhoodPercent: 0,
    });
  }

  // ─── Normalisation pression marché (mutation in-place) ────────────────
  normalizeMarketPressure(days);

  // Tri par date croissante (sécurité)
  days.sort((a, b) => a.date.localeCompare(b.date));

  return {
    fileName: file.name,
    importedAt: new Date().toISOString(),
    exportedAt,
    market,
    globalVerdict,
    ourHotelName,
    competitorNames,
    broaderZoneName: broaderName,
    neighborhoodName,
    days,
    warnings,
  };
}

/**
 * Helper : récupère les données Expedia pour une date donnée.
 * Pratique pour brancher au RMS plus tard.
 */
export function getExpediaDataForDate(
  importData: ExpediaImport,
  date: string,
): ExpediaDayData | null {
  return importData.days.find(d => d.date === date) ?? null;
}
