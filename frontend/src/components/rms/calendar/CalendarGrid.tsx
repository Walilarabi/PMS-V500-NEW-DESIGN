import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useRateCalendarStore } from "../store/rateCalendarStore";
import { RoomSection } from "./RoomSection";
import { ChannelGrid } from "./ChannelGrid";
import { FilterBar } from "./FilterBar";
import { ViewModeSelector } from "./ViewModeSelector";
import { DateRangeSelector } from "./DateRangeSelector";
import { generateChannels } from "../data/channelData";
import { Loader2, Download, Printer, Undo2, Redo2, Save, CheckCircle2, Keyboard, Info, Filter } from "lucide-react";
import { cn } from "../utils/cn";
import { BulkUpdateModal } from "./BulkUpdateModal";
import { useToast } from "./Toast";
import { exportToCSV, printCalendar } from "../utils/exportPrint";

export const LABEL_W = 200;

export function CalendarGrid() {
  const {
    viewMode,
    dateColumns,
    roomTypes,
    channels,
    isLoading,
    lastSaved,
    loadData,
    startDate,
    toggleChannelClosed,
    reorderChannels,
    reorderRoomTypes,
    resetRoomTypesOrder,
    updateChannel,
    deleteChannel,
    addChannel,
    editedCells,
    selectedRoomTypeIds,
    selectedPlanNames,
    auditLogs,
  } = useRateCalendarStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [draggedRoomIndex, setDraggedRoomIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { success, info } = useToast();

  // Initialize
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (dateColumns.length > 0 && channels.length === 0) {
      reorderChannels(generateChannels(startDate, dateColumns.length));
    }
  }, [startDate, dateColumns.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowKeyboardHelp(p => !p);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        info("Sauvegarde", "Les modifications sont enregistrées automatiquement");
      }
      
      // ✅ COPIER/COLLER EXCEL-STYLE
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !e.shiftKey) {
        // Copier : pour l'instant on log juste, implémentation complète plus tard
        console.log('[RMS] Copy triggered');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && !e.shiftKey) {
        // Coller : pour l'instant on log juste, implémentation complète plus tard
        console.log('[RMS] Paste triggered');
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [info]);

  // Grid template
  const minColPx = viewMode === "7days" ? 90 : viewMode === "15days" ? 52 : 32;
  const colCount = dateColumns.length;
  const gridTemplate = `${LABEL_W}px repeat(${colCount}, minmax(${minColPx}px, 1fr))`;



  const filteredRoomTypes = useMemo(() => {
    if (selectedRoomTypeIds.length === 0) return roomTypes;
    return roomTypes.filter((room) => selectedRoomTypeIds.includes(room.roomTypeId));
  }, [roomTypes, selectedRoomTypeIds]);

  const visiblePlanNames = selectedPlanNames.length === 0 ? null : selectedPlanNames;

  // ✅ DRAG & DROP HANDLERS
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedRoomIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedRoomIndex === null || dragOverIndex === null) {
      setDraggedRoomIndex(null);
      setDragOverIndex(null);
      return;
    }

    if (draggedRoomIndex === dragOverIndex) {
      setDraggedRoomIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Réordonnancer
    const newRoomTypes = [...filteredRoomTypes];
    const [removed] = newRoomTypes.splice(draggedRoomIndex, 1);
    newRoomTypes.splice(dragOverIndex, 0, removed);
    
    // Reconstruire avec TOUS les roomTypes (pas juste filteredRoomTypes)
    const fullReordered = [...roomTypes];
    const filterSet = new Set(filteredRoomTypes.map(r => r.roomTypeId));
    const nonFiltered = fullReordered.filter(r => !filterSet.has(r.roomTypeId));
    const finalOrder = [...nonFiltered, ...newRoomTypes];
    
    reorderRoomTypes(finalOrder);
    success("Ordre mis à jour", "L'affichage des chambres a été réorganisé");
    
    setDraggedRoomIndex(null);
    setDragOverIndex(null);
  }, [draggedRoomIndex, dragOverIndex, filteredRoomTypes, roomTypes, reorderRoomTypes, success]);

  // Export/Print handlers
  const handleExport = useCallback(() => {
    exportToCSV(roomTypes, dateColumns);
    success("Export réussi", "Le fichier CSV a été téléchargé");
  }, [roomTypes, dateColumns, success]);

  const handlePrint = useCallback(() => {
    printCalendar();
    info("Impression", "La fenêtre d'impression s'est ouverte");
  }, [info]);

  // Auto-save indicator
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  useEffect(() => {
    if (lastSaved) {
      setShowSavedIndicator(true);
      const timer = setTimeout(() => setShowSavedIndicator(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
        <span className="ml-4 text-lg text-gray-600">Chargement du calendrier...</span>
      </div>
    );
  }

  const modifiedCount = editedCells.size;

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
      {/* Top toolbar - Violet 500 theme */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0 gap-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-800">Calendrier</h1>
          <div className="flex items-center gap-2">
            <ViewModeSelector />
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-sm font-semibold rounded-md hover:bg-violet-600 transition-colors shadow-sm"
            >
              <Filter className="w-3.5 h-3.5" />
              Modifier en masse
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeSelector />

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-sm font-semibold rounded-md hover:bg-violet-600 transition-colors"
              title="Exporter en CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-sm font-semibold rounded-md hover:bg-violet-600 transition-colors"
              title="Imprimer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer
            </button>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors border",
                showFilters ? "bg-violet-500 text-white border-violet-500" : "bg-white text-violet-700 border-violet-300 hover:bg-violet-50"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtres
            </button>
            <button
              onClick={() => {
                if (confirm("Réinitialiser l'ordre d'affichage des chambres ?")) {
                  resetRoomTypesOrder();
                  success("Ordre réinitialisé", "L'ordre par défaut a été restauré");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-50 transition-colors border border-gray-300"
              title="Réinitialiser l'ordre des chambres"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Reset Ordre
            </button>
          </div>

          <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
            <button
              onClick={() => info("Annuler", "Fonctionnalité à venir")}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
              title="Annuler (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => info("Rétablir", "Fonctionnalité à venir")}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
              title="Rétablir (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowKeyboardHelp(true)}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
              title="Raccourcis clavier (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Save indicator */}
      {showSavedIndicator && (
        <div className="flex items-center justify-center gap-1.5 py-1 bg-emerald-50 border-b border-emerald-200 text-emerald-700 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Modifications enregistrées automatiquement
          {lastSaved && <span className="text-emerald-500">· {lastSaved.toLocaleTimeString("fr-FR")}</span>}
        </div>
      )}

      {/* Modified cells indicator */}
      {modifiedCount > 0 && !showSavedIndicator && (
        <div className="flex items-center justify-center gap-1.5 py-1 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-medium">
          <Save className="w-3.5 h-3.5" />
          {modifiedCount} modification{modifiedCount > 1 ? "s" : ""} en attente de synchronisation...
        </div>
      )}

      {/* Filters */}
      <FilterBar showFilters={showFilters} />

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0 overflow-x-auto">
        <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <div className="flex items-center gap-3 text-[11px] text-gray-500 whitespace-nowrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Ouvert</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Fermé</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Restriction</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" /> Modifié</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-violet-50 border border-violet-200" /> Référence</span>
          <span className="font-medium text-gray-400 ml-2">Priorité : Restrictions → Inventaire → Fermeture → Prix → Cascade</span>
        </div>
      </div>

      {showBulkModal && <BulkUpdateModal onClose={() => setShowBulkModal(false)} />}

      {/* Main scrollable area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto w-full">
        <div className="w-full">
          {/* Channel grid */}
          <ChannelGrid
            dateColumns={dateColumns}
            gridTemplate={gridTemplate}
            channels={channels}
            onToggleClose={toggleChannelClosed}
            onReorderChannels={reorderChannels}
            onUpdateChannel={updateChannel}
            onDeleteChannel={deleteChannel}
            onAddChannel={addChannel}
          />

          {/* Date headers */}
          <div className="sticky top-0 z-30 border-b-2 border-gray-300 bg-white w-full" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
            <div className="sticky left-0 z-40 bg-white border-r border-gray-300" style={{ width: LABEL_W }} />
            {dateColumns.map((col, idx) => (
              <div
                key={col.date}
                className={cn(
                  "flex flex-col items-center justify-center border-r border-gray-200 py-1.5 overflow-hidden",
                  col.isWeekend && "bg-gray-50",
                  col.isToday && "bg-violet-50"
                )}
              >
                <span className="text-[9px] text-gray-400 font-medium uppercase leading-none">{col.dayOfWeek}</span>
                <span className={cn("text-sm font-bold leading-tight", col.isToday ? "text-violet-600" : "text-gray-700")}>
                  {col.dayOfMonth}
                </span>
                {(idx === 0 || col.dayOfMonth === 1) && (
                  <span className="text-[8px] text-gray-400 leading-none">{col.month}</span>
                )}
              </div>
            ))}
          </div>

          {/* Room sections */}
          {filteredRoomTypes.map((roomType, index) => (
            <div
              key={roomType.roomTypeId}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "transition-all duration-200",
                draggedRoomIndex === index && "opacity-40",
                dragOverIndex === index && draggedRoomIndex !== index && "border-t-4 border-violet-500"
              )}
            >
              <RoomSection
                roomType={roomType}
                gridTemplate={gridTemplate}
                colCount={colCount}
                visiblePlanNames={visiblePlanNames}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard help modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Raccourcis clavier</h2>
            <div className="space-y-2.5 text-sm">
              {[
                ["Éditer une cellule", "Clic / Entrée / Chiffre"],
                ["Date suivante", "Tab"],
                ["Date précédente", "Shift + Tab"],
                ["Valider sans bouger", "Entrée"],
                ["Annuler", "Échap"],
                ["Sauvegarder", "Ctrl + S"],
                ["Aide", "?"],
              ].map(([label, key]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-gray-600">{label}</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">{key}</kbd>
                </div>
              ))}
            </div>
            <button onClick={() => setShowKeyboardHelp(false)} className="mt-5 w-full py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors text-sm font-medium">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Audit log */}
      {auditLogs.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-[400px] rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Historique des modifications</span>
            <span className="text-[9px] text-gray-400">Traçabilité</span>
          </div>
          <div className="max-h-48 overflow-auto p-2 space-y-1.5">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-gray-50 px-3 py-2 text-[11px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-gray-700 truncate">{log.action}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold shrink-0", log.result === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                    {log.result}
                  </span>
                </div>
                <div className="text-gray-400 truncate mt-0.5">{log.at} · {log.target}</div>
                <div className="text-gray-500 truncate mt-0.5">{log.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
