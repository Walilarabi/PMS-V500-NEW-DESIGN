/**
 * FLOWTYM — Parser Excel des plans tarifaires distribués par partenaire.
 *
 * Format attendu (3 colonnes) :
 *   - "Activation"                 ex: "Activé" / "Désactivé"
 *   - "Partenaires de distribution" ex: "Booking.com (6562)"
 *   - "Tarifs distribués"          ex: "OTA BB FLEX 1P (OTA-BB-FLEX-1P)"
 *
 * Particularité (fusion de cellules à plat) :
 *   - Un partenaire / une activation n'apparaissent qu'une fois ;
 *   - les lignes suivantes laissent ces cellules VIDES ;
 *   - on reprend alors la dernière valeur connue (forward-fill).
 *
 * Le parser n'écrit RIEN : il produit un rapport typé prévisualisable.
 * La persistance Supabase est faite par partner-rate-import.persist.ts.
 */

import * as XLSX from 'xlsx';

export interface ParsedPlan {
  name: string;                 // "OTA BB FLEX 1P"
  code: string;                 // "OTA-BB-FLEX-1P"
  partnerName: string;          // "Booking.com"
  partnerExternalId: string | null; // "6562"
  isActive: boolean;
  mealPlan: string | null;      // RO | BB | HB | FB | AI
  cancellationType: string | null; // FLEX | NANR
  occupancy: string | null;     // 1P | 2P | 4P …
  rowIndex: number;             // n° de ligne dans le fichier (debug / erreurs)
}

export interface ParsedPartner {
  name: string;
  externalId: string | null;
  isActive: boolean;
}

export interface PartnerRateImportReport {
  fileName: string;
  parsedAt: string;
  sheet: string;
  partners: ParsedPartner[];     // dédupliqués
  plans: ParsedPlan[];           // une entrée par (plan, partenaire)
  warnings: string[];
  errors: { row: number; message: string }[];
}

const MEAL_PLANS = new Set(['RO', 'BB', 'HB', 'FB', 'AI']);

/** Normalise un en-tête : minuscules, sans accents, sans espaces superflus. */
function normHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Sépare "Nom (123)" → { name: "Nom", externalId: "123" }. */
function splitNameAndId(raw: string): { name: string; externalId: string | null } {
  const m = raw.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (m) {
    const inner = m[2].trim();
    return { name: m[1].trim(), externalId: inner || null };
  }
  return { name: raw.trim(), externalId: null };
}

/** Déduit meal_plan / cancellation_type / occupancy depuis le code du plan. */
export function derivePlanAttributes(code: string): {
  mealPlan: string | null;
  cancellationType: string | null;
  occupancy: string | null;
} {
  const tokens = code.toUpperCase().split(/[-_\s]+/).filter(Boolean);
  let mealPlan: string | null = null;
  let cancellationType: string | null = null;
  let occupancy: string | null = null;

  for (const t of tokens) {
    if (!mealPlan && MEAL_PLANS.has(t)) mealPlan = t;
    if (!cancellationType) {
      if (t === 'FLEX') cancellationType = 'FLEX';
      else if (t === 'NANR' || t === 'NR' || t === 'NREF' || t === 'NONREF') cancellationType = 'NANR';
    }
    if (!occupancy && /^\d+P$/.test(t)) occupancy = t;
  }
  return { mealPlan, cancellationType, occupancy };
}

/** Détecte l'index des 3 colonnes dans la ligne d'en-tête. */
function findColumns(headerRow: string[]): { activation: number; partner: number; plan: number } | null {
  let activation = -1, partner = -1, plan = -1;
  headerRow.forEach((h, i) => {
    const n = normHeader(h);
    if (activation < 0 && n.includes('activation')) activation = i;
    if (partner < 0 && (n.includes('partenaire') || n.includes('distribution'))) partner = i;
    if (plan < 0 && (n.includes('tarif') || n.includes('distribue') || n.includes('plan'))) plan = i;
  });
  if (partner < 0 || plan < 0) return null;
  return { activation, partner, plan };
}

function isActivated(v: string): boolean {
  const n = normHeader(v);
  return n.startsWith('activ') || n === 'oui' || n === 'yes' || n === 'true' || n === '1';
}

export function parsePartnerRateExcel(buffer: ArrayBuffer, fileName: string): PartnerRateImportReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  const warnings: string[] = [];
  const errors: { row: number; message: string }[] = [];
  const plans: ParsedPlan[] = [];
  const partnersMap = new Map<string, ParsedPartner>(); // clé = name lower

  let processedSheet = '';

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false });
    if (matrix.length === 0) continue;

    // Trouver la ligne d'en-tête (première ligne contenant les colonnes attendues)
    let headerIdx = -1;
    let cols: ReturnType<typeof findColumns> = null;
    for (let i = 0; i < Math.min(matrix.length, 15); i++) {
      const c = findColumns((matrix[i] ?? []).map((x) => String(x ?? '')));
      if (c) { headerIdx = i; cols = c; break; }
    }
    if (headerIdx < 0 || !cols) continue;

    processedSheet = sheetName;

    let lastPartnerRaw = '';
    let lastActivationRaw = '';

    for (let r = headerIdx + 1; r < matrix.length; r++) {
      const row = matrix[r] ?? [];
      const cell = (idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : '');

      // Forward-fill activation + partenaire
      const partnerRaw = cell(cols.partner) || lastPartnerRaw;
      const activationRaw = cell(cols.activation) || lastActivationRaw;
      if (cell(cols.partner)) lastPartnerRaw = cell(cols.partner);
      if (cell(cols.activation)) lastActivationRaw = cell(cols.activation);

      const planRaw = cell(cols.plan);
      if (!planRaw) continue; // ligne vide (pas de plan) → ignorée silencieusement

      if (!partnerRaw) {
        errors.push({ row: r + 1, message: `Plan "${planRaw}" sans partenaire associé (aucun partenaire connu en amont).` });
        continue;
      }

      const { name: partnerName, externalId: partnerExternalId } = splitNameAndId(partnerRaw);
      const plan = splitNameAndId(planRaw);
      // Le code est l'identifiant entre parenthèses ; sinon on retombe sur le nom.
      const code = (plan.externalId ?? plan.name).trim();
      const name = plan.name.trim();
      if (!code) {
        errors.push({ row: r + 1, message: `Plan "${planRaw}" : code introuvable.` });
        continue;
      }

      const active = isActivated(activationRaw);
      const attrs = derivePlanAttributes(code);

      // Dédup partenaire
      const pKey = partnerName.toLowerCase();
      const existingPartner = partnersMap.get(pKey);
      if (!existingPartner) {
        partnersMap.set(pKey, { name: partnerName, externalId: partnerExternalId, isActive: active });
      } else if (!existingPartner.externalId && partnerExternalId) {
        existingPartner.externalId = partnerExternalId;
      }

      plans.push({
        name, code, partnerName, partnerExternalId,
        isActive: active,
        mealPlan: attrs.mealPlan,
        cancellationType: attrs.cancellationType,
        occupancy: attrs.occupancy,
        rowIndex: r + 1,
      });
    }
    break; // une seule feuille
  }

  if (plans.length === 0 && errors.length === 0) {
    warnings.push("Aucun plan détecté — vérifiez les colonnes « Partenaires de distribution » et « Tarifs distribués ».");
  }

  return {
    fileName,
    parsedAt: new Date().toISOString(),
    sheet: processedSheet,
    partners: [...partnersMap.values()],
    plans,
    warnings,
    errors,
  };
}
