/**
 * FLOWTYM — Parser Excel des plans tarifaires (format Folkestone).
 *
 * Lit un fichier Excel avec les colonnes :
 *   Id · Code · Name · Meal Plan · Package? · Private? · Computation ·
 *   Base Rate · Base Room · Labels · Rooms · Partners · Early Booking ·
 *   Last Minute · Default MinStay · Default MaxStay · Selling Condition ·
 *   Cancel Condition · Deposit · Selling Periods · Stay Periods ·
 *   Gratuitousness Periods
 *
 * Le parser produit une liste typée d'entrées prêtes à être affichées
 * (lecture seule en Phase 1) ou injectées dans le rateCalendarStore
 * (Phase 2 — création des plans dans le moteur RMS).
 */

import * as XLSX from 'xlsx';

export interface ImportedRatePlan {
  id: string;
  code: string;
  name: string;
  mealPlan: string;
  isPackage: boolean;
  isPrivate: boolean;
  computation: 'reference' | 'derived';
  baseRate: string;       // libellé du plan de référence si dérivé
  baseRoom: string;
  labels: string;
  rooms: string[];        // liste des typologies acceptées (split " / ")
  partners: string[];     // OTAs/canaux (split " / ")
  earlyBooking: string;
  lastMinute: string;
  defaultMinStay: string;
  defaultMaxStay: string;
  sellingCondition: string;
  cancelCondition: string;
  deposit: string;
  sellingPeriods: string;
  stayPeriods: string;
  gratuitousnessPeriods: string;
}

export interface RatePlanImportReport {
  fileName: string;
  parsedAt: string;
  sheet: string;
  totalRows: number;
  plans: ImportedRatePlan[];
  warnings: string[];
  /** Liste dédupliquée des typologies de chambres détectées. */
  uniqueRooms: string[];
  /** Liste dédupliquée des partenaires détectés. */
  uniquePartners: string[];
  /** Liste dédupliquée des meal plans détectés. */
  uniqueMealPlans: string[];
}

function splitList(s: string): string[] {
  if (!s) return [];
  return s.split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean);
}

function parseComputation(v: string): 'reference' | 'derived' {
  return /reference/i.test(v) ? 'reference' : 'derived';
}

/**
 * Parse un fichier Excel de plans tarifaires.
 * Le format attendu est celui exporté par Folkestone / D-EDGE (22 colonnes
 * détaillées). Le parser détecte automatiquement la première feuille
 * non vide et la ligne d'en-tête.
 */
export function parseRatePlanExcel(buffer: ArrayBuffer, fileName: string): RatePlanImportReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const warnings: string[] = [];
  const plans: ImportedRatePlan[] = [];
  const roomsSet = new Set<string>();
  const partnersSet = new Set<string>();
  const mealPlansSet = new Set<string>();

  let processedSheet = '';

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (rows.length === 0) continue;

    processedSheet = sheetName;

    for (const row of rows) {
      const id = String(row['Id'] ?? '').trim();
      const code = String(row['Code'] ?? '').trim();
      const name = String(row['Name'] ?? '').trim();
      if (!id && !code && !name) continue;
      if (!code && !name) {
        warnings.push(`Ligne ignorée (ni code ni nom) : id="${id}"`);
        continue;
      }

      const rooms = splitList(String(row['Rooms'] ?? ''));
      const partners = splitList(String(row['Partners'] ?? ''));
      const mealPlan = String(row['Meal Plan'] ?? '').trim();

      rooms.forEach((r) => roomsSet.add(r));
      partners.forEach((p) => partnersSet.add(p));
      if (mealPlan) mealPlansSet.add(mealPlan);

      plans.push({
        id: id || `imported_${Date.now()}_${plans.length}`,
        code,
        name,
        mealPlan,
        isPackage: !!String(row['Package?'] ?? '').trim(),
        isPrivate: !!String(row['Private?'] ?? '').trim(),
        computation: parseComputation(String(row['Computation'] ?? '')),
        baseRate: String(row['Base Rate'] ?? '').trim(),
        baseRoom: String(row['Base Room'] ?? '').trim(),
        labels: String(row['Labels'] ?? '').trim(),
        rooms,
        partners,
        earlyBooking: String(row['Early Booking'] ?? '').trim(),
        lastMinute: String(row['Last Minute'] ?? '').trim(),
        defaultMinStay: String(row['Default MinStay'] ?? '').trim(),
        defaultMaxStay: String(row['Default MaxStay'] ?? '').trim(),
        sellingCondition: String(row['Selling Condition'] ?? '').trim(),
        cancelCondition: String(row['Cancel Condition'] ?? '').trim(),
        deposit: String(row['Deposit'] ?? '').trim(),
        sellingPeriods: String(row['Selling Periods'] ?? '').trim(),
        stayPeriods: String(row['Stay Periods'] ?? '').trim(),
        gratuitousnessPeriods: String(row['Gratuitousness Periods'] ?? '').trim(),
      });
    }
    break; // une seule feuille traitée
  }

  if (plans.length === 0) {
    warnings.push('Aucun plan tarifaire reconnu — vérifiez que la première ligne contient les en-têtes (Id, Code, Name, …).');
  }

  return {
    fileName,
    parsedAt: new Date().toISOString(),
    sheet: processedSheet,
    totalRows: plans.length,
    plans,
    warnings,
    uniqueRooms: [...roomsSet].sort(),
    uniquePartners: [...partnersSet].sort(),
    uniqueMealPlans: [...mealPlansSet].sort(),
  };
}

const STORAGE_KEY = 'flowtym.rate_plans.imported';

export function saveImportedRatePlans(report: RatePlanImportReport) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
}

export function loadImportedRatePlans(): RatePlanImportReport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearImportedRatePlans() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
