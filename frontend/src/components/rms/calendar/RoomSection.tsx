import React, { memo, useCallback, useMemo, useState } from "react";
import type { RatePlanData, RoomStatus } from "../types";
import { RoomTypeData, InventoryOverride } from "../types";
import { RateRow } from "./RateRow";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { BedDouble } from "lucide-react";
import { cn } from "../utils/cn";
import { LABEL_W } from "./CalendarGrid";
import { dedupRatePlans, dedupRoomStatuses } from "../engines/RateCalendarDedupEngine";

/* ─── Inline-editable inventory cell ─── */

interface InventoryCellProps {
  value: number;
  capacity: number;
  override?: InventoryOverride;
  onChange: (v: number) => void;
}

const InventoryCell: React.FC<InventoryCellProps> = ({
  value,
  capacity,
  override,
  onChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 0) onChange(n);
    setEditing(false);
  };
  return (
    <div
      className={cn(
        "flex items-center justify-center border-r border-gray-200 text-sm font-semibold cursor-pointer hover:bg-gray-50 transition-colors",
        override === "force_open" && "bg-blue-50 text-blue-700",
        override === "manual_closed" && "bg-red-50 text-red-700"
      )}
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      title={`Capacité ${capacity}. 0 = fermeture, > capacité = overbooking`}
    >
      {editing ? (
        <input
          autoFocus
          className="w-[80%] rounded border-2 border-blue-500 px-0.5 text-center outline-none text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

/* ─── Inline-editable stay restriction cell (number | null) ─── */

interface NumberCellProps {
  value?: number | null;
  onChange: (v: number | null) => void;
}

const NumberCell: React.FC<NumberCellProps> = ({ value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ? String(value) : "");
  const commit = () => {
    const n = draft.trim() === "" ? null : parseInt(draft, 10);
    if (n === null || (!isNaN(n) && n >= 0)) onChange(n);
    setEditing(false);
  };
  return (
    <div
      className={cn(
        "flex items-center justify-center border-r border-gray-200 text-xs cursor-pointer hover:bg-gray-50 transition-colors",
        value ? "bg-orange-50 text-orange-700 font-bold" : "text-gray-300"
      )}
      onClick={() => { setDraft(value ? String(value) : ""); setEditing(true); }}
    >
      {editing ? (
        <input
          autoFocus
          className="w-[80%] rounded border border-orange-500 px-0.5 text-center outline-none text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
      ) : (
        value ?? "–"
      )}
    </div>
  );
}

/* ─── Toggle restriction cell (boolean) ─── */

const ToggleCell: React.FC<{ value?: boolean; onToggle: () => void }> = ({ value, onToggle }) => {
  return (
    <button
      className={cn(
        "flex items-center justify-center border-r border-gray-200 text-xs font-bold transition-colors",
        value ? "bg-red-100 text-red-700 hover:bg-red-200" : "text-gray-300 hover:bg-gray-50"
      )}
      onClick={onToggle}
    >
      {value ? "Ferm." : "–"}
    </button>
  );
}

/* ─── RoomSection ─── */

export interface RoomSectionProps {
  roomType: RoomTypeData;
  gridTemplate: string;
  colCount: number;
  visiblePlanNames: string[] | null;
}

export const RoomSection = memo(function RoomSection({
  roomType,
  gridTemplate,
  visiblePlanNames,
}: RoomSectionProps) {
  const {
    expandedRooms,
    toggleRoom,
    rulesEngine,
    updateInventory,
    updateStayRestriction,
    updateArrivalDepartureRestriction,
  } = useRateCalendarStore();

  const [restrictionsOpen, setRestrictionsOpen] = useState(false);

  const isExpanded = expandedRooms[roomType.roomTypeId] ?? true;
  const isRefRoom = rulesEngine.isReferenceRoom(roomType.roomTypeId);

  const handleToggle = useCallback(() => toggleRoom(roomType.roomTypeId), [roomType.roomTypeId, toggleRoom]);

  // Garde-fou final contre les doublons (le load fait déjà le ménage,
  // mais ceci protège des injections runtime depuis la cascade / l'import).
  const dedupedPlans = useMemo<RatePlanData[]>(() => dedupRatePlans(roomType.ratePlans), [roomType.ratePlans]);
  const dedupedStatuses = useMemo<RoomStatus[]>(() => dedupRoomStatuses(roomType.statuses), [roomType.statuses]);
  const filteredPlans = visiblePlanNames
    ? dedupedPlans.filter((p) => visiblePlanNames.includes(p.planName))
    : dedupedPlans;

  return (
    <div className="border-b border-gray-300 w-full">
      {/* Room header — full width, not a grid row so it can be sticky independently */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2.5 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors",
          isRefRoom ? "bg-blue-50" : "bg-white"
        )}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] select-none">{isExpanded ? "▼" : "▶"}</span>
          <BedDouble className={cn("w-4 h-4 shrink-0", isRefRoom ? "text-blue-600" : "text-gray-400")} />
          <h3 className={cn("font-semibold text-sm", isRefRoom ? "text-blue-800" : "text-gray-800")}>
            {roomType.roomTypeName}
            <span className="text-gray-400 font-normal ml-1.5 text-xs">({roomType.roomTypeCode})</span>
            {isRefRoom && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">RÉF.</span>}
          </h3>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Status row */}
          <div className="w-full border-b border-gray-200" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
            <div className="sticky left-0 z-20 flex items-center px-3 py-1.5 border-r border-gray-200 bg-gray-50" style={{ width: LABEL_W }}>
              <span className="text-xs font-medium text-gray-500">Statut de la chambre</span>
            </div>
            {dedupedStatuses.map((s: RoomStatus) => (
              <div
                key={s.date}
                className={cn(
                  "flex items-center justify-center border-r border-gray-200 text-[10px] font-semibold overflow-hidden py-1.5",
                  s.status === "open" && "bg-emerald-500 text-white",
                  s.status === "closed" && "bg-red-500 text-white",
                  s.status === "restricted" && "bg-orange-500 text-white"
                )}
              >
                <span className="truncate px-0.5">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Inventory row */}
          <div className="w-full border-b border-gray-200" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
            <div className="sticky left-0 z-20 flex items-center px-3 py-1 border-r border-gray-200 bg-white" style={{ width: LABEL_W }}>
              <span className="text-xs text-gray-500">Nb. inventaires disponibles</span>
            </div>
            {dedupedStatuses.map((s: RoomStatus) => (
              <InventoryCell
                key={s.date}
                value={s.inventory}
                capacity={s.capacity ?? roomType.capacity ?? 0}
                override={s.override}
                onChange={(v) => updateInventory(roomType.roomTypeId, s.date, v)}
              />
            ))}
          </div>

          {/* Sold + restrictions toggle */}
          <div className="w-full border-b border-gray-200" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
            <div
              className="sticky left-0 z-20 flex items-center gap-1 px-3 py-1 border-r border-gray-200 bg-white cursor-pointer select-none hover:bg-gray-50"
              style={{ width: LABEL_W }}
              onClick={() => setRestrictionsOpen((o) => !o)}
            >
              <span className={cn("text-[10px] transition-transform inline-block", restrictionsOpen ? "rotate-0" : "-rotate-90")}>▼</span>
              <span className="text-xs text-gray-500">Inventaire disponible vendu</span>
            </div>
            {dedupedStatuses.map((s: RoomStatus) => (
              <div key={s.date} className="flex items-center justify-center border-r border-gray-200 text-sm text-gray-500">
                {s.sold > 0 ? s.sold : ""}
              </div>
            ))}
          </div>

          {/* Collapsible restrictions */}
          {restrictionsOpen && (
            <>
              {/* Min Stay */}
              <div className="w-full border-b border-gray-100 bg-gray-50/30" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
                <div className="sticky left-0 z-20 flex items-center pl-7 pr-2 py-1 border-r border-gray-200 bg-gray-50/60" style={{ width: LABEL_W }}>
                  <span className="text-[11px] text-gray-400">Min Stay</span>
                </div>
                {dedupedStatuses.map((s: RoomStatus) => (
                  <NumberCell
                    key={s.date}
                    value={s.minStay}
                    onChange={(v) => updateStayRestriction(roomType.roomTypeId, s.date, "minStay", v)}
                  />
                ))}
              </div>

              {/* Max Stay */}
              <div className="w-full border-b border-gray-100 bg-gray-50/30" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
                <div className="sticky left-0 z-20 flex items-center pl-7 pr-2 py-1 border-r border-gray-200 bg-gray-50/60" style={{ width: LABEL_W }}>
                  <span className="text-[11px] text-gray-400">Max Stay</span>
                </div>
                {dedupedStatuses.map((s: RoomStatus) => (
                  <NumberCell
                    key={s.date}
                    value={s.maxStay}
                    onChange={(v) => updateStayRestriction(roomType.roomTypeId, s.date, "maxStay", v)}
                  />
                ))}
              </div>

              {/* CTA */}
              <div className="w-full border-b border-gray-100 bg-gray-50/30" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
                <div className="sticky left-0 z-20 flex items-center pl-7 pr-2 py-1 border-r border-gray-200 bg-gray-50/60" style={{ width: LABEL_W }}>
                  <span className="text-[11px] text-gray-400">CTA (Closed to Arrival)</span>
                </div>
                {dedupedStatuses.map((s: RoomStatus) => (
                  <ToggleCell
                    key={s.date}
                    value={s.cta}
                    onToggle={() => updateArrivalDepartureRestriction(roomType.roomTypeId, s.date, "cta", !s.cta)}
                  />
                ))}
              </div>

              {/* CTD */}
              <div className="w-full border-b border-gray-100 bg-gray-50/30" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
                <div className="sticky left-0 z-20 flex items-center pl-7 pr-2 py-1 border-r border-gray-200 bg-gray-50/60" style={{ width: LABEL_W }}>
                  <span className="text-[11px] text-gray-400">CTD (Closed to Departure)</span>
                </div>
                {dedupedStatuses.map((s: RoomStatus) => (
                  <ToggleCell
                    key={s.date}
                    value={s.ctd}
                    onToggle={() => updateArrivalDepartureRestriction(roomType.roomTypeId, s.date, "ctd", !s.ctd)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Rate plan rows */}
          {filteredPlans.map((plan) => (
            <RateRow
              key={plan.planId}
              roomTypeId={roomType.roomTypeId}
              plan={plan}
              gridTemplate={gridTemplate}
              isReferencePlan={rulesEngine.isReferencePlan(plan.planId)}
              isReferenceRoom={isRefRoom}
            />
          ))}
        </>
      )}
    </div>
  );
});
