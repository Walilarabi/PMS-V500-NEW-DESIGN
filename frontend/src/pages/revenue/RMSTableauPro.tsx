/**
 * FLOWTYM — Lighthouse Excel Parser
 *
 * Lit le fichier Excel Lighthouse complet (5 feuilles) et produit un modèle
 * de données normalisé pour alimenter RMS, Veille, Calendrier, Modal détail.
 *
 * Structure du fichier source (fournie par Lighthouse) :
 *   Feuille "Aperçu"    : Jour, Date, Notre prix, Médiane compset, Ranking, Demande, Booking rank, Fériés, Events
 *   Feuille "Tarifs"    : Jour, Date, Demande, Notre hôtel, ...10 concurrents
 *   Feuille "vs. Hier"  : Variation J-1
 *   Feuille "vs. 3 jours" : Variation J-3
 *   Feuille "vs. 7 jours" : Variation J-7
 *
 * Valeurs spéciales dans la colonne tarif : "Épuisé", "1 pax seulement", "LOS2", null
 *   → traitées comme "non disponible" (exclues du MIN/MAX et du compset_median calculé)
 *
 * SÉCURITÉ TARIFAIRE : le parseur refuse strictement d'interpréter un code métier
 * (LOS, MLOS, CTA, CTD, MIN, MAX, etc.) comme un tarif, pour prévenir toute
 * corruption tarifaire critique en cas de cellule mal formatée.
 */

import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CompetitorRate {
  hotelName: string;
  price: number | null;       // null si "Épuisé" ou indisponible
  status: 'available' | 'sold_out' | 'restricted' | 'unknown';
  rawValue: string;           // valeur brute pour debug ("Épuisé", "230", etc.)
}

export interface LighthouseDayData {
  date: string;               // ISO YYYY-MM-DD
  dayName: string;            // "Lun", "Mar", ...

  // Depuis Aperçu
  ourPrice: number;
  compsetMedian: number;
  marketDemand: number;       // 0..1
  marketDemandPercent: number;// 0..100
  ranking: string;            // "7 sur 9"
  rankPosition: number | null;// 7
  rankTotal: number | null;   // 9
  bookingRank: string;
  holidays: string;
  events: string;

  // Depuis Tarifs (calculé)
  competitors: CompetitorRate[];
  compsetMin: number | null;
  compsetMax: number | null;

  // Variations (si feuilles vs. présentes)
  varVsYesterday?: number | null;
  varVs3Days?: number | null;
  varVs7Days?: number | null;
}

export interface LighthouseImport {
  // Métadonnées
  fileName: string;
  importedAt: string;          // ISO
  ourHotelName: string;        // ex: "Folkestone Opéra"
  competitorNames: string[];   // 10 noms

  // Données
  days: LighthouseDayData[];

