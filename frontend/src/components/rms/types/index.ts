// ─── Enums & primitives ───

export type ViewMode = "7days" | "15days" | "1month";
export type CellStatus = "open" | "closed" | "restricted" | "readonly";
export type InventoryOverride = "manual_closed" | "force_open" | null;

export type BathroomType = "Douche" | "Baignoire" | "Les deux" | "Aucune";
export type PensionType = "RO" | "BB" | "HB" | "FB" | "AI" | "Package";
export type ChannelType = "OTA" | "Mobile" | "Corporate" | "Direct";
export type CalcMode = "fixed" | "derived";
export type ConnectivityType = "D-EDGE" | "ChannelManager" | "Aucun";
export type RateStatus = "Actif" | "Inactif";

// ─── Calendar ───

export interface DateColumn {
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  month: string;
  isWeekend: boolean;
  isToday: boolean;
}

// ─── Chambres virtuelles ───
// Une chambre virtuelle n'a pas d'existence physique propre :
// elle est composée d'une ou plusieurs chambres physiques.
// Exemple : "Deux chambres adjacentes" = combinaison de 2 unités physiques
// vendues comme une seule unité ; sa disponibilité dépend de la dispo des
// composantes (verrouillage en cascade).
export type VirtualRoomKind =
  | "adjacent"        // chambres adjacentes (côte à côte)
  | "connecting"      // chambres communicantes (porte intérieure)
  | "suite_combo"     // suite composée (chambre + salon)
  | "family_combo"    // combo familial (ex : double + single)
  | "split_twin"      // unité physique vendable en twin ou double
  | "custom";

export interface VirtualRoomComposition {
  componentRoomTypeIds: string[];   // chambres physiques composantes
  componentsRequired: "all" | "any"; // "all" = toutes requises | "any" = au moins une
}

// ─── Room Type ───

export interface RoomTypeData {
  internalId: number;
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  capacity: number;
  bathroom: BathroomType;
  equipment: string[];
  view: string;
  description: string;
  isReference: boolean;
  isActive: boolean;
  assignedRatePlanIds: string[];
  /** @deprecated Utiliser `partnerIds` — conservé pour rétro-compat */
  distributionChannels: string[];
  /** IDs stables des partenaires assignés (slugs depuis constants/partners.ts) */
  partnerIds?: string[];
  diffFromRef: number;
  diffType: "fixed" | "percent";
  statuses: RoomStatus[];
  ratePlans: RatePlanData[];
  // ─── Chambres virtuelles (optionnel) ───
  isVirtual?: boolean;
  virtualKind?: VirtualRoomKind;
  virtualComposition?: VirtualRoomComposition;
}

export interface RoomStatus {
  date: string;
  status: CellStatus;
  label: string;
  capacity?: number;
  inventory: number;
  sold: number;
  override?: InventoryOverride;
  minStay?: number | null;
  maxStay?: number | null;
  cta?: boolean;
  ctd?: boolean;
  // Runtime fields injected by Supabase adapter:
  restrictionId?: string;     // uuid in public.rate_restrictions
  restrictionVersion?: number;
}

// ─── Rate Plan ───

export interface RatePlanData {
  internalId: number;
  planId: string;
  planName: string;
  planCode: string;
  pensionType: PensionType;
  channelType: ChannelType;
  calcMode: CalcMode;
  calcValue: number;
  referencePlanId: string;
  isReference: boolean;
  isActive: boolean;
  connectivityType: ConnectivityType;
  isConnectivityLocked: boolean;
  assignedRoomTypeIds: string[];
  /** @deprecated Utiliser `partnerIds` — conservé pour rétro-compat */
  distributionChannels: string[];
  /** IDs stables des partenaires liés à ce plan (slugs depuis constants/partners.ts) */
  partnerIds?: string[];
  /** Partenaire principal (OTA propriétaire de ce plan) */
  primaryPartnerId?: string;
  prices: RatePrice[];
}

