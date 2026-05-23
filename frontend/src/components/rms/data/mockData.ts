import { RoomTypeData, DateColumn, PricingRules, ViewMode, CellStatus } from "../types";

// ─── Helpers ───

export function generateDateColumns(startDate: Date, viewMode: ViewMode): DateColumn[] {
  const days = viewMode === "7days" ? 7 : viewMode === "15days" ? 15 : 31;
  const columns: DateColumn[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayNames = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
  const monthNames = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate); d.setDate(d.getDate() + i);
    columns.push({
      date: d.toISOString().split("T")[0],
      dayOfWeek: dayNames[d.getDay()],
      dayOfMonth: d.getDate(),
      month: monthNames[d.getMonth()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: d.getTime() === today.getTime(),
    });
  }
  return columns;
}

function randStatus(): CellStatus { const r = Math.random(); return r < 0.7 ? "open" : r < 0.85 ? "restricted" : "closed"; }
function randLabel(s: CellStatus): string { return s === "open" ? "Disponible" : s === "closed" ? "Fermé" : "Partielle..."; }

function buildPrices(dates: string[], base: number, weekendBonus: number): { date: string; price: number; currency: string; status: CellStatus; isEditable: boolean; planClosed?: boolean }[] {
  return dates.map((date, i) => {
    const status = randStatus();
    const weekend = dates.length > 7 ? (i % 7 >= 5 ? weekendBonus : 0) : 0;
    return { date, price: base + weekend + Math.floor(Math.random() * 40 - 20), currency: "EUR", status, isEditable: true, planClosed: false };
  });
}

function buildStatuses(dates: string[], cap: number): RoomTypeData["statuses"] {
  return dates.map((date) => {
    const status = randStatus();
    return { date, status, label: randLabel(status), capacity: cap, inventory: status === "closed" ? 0 : Math.floor(Math.random() * cap) + 1, sold: Math.floor(Math.random() * 2), override: null, minStay: null, maxStay: null, cta: false, ctd: false };
  });
}

// ─── Pricing Rules ───

export const pricingRules: PricingRules = {
  referenceRoomTypeId: "rt_double_standard",
  referencePlanId: "plan_flexible_ro",
  roomRules: [
    { roomTypeId: "rt_double_standard", diffType: "fixed", diffValue: 0 },
    { roomTypeId: "rt_double_deluxe", diffType: "fixed", diffValue: 20 },
    { roomTypeId: "rt_suite", diffType: "percent", diffValue: 35 },
    { roomTypeId: "rt_single", diffType: "fixed", diffValue: -30 },
    { roomTypeId: "rt_family", diffType: "fixed", diffValue: 45 },
  ],
  planRules: [
    { planId: "plan_flexible_ro", diffType: "fixed", diffValue: 0 },
    { planId: "plan_nr_ro", diffType: "percent", diffValue: -10 },
    { planId: "plan_flexible_bb", diffType: "fixed", diffValue: 15 },
    { planId: "plan_nr_bb", diffType: "fixed", diffValue: 5 },
  ],
};

// ─── Mock Generator ───

/**
 * Génère une fenêtre de dates large (120 jours) — utilisée pour seeder
 * les prix de toutes les chambres × plans. La vue calendrier ne montre
 * que `viewMode` jours, mais le store contient toujours plus de prix
 * que ce qui est affiché : cela permet à d'autres modules (RMS Tableau
 * Pro qui peut afficher jusqu'à 90 jours, recommandations longues
 * échéances, autopilote) de lire les prix sans recevoir de fallback.
 */
const PRICE_WINDOW_DAYS = 120;

