import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { cn } from "../utils/cn";

export function DateRangeSelector() {
  const { startDate, setStartDate, viewMode } = useRateCalendarStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const daysOffset = viewMode === "7days" ? 7 : viewMode === "15days" ? 15 : 31;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const prevPeriod = () => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() - daysOffset);
    setStartDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + daysOffset);
    setStartDate(newDate);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Generate calendar grid
  const generateCalendarDays = () => {
    const days: Date[] = [];
    const firstDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const startOfGrid = new Date(firstDayOfMonth);
    startOfGrid.setDate(startOfGrid.getDate() - firstDayOfMonth.getDay() + 1);

    for (let i = 0; i < 42; i++) {
      const day = new Date(startOfGrid);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1">
        <button
          onClick={prevPeriod}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="Période précédente"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">
            {formatDate(startDate)}
          </span>
          <span className="text-violet-400">→</span>
          <span className="text-sm font-medium text-gray-700">
            {formatDate(new Date(startDate.getTime() + (daysOffset - 1) * 24 * 60 * 60 * 1000))}
          </span>
          <Calendar className="w-4 h-4 text-violet-500 ml-1" />
        </button>

        <button
          onClick={nextPeriod}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="Période suivante"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[320px]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700 capitalize">
              {startDate.toLocaleString("fr-FR", { month: "long", year: "numeric" })}
            </h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {["L", "M", "M", "J", "V", "S", "D"].map((day, i) => (
              <div key={i} className="text-xs font-semibold text-gray-500 py-2">
                {day}
              </div>
            ))}
            {generateCalendarDays().map((day, i) => {
              const isToday = new Date().toDateString() === day.toDateString();
              const isSelected = day.toDateString() === startDate.toDateString();
              const isCurrentMonth = day.getMonth() === startDate.getMonth();

              return (
                <button
                  key={i}
                  onClick={() => {
                    setStartDate(day);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "py-2 rounded-lg text-sm transition-all duration-150",
                    isSelected
                      ? "bg-violet-500 text-white shadow-md"
                      : isToday
                      ? "bg-violet-100 text-violet-700 font-semibold"
                      : isCurrentMonth
                      ? "hover:bg-gray-100 text-gray-700"
                      : "text-gray-300 hover:bg-gray-50"
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                setStartDate(new Date());
                setIsOpen(false);
              }}
              className="w-full py-2 text-sm text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
            >
              Aller à aujourd'hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
