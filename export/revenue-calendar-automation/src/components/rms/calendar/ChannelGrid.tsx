import { useState, useMemo, useCallback, memo } from "react";
import { DateColumn, ChannelData, OTALogoType } from "../types";
import { cn } from "../utils/cn";
import { LABEL_W } from "./CalendarGrid";
import { PARTNERS, getPartnerLogo, PartnerKey } from "../data/partnerLogos";
import { Plus } from "lucide-react";

interface ChannelGridProps {
  dateColumns: DateColumn[];
  gridTemplate: string;
  channels: ChannelData[];
  onToggleClose: (channelId: string, date: string) => void;
  onReorderChannels: (channels: ChannelData[]) => void;
  onUpdateChannel: (channelId: string, updates: Partial<ChannelData>) => void;
  onDeleteChannel: (channelId: string) => void;
  onAddChannel: (channel: ChannelData) => void;
}

const ALL_LOGO_KEYS = Object.keys(PARTNERS) as PartnerKey[];

// ─── Main component ────────────────────────────────────────────────────────────
export const ChannelGrid = memo(function ChannelGrid({
  dateColumns,
  gridTemplate,
  channels,
  onToggleClose,
  onReorderChannels,
  onUpdateChannel,
  onDeleteChannel,
  onAddChannel,
}: ChannelGridProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; comm: number; logo: OTALogoType }>({
    name: "",
    comm: 0,
    logo: "default",
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState<{ name: string; comm: number; logo: OTALogoType }>({
    name: "",
    comm: 15,
    logo: "default",
  });

  // Sort by commission ascending
  const sortedChannels = useMemo(
    () => [...channels].sort((a, b) => a.commission - b.commission),
    [channels]
  );

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const arr = [...channels];
    const from = arr.findIndex(c => c.channelId === draggedId);
    const to = arr.findIndex(c => c.channelId === targetId);
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onReorderChannels(arr);
    setDraggedId(null);
    setDragOverId(null);
  };
  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };

  // Edit
  const startEdit = useCallback((ch: ChannelData) => {
    setEditingId(ch.channelId);
    setEditForm({ name: ch.channelName, comm: ch.commission, logo: ch.logoType });
  }, []);
  const saveEdit = useCallback(() => {
    if (editingId) onUpdateChannel(editingId, { channelName: editForm.name, commission: editForm.comm, logoType: editForm.logo });
    setEditingId(null);
  }, [editingId, editForm, onUpdateChannel]);
  const cancelEdit = () => setEditingId(null);

  // Add
  const commitAdd = () => {
    if (!newForm.name.trim()) return;
    onAddChannel({
      channelId: `ch_${Date.now()}`,
      channelName: newForm.name.trim(),
      commission: newForm.comm,
      logoType: newForm.logo,
      closedDates: [],
    });
    setNewForm({ name: "", comm: 15, logo: "default" });
    setShowAddForm(false);
  };

  return (
    <div className="border-b border-gray-200 w-full">
      {/* Section header - same style as Mes Chambres / Mes Tarifs / Connectivité CM */}
      <div className="flex items-center gap-3 px-4 py-2 bg-violet-50/50 border-b border-violet-100">
        <button
          onClick={() => setIsOpen(o => !o)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 bg-white text-violet-700 border-violet-200 hover:bg-violet-50 hover:border-violet-300 hover:shadow-sm"
        >
          <span className={cn("text-xs transition-transform inline-block duration-200", isOpen ? "rotate-0" : "-rotate-90")}>▼</span>
          <span>Canaux de distribution</span>
        </button>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-violet-200 bg-white text-violet-600 hover:bg-violet-50 hover:border-violet-300 transition-all duration-200"
          title="Ajouter un canal"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-violet-50 border-b border-violet-200 px-4 py-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-600 font-medium mb-1">Nom du canal</label>
            <input
              autoFocus
              value={newForm.name}
              onChange={e => setNewForm({ ...newForm, name: e.target.value })}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-violet-500 w-48"
              placeholder="Ex: Booking.com Premium"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 font-medium mb-1">Commission (%)</label>
            <input
              type="number"
              value={newForm.comm}
              onChange={e => setNewForm({ ...newForm, comm: parseFloat(e.target.value) || 0 })}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-violet-500 w-24"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 font-medium mb-1">Partenaire / Logo</label>
            <select
              value={newForm.logo}
              onChange={e => setNewForm({ ...newForm, logo: e.target.value as OTALogoType })}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-violet-500 bg-white w-40"
            >
              {ALL_LOGO_KEYS.map(k => (
                <option key={k} value={k}>{PARTNERS[k].name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={commitAdd} className="px-4 py-2 bg-violet-500 text-white text-sm font-semibold rounded-lg hover:bg-violet-600 transition-colors">
              Ajouter
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="w-full">
          {/* Date sub-header */}
          <div className="border-b border-gray-200 bg-gray-50 w-full" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
            <div className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 flex items-center px-3 py-1.5 text-[10px] text-gray-400 font-medium" style={{ width: LABEL_W }}>
              Partenaire · Glisser pour réordonner · Double-clic pour modifier
            </div>
            {dateColumns.map(col => (
              <div
                key={`ch-hdr-${col.date}`}
                className={cn("flex flex-col items-center justify-center border-r border-gray-200 py-1 overflow-hidden", col.isWeekend && "bg-gray-100")}
              >
                <span className="text-[9px] text-gray-400">{col.dayOfWeek[0]}</span>
                <span className="text-[10px] font-bold text-gray-600">{col.dayOfMonth}</span>
              </div>
            ))}
          </div>

          {/* Channel rows */}
          {sortedChannels.map(channel => {
            const partner = getPartnerLogo(channel.logoType as PartnerKey);
            const isDragging = draggedId === channel.channelId;
            const isDragOver = dragOverId === channel.channelId && draggedId !== channel.channelId;

            return (
              <div
                key={channel.channelId}
                draggable
                onDragStart={e => handleDragStart(e, channel.channelId)}
                onDragOver={e => handleDragOver(e, channel.channelId)}
                onDrop={e => handleDrop(e, channel.channelId)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "border-b border-gray-100 w-full transition-all",
                  isDragging && "opacity-40",
                  isDragOver && "border-t-2 border-t-blue-500"
                )}
                style={{ display: "grid", gridTemplateColumns: gridTemplate }}
              >
                {/* Label cell */}
                <div
                  className="sticky left-0 z-20 bg-white border-r border-gray-200 flex items-center gap-2 px-2 py-1.5 cursor-grab active:cursor-grabbing"
                  style={{ width: LABEL_W }}
                >
                  {/* Logo badge */}
                  <div className="shrink-0">{partner.logo}</div>

                  {/* Edit mode */}
                  {editingId === channel.channelId ? (
                    <div className="flex flex-col gap-1 w-full" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        className="rounded border border-blue-400 px-1.5 text-xs outline-none w-full"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editForm.comm}
                          onChange={e => setEditForm({ ...editForm, comm: parseFloat(e.target.value) || 0 })}
                          className="w-12 rounded border border-gray-300 px-1 text-[10px] outline-none"
                          title="Commission %"
                        />
                        <span className="text-[9px] text-gray-400">%</span>
                        <select
                          value={editForm.logo}
                          onChange={e => setEditForm({ ...editForm, logo: e.target.value as OTALogoType })}
                          className="flex-1 rounded border border-gray-300 px-0.5 text-[9px] outline-none bg-white"
                        >
                          {ALL_LOGO_KEYS.map(k => <option key={k} value={k}>{PARTNERS[k].name}</option>)}
                        </select>
                        <button onClick={() => onDeleteChannel(channel.channelId)} className="p-0.5 text-red-500 hover:bg-red-50 rounded" title="Supprimer">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                        <button onClick={saveEdit} className="p-0.5 text-blue-500 hover:bg-blue-50 rounded" title="Sauvegarder">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center gap-1.5 min-w-0" onDoubleClick={() => startEdit(channel)}>
                      <div>
                        <p className="truncate text-xs font-semibold text-gray-800">{channel.channelName}</p>
                        <p className="text-[10px] text-gray-400 font-medium">Commission : {channel.commission}%</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Date cells */}
                {dateColumns.map(col => {
                  const isClosed = channel.closedDates.includes(col.date);
                  return (
                    <button
                      key={`${channel.channelId}-${col.date}`}
                      onClick={() => onToggleClose(channel.channelId, col.date)}
                      className={cn(
                        "flex items-center justify-center border-r border-gray-100 text-xs font-bold transition-colors overflow-hidden",
                        col.isWeekend && !isClosed && "bg-gray-50/50",
                        isClosed ? "bg-red-600 text-white hover:bg-red-700" : "text-transparent hover:bg-red-50"
                      )}
                      style={{ height: 36 }}
                      title={isClosed ? "Cliquer pour rouvrir" : "Cliquer pour fermer"}
                    >
                      {isClosed ? "✕" : ""}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