  // Diagnostic
  sheetsFound: string[];
  warnings: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Convertit une valeur cellule Excel en YYYY-MM-DD.
 * Accepte : Date JS, serial Excel (nombre), string "YYYY-MM-DD" ou "YYYY-MM-DD HH:MM:SS"
 */
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

// ─────────────────────────────────────────────────────────────────────────
// PARSING STRICT DES CELLULES TARIF CONCURRENT
//
// Codes métier RMS qui ne sont JAMAIS un tarif (case-insensitive).
// Word-boundary regex pour éviter les faux positifs sur noms d'hôtels.
// ─────────────────────────────────────────────────────────────────────────
const RESTRICTION_TOKENS = [
  'los', 'mlos', 'maxlos', 'minlos',     // Length of Stay
  'cta', 'ctd',                          // Close To Arrival / Departure
  'min', 'max',                          // Restrictions stay
  'minstay', 'maxstay',
  'pax', 'restrict',                     // Restrictions occupant
  'closed', 'fermé', 'ferme',
];

const SOLD_OUT_TOKENS = [
  'épuisé', 'epuise', 'sold', 'soldout', 'sold out',
  'unavailable', 'indisponible',
];

/**
 * Parse une cellule de tarif concurrent.
 *
 * RÈGLES STRICTES (anti-corruption tarifaire) :
 *   - Seul un nombre direct OU une chaîne purement monétaire est accepté comme tarif
 *   - Tout token contenant LOS / CTA / CTD / MIN / MAX / MLOS est REJETÉ (statut 'restricted')
 *   - On n'extrait JAMAIS des chiffres présents dans des codes métier
 *   - Plage acceptée : 0 < prix ≤ 100 000 €
 *
 * Bug corrigé : "LOS2" était interprété comme 2 € — désormais 'restricted'.
 *
 * Exemples :
 *   145         → { price: 145,    status: 'available'  }
 *   "145.50€"   → { price: 145.5,  status: 'available'  }
 *   "1 234,50"  → { price: 1234.5, status: 'available'  }
 *   "Épuisé"    → { price: null,   status: 'sold_out'   }
 *   "LOS2"      → { price: null,   status: 'restricted' }   ← bug corrigé
 *   "[LOS2]"    → { price: null,   status: 'restricted' }
 *   "MLOS 3"    → { price: null,   status: 'restricted' }
 *   "CTA"       → { price: null,   status: 'restricted' }
 *   "MIN 3"     → { price: null,   status: 'restricted' }
 *   "1 pax"     → { price: null,   status: 'restricted' }
 */
function parseCompetitorCell(raw: unknown): {
  price: number | null;
  status: CompetitorRate['status'];
  rawValue: string;
} {
  // 1. Valeur nulle / vide
  if (raw == null) return { price: null, status: 'unknown', rawValue: '' };

  // 2. Nombre direct fourni par Excel (cellule numérique) — sûr, mais on borne
  if (typeof raw === 'number') {
    if (!isFinite(raw) || raw <= 0 || raw > 100000) {
      return { price: null, status: 'unknown', rawValue: String(raw) };
    }
    return { price: raw, status: 'available', rawValue: String(raw) };
  }

  // 3. Cellule string : trim et garde-fou
  const rawStr = String(raw).trim();
  if (rawStr === '') return { price: null, status: 'unknown', rawValue: '' };

  const lower = rawStr.toLowerCase();

  // 4. Détection "épuisé" — prioritaire sur restrictions
  for (const t of SOLD_OUT_TOKENS) {
    if (lower.includes(t)) {
      return { price: null, status: 'sold_out', rawValue: rawStr };
    }
  }

  // 5. Détection codes métier (LOS, CTA, MIN, MAX, etc.) → restricted, JAMAIS un prix
  //    Word-boundary regex pour éviter faux positifs sur noms d'hôtels.
  for (const token of RESTRICTION_TOKENS) {
    const pattern = new RegExp(`(^|[^a-z])${token}([^a-z]|$)`, 'i');
    if (pattern.test(rawStr)) {
      return { price: null, status: 'restricted', rawValue: rawStr };
    }
  }

  // 6. Chaîne entre crochets/parenthèses → généralement un code (ex: "[LOS2]", "(MIN 3)")
  if (/^[\[\(\{].*[\]\)\}]$/.test(rawStr)) {
    return { price: null, status: 'restricted', rawValue: rawStr };
  }

  // 7. Tentative de parsing numérique STRICTE
  //    Accepté UNIQUEMENT : chiffres + séparateur décimal + symbole monétaire optionnel
  //    Refusé : toute lettre/code après nettoyage
  const cleaned = rawStr
    .replace(/[€$£]/g, '')                  // symboles monétaires
    .replace(/\b(eur|usd|gbp)\b/gi, '')     // codes devise
    .replace(/\s+/g, '')                    // espaces (séparateurs milliers)
    .replace(/\u00A0/g, '')                 // NBSP explicite
    .trim();

  // Après nettoyage, la chaîne DOIT être purement numérique
  if (!/^-?\d+([.,]\d+)?$/.test(cleaned)) {
    // Reste alphabétique → code métier inconnu, pas un prix
    return { price: null, status: 'restricted', rawValue: rawStr };
  }

  const parsed = parseFloat(cleaned.replace(',', '.'));
  if (!isFinite(parsed) || parsed <= 0 || parsed > 100000) {
    return { price: null, status: 'unknown', rawValue: rawStr };
  }

  return { price: parsed, status: 'available', rawValue: rawStr };
}

/** Parse "7 sur 9" → { position: 7, total: 9 } */
function parseRanking(s: string): { position: number | null; total: number | null } {
  if (!s) return { position: null, total: null };
  const m = s.match(/(\d+)\s*(?:sur|\/|de)\s*(\d+)/i);
  if (!m) return { position: null, total: null };
  return { position: parseInt(m[1], 10), total: parseInt(m[2], 10) };
}

// ─── Lecture feuille Aperçu ────────────────────────────────────────────────

interface ApercuRow {
  date: string;
  dayName: string;
  ourPrice: number;
  compsetMedian: number;
  marketDemand: number;
  ranking: string;
  bookingRank: string;
  holidays: string;
  events: string;
}

function parseApercuSheet(ws: XLSX.WorkSheet): ApercuRow[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const rows: ApercuRow[] = [];

  // Données à partir de la ligne 6 (index 5)
  for (let i = 5; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row) continue;

    const dayName = row[1];
    const dateStr = cellToDate(row[2]);
    if (!dayName || !dateStr) continue;

    rows.push({
      date: dateStr,
      dayName: String(dayName),
      ourPrice: Number(row[3] ?? 0) || 0,
      compsetMedian: Number(row[4] ?? 0) || 0,
      ranking: String(row[5] ?? ''),
      marketDemand: Number(row[6] ?? 0) || 0,
      bookingRank: String(row[7] ?? ''),
      holidays: String(row[8] ?? ''),
      events: String(row[9] ?? ''),
    });
  }

