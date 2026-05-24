/**
 * FLOWTYM — Palette globale (Cmd+K / Ctrl+K).
 *
 * Recherche full-text instantanée à travers les 65 pages Paramètres.
 * Permet d'accéder à n'importe quelle page sans naviguer dans le menu.
 *
 * Raccourcis :
 *   • Cmd/Ctrl + K — ouvrir
 *   • ↑↓ — naviguer
 *   • Entrée — sélectionner
 *   • Échap — fermer
 *
 * Mounted globalement par SettingsLayout (visible uniquement quand on
 * est dans le module Paramètres).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowRight, Command, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { SETTINGS_NAVIGATION } from './settingsNavigation';
import type { PageId } from '@/src/types';

interface PaletteEntry {
  pageId: PageId;
  label: string;
  domainLabel: string;
  domainId: string;
  /** Texte concaténé pour matcher (label + domain + alias). */
  searchBlob: string;
}

const ENTRIES: PaletteEntry[] = SETTINGS_NAVIGATION.flatMap((domain) =>
  domain.items.map((item) => ({
    pageId: item.id,
    label: item.label,
    domainLabel: domain.label,
    domainId: domain.id,
    searchBlob: `${item.label} ${domain.label}`.toLowerCase(),
  })),
);

/** Match fuzzy basique : tous les caractères du query apparaissent en ordre. */
function fuzzyScore(blob: string, query: string): number {
  if (!query) return 0;
  if (blob.includes(query)) return 100 + query.length; // bonus exact substring
  let bi = 0;
  let qi = 0;
  let matchCount = 0;
  while (bi < blob.length && qi < query.length) {
    if (blob[bi] === query[qi]) {
      matchCount++;
      qi++;
    }
    bi++;
  }
  return qi === query.length ? matchCount : 0;
}

interface SettingsCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
}

export const SettingsCommandPalette: React.FC<SettingsCommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset à chaque ouverture
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFocused(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Pas de query → 12 premiers en mode "récents/populaires"
      return ENTRIES.slice(0, 12);
    }
    return ENTRIES
      .map((e) => ({ entry: e, score: fuzzyScore(e.searchBlob, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.entry);
  }, [query]);

  // Clamp `focused` quand les résultats changent
  useEffect(() => {
    if (focused >= results.length) setFocused(0);
  }, [results.length, focused]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocused((f) => Math.min(results.length - 1, f + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocused((f) => Math.max(0, f - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const target = results[focused];
        if (target) {
          onNavigate(target.pageId);
          onClose();
        }
        return;
      }
    },
    [focused, results, onClose, onNavigate],
  );

  // Scroll focused item into view (guarded — jsdom n'implémente pas scrollIntoView)
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${focused}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [focused, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher une page (taxes, langues, RGPD…)"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-slate-400"
          />
          <kbd className="text-[10.5px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ring-1 ring-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-slate-400">
              Aucun résultat pour « {query} »
            </div>
          ) : (
            <ul className="py-1">
              {results.map((r, idx) => {
                const isFocused = idx === focused;
                return (
                  <li key={r.pageId}>
                    <button
                      data-idx={idx}
                      onMouseEnter={() => setFocused(idx)}
                      onClick={() => {
                        onNavigate(r.pageId);
                        onClose();
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors',
                        isFocused ? 'bg-violet-50 text-violet-900' : 'hover:bg-slate-50 text-slate-800',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-medium truncate">{r.label}</div>
                        <div className="text-[11px] text-slate-500 truncate">{r.domainLabel}</div>
                      </div>
                      {isFocused && (
                        <ArrowRight className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[10.5px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="font-mono bg-white px-1 py-0.5 rounded ring-1 ring-slate-200">↑↓</kbd> Naviguer
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="font-mono bg-white px-1 py-0.5 rounded ring-1 ring-slate-200">↵</kbd> Ouvrir
            </span>
          </div>
          <span className="tabular-nums">{results.length} / {ENTRIES.length} pages</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook : écoute Cmd+K / Ctrl+K globalement et expose `{ open, setOpen }`.
 * À monter au top-level du module Paramètres.
 */
export function useCommandPalette(): { open: boolean; setOpen: (v: boolean) => void } {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { open, setOpen };
}