function generateWideDates(startDate: Date): string[] {
  const out: string[] = [];
  const d = new Date(startDate);
  for (let i = 0; i < PRICE_WINDOW_DAYS; i++) {
    out.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function generateMockData(startDate: Date, viewMode: ViewMode): RoomTypeData[] {
  const dateColumns = generateDateColumns(startDate, viewMode);
  // Les prix sont seedés sur une fenêtre large (120 j) et non pas sur
  // les seuls `dateColumns` visibles — voir commentaire ci-dessus.
  const dates = generateWideDates(startDate);

  const rooms: RoomTypeData[] = [
    {
      internalId: 1, roomTypeId: "rt_double_standard", roomTypeName: "Chambre double Classique", roomTypeCode: "DBL-CL",
      capacity: 2, bathroom: "Douche", equipment: ["wifi", "tv", "minibar"], view: "Ville",
      description: "Chambre double confortable avec vue sur la ville.",
      isReference: true, isActive: true,
      assignedRatePlanIds: ["plan_flexible_ro", "plan_nr_ro", "plan_flexible_bb", "plan_nr_bb"],
      distributionChannels: ["Booking.com", "Direct", "Expedia"],
      diffFromRef: 0, diffType: "fixed",
      statuses: buildStatuses(dates, 4),
      ratePlans: [
        { internalId: 101, planId: "plan_flexible_ro", planName: "Flexible RO", planCode: "FLEX_RO", pensionType: "RO", channelType: "OTA", calcMode: "fixed", calcValue: 0, referencePlanId: "", isReference: true, isActive: true, connectivityType: "D-EDGE", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe", "rt_suite", "rt_single", "rt_family"], distributionChannels: ["Booking.com", "Direct"], prices: buildPrices(dates, 150, 30) },
        { internalId: 102, planId: "plan_nr_ro", planName: "NR RO", planCode: "NR_RO", pensionType: "RO", channelType: "OTA", calcMode: "derived", calcValue: 0, referencePlanId: "plan_flexible_ro", isReference: false, isActive: true, connectivityType: "D-EDGE", isConnectivityLocked: true, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe", "rt_family"], distributionChannels: ["Booking.com"], prices: buildPrices(dates, 135, 25) },
        { internalId: 103, planId: "plan_flexible_bb", planName: "Flexible BB", planCode: "FLEX_BB", pensionType: "BB", channelType: "Direct", calcMode: "derived", calcValue: 15, referencePlanId: "plan_flexible_ro", isReference: false, isActive: true, connectivityType: "Aucun", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe"], distributionChannels: ["Direct"], prices: buildPrices(dates, 165, 35) },
        { internalId: 104, planId: "plan_nr_bb", planName: "NR BB", planCode: "NR_BB", pensionType: "BB", channelType: "Mobile", calcMode: "derived", calcValue: 5, referencePlanId: "plan_flexible_ro", isReference: false, isActive: false, connectivityType: "Aucun", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard"], distributionChannels: ["Mobile"], prices: buildPrices(dates, 155, 30) },
      ],
    },
    {
      internalId: 2, roomTypeId: "rt_double_deluxe", roomTypeName: "Chambre Deluxe", roomTypeCode: "DBL-DLX",
      capacity: 2, bathroom: "Baignoire", equipment: ["wifi", "tv", "minibar", "bath", "balcony"], view: "Mer",
      description: "Chambre Deluxe avec vue mer et baignoire.",
      isReference: false, isActive: true,
      assignedRatePlanIds: ["plan_flexible_ro", "plan_nr_ro", "plan_flexible_bb"],
      distributionChannels: ["Booking.com", "Agoda", "Direct"],
      diffFromRef: 20, diffType: "fixed",
      statuses: buildStatuses(dates, 3),
      ratePlans: [
        { internalId: 201, planId: "plan_flexible_ro", planName: "Flexible RO", planCode: "FLEX_RO", pensionType: "RO", channelType: "OTA", calcMode: "fixed", calcValue: 0, referencePlanId: "", isReference: false, isActive: true, connectivityType: "D-EDGE", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe", "rt_suite", "rt_single", "rt_family"], distributionChannels: ["Booking.com", "Direct"], prices: buildPrices(dates, 170, 35) },
        { internalId: 202, planId: "plan_nr_ro", planName: "NR RO", planCode: "NR_RO", pensionType: "RO", channelType: "OTA", calcMode: "derived", calcValue: 0, referencePlanId: "plan_flexible_ro", isReference: false, isActive: true, connectivityType: "D-EDGE", isConnectivityLocked: true, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe", "rt_family"], distributionChannels: ["Booking.com"], prices: buildPrices(dates, 153, 30) },
        { internalId: 203, planId: "plan_flexible_bb", planName: "Flexible BB", planCode: "FLEX_BB", pensionType: "BB", channelType: "Direct", calcMode: "derived", calcValue: 15, referencePlanId: "plan_flexible_ro", isReference: false, isActive: true, connectivityType: "Aucun", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe"], distributionChannels: ["Direct"], prices: buildPrices(dates, 185, 40) },
      ],
    },
    {
      internalId: 3, roomTypeId: "rt_suite", roomTypeName: "Suite", roomTypeCode: "STE-PR",
      capacity: 4, bathroom: "Les deux", equipment: ["wifi", "tv", "minibar", "bath", "balcony", "safe"], view: "Mer",
      description: "Suite Premium avec salon séparé et vue mer panoramique.",
      isReference: false, isActive: true,
      assignedRatePlanIds: ["plan_flexible_ro", "plan_flexible_bb"],
      distributionChannels: ["Direct", "Corporate"],
      diffFromRef: 35, diffType: "percent",
      statuses: buildStatuses(dates, 2),
      ratePlans: [
        { internalId: 301, planId: "plan_flexible_ro", planName: "Flexible RO", planCode: "FLEX_RO", pensionType: "RO", channelType: "Direct", calcMode: "fixed", calcValue: 202, referencePlanId: "", isReference: false, isActive: true, connectivityType: "Aucun", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe", "rt_suite", "rt_single", "rt_family"], distributionChannels: ["Booking.com", "Direct"], prices: buildPrices(dates, 202, 50) },
        { internalId: 302, planId: "plan_flexible_bb", planName: "Flexible BB", planCode: "FLEX_BB", pensionType: "BB", channelType: "Direct", calcMode: "derived", calcValue: 15, referencePlanId: "plan_flexible_ro", isReference: false, isActive: true, connectivityType: "Aucun", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe"], distributionChannels: ["Direct"], prices: buildPrices(dates, 217, 55) },
      ],
    },
    {
      internalId: 4, roomTypeId: "rt_single", roomTypeName: "Chambre Simple", roomTypeCode: "SGL-CL",
      capacity: 1, bathroom: "Douche", equipment: ["wifi", "tv"], view: "Ville",
      description: "Chambre simple économique avec WiFi gratuit.",
      isReference: false, isActive: true,
      assignedRatePlanIds: ["plan_flexible_ro", "plan_nr_ro"],
      distributionChannels: ["Booking.com", "Agoda"],
      diffFromRef: -30, diffType: "fixed",
      statuses: buildStatuses(dates, 5),
      ratePlans: [
        { internalId: 401, planId: "plan_flexible_ro", planName: "Flexible RO", planCode: "FLEX_RO", pensionType: "RO", channelType: "OTA", calcMode: "fixed", calcValue: 0, referencePlanId: "", isReference: false, isActive: true, connectivityType: "D-EDGE", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe", "rt_suite", "rt_single", "rt_family"], distributionChannels: ["Booking.com", "Direct"], prices: buildPrices(dates, 120, 20) },
        { internalId: 402, planId: "plan_nr_ro", planName: "NR RO", planCode: "NR_RO", pensionType: "RO", channelType: "OTA", calcMode: "derived", calcValue: 0, referencePlanId: "plan_flexible_ro", isReference: false, isActive: true, connectivityType: "D-EDGE", isConnectivityLocked: true, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe", "rt_family"], distributionChannels: ["Booking.com"], prices: buildPrices(dates, 108, 18) },
      ],
    },
    {
      internalId: 5, roomTypeId: "rt_family", roomTypeName: "Chambre Familiale", roomTypeCode: "FAM-CL",
      capacity: 4, bathroom: "Douche", equipment: ["wifi", "tv", "minibar"], view: "Jardin",
      description: "Chambre familiale spacieuse, idéale pour les familles.",
      isReference: false, isActive: true,
      assignedRatePlanIds: ["plan_flexible_ro", "plan_nr_ro", "plan_flexible_bb", "plan_nr_bb"],
      distributionChannels: ["Booking.com", "Expedia", "Trip.com"],
      diffFromRef: 45, diffType: "fixed",
      statuses: buildStatuses(dates, 3),
      ratePlans: [
        { internalId: 501, planId: "plan_flexible_ro", planName: "Flexible RO", planCode: "FLEX_RO", pensionType: "RO", channelType: "OTA", calcMode: "fixed", calcValue: 0, referencePlanId: "", isReference: false, isActive: true, connectivityType: "D-EDGE", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe", "rt_suite", "rt_single", "rt_family"], distributionChannels: ["Booking.com", "Direct"], prices: buildPrices(dates, 195, 40) },
        { internalId: 502, planId: "plan_nr_ro", planName: "NR RO", planCode: "NR_RO", pensionType: "RO", channelType: "OTA", calcMode: "derived", calcValue: 0, referencePlanId: "plan_flexible_ro", isReference: false, isActive: true, connectivityType: "D-EDGE", isConnectivityLocked: true, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe", "rt_family"], distributionChannels: ["Booking.com"], prices: buildPrices(dates, 175, 35) },
        { internalId: 503, planId: "plan_flexible_bb", planName: "Flexible BB", planCode: "FLEX_BB", pensionType: "BB", channelType: "Direct", calcMode: "derived", calcValue: 15, referencePlanId: "plan_flexible_ro", isReference: false, isActive: true, connectivityType: "Aucun", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard", "rt_double_deluxe"], distributionChannels: ["Direct"], prices: buildPrices(dates, 210, 45) },
        { internalId: 504, planId: "plan_nr_bb", planName: "NR BB", planCode: "NR_BB", pensionType: "BB", channelType: "Mobile", calcMode: "derived", calcValue: 5, referencePlanId: "plan_flexible_ro", isReference: false, isActive: true, connectivityType: "Aucun", isConnectivityLocked: false, assignedRoomTypeIds: ["rt_double_standard"], distributionChannels: ["Mobile"], prices: buildPrices(dates, 200, 40) },
      ],
    },
  ];

  return rooms;
}

export async function fetchCalendarData(startDate: Date, viewMode: ViewMode): Promise<{ roomTypes: RoomTypeData[]; dateColumns: DateColumn[] }> {
  await new Promise(r => setTimeout(r, 200));
  return { roomTypes: generateMockData(startDate, viewMode), dateColumns: generateDateColumns(startDate, viewMode) };
}