  return rows;
}

// ─── Lecture feuille Tarifs ────────────────────────────────────────────────

interface TarifsParsed {
  ourHotelName: string;
  competitorNames: string[];
  byDate: Map<string, { ourPrice: number | null; competitors: CompetitorRate[] }>;
}

function parseTarifsSheet(ws: XLSX.WorkSheet): TarifsParsed {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  // Headers en ligne 5 (index 4)
  const headers = (raw[4] as unknown[]) ?? [];
  // Structure attendue : col 1=Jour, 2=Date, 3=Demande, 4=Notre hôtel, 5..14=concurrents
  const ourHotelName = String(headers[4] ?? 'Notre hôtel');
  const competitorNames: string[] = [];
  for (let col = 5; col < headers.length; col++) {
    const h = headers[col];
    if (h && String(h).trim()) competitorNames.push(String(h));
  }

  const byDate = new Map<string, { ourPrice: number | null; competitors: CompetitorRate[] }>();

  for (let i = 5; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row) continue;

    const dateStr = cellToDate(row[2]);
    if (!dateStr) continue;

    // Notre prix (col 4)
    const ourCell = parseCompetitorCell(row[4]);

    // Concurrents (cols 5..N)
    const competitors: CompetitorRate[] = competitorNames.map((name, idx) => {
      const cell = parseCompetitorCell(row[5 + idx]);
      return {
        hotelName: name,
        price: cell.price,
        status: cell.status,
        rawValue: cell.rawValue,
      };
    });

    byDate.set(dateStr, {
      ourPrice: ourCell.price,
      competitors,
    });
  }

  return { ourHotelName, competitorNames, byDate };
}

// ─── Lecture feuilles vs. ──────────────────────────────────────────────────

/** Lit une feuille vs. et extrait la variation de NOTRE prix vs la date de comparaison.
 *  Structure réelle (vérifiée sur fichier Lighthouse v2026) :
 *    col 1 = Jour, 2 = Date, 3 = Demande marché (absolu),
 *    col 4 = Variation demande (décimal, ex -0.067), 5 = Notre prix actuel (référence),
 *    col 6 = Variation de notre prix en € (signed)
 *  On extrait col 6 (variation € notre hôtel).
 */
function parseVsSheet(ws: XLSX.WorkSheet): Map<string, number> {
  const result = new Map<string, number>();
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  for (let i = 5; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row) continue;
    const dateStr = cellToDate(row[2]);
    if (!dateStr) continue;

    // Variation prix notre hôtel = col index 6
    const v = row[6];
    let val: number | null = null;
    if (typeof v === 'number') {
      val = v;
    } else if (typeof v === 'string') {
      // Ignorer codes type "[LOS2]" — uniquement nombres
      if (/^[\[\]]/.test(v.trim())) continue;
      const cleaned = v.replace(/[^\d.,+-]/g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      if (!isNaN(n)) val = n;
    }
    if (val !== null) result.set(dateStr, val);
  }

  return result;
}

