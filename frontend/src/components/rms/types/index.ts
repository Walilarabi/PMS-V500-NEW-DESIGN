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
  distributionChannels: string[];
  diffFromRef: number;
  diffType: "fixed" | "percent";
  statuses: RoomStatus[];
  ratePlans: RatePlanData[];
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
  distributionChannels: string[];
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
  diffFromRef: number;
  diffType: "fixed" | "percent";
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
}
