/**
 * FLOWTYM — Service d'intégration des plans tarifaires importés.
 *
 * Pipeline en 4 étapes :
 *   1. PARSE   — lecture du fichier Excel (rate-plan-import.service)
 *   2. PREVIEW — affichage des plans avec détection erreurs
 *   3. MAP     — mapping des typologies Excel → typologies du PMS
 *   4. INTEGRATE — injection dans rateCalendarStore (création/mise à jour)
 *
 * Ce service prend en charge l'étape 4 : validation finale et écriture
 * effective. Il produit un rapport détaillé (acceptées/rejetées/à corriger).
 */

import type { ImportedRatePlan } from './rate-plan-import.service';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';
import type { RoomTypeData, RatePlanData, PensionType, ChannelType, ConnectivityType, CalcMode } from '@/src/components/rms/types';

export interface IntegrationRowResult {
  source: ImportedRatePlan;
  status: 'created' | 'updated' | 'rejected' | 'requires_mapping';
  reason?: string;
  /** Mapping appliqué : typologies Excel → roomTypeIds PMS */
  mappedRoomTypeIds?: string[];
  /** Plan tarifaire créé / mis à jour (id PMS) */
  planId?: string;
}

export interface IntegrationReport {
  ranAt: string;
  total: number;
  created: number;
  updated: number;
  rejected: number;
  requiresMapping: number;
  rows: IntegrationRowResult[];
}

/** Mapping typologie Excel → roomTypeId PMS (saisi par l'utilisateur). */
export type RoomTypeMapping = Record<string, string>;
/** Mapping pension Excel → PensionType PMS. */
export type MealPlanMapping = Record<string, PensionType>;

/**
 * Suggère un mapping automatique en cherchant la correspondance par
 * normalisation des libellés (insensible à la casse, sans accents).
 */
export function suggestRoomMapping(uniqueRooms: string[], roomTypes: RoomTypeData[]): RoomTypeMapping {
  const map: RoomTypeMapping = {};
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  for (const excelRoom of uniqueRooms) {
    const n = norm(excelRoom);
    const found = roomTypes.find((rt) =>
      norm(rt.roomTypeName).includes(n) ||
      n.includes(norm(rt.roomTypeName)) ||
      norm(rt.roomTypeCode) === n,
    );
    if (found) map[excelRoom] = found.roomTypeId;
  }
  return map;
}

const PENSION_KEYWORDS: Record<PensionType, string[]> = {
  'RO': ['room only', 'room-only', 'seulement', 'sans petit'],
  'BB': ['bed and breakfast', 'breakfast', 'petit-déjeuner', 'pdj', 'b&b'],
  'HB': ['half board', 'demi-pension', 'demi pension'],
  'FB': ['full board', 'pension complète', 'pension complete'],
  'AI': ['all inclusive', 'all-inclusive', 'tout compris'],
  'Package': ['package', 'forfait', 'séjour'],
};

export function suggestMealPlanMapping(uniqueMealPlans: string[]): MealPlanMapping {
  const map: MealPlanMapping = {};
  for (const meal of uniqueMealPlans) {
    const n = meal.toLowerCase();
    let bestMatch: PensionType = 'RO';
    for (const [pension, keywords] of Object.entries(PENSION_KEYWORDS) as [PensionType, string[]][]) {
      if (keywords.some((kw) => n.includes(kw))) { bestMatch = pension; break; }
    }
    map[meal] = bestMatch;
  }
  return map;
}

/**
 * Valide une ligne avant intégration. Retourne null si OK, sinon un motif
 * de rejet ou de mapping requis.
 */
type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string; status: 'rejected' | 'requires_mapping' };

function validateRow(p: ImportedRatePlan, roomMap: RoomTypeMapping): ValidationResult {
  if (!p.code.trim()) return { ok: false, reason: 'Code de plan manquant', status: 'rejected' };
  if (!p.name.trim()) return { ok: false, reason: 'Nom de plan manquant', status: 'rejected' };
  if (p.rooms.length === 0) return { ok: false, reason: 'Aucune typologie de chambre déclarée', status: 'rejected' };
  const unmapped = p.rooms.filter((r) => !roomMap[r]);
  if (unmapped.length > 0) {
    return {
      ok: false,
      reason: `Typologies non mappées : ${unmapped.slice(0, 3).join(', ')}${unmapped.length > 3 ? '…' : ''}`,
      status: 'requires_mapping',
    };
  }
  return { ok: true };
}

