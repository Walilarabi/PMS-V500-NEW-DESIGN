import { create } from "zustand";
import {
  ViewMode, RoomTypeData, DateColumn, PricingRules, AuditLogEntry, ChannelData,
  NewRoomPayload, NewRatePlanPayload, UpdateRoomPayload, UpdateRatePlanPayload,
  CalcMode, RatePlanData
} from "../types";
import { pricingRules } from "../data/mockData";
import { fetchCalendarDataFromSupabase as fetchCalendarData } from "../data/supabaseAdapter";
import { PricingRulesEngine } from "../engines/PricingRulesEngine";
import { CascadePricingEngine } from "../engines/CascadePricingEngine";
import { supabase } from "@/src/lib/supabase";

// ─── Supabase persistence helper ──────────────────────────────────────────
async function persistReferencePriceCascade(
  hotelId: string,
  stayDate: string,
  newPrice: number,
): Promise<{ id: string; price: number }[] | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('cascade_reference_price', {
      p_hotel_id: hotelId,
      p_stay_date: stayDate,
      p_new_price: newPrice,
    });
    if (error) {
      console.warn('[rms-store] cascade RPC failed:', error.message);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data ?? []) as any[]).map((r) => ({
      id: r.out_id ?? r.id,
      price: Number(r.out_price ?? r.price),
    }));
  } catch (err) {
    console.warn('[rms-store] cascade RPC threw:', err);
    return null;
  }
}

async function getCurrentHotelIdSafe(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_user_hotel_id');
    if (error || !data) return null;
    return String(data);
  } catch {
    return null;
  }
}

let _internalIdCounter = 2000;
const nextInternalId = () => ++_internalIdCounter;

interface RateCalendarStore {
  viewMode: ViewMode;
  startDate: Date;
  endDate: Date;
  dateColumns: DateColumn[];
  roomTypes: RoomTypeData[];
  channels: ChannelData[];
  pricingRules: PricingRules;
  isLoading: boolean;
  isSaving: boolean;
  expandedRooms: Record<string, boolean>;
  editedCells: Set<string>;
  auditLogs: AuditLogEntry[];
  lastSaved: Date | null;
  activeCell: { roomTypeId: string; planId: string; date: string } | null;
  rulesEngine: PricingRulesEngine;
  cascadeEngine: CascadePricingEngine;

  // Global UI Panels
  roomPanelOpen: boolean;
  ratePanelOpen: boolean;
  editingRoomId: string | null;
  editingPlanId: string | null;
  openRoomPanel: (roomId?: string | null) => void;
  openRatePanel: (planId?: string | null, roomId?: string | null) => void;
  closeAllPanels: () => void;

  // Filters
  selectedRoomTypeIds: string[];
  selectedPlanNames: string[];
  setSelectedRoomTypeIds: (ids: string[]) => void;
  setSelectedPlanNames: (names: string[]) => void;

  // Calendar Actions
  setViewMode: (mode: ViewMode) => void;
  setStartDate: (date: Date) => void;
  loadData: () => Promise<void>;
  toggleRoom: (roomTypeId: string) => void;
  expandAllRooms: () => void;
  collapseAllRooms: () => void;

  // Price Actions
  updatePrice: (roomTypeId: string, planId: string, date: string, newPrice: number) => void;
  updateInventory: (roomTypeId: string, date: string, newInventory: number) => void;
  updateStayRestriction: (roomTypeId: string, date: string, field: "minStay" | "maxStay", value: number | null) => void;
  updateArrivalDepartureRestriction: (roomTypeId: string, date: string, field: "cta" | "ctd", value: boolean) => void;
  updatePlanRestriction: (roomTypeId: string, planId: string, date: string, closed: boolean) => void;
  updateStatus: (roomTypeId: string, date: string, newStatus: string, newLabel: string) => void;
  markCellEdited: (key: string) => void;
  clearEditedCells: () => void;
  setActiveCell: (cell: { roomTypeId: string; planId: string; date: string } | null) => void;
  getNextEditableCell: (roomTypeId: string, planId: string, date: string, direction: "next" | "prev") => { roomTypeId: string; planId: string; date: string } | null;

