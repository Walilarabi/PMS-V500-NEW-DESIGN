import { useState, useMemo } from "react";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { cn } from "../utils/cn";
import { Boxes, CalendarClock, CircleDollarSign, DoorOpen, RadioTower, SlidersHorizontal, LucideIcon } from "lucide-react";

type Operation = "inventory" | "open_close" | "room_restrictions" | "plan_restrictions" | "channels" | "price";

// ─── Shared multi-select list ─────────────────────────────────────────────────
function SelectList<T extends string>({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: { id: T; label: string }[];
  selected: T[];
  onChange: (ids: T[]) => void;
}) {
  const [search, setSearch] = useState("");
  const allSelected = selected.length === items.length && items.length > 0;
  const someSelected = selected.length > 0 && !allSelected;
  const filtered = items.filter(it => it.label.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: T) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const toggleAll = () =>
    onChange(allSelected ? [] : items.map(it => it.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        <button
          className="text-xs text-violet-600 hover:underline"
          onClick={toggleAll}
        >
          {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs border-b border-gray-200 outline-none focus:bg-violet-50"
        />
        <div className="max-h-32 overflow-auto">
          {filtered.map(item => {
            const checked = selected.includes(item.id);
            return (
              <label key={item.id} className="flex items-center gap-2 px-2.5 py-1 text-sm cursor-pointer hover:bg-gray-50 select-none">
                <span className={cn("w-4 h-4 rounded border flex items-center justify-center text-[9px] shrink-0",
                  checked ? "bg-violet-600 border-violet-600 text-white" : "border-gray-300"
                )}>
                  {checked && "✓"}
                </span>
                <span className="truncate">{item.label}</span>
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(item.id)} />
              </label>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">Aucun résultat</p>
          )}
        </div>
      </div>
      {someSelected && (
        <p className="text-[10px] text-violet-600 mt-1">{selected.length} / {items.length} sélectionnés</p>
      )}
    </div>
  );
}

// ─── DateRange picker ─────────────────────────────────────────────────────────
function DateRangePicker({
  ranges,
  onAdd,
  onRemove,
}: {
  ranges: { start: string; end: string }[];
  onAdd: (range: { start: string; end: string }) => void;
  onRemove: (i: number) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const valid = start && end && new Date(start) <= new Date(end);

  const handleAdd = () => {
    if (!valid) return;
    onAdd({ start, end });
    setStart("");
    setEnd("");
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="font-semibold text-gray-800 mb-3 text-sm">Périodes d'application</h3>
      <div className="space-y-2 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Du</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Au</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-violet-500" />
        </div>
        <button
          onClick={handleAdd}
          disabled={!valid}
          className="w-full py-2 bg-violet-500 text-white text-sm font-semibold rounded hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + Ajouter la période
        </button>
      </div>
      <div className="flex-1 overflow-auto space-y-1.5">
        {ranges.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">Aucune période</p>
        )}
        {ranges.map((r, i) => (
          <div key={i} className="flex items-center justify-between bg-white border border-gray-200 px-3 py-2 rounded-lg text-xs">
            <div>
              <span className="font-semibold text-gray-700">{r.start}</span>
              <span className="text-gray-400 mx-1">→</span>
              <span className="font-semibold text-gray-700">{r.end}</span>
            </div>
            <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600 font-bold ml-2">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function BulkUpdateModal({ onClose }: { onClose: () => void }) {
  const {
    roomTypes,
    channels,
    updatePrice,
    updateInventory,
    updateStayRestriction,
    updateArrivalDepartureRestriction,
    updatePlanRestriction,
    toggleChannelClosed,
  } = useRateCalendarStore();

  const [operation, setOperation] = useState<Operation>("inventory");
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [dateRanges, setDateRanges] = useState<{ start: string; end: string }[]>([]);

  // Value state
  const [invValue, setInvValue] = useState("");
  const [openCloseValue, setOpenCloseValue] = useState<"open" | "close">("open");
  const [restrictionField, setRestrictionField] = useState<"minStay" | "maxStay" | "cta" | "ctd">("minStay");
  const [restrictionValue, setRestrictionValue] = useState("");
  const [priceValue, setPriceValue] = useState("");

  const roomItems = useMemo(() =>
    roomTypes.map(rt => ({ id: rt.roomTypeId, label: rt.roomTypeName })),
    [roomTypes]
  );

  const planItems = useMemo(() => {
    const map = new Map<string, string>();
    roomTypes.forEach(rt => rt.ratePlans.forEach(rp => map.set(rp.planId, rp.planName)));
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [roomTypes]);

  const channelItems = useMemo(() =>
    channels.map(ch => ({ id: ch.channelId, label: `${ch.channelName} (${ch.commission}%)` })),
    [channels]
  );

  const getDates = (start: string, end: string): string[] => {
    const dates: string[] = [];
    let cur = new Date(start);
    const last = new Date(end);
    while (cur <= last) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const applyable = dateRanges.length > 0;

  const handleApply = () => {
    if (!applyable) return;
    const dates = Array.from(new Set(dateRanges.flatMap(r => getDates(r.start, r.end))));

    dates.forEach(date => {
      if (operation === "inventory") {
        const val = parseInt(invValue, 10);
        if (!isNaN(val)) selectedRooms.forEach(rId => updateInventory(rId, date, val));
      } else if (operation === "open_close") {
        selectedRooms.forEach(rId => {
          const rt = roomTypes.find(r => r.roomTypeId === rId);
          const cap = rt?.capacity ?? 5;
          updateInventory(rId, date, openCloseValue === "close" ? 0 : cap);
        });
      } else if (operation === "room_restrictions") {
        if (restrictionField === "cta" || restrictionField === "ctd") {
          const closed = restrictionValue === "true";
          selectedRooms.forEach(rId => updateArrivalDepartureRestriction(rId, date, restrictionField, closed));
        } else {
          const val = restrictionValue === "" ? null : parseInt(restrictionValue, 10);
          selectedRooms.forEach(rId => updateStayRestriction(rId, date, restrictionField, val));
        }
      } else if (operation === "plan_restrictions") {
        const closed = restrictionValue === "true";
        selectedRooms.forEach(rId =>
          selectedPlans.forEach(pId => updatePlanRestriction(rId, pId, date, closed))
        );
      } else if (operation === "channels") {
        const shouldClose = openCloseValue === "close";
        selectedChannels.forEach(cId => {
          const ch = channels.find(c => c.channelId === cId);
          if (!ch) return;
          const alreadyClosed = ch.closedDates.includes(date);
          if (shouldClose !== alreadyClosed) toggleChannelClosed(cId, date);
        });
      } else if (operation === "price") {
        const val = parseFloat(priceValue);
        if (!isNaN(val)) {
          selectedRooms.forEach(rId =>
            selectedPlans.forEach(pId => updatePrice(rId, pId, date, val))
          );
        }
      }
    });
    onClose();
  };

  const OPERATIONS: { value: Operation; label: string; icon: LucideIcon }[] = [
    { value: "inventory",         label: "Modifier le stock",         icon: Boxes },
    { value: "open_close",        label: "Ouvrir / Fermer les ventes", icon: DoorOpen },
    { value: "room_restrictions", label: "Restrictions chambres",      icon: CalendarClock },
    { value: "plan_restrictions", label: "Restrictions plans tarifaires", icon: SlidersHorizontal },
    { value: "price",             label: "Mise à jour rapide des prix", icon: CircleDollarSign },
    { value: "channels",          label: "Ouvrir / Fermer canaux",     icon: RadioTower },
  ];

  const needsRooms  = ["inventory","open_close","room_restrictions","plan_restrictions","price"].includes(operation);
  const needsPlans  = ["plan_restrictions","price"].includes(operation);
  const needsChannels = operation === "channels";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-violet-500 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Modification en masse</h2>
            <p className="text-violet-100 text-xs mt-0.5">Appliquez des changements sur plusieurs chambres, plans et périodes simultanément</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-bold">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto flex gap-0 divide-x divide-gray-100">

          {/* 1. Operation selection */}
          <div className="w-56 shrink-0 p-4 bg-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Action</p>
            <div className="space-y-1">
              {OPERATIONS.map(op => {
                const Icon = op.icon;
                return (
                <button
                  key={op.value}
                  onClick={() => setOperation(op.value)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm transition-colors",
                    operation === op.value
                      ? "bg-violet-500 text-white shadow-sm font-semibold"
                      : "text-gray-700 hover:bg-gray-200"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{op.label}</span>
                </button>
                );
              })}
            </div>
          </div>

          {/* 2. Settings column */}
          <div className="flex-1 p-5 space-y-5 overflow-auto">

            {needsRooms && (
              <SelectList
                label="Chambres concernées"
                items={roomItems}
                selected={selectedRooms}
                onChange={setSelectedRooms}
              />
            )}

            {needsPlans && (
              <SelectList
                label="Plans tarifaires concernés"
                items={planItems}
                selected={selectedPlans}
                onChange={setSelectedPlans}
              />
            )}

            {needsChannels && (
              <SelectList
                label="Canaux concernés"
                items={channelItems}
                selected={selectedChannels}
                onChange={setSelectedChannels}
              />
            )}

            {/* Value configuration */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Paramètres</p>

              {operation === "inventory" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nouvel inventaire (nombre de chambres)</label>
                  <input type="number" min={0} value={invValue} onChange={e => setInvValue(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm outline-none focus:border-violet-500" placeholder="Ex: 5" />
                </div>
              )}

              {(operation === "open_close" || operation === "channels") && (
                <div className="flex gap-4">
                  {(["open","close"] as const).map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" name="oc" checked={openCloseValue === v} onChange={() => setOpenCloseValue(v)} />
                      <span>{v === "open" ? "Ouvrir" : "Fermer"}</span>
                    </label>
                  ))}
                </div>
              )}

              {operation === "room_restrictions" && (
                <div className="space-y-3">
                  <select value={restrictionField} onChange={e => setRestrictionField(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500 bg-white">
                    <option value="minStay">Min Stay (durée minimale)</option>
                    <option value="maxStay">Max Stay (durée maximale)</option>
                    <option value="cta">CTA — Closed to Arrival</option>
                    <option value="ctd">CTD — Closed to Departure</option>
                  </select>
                  {(restrictionField === "minStay" || restrictionField === "maxStay") ? (
                    <input type="number" min={0} value={restrictionValue} onChange={e => setRestrictionValue(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm outline-none focus:border-violet-500"
                      placeholder="Nombre de nuits (vide = supprimer)" />
                  ) : (
                    <select value={restrictionValue} onChange={e => setRestrictionValue(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500 bg-white">
                      <option value="true">Fermé (restreindre)</option>
                      <option value="false">Ouvert (lever la restriction)</option>
                    </select>
                  )}
                </div>
              )}

              {operation === "plan_restrictions" && (
                <div className="flex gap-4">
                  {(["true","false"] as const).map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" name="pr" checked={restrictionValue === v} onChange={() => setRestrictionValue(v)} />
                      <span>{v === "true" ? "Fermer le plan" : "Ouvrir le plan"}</span>
                    </label>
                  ))}
                </div>
              )}

              {operation === "price" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau tarif (EUR)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={priceValue} onChange={e => setPriceValue(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm outline-none focus:border-violet-500" placeholder="Ex: 150" />
                    <span className="text-sm font-semibold text-gray-500">€</span>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1.5">Applicable uniquement à la chambre et au plan de référence. La cascade se propagera automatiquement.</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Date ranges */}
          <div className="w-64 shrink-0 p-4 bg-violet-50 flex flex-col">
            <DateRangePicker
              ranges={dateRanges}
              onAdd={r => setDateRanges([...dateRanges, r])}
              onRemove={i => setDateRanges(dateRanges.filter((_, idx) => idx !== i))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-2xl">
          <div className="text-xs text-gray-500">
            {dateRanges.length > 0
              ? <span className="font-medium text-violet-700">{dateRanges.length} période(s) sélectionnée(s)</span>
              : "Sélectionnez au moins une période pour activer l'application"}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors text-sm">
              Annuler
            </button>
            <button
              onClick={handleApply}
              disabled={!applyable}
              className="px-6 py-2 bg-violet-500 text-white font-bold rounded-lg hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Appliquer les modifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
