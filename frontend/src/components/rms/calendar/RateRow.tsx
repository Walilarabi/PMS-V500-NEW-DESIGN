import { memo, useCallback, useMemo } from "react";
import { RatePlanData, RatePrice } from "../types";
import { RateCell } from "./RateCell";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { cn } from "../utils/cn";
import { LABEL_W } from "./CalendarGrid";
import { dedupRatePrices } from "../engines/RateCalendarDedupEngine";

export interface RateRowProps {
  roomTypeId: string;
  plan: RatePlanData;
  gridTemplate: string;
  isReferencePlan: boolean;
  isReferenceRoom: boolean;
}

export const RateRow = memo(function RateRow({
  roomTypeId,
  plan,
  gridTemplate,
  isReferencePlan,
  isReferenceRoom,
}: RateRowProps) {
  const {
    activeCell,
    editedCells,
    getCellKey,
    updatePrice,
    updatePlanRestriction,
    setActiveCell,
    getNextEditableCell,
    openRatePanel,
  } = useRateCalendarStore();

  const handlePriceChange = useCallback(
    (date: string, newPrice: number) => updatePrice(roomTypeId, plan.planId, date, newPrice),
    [roomTypeId, plan.planId, updatePrice]
  );

  const handleFocus = useCallback(
    (date: string) => setActiveCell({ roomTypeId, planId: plan.planId, date }),
    [roomTypeId, plan.planId, setActiveCell]
  );

  const handleTab = useCallback(
    (date: string, direction: "next" | "prev") => {
      const next = getNextEditableCell(roomTypeId, plan.planId, date, direction);
      if (next) setActiveCell(next);
    },
    [roomTypeId, plan.planId, getNextEditableCell, setActiveCell]
  );

  // Garde-fou final contre les doublons de prices (même date apparue
  // plusieurs fois) — symptôme du bug "3 lignes tarifaires" après push RMS.
  // Le moteur dédoublonne aussi au load + adapter, ceci est défensif.
  const dedupedPrices = useMemo<RatePrice[]>(() => dedupRatePrices(plan.prices), [plan.prices]);

  return (
    <div
      className="border-b border-gray-200 hover:bg-gray-50/40 transition-colors w-full"
      style={{ display: "grid", gridTemplateColumns: gridTemplate }}
    >
      {/* Plan name — sticky left */}
      <div
        className={cn(
          "sticky left-0 z-20 flex flex-col justify-center px-3 py-1.5 border-r border-gray-200 bg-white shrink-0 overflow-hidden",
          isReferencePlan && "bg-blue-50"
        )}
        style={{ width: LABEL_W }}
      >
        <div className="flex items-center gap-1.5 cursor-pointer group/name" onClick={() => openRatePanel(plan.planId, roomTypeId)}>
          <span className={cn("text-sm font-bold group-hover/name:text-violet-600 transition-colors", isReferencePlan ? "text-blue-700" : "text-gray-700")}>
            {plan.planName}
          </span>
          {isReferencePlan && (
            <span className="text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-bold">REF</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-gray-400">x2 Tarif de vente</span>
          <button className="text-[10px] text-blue-500 hover:text-blue-600 font-medium">Modifier</button>
        </div>
      </div>

      {/* Price cells — each is a CSS grid cell, automatically sized by 1fr */}
      {dedupedPrices.map((price) => {
        const cellKey = getCellKey(roomTypeId, plan.planId, price.date);
        const isActive =
          activeCell?.roomTypeId === roomTypeId &&
          activeCell?.planId === plan.planId &&
          activeCell?.date === price.date;
        const isEdited = editedCells.has(cellKey);

        return (
          <RateCell
            key={cellKey}
            price={price}
            isActive={isActive}
            isEdited={isEdited}
            canEditPrice={true}  // ✅ TOUTES chambres éditables (cascade désactivée temporairement)
            onPriceChange={(newPrice) => handlePriceChange(price.date, newPrice)}
            onTogglePlanRestriction={() =>
              updatePlanRestriction(roomTypeId, plan.planId, price.date, !price.planClosed)
            }
            onFocus={() => handleFocus(price.date)}
            onTab={(dir) => handleTab(price.date, dir)}
          />
        );
      })}
    </div>
  );
});