  // Channel Actions
  setChannels: (channels: ChannelData[]) => void;
  updateChannel: (channelId: string, updates: Partial<ChannelData>) => void;
  addChannel: (channel: ChannelData) => void;
  deleteChannel: (channelId: string) => void;
  toggleChannelClosed: (channelId: string, date: string) => void;
  reorderChannels: (newChannels: ChannelData[]) => void;

  // Room Ordering
  reorderRoomTypes: (newRoomTypes: RoomTypeData[]) => void;
  resetRoomTypesOrder: () => void;

  // CRUD
  addRoomType: (payload: NewRoomPayload) => void;
  updateRoomType: (payload: UpdateRoomPayload) => void;
  deleteRoomType: (roomTypeId: string) => void;
  toggleRoomActive: (roomTypeId: string) => void;
  setRoomAsReference: (roomTypeId: string) => void;
  addRatePlan: (payload: NewRatePlanPayload) => void;
  updateRatePlan: (payload: UpdateRatePlanPayload) => void;
  deleteRatePlan: (roomTypeId: string, planId: string) => void;
  toggleRatePlanActive: (roomTypeId: string, planId: string) => void;
  duplicateRatePlan: (roomTypeId: string, planId: string) => void;

  // Helpers
  getCellKey: (roomTypeId: string, planId: string, date: string) => string;
  addAuditLog: (entry: Omit<AuditLogEntry, "id" | "at">) => void;
}

// ✅ Date initiale = AUJOURD'HUI (pas hardcodée)
const initialStartDate = (() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
})();

