/**
 * FLOWTYM — RateManagerPanel
 *
 * Drawer CRUD complet pour les grilles tarifaires.
 *
 * T4 — Améliorations :
 *   • 34 partenaires groupés par catégorie + champ primaryPartnerId
 *   • Validation inline (name + code obligatoires, bordures rouge + message)
 *   • isSaving + spinner sur le bouton de sauvegarde
 *   • Toast succès / erreur inline, auto-dismiss 3 s
 *   • Fermeture auto du formulaire après succès (1 s)
 *   • Correction du bug submit (condition editingPlanId retirée)
 *   • Recherche fonctionnelle sur nom & code
 *   • Empty state avec CTA
 *   • Star icon pour les plans référents
 *   • Harmonisation visuelle avec RoomManagerPanel (footer, labels, max-w-2xl)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator, CheckCircle, Copy, Info, Loader2,
  Pencil, Plus, Search, Star, Tag, Trash2, X,
} from "lucide-react";
import type {
  CalcMode, ChannelType, ConnectivityType, PensionType, RatePlanData,
} from "../types";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { cn } from "../utils/cn";
import {
  PARTNER_CATEGORIES, PARTNER_CATEGORY_ORDER,
} from "@/src/constants/partners";

// ─── Constantes ──────────────────────────────────────────────────────────────

const PENSION_OPTIONS: PensionType[]      = ["RO", "BB", "HB", "FB", "AI", "Package"];
const CHANNEL_OPTIONS: ChannelType[]      = ["OTA", "Mobile", "Corporate", "Direct"];
const CONNECTIVITY_OPTIONS: ConnectivityType[] = ["D-EDGE", "ChannelManager", "Aucun"];

// ─── PartnerMultiCheck ────────────────────────────────────────────────────────

function PartnerMultiCheck({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      {PARTNER_CATEGORY_ORDER.map((catKey) => {
        const cat = PARTNER_CATEGORIES[catKey];
        if (!cat) return null;
        return (
          <div key={catKey}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              {cat.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cat.partners.map((p) => {
                const active = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onChange(
                        active
                          ? selected.filter((s) => s !== p.id)
                          : [...selected, p.id]
                      )
                    }
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs border transition-colors",
                      active
                        ? "border-violet-500 bg-violet-500 text-white"
                        : "border-slate-200 text-slate-500 hover:border-violet-300 hover:bg-violet-50"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Types internes ───────────────────────────────────────────────────────────

interface RateFormState {
  name: string;
  code: string;
  pensionType: PensionType;
  channelType: ChannelType;
  calcMode: CalcMode;
  calcValue: number;
  calcPercent: number;
  referencePlanId: string;
  connectivityType: ConnectivityType;
  assignedRoomTypeIds: string[];
  partnerIds: string[];
  primaryPartnerId: string;
}

interface TouchedState {
  name: boolean;
  code: boolean;
}

interface ToastMsg {
  type: "success" | "error";
  msg: string;
}

// ─── Blank form ───────────────────────────────────────────────────────────────

const blankForm = (): RateFormState => ({
  name:               "",
  code:               "",
  pensionType:        "RO",
  channelType:        "OTA",
  calcMode:           "fixed",
  calcValue:          0,
  calcPercent:        0,
  referencePlanId:    "",
  connectivityType:   "Aucun",
  assignedRoomTypeIds: [],
  partnerIds:         ["direct", "booking-com"],
  primaryPartnerId:   "booking-com",
});

// ─── RateManagerPanel ─────────────────────────────────────────────────────────

export function RateManagerPanel() {
  const {
    roomTypes,
    addRatePlan, updateRatePlan, deleteRatePlan,
    toggleRatePlanActive, duplicateRatePlan,
    ratePanelOpen, closeAllPanels,
    editingPlanId, editingRoomId,
  } = useRateCalendarStore();

  // ── UI state ────────────────────────────────────────────────────────────
  const [showForm,       setShowForm]       = useState(false);
  const [selectedKey,    setSelectedKey]    = useState<string | null>(null);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [isSaving,       setIsSaving]       = useState(false);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  const [toast,          setToast]          = useState<ToastMsg | null>(null);
  const [touched,        setTouched]        = useState<TouchedState>({ name: false, code: false });

  const [form, setForm] = useState<RateFormState>(blankForm);

  const ref = useRef<HTMLDivElement>(null);

  // ── Derived data ─────────────────────────────────────────────────────────

  const allPlans = useMemo(
    () =>
      Array.from(
        new Map(
          roomTypes.flatMap((rt) => rt.ratePlans.map((rp) => [rp.planId, rp]))
        ).values()
      ),
    [roomTypes]
  );

  /** Plans enrichis avec la chambre d'appartenance et son roomTypeId */
  const flatPlans = useMemo(
    () =>
      allPlans.map((plan) => {
        const firstRoom = roomTypes.find((rt) =>
          rt.ratePlans.some((rp) => rp.planId === plan.planId)
        );
        const planInRoom = firstRoom?.ratePlans.find(
          (rp) => rp.planId === plan.planId
        );
        return {
          plan,
          planInRoom,
          roomId: firstRoom?.roomTypeId ?? "",
        };
      }),
    [allPlans, roomTypes]
  );

  const filteredPlans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return flatPlans;
    return flatPlans.filter(
      ({ plan }) =>
        plan.planName.toLowerCase().includes(q) ||
        plan.planCode.toLowerCase().includes(q)
    );
  }, [flatPlans, searchQuery]);

  /** Prévisualisation de la formule dérivée */
  const previewResult = useMemo(() => {
    if (form.calcMode === "fixed") return "Prix saisi manuellement";
    const base = 100;
    const final = base + base * (form.calcPercent / 100) + form.calcValue;
    return `${final.toFixed(2)} € (pour une base de 100 €)`;
  }, [form.calcMode, form.calcPercent, form.calcValue]);

  // ── Effects ──────────────────────────────────────────────────────────────

  /** Réaction au trigger externe (clic dans le calendrier) */
  useEffect(() => {
    if (!ratePanelOpen) return;
    if (editingPlanId) {
      const roomId = editingRoomId ?? roomTypes[0]?.roomTypeId ?? "";
      openEdit(roomId, editingPlanId);
    } else {
      setShowForm(false);
      setSelectedKey(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratePanelOpen, editingPlanId, editingRoomId]);

  /** Auto-dismiss du toast */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(blankForm());
    setSelectedKey(null);
    setTouched({ name: false, code: false });
    setIsSaving(false);
  };

  const populateForm = useCallback(
    (plan: RatePlanData) => {
      const isOldPercent   = (plan.calcMode as string) === "percent_ref";
      const isOldFixedAdj  = (plan.calcMode as string) === "fixed_adjusted";
      setForm({
        name:                plan.planName,
        code:                plan.planCode,
        pensionType:         plan.pensionType,
        channelType:         plan.channelType,
        calcMode:            isOldPercent || isOldFixedAdj ? "derived" : plan.calcMode,
        calcValue:           isOldFixedAdj ? plan.calcValue : 0,
        calcPercent:         isOldPercent  ? plan.calcValue : 0,
        referencePlanId:     plan.referencePlanId ?? "",
        connectivityType:    plan.connectivityType,
        assignedRoomTypeIds: plan.assignedRoomTypeIds ?? [],
        partnerIds:          plan.partnerIds ?? plan.distributionChannels ?? ["direct"],
        primaryPartnerId:    plan.primaryPartnerId ?? "",
      });
      setSelectedKey(plan.planId);
      setTouched({ name: false, code: false });
      setIsSaving(false);
      setShowForm(true);
    },
    []
  );

  const openAdd = () => {
    resetForm();
    setForm((f) => ({ ...f, referencePlanId: allPlans[0]?.planId ?? "" }));
    setShowForm(true);
  };

  const openEdit = (rtId: string, pId: string) => {
    // Cherche d'abord dans la chambre indiquée, puis globalement
    const plan =
      roomTypes.find((r) => r.roomTypeId === rtId)
               ?.ratePlans.find((p) => p.planId === pId)
      ?? allPlans.find((p) => p.planId === pId);
    if (plan) populateForm(plan);
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    setTouched({ name: true, code: true });
    if (!form.name.trim() || !form.code.trim()) return;

    setIsSaving(true);
    try {
      const payload = {
        planName:            form.name.trim(),
        planCode:            form.code.trim().toUpperCase(),
        pensionType:         form.pensionType,
        channelType:         form.channelType,
        calcMode:            form.calcMode,
        calcValue:           form.calcMode === "derived" ? form.calcValue   : 0,
        calcPercent:         form.calcMode === "derived" ? form.calcPercent : 0,
        referencePlanId:     form.referencePlanId,
        connectivityType:    form.connectivityType,
        assignedRoomTypeIds:
          form.assignedRoomTypeIds.length > 0
            ? form.assignedRoomTypeIds
            : roomTypes.map((r) => r.roomTypeId),
        distributionChannels: form.partnerIds,      // rétro-compat
        partnerIds:           form.partnerIds,
        primaryPartnerId:     form.primaryPartnerId || undefined,
      };

      if (selectedKey) {
        updateRatePlan({ ...payload, planId: selectedKey });
      } else {
        addRatePlan({
          ...payload,
          minStay:             null,
          maxStay:             null,
          cancellationPolicy:  "",
          mealPlan:            form.pensionType,
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      }

      setToast({
        type: "success",
        msg:  selectedKey ? "Plan tarifaire mis à jour ✓" : "Plan tarifaire créé ✓",
      });
      setTimeout(() => setShowForm(false), 1000);
    } catch {
      setToast({ type: "error", msg: "Une erreur est survenue" });
    } finally {
      setIsSaving(false);
    }
  }, [form, selectedKey, addRatePlan, updateRatePlan, roomTypes]);

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    (roomId: string, planId: string, planName: string) => {
      if (!window.confirm(`Supprimer "${planName}" ? Cette action est irréversible.`)) return;
      setDeletingId(planId);
      try {
        deleteRatePlan(roomId, planId);
        setToast({ type: "success", msg: `Plan "${planName}" supprimé` });
        if (selectedKey === planId) {
          setShowForm(false);
          setSelectedKey(null);
        }
      } catch {
        setToast({ type: "error", msg: "Erreur lors de la suppression" });
      } finally {
        setDeletingId(null);
      }
    },
    [deleteRatePlan, selectedKey]
  );

  // ── Guard ────────────────────────────────────────────────────────────────

  if (!ratePanelOpen) return null;

  // ── Validation errors ────────────────────────────────────────────────────

  const nameError = touched.name && !form.name.trim() ? "Le nom est obligatoire"  : null;
  const codeError = touched.code && !form.code.trim() ? "Le code est obligatoire" : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={closeAllPanels}
      />

      <div
        ref={ref}
        className="relative h-screen w-[850px] max-w-full bg-white shadow-2xl flex flex-col animate-drawer-in"
      >
        {/* ── Header ── */}
        <div className="bg-violet-500 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-white text-lg">Gestion des grilles tarifaires</h3>
            <p className="text-violet-100 text-xs mt-0.5">
              Configurez vos stratégies de prix et leur distribution
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!showForm && (
              <button
                onClick={openAdd}
                className="flex items-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Créer un tarif
              </button>
            )}
            <button
              onClick={closeAllPanels}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showForm ? (
            /* ═══════════════════ FORMULAIRE ═══════════════════ */
            <div className="flex-1 overflow-auto bg-slate-50 p-6">
              <div className="mx-auto max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Form header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">
                    {selectedKey ? "Modifier le tarif" : "Nouveau tarif"}
                  </h4>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <Info className="w-3 h-3" /> Fiche de configuration
                  </div>
                </div>

                {/* Toast */}
                {toast && (
                  <div
                    className={cn(
                      "mx-6 mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium",
                      toast.type === "success"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-rose-50 text-rose-700 border border-rose-100"
                    )}
                  >
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    {toast.msg}
                  </div>
                )}

                <div className="p-6 space-y-6">
                  {/* Nom + Code */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Nom du tarif <span className="text-rose-400">*</span>
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                        placeholder="Ex: Flexible RO"
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all",
                          nameError
                            ? "border-rose-400 focus:ring-4 focus:ring-rose-50"
                            : "border-slate-200 focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
                        )}
                      />
                      {nameError && (
                        <p className="mt-1 text-[11px] text-rose-500">{nameError}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Code tarif <span className="text-rose-400">*</span>
                      </label>
                      <input
                        value={form.code}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                        }
                        onBlur={() => setTouched((t) => ({ ...t, code: true }))}
                        placeholder="FLEX_RO"
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-sm outline-none font-mono transition-all",
                          codeError
                            ? "border-rose-400 focus:ring-4 focus:ring-rose-50"
                            : "border-slate-200 focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
                        )}
                      />
                      {codeError && (
                        <p className="mt-1 text-[11px] text-rose-500">{codeError}</p>
                      )}
                    </div>
                  </div>

                  {/* Pension / Canal / Connectivité */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Pension
                      </label>
                      <select
                        value={form.pensionType}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, pensionType: e.target.value as PensionType }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 transition-all"
                      >
                        {PENSION_OPTIONS.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Canal
                      </label>
                      <select
                        value={form.channelType}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, channelType: e.target.value as ChannelType }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 transition-all"
                      >
                        {CHANNEL_OPTIONS.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Connectivité
                      </label>
                      <select
                        value={form.connectivityType}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            connectivityType: e.target.value as ConnectivityType,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 transition-all"
                      >
                        {CONNECTIVITY_OPTIONS.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── Paramétrage du prix ── */}
                  <div className="bg-violet-50/50 rounded-2xl border border-violet-100 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold text-violet-900 flex items-center gap-2">
                        <Calculator className="w-4 h-4" /> Paramétrage du prix
                      </h5>
                      <div className="flex bg-white p-1 rounded-xl border border-violet-200">
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, calcMode: "fixed" }))}
                          className={cn(
                            "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                            form.calcMode === "fixed"
                              ? "bg-violet-500 text-white shadow-sm"
                              : "text-slate-500 hover:text-violet-600"
                          )}
                        >
                          Tarif Fixe
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, calcMode: "derived" }))}
                          className={cn(
                            "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                            form.calcMode === "derived"
                              ? "bg-violet-500 text-white shadow-sm"
                              : "text-slate-500 hover:text-violet-600"
                          )}
                        >
                          Tarif Dérivé
                        </button>
                      </div>
                    </div>

                    {form.calcMode === "fixed" ? (
                      <div className="p-3 bg-white/60 rounded-xl text-xs text-slate-600 flex items-start gap-3">
                        <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                        <p>
                          Ce tarif est totalement indépendant. Le montant est saisi
                          manuellement jour par jour dans le calendrier.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1.5">
                            Basé sur le tarif référent
                          </label>
                          <select
                            value={form.referencePlanId}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, referencePlanId: e.target.value }))
                            }
                            className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-violet-100 transition-all font-semibold"
                          >
                            {allPlans.map((p) => (
                              <option key={p.planId} value={p.planId}>
                                {p.planName} ({p.planCode})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1.5">
                              Ajustement %
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                value={form.calcPercent}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    calcPercent: parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className="w-full rounded-xl border border-violet-200 px-3 py-2 text-sm outline-none bg-white pr-8 font-bold"
                              />
                              <span className="absolute right-3 top-2 text-slate-400 font-bold">
                                %
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1.5">
                              Ajustement €
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                value={form.calcValue}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    calcValue: parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className="w-full rounded-xl border border-violet-200 px-3 py-2 text-sm outline-none bg-white pr-8 font-bold"
                              />
                              <span className="absolute right-3 top-2 text-slate-400 font-bold">
                                €
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Formule */}
                        <div className="bg-violet-900 text-white rounded-xl p-4 shadow-inner">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-violet-200">
                              Formule appliquée
                            </span>
                            <span className="bg-violet-400/30 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                              Recalcul temps réel
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-2 font-mono text-sm">
                            <span className="font-bold">
                              {allPlans.find((p) => p.planId === form.referencePlanId)
                                ?.planName ?? "Réf."}
                            </span>
                            <span
                              className={cn(
                                form.calcPercent >= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                              )}
                            >
                              {form.calcPercent >= 0 ? "+" : ""}
                              {form.calcPercent}%
                            </span>
                            <span
                              className={cn(
                                form.calcValue >= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                              )}
                            >
                              {form.calcValue >= 0 ? "+" : ""}
                              {form.calcValue.toFixed(2)} €
                            </span>
                            <span className="text-violet-300">=</span>
                            <span className="text-lg font-bold text-white tracking-tight">
                              {previewResult}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chambres associées */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Chambres associées
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {roomTypes.map((r) => {
                        const active = form.assignedRoomTypeIds.includes(r.roomTypeId);
                        return (
                          <button
                            key={r.roomTypeId}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                assignedRoomTypeIds: active
                                  ? f.assignedRoomTypeIds.filter((id) => id !== r.roomTypeId)
                                  : [...f.assignedRoomTypeIds, r.roomTypeId],
                              }))
                            }
                            className={cn(
                              "px-2.5 py-1 rounded-full text-xs border transition-colors",
                              active
                                ? "border-violet-500 bg-violet-500 text-white"
                                : "border-slate-200 text-slate-500 hover:border-violet-300 hover:bg-violet-50"
                            )}
                          >
                            {r.roomTypeName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 34 Partenaires groupés */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Partenaires / distributeurs
                    </label>
                    <PartnerMultiCheck
                      selected={form.partnerIds}
                      onChange={(v) => setForm((f) => ({ ...f, partnerIds: v }))}
                    />
                  </div>

                  {/* Partenaire principal */}
                  {form.partnerIds.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        <Star className="w-3.5 h-3.5 inline mr-1 text-amber-400 fill-amber-400" />
                        Partenaire principal (OTA propriétaire)
                      </label>
                      <select
                        value={form.primaryPartnerId}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, primaryPartnerId: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 transition-all"
                      >
                        <option value="">— Aucun —</option>
                        {PARTNER_CATEGORY_ORDER.flatMap((catKey) =>
                          (PARTNER_CATEGORIES[catKey]?.partners ?? [])
                            .filter((p) => form.partnerIds.includes(p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))
                        )}
                      </select>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/40 px-6 py-4">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {selectedKey ? "Enregistrer les modifications" : "Créer le plan tarifaire"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ═══════════════════ LISTE ═══════════════════ */
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Toast (vue liste) */}
              {toast && (
                <div
                  className={cn(
                    "mx-6 mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium",
                    toast.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      : "bg-rose-50 text-rose-700 border border-rose-100"
                  )}
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {toast.msg}
                </div>
              )}

              {/* Recherche */}
              <div className="px-6 py-4 border-b border-slate-100 bg-white">
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un tarif..."
                    className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-100 outline-none"
                  />
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Table ou empty state */}
              <div className="flex-1 overflow-auto p-4">
                {filteredPlans.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Tag className="w-12 h-12 text-slate-200 mb-4" />
                    <h4 className="font-bold text-slate-400 text-sm">
                      {searchQuery ? "Aucun résultat" : "Aucun plan tarifaire"}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery
                        ? `Aucun tarif correspondant à "${searchQuery}"`
                        : "Créez votre premier plan tarifaire"}
                    </p>
                    {!searchQuery && (
                      <button
                        onClick={openAdd}
                        className="mt-4 flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700"
                      >
                        <Plus className="w-4 h-4" /> Créer un tarif
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          ID
                        </th>
                        <th className="text-left px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          Nom & Code
                        </th>
                        <th className="text-center px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          Type
                        </th>
                        <th className="text-center px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          Canal
                        </th>
                        <th className="text-center px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          Statut
                        </th>
                        <th className="text-center px-3 py-3 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredPlans.map(({ plan, roomId }) => (
                        <tr
                          key={plan.planId}
                          className={cn(
                            "group hover:bg-violet-50/40 transition-colors",
                            plan.isReference && "bg-violet-50/20"
                          )}
                        >
                          <td className="px-3 py-4 font-mono text-slate-300">
                            {plan.internalId}
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-2 h-8 rounded-full shrink-0",
                                  plan.isActive ? "bg-violet-500" : "bg-slate-200"
                                )}
                              />
                              <div>
                                <p className="font-bold text-slate-800 text-sm leading-tight">
                                  {plan.planName}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {plan.planCode}
                                </p>
                              </div>
                              {plan.isReference && (
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-bold text-[10px]">
                              {plan.pensionType}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center font-medium text-slate-500">
                            {plan.channelType}
                          </td>
                          <td className="px-3 py-4 text-center">
                            <button
                              onClick={() => toggleRatePlanActive(roomId, plan.planId)}
                              className={cn(
                                "text-[10px] font-black px-2.5 py-1 rounded-full border transition-all",
                                plan.isActive
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
                                  : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                              )}
                            >
                              {plan.isActive ? "ACTIF" : "INACTIF"}
                            </button>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => populateForm(plan)}
                                className="p-2 text-violet-500 hover:bg-violet-100 rounded-xl transition-all"
                                title="Modifier"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => duplicateRatePlan(roomId, plan.planId)}
                                className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl transition-all"
                                title="Dupliquer"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleDelete(roomId, plan.planId, plan.planName)
                                }
                                disabled={deletingId === plan.planId}
                                className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
                                title="Supprimer"
                              >
                                {deletingId === plan.planId ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
