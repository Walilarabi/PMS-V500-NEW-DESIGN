/**
 * FLOWTYM — RoomManagerPanel
 *
 * Drawer CRUD complet pour les typologies de chambres.
 *
 * T3 — Améliorations :
 *   • 34 partenaires avec groupes par catégorie (PARTNER_CATEGORIES)
 *   • Validation inline (name + code obligatoires, erreurs visuelles)
 *   • isSaving + spinner sur le bouton de sauvegarde
 *   • Toast succès / erreur
 *   • Fermeture auto du formulaire après succès (1 s)
 *   • Confirmation + retour d'état sur suppression
 *   • Harmonisation visuelle avec RateManagerPanel (max-w-2xl, labels, footer)
 *   • Écoute du store roomPanelOpen / editingRoomId pour ouverture externe
 *     (depuis RoomTypesPage → openRoomPanel(roomId))
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bed, CheckCircle, Eye, Loader2, Pencil, Plus,
  Search, Star, Trash2, X,
} from "lucide-react";
import type { BathroomType, RoomTypeData } from "../types";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { cn } from "../utils/cn";
import {
  PARTNER_CATEGORIES, PARTNER_CATEGORY_ORDER,
} from "@/src/constants/partners";

// ─── Constantes ──────────────────────────────────────────────────────────────

const EQUIPMENT_LIST = [
  { id: "wifi",    label: "Wi-Fi" },
  { id: "tv",      label: "Télévision" },
  { id: "minibar", label: "Minibar" },
  { id: "safe",    label: "Coffre-fort" },
  { id: "bath",    label: "Baignoire" },
  { id: "shower",  label: "Douche" },
  { id: "balcony", label: "Balcon" },
  { id: "ac",      label: "Climatisation" },
];

const BATHROOM_OPTIONS: BathroomType[] = ["Douche", "Baignoire", "Les deux", "Aucune"];
const VIEWS = ["Mer", "Ville", "Jardin", "Montagne", "Piscine", "Intérieure"];

// ─── Types ────────────────────────────────────────────────────────────────────

type RoomFormState = {
  name: string;
  code: string;
  capacity: number;
  bathroom: BathroomType;
  equipment: string[];
  view: string;
  description: string;
  isReference: boolean;
  assignedRatePlanIds: string[];
  partnerIds: string[];
  diffFromRef: number;
  diffType: "fixed" | "percent";
};

const blankForm: RoomFormState = {
  name: "",
  code: "",
  capacity: 2,
  bathroom: "Douche",
  equipment: ["wifi", "tv"],
  view: "Ville",
  description: "",
  isReference: false,
  assignedRatePlanIds: [],
  partnerIds: ["direct", "booking-com"],
  diffFromRef: 0,
  diffType: "fixed",
};

// ─── Sub-composants ───────────────────────────────────────────────────────────

function MultiCheck({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const allSelected = selected.length === options.length;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</label>
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : options.map((o) => o.id))}
          className="text-[11px] font-medium text-violet-600 hover:text-violet-700"
        >
          {allSelected ? "Tout retirer" : "Tout sélectionner"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                onChange(active ? selected.filter((id) => id !== o.id) : [...selected, o.id])
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150",
                active
                  ? "border-violet-500 bg-violet-500 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Sélecteur partenaires avec groupes par catégorie */
