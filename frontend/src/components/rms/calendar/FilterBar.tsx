import { memo, useEffect, useRef, useState, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { RoomManagerPanel } from "./RoomManagerPanel";
import { RateManagerPanel } from "./RateManagerPanel";
import { ConnectivityPanel } from "./ConnectivityPanel";
import { cn } from "../utils/cn";

function FilterSelect({
  title,
  allLabel,
  options,
  selected,
  onChange,
}: {
  title: string;
  allLabel: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const allActive = selected.length === options.length;
  const noneActive = selected.length === 0;

  const display = allActive
    ? allLabel
    : noneActive
      ? "Aucun sélectionné"
      : selected.length === 1
        ? options.find((o) => o.id === selected[0])?.label ?? title
        : `${selected.length} sélectionnés`;

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-10 min-w-[220px] items-center justify-between gap-3 rounded-lg border px-3 text-sm font-medium transition-all",
          open || !allActive
            ? "border-violet-500 bg-white text-violet-700 shadow-sm"
            : "border-violet-200 bg-white text-slate-700 hover:border-violet-300"
        )}
      >
        <span className="truncate"><span className="text-violet-600 font-bold">{title} :</span> {display}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-slide-in">
          <div className="border-b border-slate-100 p-3 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrer par {title.toLowerCase()}</p>
               <button onClick={() => setOpen(false)}><X className="w-3 h-3 text-slate-400" /></button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Recherche rapide..." className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-violet-500" />
            </div>
          </div>
          
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 bg-white">
            <button onClick={() => onChange(options.map(o => o.id))} className={cn("flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all", allActive ? "bg-violet-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>Tout sélectionner</button>
            <button onClick={() => onChange([])} className={cn("flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all", noneActive ? "bg-violet-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>Aucun</button>
          </div>

          <div className="max-h-72 overflow-auto p-1.5">
            {filtered.map((option) => {
              const active = selected.includes(option.id);
              return (
                <button key={option.id} onClick={() => toggle(option.id)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors", active ? "bg-violet-50 text-violet-700" : "text-slate-700 hover:bg-slate-50")}>
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded border transition-all", active ? "border-violet-500 bg-violet-500 text-white" : "border-slate-300 bg-white")}>{active && <Check className="h-3 w-3" />}</span>
                  <span className="truncate font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const FilterBar = memo(function FilterBar({ showFilters }: { showFilters: boolean }) {
  const { 
    roomTypes, 
    selectedRoomTypeIds, setSelectedRoomTypeIds,
    selectedPlanNames, setSelectedPlanNames
  } = useRateCalendarStore();

  const allPlanNames = useMemo(() => {
    const set = new Set<string>();
    roomTypes.forEach(r => r.ratePlans.forEach(p => set.add(p.planName)));
    return Array.from(set).map(name => ({ id: name, label: name }));
  }, [roomTypes]);

  const roomOptions = useMemo(() => roomTypes.map(r => ({ id: r.roomTypeId, label: r.roomTypeName })), [roomTypes]);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-violet-200 bg-violet-50/50 px-4 py-2.5">
      <span className="text-sm font-semibold text-gray-700">Gérer</span>
      <RoomManagerPanel />
      <RateManagerPanel />
      <ConnectivityPanel />
      
      {showFilters && (
        <div className="ml-2 flex flex-wrap items-center gap-3 border-l border-violet-200 pl-4 animate-fade-in">
          <FilterSelect
            title="Chambres"
            allLabel="Toutes les chambres"
            options={roomOptions}
            selected={selectedRoomTypeIds}
            onChange={setSelectedRoomTypeIds}
          />
          <FilterSelect
            title="Tarifs"
            allLabel="Tous les tarifs"
            options={allPlanNames}
            selected={selectedPlanNames}
            onChange={setSelectedPlanNames}
          />
        </div>
      )}
    </div>
  );
});