/**
 * Construit un RatePlanData PMS à partir d'un ImportedRatePlan.
 * Le prix par défaut est 0 — il faudra être rempli plus tard (Calendrier).
 */
function toRatePlanData(
  p: ImportedRatePlan,
  mealMap: MealPlanMapping,
  roomMap: RoomTypeMapping,
  dateColumns: string[],
): RatePlanData {
  const pension = mealMap[p.mealPlan] ?? 'RO';
  const channelType: ChannelType = p.partners.some((x) => /booking|expedia|airbnb|ota/i.test(x))
    ? 'OTA'
    : p.partners.some((x) => /direct|site/i.test(x))
      ? 'Direct'
      : 'OTA';
  const connectivityType: ConnectivityType = p.partners.some((x) => /d-edge|siteminder|cendyn/i.test(x))
    ? 'D-EDGE'
    : 'Aucun';
  const calcMode: CalcMode = p.computation === 'reference' ? 'fixed' : 'derived';

  return {
    internalId: Date.now() + Math.floor(Math.random() * 10000),
    planId: `imported_${p.id}`,
    planName: p.name,
    planCode: p.code,
    pensionType: pension,
    channelType,
    calcMode,
    calcValue: 0,
    referencePlanId: p.computation === 'derived' ? p.baseRate : '',
    isReference: p.computation === 'reference',
    isActive: true,
    connectivityType,
    isConnectivityLocked: false,
    assignedRoomTypeIds: p.rooms.map((r) => roomMap[r]).filter(Boolean),
    distributionChannels: p.partners,
    prices: dateColumns.map((d) => ({
      date: d, price: 0, currency: 'EUR', status: 'open' as const, isEditable: true,
    })),
  };
}

/**
 * Exécute l'intégration finale dans le rateCalendarStore.
 * Idempotent : si un plan avec le même planCode existe déjà sur la même
 * chambre, il est mis à jour ; sinon créé.
 */
export function integrateRatePlans(
  plans: ImportedRatePlan[],
  roomMap: RoomTypeMapping,
  mealMap: MealPlanMapping,
): IntegrationReport {
  const ranAt = new Date().toISOString();
  const { roomTypes, dateColumns } = useRateCalendarStore.getState();
  const dateIso = dateColumns.map((c) => c.date);
  const rows: IntegrationRowResult[] = [];

  // Snapshot des roomTypes (mutation locale)
  const next = roomTypes.map((rt) => ({ ...rt, ratePlans: [...rt.ratePlans] }));

  for (const p of plans) {
    const validation = validateRow(p, roomMap);
    if (validation.ok === false) {
      rows.push({
        source: p,
        status: validation.status,
        reason: validation.reason,
      });
      continue;
    }

    const newPlan = toRatePlanData(p, mealMap, roomMap, dateIso);
    const targetRoomIds = newPlan.assignedRoomTypeIds;
    let didCreate = false;
    let didUpdate = false;

    for (const rt of next) {
      if (!targetRoomIds.includes(rt.roomTypeId)) continue;
      const existingIdx = rt.ratePlans.findIndex((x) => x.planCode === newPlan.planCode);
      if (existingIdx >= 0) {
        rt.ratePlans[existingIdx] = {
          ...rt.ratePlans[existingIdx],
          planName: newPlan.planName,
          pensionType: newPlan.pensionType,
          channelType: newPlan.channelType,
          isReference: newPlan.isReference,
          isActive: newPlan.isActive,
          distributionChannels: newPlan.distributionChannels,
        };
        didUpdate = true;
      } else {
        rt.ratePlans.push({
          ...newPlan,
          planId: `${newPlan.planId}_${rt.roomTypeId}`,
        });
        didCreate = true;
      }
    }

    rows.push({
      source: p,
      status: didCreate ? 'created' : didUpdate ? 'updated' : 'rejected',
      reason: !didCreate && !didUpdate ? 'Aucune chambre cible trouvée' : undefined,
      mappedRoomTypeIds: targetRoomIds,
      planId: newPlan.planId,
    });
  }

  // Commit dans le store via le setter zustand
  useRateCalendarStore.setState({ roomTypes: next });

  return {
    ranAt,
    total: plans.length,
    created: rows.filter((r) => r.status === 'created').length,
    updated: rows.filter((r) => r.status === 'updated').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    requiresMapping: rows.filter((r) => r.status === 'requires_mapping').length,
    rows,
  };
}

const STORAGE_KEY = 'flowtym.rate_plans.integration_report';

export function saveIntegrationReport(report: IntegrationReport) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
}

export function loadIntegrationReport(): IntegrationReport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
