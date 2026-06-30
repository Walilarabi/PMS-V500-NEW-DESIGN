import { useState, useRef, useCallback, useEffect, memo } from "react";
import { RatePrice, CellStatus } from "../types";
import { cn } from "../utils/cn";

interface RateCellProps {
  price: RatePrice;
  isActive: boolean;
  isEdited: boolean;
  canEditPrice: boolean;
  onPriceChange: (newPrice: number) => void;
  onTogglePlanRestriction: () => void;
  onFocus: () => void;
  onTab: (direction: "next" | "prev") => void;
}

export const RateCell = memo(function RateCell({
  price,
  isActive,
  isEdited,
  canEditPrice,
  onPriceChange,
  onTogglePlanRestriction,
  onFocus,
  onTab,
}: RateCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(price.price.toString());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    if (!isEditing && !isProcessing.current) {
      setEditValue(price.price.toString());
    }
  }, [price.price, isEditing]);

  useEffect(() => {
    if (isActive && !isEditing && !isProcessing.current) {
      requestAnimationFrame(() => {
        containerRef.current?.focus();
      });
    }
  }, [isActive, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const saveValue = useCallback(() => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue >= 0 && numValue !== price.price) {
      onPriceChange(numValue);
    }
  }, [editValue, price.price, onPriceChange]);

  const saveAndExit = useCallback(() => {
    saveValue();
    setIsEditing(false);
    isProcessing.current = false;
  }, [saveValue]);

  const cancelEdit = useCallback(() => {
    setEditValue(price.price.toString());
    setIsEditing(false);
    isProcessing.current = false;
  }, [price.price]);

  const handleClick = useCallback(() => {
    if (!canEditPrice || isProcessing.current) return;
    onFocus();
    setEditValue(price.price.toString());
    setIsEditing(true);
  }, [onFocus, price.price, canEditPrice]);

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isEditing) return;
      if (!canEditPrice) return;

      if (e.key === "Tab") {
        e.preventDefault();
        onTab(e.shiftKey ? "prev" : "next");
      } else if (e.key === "Enter" || /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        onFocus();
        setIsEditing(true);
        if (/^[0-9]$/.test(e.key)) {
          setEditValue(e.key);
        } else {
          setEditValue(price.price.toString());
        }
      }
    },
    [isEditing, canEditPrice, onTab, onFocus, price.price]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        isProcessing.current = true;
        saveValue();
        setIsEditing(false);
        const direction = e.shiftKey ? "prev" : "next";
        requestAnimationFrame(() => {
          onTab(direction);
          isProcessing.current = false;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        saveAndExit();
        requestAnimationFrame(() => {
          containerRef.current?.focus();
        });
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
        requestAnimationFrame(() => {
          containerRef.current?.focus();
        });
      }
    },
    [saveValue, saveAndExit, cancelEdit, onTab]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setEditValue(value);
    }
  }, []);

  const getStatusBg = (status: CellStatus) => {
    switch (status) {
      case "closed": return "bg-red-50/40";
      case "restricted": return "bg-orange-50/40";
      default: return "";
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={canEditPrice ? 0 : -1}
      className={cn(
        "relative flex flex-col items-center justify-center border-r border-gray-200 outline-none transition-all duration-75 h-12 overflow-hidden",
        getStatusBg(price.status),
        isActive && !isEditing && "ring-2 ring-blue-500 ring-inset z-10 bg-blue-50/50",
        isEdited && !isActive && "bg-yellow-50/60",
        !canEditPrice && "cursor-default"
      )}
      onClick={canEditPrice ? handleClick : undefined}
      onFocus={canEditPrice ? onFocus : undefined}
      onKeyDown={handleContainerKeyDown}
    >
      {/* Plan open/close dot — small round dot, click to toggle */}
      <button
        type="button"
        className={cn(
          "absolute top-1 left-1 w-2.5 h-2.5 rounded-full border transition-colors",
          price.planClosed
            ? "bg-red-500 border-red-600 hover:bg-red-400"
            : "bg-emerald-500 border-emerald-600 hover:bg-emerald-400"
        )}
        onClick={(event) => {
          event.stopPropagation();
          onTogglePlanRestriction();
        }}
        title={price.planClosed ? "Rouvrir ce plan" : "Fermer ce plan"}
      />

      {/* Currency */}
      <span className="text-[9px] text-gray-400 font-medium leading-none mb-0.5">
        {price.currency}
      </span>

      {isEditing && canEditPrice ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleInputKeyDown}
          className="w-[90%] text-center text-sm font-bold bg-white border-2 border-blue-500 rounded px-0.5 py-0 focus:outline-none"
        />
      ) : (
        <span
          className={cn(
            "text-sm font-bold leading-none",
            price.planClosed && "text-red-400 line-through",
            !price.planClosed && price.status === "closed" && "text-red-600",
            !price.planClosed && price.status === "restricted" && "text-orange-600",
            !price.planClosed && price.status === "open" && "text-gray-800",
            isEdited && "text-amber-700"
          )}
        >
          {price.price}
        </span>
      )}
    </div>
  );
});
