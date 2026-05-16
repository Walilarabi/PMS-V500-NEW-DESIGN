import { ViewMode } from "../types";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { cn } from "../utils/cn";

const viewModes: { value: ViewMode; label: string }[] = [
  { value: "7days", label: "7 jours" },
  { value: "15days", label: "15 jours" },
  { value: "1month", label: "1 mois" },
];

export function ViewModeSelector() {
  const { viewMode, setViewMode } = useRateCalendarStore();

  return (
    <div className="flex items-center bg-violet-100 rounded-lg p-1">
      {viewModes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setViewMode(mode.value)}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-150",
            viewMode === mode.value
              ? "bg-violet-500 text-white shadow-sm"
              : "text-violet-600 hover:text-violet-700"
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