function PartnerMultiCheck({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const total = PARTNER_CATEGORY_ORDER.reduce(
    (n, cat) => n + PARTNER_CATEGORIES[cat].partners.length,
    0
  );
  const allSelected = selected.length === total;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Partenaires &amp; distribution
        </label>
        <button
          type="button"
          onClick={() => {
            if (allSelected) {
              onChange([]);
            } else {
              const all = PARTNER_CATEGORY_ORDER.flatMap(
                (cat) => PARTNER_CATEGORIES[cat].partners.map((p) => p.id)
              );
              onChange(all);
            }
          }}
          className="text-[11px] font-medium text-violet-600 hover:text-violet-700"
        >
          {allSelected ? "Tout retirer" : "Tout sélectionner"}
        </button>
      </div>
      <div className="space-y-3">
        {PARTNER_CATEGORY_ORDER.map((cat) => {
          const { label, partners } = PARTNER_CATEGORIES[cat];
          if (partners.length === 0) return null;
          return (
            <div key={cat}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {partners.map((p) => {
                  const active = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        onChange(
                          active
                            ? selected.filter((id) => id !== p.id)
                            : [...selected, p.id]
                        )
                      }
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150",
                        active
                          ? "border-violet-500 bg-violet-500 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50"
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
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function RoomManagerPanel() {
  const {
    roomTypes,
    addRoomType, updateRoomType, deleteRoomType,
    toggleRoomActive, setRoomAsReference,
    roomPanelOpen, editingRoomId, openRoomPanel, closeAllPanels,
  } = useRateCalendarStore();

  // Panel state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  // Form state
  const [form, setForm] = useState<RoomFormState>(blankForm);
  const [touched, setTouched] = useState({ name: false, code: false });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);

  // ── Écoute store externe (RoomTypesPage → openRoomPanel) ─────────────────
  useEffect(() => {
    if (roomPanelOpen) {
      setOpen(true);
      if (editingRoomId) {
        const room = roomTypes.find((r) => r.roomTypeId === editingRoomId);
        if (room) openEdit(room);
        else setShowForm(false);
      } else {
        setShowForm(false);
        setEditingId(null);
      }
    } else {
      setOpen(false);
      setShowForm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomPanelOpen, editingRoomId]);

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Toast auto-dismiss ────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const allRatePlans = useMemo(
    () =>
      Array.from(
        new Map(
          roomTypes.flatMap((r) => r.ratePlans.map((p) => [p.planId, p]))
        ).values()
      ),
    [roomTypes]
  );

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roomTypes;
    return roomTypes.filter((r) =>
      `${r.roomTypeName} ${r.roomTypeCode}`.toLowerCase().includes(q)
    );
  }, [query, roomTypes]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function closeDrawer() {
    setOpen(false);
    setShowForm(false);
    setEditingId(null);
    setTouched({ name: false, code: false });
    closeAllPanels();
  }

  function openAdd() {
    setForm(blankForm);
    setEditingId(null);
    setTouched({ name: false, code: false });
    setShowForm(true);
  }

  function openEdit(room: RoomTypeData) {
    setForm({
      name: room.roomTypeName,
      code: room.roomTypeCode,
      capacity: room.capacity,
      bathroom: room.bathroom,
      equipment: room.equipment,
      view: room.view,
      description: room.description,
      isReference: room.isReference,
      assignedRatePlanIds: room.assignedRatePlanIds,
      partnerIds: room.partnerIds ?? room.distributionChannels ?? [],
      diffFromRef: room.diffFromRef,
      diffType: room.diffType,
    });
    setEditingId(room.roomTypeId);
    setTouched({ name: false, code: false });
    setShowForm(true);
  }

  const submit = useCallback(async () => {
    setTouched({ name: true, code: true });

    // Surface validation errors visually (instead of silent return)
    const missing: string[] = [];
    if (!form.name.trim()) missing.push('nom');
    if (!form.code.trim()) missing.push('code');
    if (missing.length > 0) {
      setToast({
        type: 'error',
        msg: `Champ${missing.length > 1 ? 's' : ''} obligatoire${missing.length > 1 ? 's' : ''} : ${missing.join(', ')}`,
      });
      window.setTimeout(() => setToast(null), 3500);
      return;
    }

    // Duplicate code guard
    const existing = roomTypes.find(
      r => r.roomTypeCode === form.code.trim().toUpperCase() && r.roomTypeId !== editingId
    );
    if (existing) {
      setToast({ type: 'error', msg: `Le code "${form.code.trim().toUpperCase()}" est déjà utilisé` });
      window.setTimeout(() => setToast(null), 3500);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        roomName: form.name.trim(),
        roomCode: form.code.trim().toUpperCase(),
        capacity: form.capacity,
        bathroom: form.bathroom,
        equipment: form.equipment,
        view: form.view,
        description: form.description,
        isReference: form.isReference,
        assignedRatePlanIds: form.assignedRatePlanIds,
        distributionChannels: form.partnerIds,
        partnerIds: form.partnerIds,
        diffFromRef: form.diffFromRef,
        diffType: form.diffType,
      };

      if (editingId) {
        updateRoomType({ roomTypeId: editingId, ...payload });
      } else {
        addRoomType(payload);
      }

      // Toast global pour notifier le reste de l'app (Planning, Calendrier tarifaire)
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: {
          message: editingId
            ? `Chambre "${form.name.trim()}" mise à jour`
            : `Chambre "${form.name.trim()}" créée avec succès`,
          type: 'success',
        },
      }));

      setToast({
        type: "success",
        msg: editingId ? `"${form.name.trim()}" mise à jour` : `"${form.name.trim()}" créée avec succès`,
      });
      // Fermeture auto après 1 s
      window.setTimeout(() => {
        setShowForm(false);
        setEditingId(null);
        setTouched({ name: false, code: false });
      }, 1000);
    } catch (err) {
      console.error('[RoomManagerPanel] save failed:', err);
      setToast({ type: "error", msg: "Erreur lors de la sauvegarde" });
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Erreur lors de la sauvegarde de la chambre', type: 'error' },
      }));
    } finally {
      setIsSaving(false);
    }
  }, [form, editingId, addRoomType, updateRoomType, roomTypes]);

  const handleDelete = useCallback(
    async (room: RoomTypeData) => {
      if (
        !window.confirm(
          `Supprimer la chambre "${room.roomTypeName}" ?\nCette action est irréversible.`
        )
      )
        return;

      setDeletingId(room.roomTypeId);
      try {
        deleteRoomType(room.roomTypeId);
        setToast({ type: "success", msg: `"${room.roomTypeName}" supprimée` });
      } catch {
        setToast({ type: "error", msg: "Impossible de supprimer cette chambre" });
      } finally {
        setDeletingId(null);
      }
    },
    [deleteRoomType]
  );

  // ── Validation helpers ────────────────────────────────────────────────────
  const nameError = touched.name && !form.name.trim();
  const codeError = touched.code && !form.code.trim();

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Bouton déclencheur */}
      <button
        onClick={() => {
          openRoomPanel();
          setOpen(true);
        }}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200",
          open
            ? "border-violet-500 bg-violet-500 text-white shadow-md"
            : "border-violet-200 bg-white text-violet-700 hover:border-violet-300 hover:bg-violet-50 hover:shadow-sm"
        )}
      >
        <Bed className="h-4 w-4" />
        <span>Mes Chambres</span>
      </button>

      {/* Overlay + Drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={closeDrawer}
          />
          <aside
            ref={drawerRef}
            className="absolute right-0 top-0 flex h-screen w-full max-w-[1120px] flex-col border-l border-slate-200 bg-white shadow-2xl lg:w-2/3"
          >
            {/* Header violet */}
            <header className="flex shrink-0 items-center justify-between bg-violet-500 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white">Typologies de chambres</h3>
                <p className="text-xs text-violet-100">
                  Création, modification et affectation des plans tarifaires
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!showForm && (
                  <button
                    onClick={openAdd}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/15 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                  >
                    <Plus className="h-4 w-4" />
                    Nouvelle chambre
                  </button>
                )}
                <button
                  onClick={closeDrawer}
                  className="rounded-lg p-2 text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            {showForm ? (
              /* ─── Formulaire ────────────────────────────────────────────── */
              <div className="flex-1 overflow-auto bg-slate-50 p-6">
                <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {/* Form header */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                    <h4 className="font-bold text-slate-800">
                      {editingId ? "Modifier la chambre" : "Nouvelle chambre"}
                    </h4>
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Fiche de configuration
                    </div>
                  </div>

                  <div className="space-y-6 p-6">
                    {/* Nom + Code */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Nom *
                        </label>
                        <input
                          value={form.name}
                          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                          placeholder="Chambre Deluxe"
                          className={cn(
                            "w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all focus:ring-4 focus:ring-violet-50",
                            nameError
                              ? "border-rose-400 focus:border-rose-400"
                              : "border-slate-200 focus:border-violet-400"
                          )}
                        />
                        {nameError && (
                          <p className="mt-1 text-[11px] font-medium text-rose-500">
                            Le nom est obligatoire
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Code *
                        </label>
                        <input
                          value={form.code}
                          onBlur={() => setTouched((t) => ({ ...t, code: true }))}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))
                          }
                          placeholder="DBL-DLX"
                          className={cn(
                            "w-full rounded-xl border px-3 py-2 font-mono text-sm uppercase outline-none transition-all focus:ring-4 focus:ring-violet-50",
                            codeError
                              ? "border-rose-400 focus:border-rose-400"
                              : "border-slate-200 focus:border-violet-400"
                          )}
                        />
                        {codeError && (
                          <p className="mt-1 text-[11px] font-medium text-rose-500">
                            Le code est obligatoire
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Capacité + SDB + Vue */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Capacité (pers.)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={form.capacity}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, capacity: Number(e.target.value) }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Salle de bain
                        </label>
                        <select
                          value={form.bathroom}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, bathroom: e.target.value as BathroomType }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-violet-400"
                        >
                          {BATHROOM_OPTIONS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Vue
                        </label>
                        <select
                          value={form.view}
                          onChange={(e) => setForm((s) => ({ ...s, view: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-violet-400"
                        >
                          {VIEWS.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Chambre référente */}
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-800">
                      <input
                        type="checkbox"
                        checked={form.isReference}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, isReference: e.target.checked }))
                        }
                        className="h-4 w-4 rounded accent-violet-600"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          Chambre référente
                        </div>
                        <p className="mt-0.5 text-[11px] font-normal text-violet-600">
                          Les prix des autres chambres sont calculés à partir de celle-ci
                        </p>
                      </div>
                    </label>

                    {/* Équipements */}
                    <MultiCheck
                      label="Équipements"
                      options={EQUIPMENT_LIST}
                      selected={form.equipment}
                      onChange={(v) => setForm((s) => ({ ...s, equipment: v }))}
                    />

                    {/* Partenaires */}
                    <PartnerMultiCheck
                      selected={form.partnerIds}
                      onChange={(v) => setForm((s) => ({ ...s, partnerIds: v }))}
                    />

                    {/* Tarifs assignés */}
                    {allRatePlans.length > 0 && (
                      <MultiCheck
                        label="Plans tarifaires assignés"
                        options={allRatePlans.map((r) => ({ id: r.planId, label: r.planName }))}
                        selected={form.assignedRatePlanIds}
                        onChange={(v) => setForm((s) => ({ ...s, assignedRatePlanIds: v }))}
                      />
                    )}

                    {/* Écart vs référence */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Écart vs chambre référente
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={form.diffFromRef}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              diffFromRef: Number(e.target.value) || 0,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Mode de calcul
                        </label>
                        <select
                          value={form.diffType}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              diffType: e.target.value as "fixed" | "percent",
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-violet-400"
                        >
                          <option value="fixed">Montant fixe (€)</option>
                          <option value="percent">Pourcentage (%)</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Description
                      </label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                        rows={3}
                        placeholder="Décrivez cette chambre…"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
                      />
                    </div>
                  </div>

                  {/* Toast inline */}
                  {toast && (
                    <div
                      className={cn(
                        "mx-6 mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium",
                        toast.type === "success"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                      )}
                    >
                      {toast.type === "success" ? (
                        <CheckCircle className="h-4 w-4 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 shrink-0" />
                      )}
                      {toast.msg}
                    </div>
                  )}

                  {/* Footer boutons */}
                  <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/40 px-6 py-4">
                    <button
                      onClick={submit}
                      disabled={isSaving}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enregistrement…
                        </>
                      ) : editingId ? (
                        "Enregistrer les modifications"
                      ) : (
                        "Créer la chambre"
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(null);
                        setTouched({ name: false, code: false });
                      }}
                      className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition-all hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ─── Liste ─────────────────────────────────────────────────── */
              <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
                {/* Barre de recherche + bouton */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
                  <div className="relative max-w-sm flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher une chambre…"
                      className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    />
                  </div>
                  <button
                    onClick={openAdd}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-600"
                  >
                    <Plus className="h-4 w-4" />
                    Nouvelle chambre
                  </button>
                </div>

                {/* Toast liste */}
                {toast && (
                  <div
                    className={cn(
                      "mx-6 mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium",
                      toast.type === "success"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                    )}
                  >
                    {toast.type === "success" ? (
                      <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 shrink-0" />
                    )}
                    {toast.msg}
                  </div>
                )}

                <div className="flex-1 overflow-auto p-6">
                  {filteredRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Bed className="mb-3 h-8 w-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">
                        {roomTypes.length === 0
                          ? "Aucune chambre configurée"
                          : "Aucun résultat pour cette recherche"}
                      </p>
                      {roomTypes.length === 0 && (
                        <button
                          onClick={openAdd}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
                        >
                          <Plus className="h-4 w-4" />
                          Créer la première chambre
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            {[
                              "Code", "Nom chambre", "Cap.", "SDB",
                              "Équipements", "Partenaires", "Plans", "Statut", "Actions",
                            ].map((h) => (
                              <th
                                key={h}
                                className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-500"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRooms.map((room) => (
                            <tr
                              key={room.roomTypeId}
                              className={cn(
                                "border-b border-slate-100 transition-colors hover:bg-violet-50/40",
                                room.isReference && "bg-violet-50/60"
                              )}
                            >
                              <td className="px-3 py-3 font-mono font-semibold text-slate-700">
                                {room.roomTypeCode}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  {room.isReference && (
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                                  )}
                                  <span className="font-medium text-slate-800">
                                    {room.roomTypeName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center text-slate-600">
                                {room.capacity}
                              </td>
                              <td className="px-3 py-3 text-slate-600">{room.bathroom}</td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {room.equipment.slice(0, 3).map((eq) => (
                                    <span
                                      key={eq}
                                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                                    >
                                      {eq}
                                    </span>
                                  ))}
                                  {room.equipment.length > 3 && (
                                    <span className="text-[10px] text-slate-400">
                                      +{room.equipment.length - 3}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center text-slate-600">
                                {(room.partnerIds ?? room.distributionChannels ?? []).length}
                              </td>
                              <td className="px-3 py-3 text-center text-slate-600">
                                {room.ratePlans?.length ?? 0}
                              </td>
                              <td className="px-3 py-3">
                                <button
                                  onClick={() => toggleRoomActive(room.roomTypeId)}
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                                    room.isActive
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                      : "bg-red-100 text-red-700 hover:bg-red-200"
                                  )}
                                >
                                  {room.isActive ? "Ouverte" : "Fermée"}
                                </button>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEdit(room)}
                                    className="rounded-lg p-1.5 text-violet-500 transition-colors hover:bg-violet-50"
                                    title="Modifier"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(room)}
                                    disabled={deletingId === room.roomTypeId}
                                    className="rounded-lg p-1.5 text-rose-400 transition-colors hover:bg-rose-50 disabled:opacity-40"
                                    title="Supprimer"
                                  >
                                    {deletingId === room.roomTypeId ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  {!room.isReference && (
                                    <button
                                      onClick={() => setRoomAsReference(room.roomTypeId)}
                                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-violet-50 hover:text-violet-500"
                                      title="Définir comme chambre référente"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