export const useRateCalendarStore = create<RateCalendarStore>((set, get) => {
  const rulesEngine = new PricingRulesEngine(pricingRules);
  const cascadeEngine = new CascadePricingEngine(rulesEngine);

  return {
    viewMode: "1month",
    startDate: initialStartDate,
    endDate: new Date(initialStartDate.getTime() + 30 * 24 * 60 * 60 * 1000),
    dateColumns: [],
    roomTypes: [],
    channels: [],
    pricingRules: pricingRules,
    isLoading: false,
    isSaving: false,
    expandedRooms: {},
    editedCells: new Set(),
    auditLogs: [],
    lastSaved: null,
    activeCell: null,
    rulesEngine,
    cascadeEngine,

    roomPanelOpen: false,
    ratePanelOpen: false,
    editingRoomId: null,
    editingPlanId: null,
    openRoomPanel: (roomId = null) => set({ roomPanelOpen: true, ratePanelOpen: false, editingRoomId: roomId }),
    openRatePanel: (planId = null, roomId = null) => set({ ratePanelOpen: true, roomPanelOpen: false, editingPlanId: planId, editingRoomId: roomId }),
    closeAllPanels: () => set({ roomPanelOpen: false, ratePanelOpen: false, editingRoomId: null, editingPlanId: null }),

    selectedRoomTypeIds: [],
    selectedPlanNames: [],
    setSelectedRoomTypeIds: (ids) => set({ selectedRoomTypeIds: ids }),
    setSelectedPlanNames: (names) => set({ selectedPlanNames: names }),

    setViewMode: (mode) => { set({ viewMode: mode }); get().loadData(); },
    setStartDate: (date) => { set({ startDate: date }); get().loadData(); },

    loadData: async () => {
      const { startDate, viewMode } = get();
      set({ isLoading: true });
      try {
        let { roomTypes, dateColumns } = await fetchCalendarData(startDate, viewMode);
        
        // ✅ Appliquer ordre sauvegardé utilisateur
        const savedOrder = localStorage.getItem('flowtym_room_order');
        if (savedOrder) {
          try {
            const orderArray: string[] = JSON.parse(savedOrder);
            const orderMap = new Map(orderArray.map((id, idx) => [id, idx]));
            roomTypes = roomTypes.sort((a, b) => {
              const aIdx = orderMap.get(a.roomTypeId) ?? 999;
              const bIdx = orderMap.get(b.roomTypeId) ?? 999;
              return aIdx - bIdx;
            });
          } catch (e) {
            console.warn('[RMS] Failed to apply saved room order:', e);
          }
        }
        
        const expandedRooms: Record<string, boolean> = {};
        roomTypes.forEach((rt) => { expandedRooms[rt.roomTypeId] = true; });
        const roomIds = roomTypes.map(r => r.roomTypeId);
        const planNames = Array.from(new Set(roomTypes.flatMap(r => r.ratePlans.map(p => p.planName))));
        set({ roomTypes, dateColumns, expandedRooms, isLoading: false, selectedRoomTypeIds: roomIds, selectedPlanNames: planNames });
      } catch { set({ isLoading: false }); }
    },

    toggleRoom: (roomTypeId) => set((s) => ({ expandedRooms: { ...s.expandedRooms, [roomTypeId]: !s.expandedRooms[roomTypeId] } })),
    expandAllRooms: () => set((s) => { const e: Record<string, boolean> = {}; s.roomTypes.forEach(rt => e[rt.roomTypeId] = true); return { expandedRooms: e }; }),
    collapseAllRooms: () => set((s) => { const e: Record<string, boolean> = {}; s.roomTypes.forEach(rt => e[rt.roomTypeId] = false); return { expandedRooms: e }; }),

    updatePrice: (roomTypeId, planId, date, newPrice) => {
      const { roomTypes, rulesEngine, cascadeEngine } = get();
      const key = `${roomTypeId}:${planId}:${date}`;
      if (!rulesEngine.isReferenceRoom(roomTypeId)) {
        get().addAuditLog({ action: "price_update_ignored", target: key, detail: "Seule la chambre de référence pilote la cascade.", result: "ignored" });
        return;
      }
      const updated = rulesEngine.isReferencePlan(planId)
        ? cascadeEngine.updateReferencePrice(roomTypes, date, newPrice)
        : cascadeEngine.updateReferenceRoomPlanPrice(roomTypes, planId, date, newPrice);
      set((s) => ({ roomTypes: updated, editedCells: new Set([...s.editedCells, key]), lastSaved: new Date() }));
      get().addAuditLog({ action: "price_cascade", target: key, detail: `Prix ${newPrice} EUR propagé.`, result: "accepted" });

      // ─── Persist to Supabase (fire-and-forget) ────────────────────────
      // The local cascade engine already updated the UI optimistically.
      // We now ask the server to do the SAME cascade authoritatively, so
      // that the values are persisted and audited. If the server cascade
      // returns different prices (because pricing_rules in DB diverge from
      // local cascade engine), we silently realign on the next loadData().
      if (rulesEngine.isReferencePlan(planId)) {
        // Only the reference plan triggers full cascade on the server
        getCurrentHotelIdSafe().then((hotelId) => {
          if (!hotelId) return;
          persistReferencePriceCascade(hotelId, date, newPrice).then((result) => {
            if (result === null) {
              get().addAuditLog({
                action: 'price_persist_failed',
                target: key,
                detail: 'Supabase cascade RPC failed — local changes only.',
                result: 'failed',
              });
            }
          });
        });
      } else {
        // Non-reference plan: just persist this single cell
        const room = roomTypes.find((r) => r.roomTypeId === roomTypeId);
        const plan = room?.ratePlans.find((p) => p.planId === planId);
        const cell = plan?.prices.find((c) => c.date === date);
        if (cell?.priceId && typeof cell.priceVersion === 'number') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from('rate_prices')
            .update({
              price: newPrice,
              source: 'manual',
              version: cell.priceVersion + 1,
            })
            .eq('id', cell.priceId)
            .eq('version', cell.priceVersion)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then(({ error }: any) => {
              if (error) {
                get().addAuditLog({
                  action: 'price_persist_failed',
                  target: key,
                  detail: error.message || 'Update failed',
                  result: 'failed',
                });
              }
            });
        }
      }
    },

    updateInventory: (roomTypeId, date, newInventory) => {
      const { roomTypes, cascadeEngine } = get();
      const target = roomTypes.find(r => r.roomTypeId === roomTypeId);
      const cap = target?.capacity ?? 0;
      const hotelCap = roomTypes.reduce((sum, r) => sum + (r.statuses.find(s => s.date === date)?.capacity ?? r.capacity ?? 0), 0);
      const maxOB = Math.floor(hotelCap * 0.1);
      const existingOB = roomTypes.reduce((sum, r) => { if (r.roomTypeId === roomTypeId) return sum; const st = r.statuses.find(s => s.date === date); return sum + Math.max(0, (st?.inventory ?? 0) - (st?.capacity ?? r.capacity ?? 0)); }, 0);
      if (existingOB + Math.max(0, newInventory - cap) > maxOB) {
        get().addAuditLog({ action: "inventory_force_open_ignored", target: `${roomTypeId}:${date}`, detail: `Surbooking refusé.`, result: "ignored" });
        return;
      }
      set({ roomTypes: cascadeEngine.updateInventory(roomTypes, roomTypeId, date, newInventory) });
    },

    updateStayRestriction: (roomTypeId, date, field, value) => {
      const { roomTypes, cascadeEngine } = get();
      set({ roomTypes: cascadeEngine.updateStayRestriction(roomTypes, roomTypeId, date, field, value) });
    },

    updateArrivalDepartureRestriction: (roomTypeId, date, field, value) => {
      const { roomTypes, cascadeEngine } = get();
      set({ roomTypes: cascadeEngine.updateArrivalDepartureRestriction(roomTypes, roomTypeId, date, field, value) });
    },

    updatePlanRestriction: (roomTypeId, planId, date, closed) => {
      const { roomTypes, cascadeEngine } = get();
      set({ roomTypes: cascadeEngine.updatePlanRestriction(roomTypes, roomTypeId, planId, date, closed) });
    },

    updateStatus: (roomTypeId, date, newStatus, newLabel) => {
      const { roomTypes, cascadeEngine } = get();
      set({ roomTypes: cascadeEngine.updateStatus(roomTypes, roomTypeId, date, newStatus, newLabel) });
    },

    markCellEdited: (key) => set((s) => ({ editedCells: new Set([...s.editedCells, key]) })),
    clearEditedCells: () => set({ editedCells: new Set() }),
    setActiveCell: (cell) => set({ activeCell: cell }),

    getNextEditableCell: (roomTypeId, planId, date, direction) => {
      const { roomTypes, dateColumns } = get();
      let di = dateColumns.findIndex(d => d.date === date);
      if (di < 0) return null;
      if (direction === "next" && di < dateColumns.length - 1) return { roomTypeId, planId, date: dateColumns[di + 1].date };
      if (direction === "prev" && di > 0) return { roomTypeId, planId, date: dateColumns[di - 1].date };
      return null;
    },

    setChannels: (channels) => set({ channels }),
    updateChannel: (channelId, updates) => set((s) => ({ channels: s.channels.map(ch => ch.channelId === channelId ? { ...ch, ...updates } : ch) })),
    addChannel: (channel) => set((s) => ({ channels: [...s.channels, channel] })),
    deleteChannel: (channelId) => set((s) => ({ channels: s.channels.filter(ch => ch.channelId !== channelId) })),
    toggleChannelClosed: (channelId, date) => set((s) => ({
      channels: s.channels.map((ch) => {
        if (ch.channelId !== channelId) return ch;
        const closed = ch.closedDates.includes(date);
        return { ...ch, closedDates: closed ? ch.closedDates.filter(d => d !== date) : [...ch.closedDates, date] };
      }),
    })),
    reorderChannels: (newChannels) => set({ channels: newChannels }),

    // ─── Room Ordering ────────────────────────────────────────────────
    reorderRoomTypes: (newRoomTypes) => {
      set({ roomTypes: newRoomTypes });
      // Persister ordre dans localStorage
      const order = newRoomTypes.map(r => r.roomTypeId);
      localStorage.setItem('flowtym_room_order', JSON.stringify(order));
    },

    resetRoomTypesOrder: () => {
      localStorage.removeItem('flowtym_room_order');
      // Recharger pour ordre par défaut
      get().loadData();
    },

    addRoomType: (payload) => set((state) => {
      const roomTypeId = `rt_${payload.roomCode.toLowerCase()}`;
      const statuses = state.dateColumns.map(dc => ({
        date: dc.date, status: "open" as const, label: "Disponible", capacity: payload.capacity,
        inventory: payload.capacity, sold: 0, override: null, minStay: null, maxStay: null, cta: false, ctd: false,
      }));
      const newRoom: RoomTypeData = {
        internalId: nextInternalId(), roomTypeId, roomTypeName: payload.roomName, roomTypeCode: payload.roomCode,
        capacity: payload.capacity, bathroom: payload.bathroom, equipment: payload.equipment, view: payload.view,
        description: payload.description, isReference: payload.isReference, isActive: true,
        assignedRatePlanIds: payload.assignedRatePlanIds, distributionChannels: payload.distributionChannels,
        diffFromRef: payload.diffFromRef, diffType: payload.diffType, statuses, ratePlans: [],
      };
      return { roomTypes: [...state.roomTypes, newRoom], expandedRooms: { ...state.expandedRooms, [roomTypeId]: true } };
    }),

    updateRoomType: (payload) => set((state) => ({
      roomTypes: state.roomTypes.map(r => r.roomTypeId === payload.roomTypeId ? { ...r, ...payload } : r),
    })),

    deleteRoomType: (roomTypeId) => set((s) => ({ roomTypes: s.roomTypes.filter(r => r.roomTypeId !== roomTypeId) })),
    toggleRoomActive: (roomTypeId) => set((s) => ({ roomTypes: s.roomTypes.map(r => r.roomTypeId === roomTypeId ? { ...r, isActive: !r.isActive } : r) })),
    setRoomAsReference: (roomTypeId) => set((s) => ({ roomTypes: s.roomTypes.map(r => ({ ...r, isReference: r.roomTypeId === roomTypeId })) })),

    addRatePlan: (payload) => set((state) => {
      const planId = `plan_${payload.planCode.toLowerCase()}`;
      const newPlan: RatePlanData = {
        internalId: nextInternalId(), planId, planName: payload.planName, planCode: payload.planCode,
        pensionType: payload.pensionType, channelType: payload.channelType, calcMode: payload.calcMode,
        calcValue: payload.calcValue, referencePlanId: payload.referencePlanId, isReference: false,
        isActive: true, connectivityType: payload.connectivityType, isConnectivityLocked: false,
        assignedRoomTypeIds: payload.assignedRoomTypeIds, distributionChannels: payload.distributionChannels, prices: [],
      };
      (newPlan as any).calcPercent = (payload as any).calcPercent || 0;
      return { roomTypes: state.roomTypes.map(r => payload.assignedRoomTypeIds.includes(r.roomTypeId) ? { ...r, ratePlans: [...r.ratePlans, newPlan] } : r) };
    }),

    updateRatePlan: (payload) => set((state) => ({
      roomTypes: state.roomTypes.map(r => ({
        ...r,
        ratePlans: r.ratePlans.map(rp => rp.planId === payload.planId ? { ...rp, ...payload } : rp),
      })),
    })),

    deleteRatePlan: (roomTypeId, planId) => set((s) => ({
      roomTypes: s.roomTypes.map(r => r.roomTypeId === roomTypeId ? { ...r, ratePlans: r.ratePlans.filter(p => p.planId !== planId) } : r)
    })),

    toggleRatePlanActive: (roomTypeId, planId) => set((s) => ({
      roomTypes: s.roomTypes.map(r => r.roomTypeId === roomTypeId ? { ...r, ratePlans: r.ratePlans.map(p => p.planId === planId ? { ...p, isActive: !p.isActive } : p) } : r)
    })),

    getCellKey: (ri, pi, d) => `${ri}:${pi}:${d}`,
    addAuditLog: (entry) => {
      const log = { ...entry, id: Math.random().toString(36).slice(2), at: new Date().toLocaleTimeString("fr-FR") };
      set((s) => ({ auditLogs: [log as AuditLogEntry, ...s.auditLogs].slice(0, 8) }));
    },
  };
});