// ─── Entrée principale ─────────────────────────────────────────────────────

export async function parseLighthouseExcel(file: File): Promise<LighthouseImport> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetsFound = wb.SheetNames;
  const warnings: string[] = [];

  // ─── Feuille obligatoire : Aperçu (ou première feuille en fallback) ───
  let apercuSheet: XLSX.WorkSheet | null = null;
  for (const candidate of ['Aperçu', 'Apercu', 'Overview', 'Resumé']) {
    if (wb.Sheets[candidate]) {
      apercuSheet = wb.Sheets[candidate];
      break;
    }
  }
  if (!apercuSheet) {
    apercuSheet = wb.Sheets[sheetsFound[0]];
    warnings.push(`Feuille "Aperçu" introuvable. Première feuille utilisée: "${sheetsFound[0]}"`);
  }
  const apercuRows = parseApercuSheet(apercuSheet);

  if (apercuRows.length === 0) {
    throw new Error(
      'Aucune ligne valide dans la feuille Aperçu. Vérifiez que le fichier est un export Lighthouse au bon format (headers en ligne 5, données à partir de ligne 6).'
    );
  }

  // ─── Feuille Tarifs ───────────────────────────────────────────────────
  let tarifsParsed: TarifsParsed = {
    ourHotelName: 'Folkestone Opéra',
    competitorNames: [],
    byDate: new Map(),
  };
  for (const candidate of ['Tarifs', 'Rates', 'Tarif']) {
    if (wb.Sheets[candidate]) {
      tarifsParsed = parseTarifsSheet(wb.Sheets[candidate]);
      break;
    }
  }
  if (tarifsParsed.competitorNames.length === 0) {
    warnings.push('Feuille "Tarifs" introuvable ou vide — concurrents non disponibles');
  }

  // ─── Feuilles vs. (optionnelles) ──────────────────────────────────────
  const varHier = wb.Sheets['vs. Hier'] ? parseVsSheet(wb.Sheets['vs. Hier']) : new Map<string, number>();
  const var3J = wb.Sheets['vs. 3 jours'] ? parseVsSheet(wb.Sheets['vs. 3 jours']) : new Map<string, number>();
  const var7J = wb.Sheets['vs. 7 jours'] ? parseVsSheet(wb.Sheets['vs. 7 jours']) : new Map<string, number>();

  // ─── Agrégation par jour ──────────────────────────────────────────────
  const days: LighthouseDayData[] = apercuRows.map(row => {
    const tarifs = tarifsParsed.byDate.get(row.date);
    const competitors = tarifs?.competitors ?? [];

    // MIN/MAX sur concurrents disponibles uniquement
    const availablePrices = competitors
      .filter(c => c.status === 'available' && c.price !== null)
      .map(c => c.price!) as number[];
    const compsetMin = availablePrices.length > 0 ? Math.min(...availablePrices) : null;
    const compsetMax = availablePrices.length > 0 ? Math.max(...availablePrices) : null;

    const { position, total } = parseRanking(row.ranking);

    // Notre prix : priorité à la feuille Tarifs (plus précis), fallback Aperçu
    const ourPrice = tarifs?.ourPrice ?? row.ourPrice;

    return {
      date: row.date,
      dayName: row.dayName,
      ourPrice,
      compsetMedian: row.compsetMedian,
      marketDemand: row.marketDemand,
      marketDemandPercent: Math.round(row.marketDemand * 100),
      ranking: row.ranking,
      rankPosition: position,
      rankTotal: total,
      bookingRank: row.bookingRank,
      holidays: row.holidays,
      events: row.events,
      competitors,
      compsetMin,
      compsetMax,
      varVsYesterday: varHier.get(row.date) ?? null,
      varVs3Days: var3J.get(row.date) ?? null,
      varVs7Days: var7J.get(row.date) ?? null,
    };
  });

  return {
    fileName: file.name,
    importedAt: new Date().toISOString(),
    ourHotelName: tarifsParsed.ourHotelName,
    competitorNames: tarifsParsed.competitorNames,
    days,
    sheetsFound,
    warnings,
  };
}
