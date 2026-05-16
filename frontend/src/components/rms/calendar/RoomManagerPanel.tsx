import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bed, CheckCircle, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { BathroomType, RoomTypeData } from "../types";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { cn } from "../utils/cn";

const EQUIPMENT_LIST = [
  { id: "wifi", label: "Wi-Fi" },
  { id: "tv", label: "Télévision" },
  { id: "minibar", label: "Minibar" },
  { id: "safe", label: "Coffre-fort" },
  { id: "bath", label: "Baignoire" },
  { id: "shower", label: "Douche" },
  { id: "balcony", label: "Balcon" },
  { id: "ac", label: "Climatisation" },
];

const BATHROOM_OPTIONS: BathroomType[] = ["Douche", "Baignoire", "Les deux", "Aucune"];
const VIEWS = ["Mer", "Ville", "Jardin", "Montagne", "Piscine", "Intérieure"];
const DIST_CHANNELS = ["Booking.com", "Expedia", "Agoda", "Airbnb", "Trip.com", "Direct", "HRS", "Hotelbeds"];

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
  distributionChannels: string[];
  diffFromRef: number;
  diffType: "fixed" | "percent";
};

const blankRoomForm: RoomFormState = {
  name: "",
  code: "",
  capacity: 2,
  bathroom: "Douche",
  equipment: ["wifi", "tv"],
  view: "Ville",
  description: "",
  isReference: false,
  assignedRatePlanIds: [],
  distributionChannels: ["Booking.com", "Direct"],
  diffFromRef: 0,
  diffType: "fixed",
};

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
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
        <button
          type="button"
          onClick={() => onChange(selected.length === options.length ? [] : options.map((option) => option.id))}
          className="text-[11px] font-medium text-violet-600 hover:text-violet-700"
        >
          {selected.length === options.length ? "Tout retirer" : "Tout sélectionner"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(active ? selected.filter((id) => id !== option.id) : [...selected, option.id])}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-violet-500",
                active
                  ? "border-violet-500 bg-violet-500 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RoomManagerPanel() {
  const { roomTypes, addRoomType, updateRoomType, deleteRoomType, toggleRoomActive, setRoomAsReference } = useRateCalendarStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<RoomFormState>(blankRoomForm);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setShowForm(false);
        setEditingId(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const allRatePlans = useMemo(
    () => Array.from(new Map(roomTypes.flatMap((room) => room.ratePlans.map((rate) => [rate.planId, rate]))).values()),
    [roomTypes]
  );

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return roomTypes;
    return roomTypes.filter((room) =>
      [room.roomTypeName, room.roomTypeCode, String(room.internalId)].join(" ").toLowerCase().includes(normalized)
    );
  }, [query, roomTypes]);

  const closeDrawer = () => {
    setOpen(false);
    setShowForm(false);
    setEditingId(null);
  };

  const openAdd = () => {
    setForm(blankRoomForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (room: RoomTypeData) => {
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
      distributionChannels: room.distributionChannels,
      diffFromRef: room.diffFromRef,
      diffType: room.diffType,
    });
    setEditingId(room.roomTypeId);
    setShowForm(true);
  };

  const submit = useCallback(() => {
    if (!form.name.trim() || !form.code.trim()) return;

    if (editingId) {
      updateRoomType({
        roomTypeId: editingId,
        roomName: form.name.trim(),
        roomCode: form.code.trim().toUpperCase(),
        capacity: form.capacity,
        bathroom: form.bathroom,
        equipment: form.equipment,
        view: form.view,
        description: form.description,
        isReference: form.isReference,
        assignedRatePlanIds: form.assignedRatePlanIds,
        distributionChannels: form.distributionChannels,
        diffFromRef: form.diffFromRef,
        diffType: form.diffType,
      });
    } else {
      addRoomType({
        roomName: form.name.trim(),
        roomCode: form.code.trim().toUpperCase(),
        capacity: form.capacity,
        bathroom: form.bathroom,
        equipment: form.equipment,
        view: form.view,
        description: form.description,
        isReference: form.isReference,
        assignedRatePlanIds: form.assignedRatePlanIds,
        distributionChannels: form.distributionChannels,
        diffFromRef: form.diffFromRef,
        diffType: form.diffType,
      });
    }

    setShowForm(false);
    setEditingId(null);
  }, [addRoomType, editingId, form, updateRoomType]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-violet-500",
          open
            ? "border-violet-500 bg-violet-500 text-white shadow-md"
            : "border-violet-200 bg-white text-violet-700 hover:border-violet-300 hover:bg-violet-50 hover:shadow-sm"
        )}
      >
        <Bed className="h-4 w-4" />
        <span>Mes Chambres</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 animate-fade-in bg-slate-950/35 backdrop-blur-[2px]" onClick={closeDrawer} />
          <aside
            ref={drawerRef}
            className="absolute right-0 top-0 flex h-screen w-full max-w-[1120px] animate-drawer-in flex-col border-l border-slate-200 bg-white shadow-2xl lg:w-2/3"
          >
            <header className="flex shrink-0 items-center justify-between bg-violet-500 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-white">Mes Chambres</h3>
                <p className="text-xs text-violet-100">Types de chambres, affectations tarifaires et référence de pricing</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openAdd}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/15 px-3 text-sm font-medium text-white transition-colors hover:bg-white/25 focus-visible:outline-white"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter
                </button>
                <button onClick={closeDrawer} className="rounded-lg p-2 text-white/75 transition-colors hover:bg-white/15 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            {showForm ? (
              <div className="flex-1 overflow-auto bg-slate-50 p-6">
                <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">{editingId ? "Modifier un type de chambre" : "Ajouter un type de chambre"}</h4>
                      <p className="mt-1 text-sm text-slate-500">Renseignez les informations commerciales et opérationnelles de la chambre.</p>
                    </div>
                    <button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nom chambre *</label>
                      <input value={form.name} onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Chambre Deluxe" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Code *</label>
                      <input value={form.code} onChange={(event) => setForm((state) => ({ ...state, code: event.target.value.toUpperCase() }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm uppercase outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="DBL-DLX" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Capacité</label>
                      <input type="number" min={1} max={6} value={form.capacity} onChange={(event) => setForm((state) => ({ ...state, capacity: Number(event.target.value) }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Salle de bain</label>
                      <select value={form.bathroom} onChange={(event) => setForm((state) => ({ ...state, bathroom: event.target.value as BathroomType }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                        {BATHROOM_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Vue</label>
                      <select value={form.view} onChange={(event) => setForm((state) => ({ ...state, view: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                        {VIEWS.map((view) => <option key={view}>{view}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex h-11 w-full items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 px-3 text-sm font-medium text-violet-800">
                        <input type="checkbox" checked={form.isReference} onChange={(event) => setForm((state) => ({ ...state, isReference: event.target.checked }))} />
                        Chambre référente
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 space-y-5">
                    <MultiCheck label="Équipements" options={EQUIPMENT_LIST} selected={form.equipment} onChange={(value) => setForm((state) => ({ ...state, equipment: value }))} />
                    <MultiCheck label="Partenaires" options={DIST_CHANNELS.map((channel) => ({ id: channel, label: channel }))} selected={form.distributionChannels} onChange={(value) => setForm((state) => ({ ...state, distributionChannels: value }))} />
                    <MultiCheck label="Tarifs assignés" options={allRatePlans.map((rate) => ({ id: rate.planId, label: rate.planName }))} selected={form.assignedRatePlanIds} onChange={(value) => setForm((state) => ({ ...state, assignedRatePlanIds: value }))} />

                    <div className="grid gap-5 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Écart vs référence</label>
                        <input type="number" value={form.diffFromRef} onChange={(event) => setForm((state) => ({ ...state, diffFromRef: Number(event.target.value) || 0 }))} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</label>
                        <select value={form.diffType} onChange={(event) => setForm((state) => ({ ...state, diffType: event.target.value as "fixed" | "percent" }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                          <option value="fixed">Montant fixe</option>
                          <option value="percent">Pourcentage</option>
                        </select>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                        Si la chambre n'est pas référente, ses prix sont calculés par rapport à la chambre référente.
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                      <textarea value={form.description} onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                    <button onClick={() => setShowForm(false)} className="h-10 rounded-lg border border-violet-200 px-4 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50">
                      Annuler
                    </button>
                    <button disabled={!form.name.trim() || !form.code.trim()} onClick={submit} className="h-10 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50">
                      {editingId ? "Mettre à jour" : "Créer la chambre"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
                  <div className="relative max-w-sm flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une chambre..." className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <button onClick={openAdd} className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-600">
                    <Plus className="h-4 w-4" />
                    Ajouter un type de chambre
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-6">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          {[
                            "ID", "Code", "Nom chambre", "Capacité", "Salle de bain", "Équipements", "Tarifs", "Partenaires", "Statut", "Actions",
                          ].map((header) => <th key={header} className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-500">{header}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRooms.map((room) => (
                          <tr key={room.roomTypeId} className={cn("border-b border-slate-100 transition-colors hover:bg-violet-50/40", room.isReference && "bg-violet-50/60")}>
                            <td className="px-3 py-3 font-mono text-slate-400">{room.internalId}</td>
                            <td className="px-3 py-3 font-semibold text-slate-700">{room.roomTypeCode}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {room.isReference && <CheckCircle className="h-3.5 w-3.5 text-violet-500" />}
                                <span className="font-medium text-slate-800">{room.roomTypeName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center text-slate-600">{room.capacity}</td>
                            <td className="px-3 py-3 text-slate-600">{room.bathroom}</td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1">{room.equipment.slice(0, 3).map((item) => <span key={item} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{item}</span>)}{room.equipment.length > 3 && <span className="text-[10px] text-slate-400">+{room.equipment.length - 3}</span>}</div>
                            </td>
                            <td className="px-3 py-3 text-center text-slate-600">{room.assignedRatePlanIds.length}</td>
                            <td className="px-3 py-3 text-center text-slate-600">{room.distributionChannels.length}</td>
                            <td className="px-3 py-3">
                              <button onClick={() => toggleRoomActive(room.roomTypeId)} className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", room.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{room.isActive ? "Ouverte" : "Fermée"}</button>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEdit(room)} className="rounded-lg p-1.5 text-violet-500 hover:bg-violet-50" title="Modifier"><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => deleteRoomType(room.roomTypeId)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                                {!room.isReference && <button onClick={() => setRoomAsReference(room.roomTypeId)} className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-500" title="Définir comme référente"><Eye className="h-4 w-4" /></button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}