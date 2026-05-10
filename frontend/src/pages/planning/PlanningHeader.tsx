/**
 * FLOWTYM — Planning header (legacy aesthetic).
 *
 * Indigo accents · 7J/15J/Mois pill · Gantt/Revenue mode toggle · prev/next/today
 * · datepicker (12-month grid) · search bar · filters · "Nouvelle réservation" button.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon, Search, Plus,
  LayoutGrid, TrendingUp, Settings2, Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import type { DisplayMode, ViewLength } from './types';
import { CHANNELS } from './types';

interface Props {
  /* mode */
  displayMode: DisplayMode;
  setDisplayMode: (m: DisplayMode) => void;
  /* view length (Gantt only) */
  view: ViewLength;
  setView: (v: ViewLength) => void;
  /* navigation */
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /* anchor month for picker */
  anchorMonth: number;
  anchorYear: number;
  onPickMonth: (year: number, month: number) => void;
  /* filters */
  search: string;
  setSearch: (s: string) => void;
  typeFilter: string;
  setTypeFilter: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  channelFilter: string;
  setChannelFilter: (s: string) => void;
  roomTypes: string[];
  /* misc */
  showRightPanel: boolean;
  toggleRightPanel: () => void;
  onCreate: () => void;
}

const STATUSES = ['Tous Statuts', 'Arrivées', 'Départs', 'Occupées', 'Libres', 'Ménage'];

export const PlanningHeader: React.FC<Props> = ({
  displayMode, setDisplayMode,
  view, setView,
  rangeLabel, onPrev, onNext, onToday,
  anchorMonth, anchorYear, onPickMonth,
  search, setSearch, typeFilter, setTypeFilter, statusFilter, setStatusFilter,
  channelFilter, setChannelFilter, roomTypes,
  showRightPanel, toggleRightPanel, onCreate,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="h-[72px] shrink-0 border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 bg-white z-[60]" data-testid="planning-header">
      {/* Left cluster */}
      <div className="flex items-center gap-3 lg:gap-4 flex-wrap">
        {displayMode === 'Gantt' && (
          <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100" data-testid="planning-view-toggle">
            {(['7J', '15J', 'Mois'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                data-testid={`planning-view-${v}`}
                className={`px-3 lg:px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  view === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {v === '7J' ? 'Semaine' : v === '15J' ? '15J' : 'Mois'}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100" data-testid="planning-mode-toggle">
          <button
            type="button"
            onClick={() => setDisplayMode('Gantt')}
            data-testid="planning-mode-gantt"
            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
              displayMode === 'Gantt' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <LayoutGrid size={14} /> Gantt
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('Revenue')}
            data-testid="planning-mode-revenue"
            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
              displayMode === 'Revenue' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <TrendingUp size={14} /> Calendrier Revenu
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-gray-100">
          <button type="button" onClick={onPrev} data-testid="planning-prev" className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"><ChevronLeft size={16} /></button>
          <button
            type="button"
            onClick={onToday}
            data-testid="planning-today"
            className="w-8 h-8 rounded-full border-2 border-indigo-100 flex items-center justify-center hover:bg-indigo-50 transition-all group"
          >
            <div className="w-2 h-2 rounded-full bg-indigo-500 group-hover:scale-125 transition-transform" />
          </button>
          <button type="button" onClick={onNext} data-testid="planning-next" className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"><ChevronRight size={16} /></button>
        </div>

        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setShowPicker((s) => !s)}
            data-testid="planning-monthpicker"
            className="px-4 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-2 cursor-pointer group"
          >
            <CalendarIcon className="text-indigo-500" size={14} />
            <span className="text-[11px] font-black text-indigo-700 uppercase tracking-widest whitespace-nowrap truncate max-w-[260px]">
              {rangeLabel}
            </span>
            <ChevronDown className={`text-indigo-400 group-hover:text-indigo-600 transition-transform ${showPicker ? 'rotate-180' : ''}`} size={14} />
          </button>
          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
              >
                <div className="grid grid-cols-3 gap-1 p-3">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const d = new Date(anchorYear, i, 1);
                    const isCurrent = i === anchorMonth;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { onPickMonth(anchorYear, i); setShowPicker(false); }}
                        data-testid={`planning-picker-month-${i}`}
                        className={`py-2.5 px-1 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${
                          isCurrent ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
                        }`}
                      >
                        {d.toLocaleString('fr-FR', { month: 'short' })}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right cluster — filters + actions */}
      <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-400" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="planning-search"
            placeholder="Nom, chambre, dates…"
            className="bg-gray-50 border border-gray-100 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-44 lg:w-56"
          />
        </div>
        <div className="flex items-center bg-gray-50 border border-gray-100 rounded-xl">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} data-testid="planning-filter-type" className="bg-transparent border-none text-[10px] font-black uppercase text-gray-500 py-2 px-2 focus:ring-0 cursor-pointer">
            <option value="Tous Types">Tous Types</option>
            {roomTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="w-px h-5 bg-gray-200" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="planning-filter-status" className="bg-transparent border-none text-[10px] font-black uppercase text-gray-500 py-2 px-2 focus:ring-0 cursor-pointer">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="w-px h-5 bg-gray-200" />
          <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} data-testid="planning-filter-channel" className="bg-transparent border-none text-[10px] font-black uppercase text-gray-500 py-2 px-2 focus:ring-0 cursor-pointer">
            <option value="Tous Canaux">Tous Canaux</option>
            {CHANNELS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        {displayMode === 'Gantt' && (
          <button
            type="button"
            onClick={toggleRightPanel}
            data-testid="planning-toggle-right"
            className={`p-2 rounded-xl transition-all ${showRightPanel ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
          >
            <Eye size={16} />
          </button>
        )}
        <button
          type="button"
          data-testid="planning-settings"
          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
        >
          <Settings2 size={16} />
        </button>
        <button
          type="button"
          onClick={onCreate}
          data-testid="planning-create-open"
          className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-200 transition-all active:scale-95"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};

export default PlanningHeader;