export interface RatePrice {
  date: string;
  price: number;
  currency: string;
  status: CellStatus;
  isEditable: boolean;
  planClosed?: boolean;
  blockReason?: string;
  // Runtime fields injected by Supabase adapter (used by persistence layer):
  priceId?: string;          // uuid in public.rate_prices
  priceVersion?: number;     // optimistic concurrency token
  priceSource?: string;      // 'manual' | 'cascade' | 'lighthouse' | ...
}

// ─── Pricing Rules ───

export interface RoomPriceRule {
  roomTypeId: string;
  diffType: "fixed" | "percent";
  diffValue: number;
}

export interface PlanPriceRule {
  planId: string;
  diffType: "fixed" | "percent";
  diffValue: number;
}

export interface PricingRules {
  referenceRoomTypeId: string;
  referencePlanId: string;
  roomRules: RoomPriceRule[];
  planRules: PlanPriceRule[];
}

// ─── Channel Data ───

export type OTALogoType =
  | "booking" | "expedia" | "trip" | "agoda" | "airbnb"
  | "hrs" | "tbo" | "travco" | "lastminute" | "hotelbeds"
  | "miki" | "olympia" | "opengus" | "magic_holidays"
  | "infiniter" | "direct" | "default";

export interface ChannelData {
  channelId: string;
  channelName: string;
  commission: number;
  closedDates: string[];
  logoType: OTALogoType;
}

// ─── Audit ───

export interface AuditLogEntry {
  id: string;
  at: string;
  action: string;
  target: string;
  detail: string;
  result: "accepted" | "ignored";
}

// ─── Navigation ───

export interface CellPosition { rowIndex: number; colIndex: number; }
export interface EditableCell { roomTypeId: string; planId: string; date: string; rowIndex: number; colIndex: number; }

// ─── State ───

export interface RateCalendarState {
  viewMode: ViewMode;
  startDate: Date;
  endDate: Date;
  dateColumns: DateColumn[];
  roomTypes: RoomTypeData[];
  pricingRules: PricingRules;
  isLoading: boolean;
  isSaving: boolean;
  expandedRooms: Record<string, boolean>;
  editedCells: Set<string>;
  lastSaved: Date | null;
}

// ─── Payloads ───

export interface NewRoomPayload {
  roomName: string;
  roomCode: string;
  capacity: number;
  bathroom: BathroomType;
  equipment: string[];
  view: string;
  description: string;
  isReference: boolean;
  assignedRatePlanIds: string[];
  distributionChannels: string[];
  partnerIds?: string[];
  diffFromRef: number;
  diffType: "fixed" | "percent";
  // Création optionnelle d'une chambre virtuelle
  isVirtual?: boolean;
  virtualKind?: VirtualRoomKind;
  virtualComposition?: VirtualRoomComposition;
}

export interface NewRatePlanPayload {
  planName: string;
  planCode: string;
  pensionType: PensionType;
  channelType: ChannelType;
  calcMode: CalcMode;
  calcValue: number;
  referencePlanId: string;
  connectivityType: ConnectivityType;
  assignedRoomTypeIds: string[];
  distributionChannels: string[];
  partnerIds?: string[];
  primaryPartnerId?: string;
  minStay: number | null;
  maxStay: number | null;
  cancellationPolicy: string;
  mealPlan: string;
}

export interface UpdateRoomPayload {
  roomTypeId: string;
  roomName: string;
  roomCode: string;
  capacity: number;
  bathroom: BathroomType;
  equipment: string[];
  view: string;
  description: string;
  isReference: boolean;
  assignedRatePlanIds: string[];
  distributionChannels: string[];
  partnerIds?: string[];
  diffFromRef: number;
  diffType: "fixed" | "percent";
}

export interface UpdateRatePlanPayload {
  planId: string;
  planName: string;
  planCode: string;
  pensionType: PensionType;
  channelType: ChannelType;
  calcMode: CalcMode;
  calcValue: number;
  referencePlanId: string;
  connectivityType: ConnectivityType;
  assignedRoomTypeIds: string[];
  distributionChannels: string[];
  partnerIds?: string[];
  primaryPartnerId?: string;
}
