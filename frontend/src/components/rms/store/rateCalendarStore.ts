import { create } from "zustand";
import {
  ViewMode, RoomTypeData, DateColumn, PricingRules, AuditLogEntry, ChannelData,
  NewRoomPayload, NewRatePlanPayload, UpdateRoomPayload, UpdateRatePlanPayload,
  CalcMode, RatePlanData
} from "../types";
import { pricingRules } from "../data/mockData";
import { fetchCalendarDataFromSupabase as fetchCalendarData } from "../data/supabaseAdapter";
import { fetchCalendarData as fetchCalendarDataMock } from "../data/mockData";
import { PricingRulesEngine } from "../engines/PricingRulesEngine";
import { CascadePricingEngine } from "../engines/CascadePricingEngine";
import { propagateVirtualRoomCascade, rebuildAllVirtualInventories } from "../engines/VirtualRoomCascadeEngine";
import { dedupRoomTypes } from "../engines/RateCalendarDedupEngine";
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
  loadError: string | null;
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
  reorderRatePlans: (roomTypeId: string, newRatePlans: RatePlanData[]) => void;
  resetRatePlansOrder: (roomTypeId?: string) => void;
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

  // Phase 8 — garde-fou universel : intercepte TOUS les `set({ roomTypes: ... })`
  // et applique dedupRoomTypes avant de stocker. Garantit qu'aucun chemin
  // d'écriture (mutation locale, import, RMS push, cascade, supabase load)
  // ne peut produire de doublons dans le store.
  type SetterArg = Parameters<typeof set>[0];
  const safeSet = (partial: SetterArg) => {
    if (typeof partial === 'function') {
      set((state) => {
        const next = (partial as (s: RateCalendarStore) => Partial<RateCalendarStore>)(state);
        if (next && 'roomTypes' in next && Array.isArray((next as { roomTypes?: unknown }).roomTypes)) {
          return { ...next, roomTypes: dedupRoomTypes((next as { roomTypes: RoomTypeData[] }).roomTypes) };
        }
        return next;
      });
    } else if (partial && typeof partial === 'object' && 'roomTypes' in partial && Array.isArray((partial as { roomTypes?: unknown }).roomTypes)) {
      set({ ...partial, roomTypes: dedupRoomTypes((partial as { roomTypes: RoomTypeData[] }).roomTypes) } as SetterArg);
    } else {
      set(partial);
    }
  };
  // Remplace `set` par `safeSet` dans le scope du store
  set = safeSet as typeof set;

  return {
    viewMode: "1month",
    startDate: initialStartDate,
    endDate: new Date(initialStartDate.getTime() + 30 * 24 * 60 * 60 * 1000),
    dateColumns: [],
    roomTypes: [],
    channels: [],
    pricingRules: pricingRules,
    isLoading: false,
    loadError: null,
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
      set({ isLoading: true, loadError: null });

      // Timeout 3s : évite que la page « mouline dans le vide » si Supabase
      // / le RPC get_user_hotel_id ne répond jamais. On retombe sur les mocks
      // ou on signale l'erreur à l'utilisateur. 3s est un compromis UX :
      // suffisant pour un RPC sain (< 500ms typique), trop court pour qu'un
      // utilisateur perçoive un mouline.
      const timeoutMs = 3_000;
      const fetchWithTimeout = (): Promise<Awaited<ReturnType<typeof fetchCalendarData>>> =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`Chargement du calendrier > ${timeoutMs / 1000}s — délai dépassé`)),
            timeoutMs,
          );
          fetchCalendarData(startDate, viewMode).then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); },
          );
        });

      try {
        let { roomTypes, dateColumns } = await fetchWithTimeout();

        // ✅ Appliquer ordre sauvegardé utilisateur (rooms)
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
        } else {
          // ✅ Défaut : chambre référente en premier
          roomTypes = [...roomTypes].sort((a, b) => {
            if (a.isReference && !b.isReference) return -1;
            if (!a.isReference && b.isReference) return 1;
            return 0;
          });
        }

        // ✅ Appliquer ordre sauvegardé utilisateur (rate plans) + défaut référent
        const savedPlanOrderRaw = localStorage.getItem('flowtym_plan_order');
        let savedPlanOrder: Record<string, string[]> = {};
        if (savedPlanOrderRaw) {
          try {
            savedPlanOrder = JSON.parse(savedPlanOrderRaw);
          } catch (e) {
            console.warn('[RMS] Failed to parse saved plan order:', e);
          }
        }
        roomTypes = roomTypes.map((rt) => {
          const orderForRoom = savedPlanOrder[rt.roomTypeId];
          let plans = [...rt.ratePlans];
          if (orderForRoom && orderForRoom.length > 0) {
            const orderMap = new Map(orderForRoom.map((id, idx) => [id, idx]));
            plans.sort((a, b) => {
              const aIdx = orderMap.get(a.planId) ?? 999;
              const bIdx = orderMap.get(b.planId) ?? 999;
              return aIdx - bIdx;
            });
          } else {
            // Défaut : plan référent en premier
            plans.sort((a, b) => {
              if (a.isReference && !b.isReference) return -1;
              if (!a.isReference && b.isReference) return 1;
              return 0;
            });
          }
          return { ...rt, ratePlans: plans };
        });

        // ─── Déduplication défensive (Phase 4 — bug calendrier) ──────────
        // Élimine les doublons de plans tarifaires (même planCode) et de
        // statuses (même date) qui causaient le bug "3 lignes tarifaires
        // dupliquées + dédoublement Ouverture/Fermeture". Stable : le plus
        // récent gagne, l'ordre est préservé.
        roomTypes = dedupRoomTypes(roomTypes);

        const expandedRooms: Record<string, boolean> = {};
        roomTypes.forEach((rt) => { expandedRooms[rt.roomTypeId] = true; });
        const roomIds = roomTypes.map(r => r.roomTypeId);
        const planNames = Array.from(new Set(roomTypes.flatMap(r => r.ratePlans.map(p => p.planName))));
        // Recalcule l'inventaire des chambres virtuelles à partir de leurs
        // composantes physiques (cohérence après chargement).
        const roomTypesWithVirtual = rebuildAllVirtualInventories(roomTypes);
        set({ roomTypes: roomTypesWithVirtual, dateColumns, expandedRooms, isLoading: false, loadError: null, selectedRoomTypeIds: roomIds, selectedPlanNames: planNames });
      } catch (err) {
        // En cas de timeout ou erreur Supabase, fallback immédiat sur le mock
        // au lieu de bloquer l'utilisateur sur un fallback erreur. C'est ce
        // qu'attend un utilisateur du PMS : voir DES données (mocks) plutôt
        // qu'un message d'erreur opaque.
        const message = err instanceof Error ? err.message : 'Erreur inconnue lors du chargement';
        console.warn('[rateCalendarStore] loadData failed, falling back to mock:', message);
        try {
          const mockData = await fetchCalendarDataMock(startDate, viewMode);
          const dateColumns = mockData.dateColumns;
          const cleanRoomTypes = rebuildAllVirtualInventories(dedupRoomTypes(mockData.roomTypes));
          const expandedRooms: Record<string, boolean> = {};
          cleanRoomTypes.forEach((rt) => { expandedRooms[rt.roomTypeId] = true; });
          const roomIds = cleanRoomTypes.map((r) => r.roomTypeId);
          const planNames = Array.from(new Set(cleanRoomTypes.flatMap((r) => r.ratePlans.map((p) => p.planName))));
          set({ roomTypes: cleanRoomTypes, dateColumns, expandedRooms, isLoading: false, loadError: null, selectedRoomTypeIds: roomIds, selectedPlanNames: planNames });
        } catch (mockErr) {
          console.error('[rateCalendarStore] mock fallback failed:', mockErr);
          set({ isLoading: false, loadError: message });
        }
      }
    },

    toggleRoom: (roomTypeId) => set((s) => ({ expandedRooms: { ...s.expandedRooms, [roomTypeId]: !s.expandedRooms[roomTypeId] } })),
    expandAllRooms: () => set((s) => { const e: Record<string, boolean> = {}; s.roomTypes.forEach(rt => e[rt.roomTypeId] = true); return { expandedRooms: e }; }),
    collapseAllRooms: () => set((s) => { const e: Record<string, boolean> = {}; s.roomTypes.forEach(rt => e[rt.roomTypeId] = false); return { expandedRooms: e }; }),

    updatePrice: (roomTypeId, planId, date, newPrice) => {
      const { roomTypes, rulesEngine } = get();
      const key = `${roomTypeId}:${planId}:${date}`;
      
      // ✅ ÉDITION DIRECTE : Update prix sans cascade pour l'instant
      // La cascade sera réactivée plus tard comme option
      const room = roomTypes.find((r) => r.roomTypeId === roomTypeId);
      const plan = room?.ratePlans.find((p) => p.planId === planId);
      const cell = plan?.prices.find((c) => c.date === date);
      
      if (!room || !plan || !cell) {
        get().addAuditLog({ action: "price_update_failed", target: key, detail: "Cellule introuvable", result: "failed" });
        return;
      }
      
      // Update local state
      const updatedRoomTypes = roomTypes.map(r => {
        if (r.roomTypeId !== roomTypeId) return r;
        return {
          ...r,
          ratePlans: r.ratePlans.map(p => {
            if (p.planId !== planId) return p;
            return {
              ...p,
              prices: p.prices.map(pr => 
                pr.date === date ? { ...pr, price: newPrice } : pr
              )
            };
          })
        };
      });
      
      set((s) => ({ 
        roomTypes: updatedRoomTypes, 
        editedCells: new Set([...s.editedCells, key]), 
        lastSaved: new Date() 
      }));
      
      get().addAuditLog({ action: "price_updated", target: key, detail: `Prix ${newPrice} EUR`, result: "accepted" });

      // ─── Persist to Supabase ────────────────────────
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
      // ✅ Update local state immédiatement (optimistic) puis propage la
      // cascade des chambres virtuelles (composantes ↔ virtuelle).
      const afterCascade = cascadeEngine.updateInventory(roomTypes, roomTypeId, date, newInventory);
      const afterVirtual = propagateVirtualRoomCascade(afterCascade, roomTypeId, date);
      set({ roomTypes: afterVirtual });

      // ✅ Persister override manuel en Supabase
      const status = target?.statuses.find(s => s.date === date);
      const overrideType = newInventory === 0 ? 'manual_closed' : newInventory > cap ? 'force_open' : 'manual';
      getCurrentHotelIdSafe().then(async (hotelId) => {
        if (!hotelId) return;
        try {
          if (status?.restrictionId) {
            // Upsert sur restriction existante
            await (supabase as any)
              .from('rate_restrictions')
              .update({
                inventory: newInventory,
                inventory_override: overrideType,
                version: (status.restrictionVersion ?? 0) + 1,
              })
              .eq('id', status.restrictionId);
          } else {
            // Créer nouvelle restriction
            await (supabase as any)
              .from('rate_restrictions')
              .insert({
                hotel_id: hotelId,
                room_type_code: roomTypeId,
                stay_date: date,
                inventory: newInventory,
                capacity: cap,
                inventory_override: overrideType,
                version: 1,
              });
          }
          get().addAuditLog({
            action: 'inventory_manual_override',
            target: `${roomTypeId}:${date}`,
            detail: `Inventaire manuel: ${newInventory} (${overrideType})`,
            result: 'accepted',
          });
        } catch (err) {
          console.warn('[rms-store] inventory persist failed:', err);
        }
      });
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

    // ─── Rate Plan Ordering ───────────────────────────────────────────
    reorderRatePlans: (roomTypeId, newRatePlans) => {
      set((s) => ({
        roomTypes: s.roomTypes.map((r) =>
          r.roomTypeId === roomTypeId ? { ...r, ratePlans: newRatePlans } : r
        ),
      }));
      try {
        const raw = localStorage.getItem('flowtym_plan_order');
        const all: Record<string, string[]> = raw ? JSON.parse(raw) : {};
        all[roomTypeId] = newRatePlans.map((p) => p.planId);
        localStorage.setItem('flowtym_plan_order', JSON.stringify(all));
      } catch (e) {
        console.warn('[RMS] Failed to persist plan order:', e);
      }
    },

    resetRatePlansOrder: (roomTypeId) => {
      try {
        const raw = localStorage.getItem('flowtym_plan_order');
        if (!raw) {
          get().loadData();
          return;
        }
        const all: Record<string, string[]> = JSON.parse(raw);
        if (roomTypeId) {
          delete all[roomTypeId];
          localStorage.setItem('flowtym_plan_order', JSON.stringify(all));
        } else {
          localStorage.removeItem('flowtym_plan_order');
        }
      } catch {
        localStorage.removeItem('flowtym_plan_order');
      }
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
        isVirtual: payload.isVirtual,
        virtualKind: payload.virtualKind,
        virtualComposition: payload.virtualComposition,
      };
      return { roomTypes: [...state.roomTypes, newRoom], expandedRooms: { ...state.expandedRooms, [roomTypeId]: true } };
    }),

    updateRoomType: (payload) => set((state) => ({
      roomTypes: state.roomTypes.map(r => r.roomTypeId === payload.roomTypeId ? { ...r, ...payload } : r),
    })),

    deleteRoomType: (roomTypeId) => set((s) => ({ roomTypes: s.roomTypes.filter(r => r.roomTypeId !== roomTypeId) })),
    toggleRoomActive: (roomTypeId) => set((s) => ({ roomTypes: s.roomTypes.map(r => r.roomTypeId === roomTypeId ? { ...r, isActive: !r.isActive } : r) })),
    setRoomAsReference: (roomTypeId) => set((s) => {
      const next = s.roomTypes.map(r => ({ ...r, isReference: r.roomTypeId === roomTypeId }));
      // Si aucun ordre custom enregistré, replacer la nouvelle référence en tête
      const hasCustomOrder = !!localStorage.getItem('flowtym_room_order');
      if (!hasCustomOrder) {
        next.sort((a, b) => {
          if (a.isReference && !b.isReference) return -1;
          if (!a.isReference && b.isReference) return 1;
          return 0;
        });
      }
      return { roomTypes: next };
    }),

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
