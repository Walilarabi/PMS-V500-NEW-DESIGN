/**
 * FLOWTYM Events — Vue Recherche Live
 *
 * Interroge Ticketmaster et OpenAgenda en temps réel.
 * Résultats normalisés → validation → intégration au store.
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  AlertCircle, Calendar, ChevronDown, ChevronUp, Eye, EyeOff,
  Globe, Key, Loader2, MapPin, Plus, Radio, RotateCcw,
  ShieldCheck, Sparkles, TrendingUp, X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  getLiveConfig,
  saveLiveConfig,
  clearLiveKey,
  autocompleteCity,
  findCity,
  runLiveSearch,
  yearPeriod,
  monthsForwardPeriod,
  LIVE_CITIES,
  type LiveSearchConfig,
  type LivePeriod,
} from '@/src/services/event-live-search.service';
import { useEventsStore } from '@/src/store/eventsStore';
import type { RMSMarketEvent, EventImpactLevel } from '@/src/types/events';

// ─── Constantes ───────────────────────────────────────────────────────────────

const IMPACT_STYLES: Record<EventImpactLevel, { label: string; cls: string }> = {
  hyper_compression: { label: 'Hyper',   cls: 'bg-purple-50 text-purple-700 ring-purple-200' },
  critical:          { label: 'Critique',cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  high:              { label: 'Fort',    cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  medium:            { label: 'Moyen',   cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  low:               { label: 'Faible',  cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  very_low:          { label: 'Très faible', cls: 'bg-slate-50 text-slate-500 ring-slate-200' },
};

const SOURCE_STYLES = {
  ticketmaster: { label: 'TM', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  openagenda:   { label: 'OA', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('fr-FR', { month: 'short' })}`;
}

function dayCount(start: string, end: string): number {
  if (!start) return 1;
  const d0 = new Date(start), d1 = new Date(end || start);
  return Math.max(1, Math.round((d1.getTime() - d0.getTime()) / 86_400_000) + 1);
}

// ─── API Config Card ──────────────────────────────────────────────────────────

function ApiConfigCard({
  cfg,
  onChange,
}: {
  cfg: LiveSearchConfig;
  onChange: (next: LiveSearchConfig) => void;
}) {
  const [open, setOpen] = useState(!cfg.tmKey && !cfg.oaKey);
  const [tmVal, setTmVal] = useState('');
  const [oaVal, setOaVal] = useState('');
  const [showTm, setShowTm] = useState(false);
  const [showOa, setShowOa] = useState(false);

  const activeSources = [cfg.tmKey && 'Ticketmaster', cfg.oaKey && 'OpenAgenda'].filter(Boolean);

  function saveKey(source: 'tm' | 'oa') {
    const val = source === 'tm' ? tmVal.trim() : oaVal.trim();
    if (!val) return;
    const patch = source === 'tm' ? { tmKey: val } : { oaKey: val };
    saveLiveConfig(patch);
    onChange({ ...cfg, ...patch });
    if (source === 'tm') setTmVal('');
    else setOaVal('');
  }

  function removeKey(source: 'tm' | 'oa') {
    clearLiveKey(source);
    const patch = source === 'tm' ? { tmKey: undefined } : { oaKey: undefined };
    onChange({ ...cfg, ...patch });
  }

  return (
    <div className="rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
            <Key className="w-3.5 h-3.5" />
          </div>
          <div className="text-left min-w-0">
            <div className="text-[13px] font-semibold text-slate-900">Configuration des sources API</div>
            <div className="text-[11px] text-slate-500">
              {activeSources.length > 0
                ? `${activeSources.join(' · ')} — ${activeSources.length} source${activeSources.length > 1 ? 's' : ''} active${activeSources.length > 1 ? 's' : ''}`
                : 'Aucune source configurée — cliquez pour ajouter vos clés'}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Ticketmaster */}
            <ApiKeyCard
              logoLabel="TM"
              logoClass="from-blue-600 to-blue-800"
              name="Ticketmaster API"
              sub="Concerts · Sport · 230+ pays"
              desc="5 000 req/jour gratuit."
              docHref="https://developer.ticketmaster.com/"
              connected={!!cfg.tmKey}
              placeholder="Consumer Key Ticketmaster"
              inputVal={tmVal}
              showVal={showTm}
              onInput={setTmVal}
              onToggleShow={() => setShowTm((v) => !v)}
              onSave={() => saveKey('tm')}
              onRemove={() => removeKey('tm')}
            />
            {/* OpenAgenda */}
            <ApiKeyCard
              logoLabel="OA"
              logoClass="from-emerald-500 to-emerald-700"
              name="OpenAgenda API"
              sub="Culture · Salons · Congrès"
              desc="Accès gratuit, fort sur France et Europe."
              docHref="https://openagenda.com/developers"
              connected={!!cfg.oaKey}
              placeholder="Public Key OpenAgenda"
              inputVal={oaVal}
              showVal={showOa}
              onInput={setOaVal}
              onToggleShow={() => setShowOa((v) => !v)}
              onSave={() => saveKey('oa')}
              onRemove={() => removeKey('oa')}
            />
          </div>

          <div className="flex items-start gap-2 text-[11.5px] text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-xl px-3 py-2.5">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
            Les clés API sont stockées uniquement dans votre navigateur (localStorage). Elles ne quittent jamais votre appareil ni nos serveurs.
          </div>
        </div>
      )}
    </div>
  );
}

function ApiKeyCard({
  logoLabel, logoClass, name, sub, desc, docHref,
  connected, placeholder, inputVal, showVal,
  onInput, onToggleShow, onSave, onRemove,
}: {
  logoLabel: string; logoClass: string; name: string; sub: string;
  desc: string; docHref: string; connected: boolean; placeholder: string;
  inputVal: string; showVal: boolean;
  onInput: (v: string) => void; onToggleShow: () => void;
  onSave: () => void; onRemove: () => void;
}) {
  return (
    <div className={cn('rounded-xl ring-1 p-4 space-y-3', connected ? 'ring-emerald-200 bg-emerald-50/30' : 'ring-slate-200 bg-white')}>
      <div className="flex items-center gap-3">
        <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white text-[11px] font-bold flex items-center justify-center shrink-0', logoClass)}>
          {logoLabel}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-slate-900">{name}</div>
          <div className="text-[10.5px] text-slate-500">{sub}</div>
        </div>
        <span className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full ring-1',
          connected ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200',
        )}>
          {connected ? 'Connecté' : 'À configurer'}
        </span>
      </div>

      <div className="text-[11px] text-slate-500 leading-relaxed">
        {desc}{' '}
        <a href={docHref} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-700">
          Obtenir une clé →
        </a>
      </div>

      {connected ? (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Clé enregistrée dans votre navigateur
          </span>
          <button
            onClick={onRemove}
            className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-1 font-medium"
          >
            <X className="w-3 h-3" /> Effacer
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showVal ? 'text' : 'password'}
              value={inputVal}
              onChange={(e) => onInput(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => e.key === 'Enter' && onSave()}
              autoComplete="off"
              className="w-full px-3 py-2 pr-8 text-[12px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-400 outline-none font-mono"
            />
            <button
              type="button"
              onClick={onToggleShow}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showVal ? 'Masquer la clé' : 'Afficher la clé'}
            >
              {showVal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={onSave}
            disabled={!inputVal.trim()}
            className="px-3 py-2 text-[12px] font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Sauvegarder
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Search Card ──────────────────────────────────────────────────────────────

function SearchCard({
  cfg,
  onResults,
}: {
  cfg: LiveSearchConfig;
  onResults: (r: { events: RMSMarketEvent[]; city: string; errors: string[] }) => void;
}) {
  const [cityInput, setCityInput] = useState(cfg.lastCity ?? 'Paris');
  const [acList, setAcList] = useState<ReturnType<typeof autocompleteCity>>([]);
  const [period, setPeriod] = useState<LivePeriod>(() => monthsForwardPeriod(6));
  const [useTM, setUseTM] = useState(true);
  const [useOA, setUseOA] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error' | 'info'; msg: string } | null>(null);
  const acRef = useRef<HTMLDivElement>(null);

  const canSearch = (cfg.tmKey && useTM) || (cfg.oaKey && useOA);

  useEffect(() => {
    setAcList(autocompleteCity(cityInput));
  }, [cityInput]);

  useEffect(() => {
    function dismiss(e: MouseEvent) {
      if (acRef.current && !acRef.current.contains(e.target as Node)) {
        setAcList([]);
      }
    }
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, []);

  async function run() {
    if (!canSearch) {
      setStatus({ type: 'error', msg: 'Configurez au moins une clé API ci-dessus.' });
      return;
    }
    const city = findCity(cityInput) ?? { n: cityInput, c: 'France', lat: 48.8566, lon: 2.3522, cc: 'FR' };
    setLoading(true);
    setStatus({ type: 'info', msg: `Interrogation des APIs pour ${city.n}…` });

    try {
      const result = await runLiveSearch(
        city, period,
        !!(useTM && cfg.tmKey),
        !!(useOA && cfg.oaKey),
        cfg.tmKey ?? '',
        cfg.oaKey ?? '',
      );
      saveLiveConfig({ lastCity: city.n });
      if (result.events.length === 0 && result.errors.length > 0) {
        setStatus({ type: 'error', msg: result.errors.join(' · ') });
      } else {
        const warn = result.errors.length > 0 ? ` (${result.errors.join('; ')})` : '';
        setStatus({ type: 'ok', msg: `${result.events.length} événement${result.events.length !== 1 ? 's' : ''} trouvé${result.events.length !== 1 ? 's' : ''}${warn}` });
      }
      onResults({ events: result.events, city: city.n, errors: result.errors });
    } catch (e) {
      setStatus({ type: 'error', msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
          <Radio className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-slate-900">Recherche d'événements</div>
          <div className="text-[11px] text-slate-500">Découvrez en temps réel via les APIs officielles</div>
        </div>
      </div>

      <div className="px-5 py-4 flex flex-wrap items-end gap-3">
        {/* City */}
        <div className="flex-1 min-w-[180px] relative" ref={acRef}>
          <label className="block text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1">Ville</label>
          <div className="relative">
            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              placeholder="Paris, Londres, Dubaï…"
              className="w-full pl-8 pr-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-400 outline-none"
            />
          </div>
          {acList.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-xl ring-1 ring-slate-200 shadow-lg overflow-hidden">
              {acList.map((c) => (
                <button
                  key={c.n}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                  onClick={() => { setCityInput(c.n); setAcList([]); }}
                >
                  <span className="text-[13px] font-medium text-slate-900 flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-slate-400" /> {c.n}
                  </span>
                  <span className="text-[11px] text-slate-400">{c.c}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Period */}
        <div className="min-w-[260px]">
          <label className="block text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1">
            Période <span className="text-slate-300">·</span> <span className="text-violet-600 font-semibold">{period.label}</span>
          </label>
          <div className="flex flex-wrap items-center gap-1">
            {[
              { label: '2024', tone: 'slate'   as const, year: 2024, hint: 'Passé' },
              { label: '2025', tone: 'slate'   as const, year: 2025, hint: 'Passé' },
              { label: '2026', tone: 'violet'  as const, year: 2026, hint: 'En cours' },
              { label: '2027', tone: 'emerald' as const, year: 2027, hint: 'À venir' },
            ].map((y) => {
              const active = period.kind === 'year' && period.start.startsWith(`${y.year}-`);
              return (
                <button
                  key={y.year}
                  type="button"
                  onClick={() => setPeriod(yearPeriod(y.year))}
                  title={y.hint}
                  className={cn(
                    'px-2.5 py-1.5 text-[12px] font-semibold rounded-lg ring-1 transition-all tabular-nums',
                    active
                      ? y.tone === 'violet'
                        ? 'bg-violet-600 text-white ring-violet-600 shadow-sm shadow-violet-600/20'
                        : y.tone === 'emerald'
                          ? 'bg-emerald-600 text-white ring-emerald-600 shadow-sm shadow-emerald-600/20'
                          : 'bg-slate-700 text-white ring-slate-700'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  {y.label}
                </button>
              );
            })}
            <span className="w-px h-5 bg-slate-200 mx-1" aria-hidden="true" />
            {[3, 6, 12].map((m) => {
              const active = period.kind === 'forward' && period.label === `${m} mois`;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPeriod(monthsForwardPeriod(m))}
                  className={cn(
                    'px-2 py-1.5 text-[12px] font-medium rounded-lg ring-1 transition-all',
                    active
                      ? 'bg-violet-50 text-violet-700 ring-violet-200'
                      : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  +{m}m
                </button>
              );
            })}
          </div>
        </div>

        {/* Sources */}
        <div>
          <label className="block text-[10.5px] uppercase tracking-wide text-slate-400 font-medium mb-1">Sources</label>
          <div className="flex items-center gap-3 h-[38px]">
            <label className={cn('flex items-center gap-1.5 text-[12.5px] cursor-pointer px-2.5 py-1.5 rounded-lg ring-1 transition-all',
              useTM && cfg.tmKey ? 'ring-blue-200 bg-blue-50 text-blue-700 font-medium' : 'ring-slate-200 text-slate-500',
              !cfg.tmKey && 'opacity-50 cursor-not-allowed')}>
              <input
                type="checkbox"
                checked={useTM}
                disabled={!cfg.tmKey}
                onChange={(e) => setUseTM(e.target.checked)}
                className="w-3 h-3 accent-blue-600"
              />
              <span className="font-bold text-[11px] bg-gradient-to-br from-blue-600 to-blue-800 bg-clip-text text-transparent">TM</span>
              Ticketmaster
            </label>
            <label className={cn('flex items-center gap-1.5 text-[12.5px] cursor-pointer px-2.5 py-1.5 rounded-lg ring-1 transition-all',
              useOA && cfg.oaKey ? 'ring-emerald-200 bg-emerald-50 text-emerald-700 font-medium' : 'ring-slate-200 text-slate-500',
              !cfg.oaKey && 'opacity-50 cursor-not-allowed')}>
              <input
                type="checkbox"
                checked={useOA}
                disabled={!cfg.oaKey}
                onChange={(e) => setUseOA(e.target.checked)}
                className="w-3 h-3 accent-emerald-600"
              />
              <span className="font-bold text-[11px] text-emerald-600">OA</span>
              OpenAgenda
            </label>
          </div>
        </div>

        {/* Run */}
        <button
          onClick={run}
          disabled={loading || !canSearch}
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition-all shadow-sm',
            canSearch
              ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-600/20'
              : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200 cursor-not-allowed',
            loading && 'opacity-80 cursor-wait',
          )}
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Sparkles className="w-4 h-4" />}
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>

      {status && (
        <div className={cn(
          'mx-5 mb-4 flex items-center gap-2 text-[12px] rounded-xl px-3 py-2 ring-1',
          status.type === 'ok'    ? 'bg-emerald-50 ring-emerald-100 text-emerald-700' :
          status.type === 'error' ? 'bg-rose-50 ring-rose-100 text-rose-700'          :
                                    'bg-violet-50 ring-violet-100 text-violet-700',
        )}>
          {status.type === 'info'  && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
          {status.type === 'ok'    && <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
          {status.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          {status.msg}
        </div>
      )}

      {!canSearch && !loading && (
        <div className="mx-5 mb-4 text-[11.5px] text-slate-500 bg-amber-50 ring-1 ring-amber-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          Configurez au moins une clé API dans la section ci-dessus pour lancer la recherche.
        </div>
      )}
    </div>
  );
}

// ─── Results Table ─────────────────────────────────────────────────────────────

function ResultsTable({
  events,
  city,
  onImport,
}: {
  events: RMSMarketEvent[];
  city: string;
  onImport: (selected: RMSMarketEvent[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(events.map((e) => e.id)),
  );
  const [sortKey, setSortKey] = useState<'date' | 'impact' | 'name'>('date');
  const [tooltip, setTooltip] = useState<{ ev: RMSMarketEvent; x: number; y: number } | null>(null);
  const { IMPACT_LEVEL_ORDER } = useMemo(() => ({
    IMPACT_LEVEL_ORDER: { very_low: 0, low: 1, medium: 2, high: 3, critical: 4, hyper_compression: 5 } as Record<string, number>,
  }), []);

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      if (sortKey === 'date')   return a.startDate.localeCompare(b.startDate);
      if (sortKey === 'impact') return (IMPACT_LEVEL_ORDER[b.impact.level] ?? 0) - (IMPACT_LEVEL_ORDER[a.impact.level] ?? 0);
      return a.name.localeCompare(b.name);
    });
  }, [events, sortKey, IMPACT_LEVEL_ORDER]);

  const selectedEvents = events.filter((e) => selected.has(e.id));

  function toggleAll() {
    setSelected((s) => s.size === events.length ? new Set() : new Set(events.map((e) => e.id)));
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function SortTh({ label, k }: { label: string; k: typeof sortKey }) {
    return (
      <th
        className={cn(
          'px-3 py-2.5 font-medium text-left cursor-pointer select-none transition-colors',
          sortKey === k ? 'text-violet-600' : 'hover:text-slate-700',
        )}
        onClick={() => setSortKey(k)}
      >
        {label} {sortKey === k && '↓'}
      </th>
    );
  }

  return (
    <div className="rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden flex flex-col">
      {/* Results bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/40">
        <div className="text-[12.5px] text-slate-700">
          <span className="font-semibold text-slate-900 tabular-nums">{events.length}</span>
          {' '}événement{events.length !== 1 ? 's' : ''} trouvé{events.length !== 1 ? 's' : ''} pour{' '}
          <span className="font-semibold">{city}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelected(new Set(events.map((e) => e.id)))}
            className="text-[11.5px] text-violet-600 hover:text-violet-800 font-medium"
          >
            Tout sélectionner
          </button>
          <span className="text-slate-300">·</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[11.5px] text-slate-500 hover:text-slate-800 font-medium"
          >
            Aucun
          </button>
          <span className="text-slate-300">·</span>
          <button
            onClick={() => onImport(selectedEvents)}
            disabled={selectedEvents.length === 0}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all',
              selectedEvents.length > 0
                ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-600/20'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Importer {selectedEvents.length > 0 ? `${selectedEvents.length} ` : ''}événement{selectedEvents.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 text-[10.5px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2.5 font-medium w-10">
                <input
                  type="checkbox"
                  checked={selected.size === events.length && events.length > 0}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 accent-violet-600"
                  aria-label="Sélectionner tous les événements"
                />
              </th>
              <SortTh label="Événement" k="name" />
              <th className="px-3 py-2.5 font-medium">Source</th>
              <SortTh label="Dates" k="date" />
              <th className="px-3 py-2.5 font-medium">Durée</th>
              <SortTh label="Impact RM" k="impact" />
              <th className="px-3 py-2.5 font-medium">Métriques</th>
              <th className="px-3 py-2.5 font-medium">Lieu</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ev) => {
              const imp = IMPACT_STYLES[ev.impact.level] ?? IMPACT_STYLES.very_low;
              const src = ev.sources[0] as 'ticketmaster' | 'openagenda' | undefined;
              const srcStyle = src ? (SOURCE_STYLES[src] ?? SOURCE_STYLES.openagenda) : SOURCE_STYLES.openagenda;
              const days = dayCount(ev.startDate, ev.endDate);
              const isSelected = selected.has(ev.id);
              return (
                <tr
                  key={ev.id}
                  className={cn(
                    'border-t border-slate-100 transition-colors',
                    isSelected ? 'hover:bg-slate-50' : 'opacity-50 hover:opacity-70 hover:bg-slate-50',
                  )}
                  onMouseEnter={(e) => setTooltip({ ev, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(ev.id)}
                      className="w-3.5 h-3.5 accent-violet-600"
                      aria-label={`Sélectionner ${ev.name}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <div className="font-medium text-slate-900 truncate" title={ev.name}>{ev.name}</div>
                    <div className="text-[10.5px] text-slate-400 truncate">{ev.category}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ring-1 ring-inset', srcStyle.cls)}>
                      {srcStyle.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-slate-700">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {fmtDate(ev.startDate)}
                      {ev.startDate !== ev.endDate && (
                        <span className="text-slate-400 text-[10.5px]"> → {fmtDate(ev.endDate)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-600">
                    {days}j
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-inset', imp.cls)}>
                      {imp.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <RmMetrics adr={ev.impact.adr} compression={ev.impact.compression} />
                  </td>
                  <td className="px-3 py-2.5 max-w-[140px] text-slate-500 truncate text-[11.5px]" title={ev.venue ?? ev.city}>
                    {ev.venue ?? ev.city}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <EventTooltip ev={tooltip.ev} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  );
}

function RmMetrics({ adr, compression }: { adr: number; compression: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10.5px] text-amber-600 font-semibold flex items-center gap-0.5">
        <TrendingUp className="w-2.5 h-2.5" /> +{adr}% ADR
      </span>
      <span className="text-[10.5px] text-violet-600 font-semibold">
        {compression}% comp.
      </span>
    </div>
  );
}

function EventTooltip({ ev, x, y }: { ev: RMSMarketEvent; x: number; y: number }) {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x + 14,
    top: y - 10,
    zIndex: 3000,
    pointerEvents: 'none',
    maxWidth: 260,
  };
  if (x > window.innerWidth - 280) style.left = x - 270;
  if (y > window.innerHeight - 220) style.top = y - 200;

  const imp = IMPACT_STYLES[ev.impact.level] ?? IMPACT_STYLES.very_low;
  return (
    <div
      style={style}
      className="bg-white rounded-xl ring-1 ring-slate-200 shadow-xl p-3 text-[11.5px] animate-in fade-in slide-in-from-bottom-1 duration-100"
    >
      <div className="font-semibold text-slate-900 text-[13px] leading-tight mb-2">{ev.name}</div>
      <div className="h-px bg-slate-100 mb-2" />
      <div className="space-y-1">
        <Row k="Dates"    v={`${fmtDate(ev.startDate)} → ${fmtDate(ev.endDate)}`} />
        <Row k="Lieu"     v={ev.venue ?? ev.city} />
        <Row k="Impact"   v={<span className={cn('px-1.5 py-px rounded text-[10px] font-bold ring-1 ring-inset', imp.cls)}>{imp.label}</span>} />
        <Row k="Catégorie" v={ev.category} />
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-3 gap-1.5">
        <MetricBox label="ADR" value={`+${ev.impact.adr}%`} color="text-amber-600" />
        <MetricBox label="Compr." value={`${ev.impact.compression}%`} color="text-violet-600" />
        <MetricBox label="Confiance" value={`${ev.impact.confidence}%`} color="text-emerald-600" />
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 bg-violet-50/60 rounded-lg px-2 py-1.5 text-center font-medium">
        Action RM suggérée : {ev.impact.level === 'hyper_compression' ? 'Stop-sell / max yield' : ev.impact.level === 'critical' ? 'Yield élevé' : ev.impact.level === 'high' ? 'Relever les tarifs' : 'Surveiller'}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 justify-between">
      <span className="text-slate-400 shrink-0">{k}</span>
      <span className="text-slate-700 text-right font-medium">{v}</span>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-1.5 py-1 text-center ring-1 ring-slate-100">
      <div className="text-[8.5px] text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={cn('text-[12px] font-bold', color)}>{value}</div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptySearch() {
  return (
    <div className="rounded-2xl ring-1 ring-slate-200 bg-white py-16 flex flex-col items-center gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center">
        <Radio className="w-6 h-6 text-violet-500" />
      </div>
      <div className="text-[14px] font-semibold text-slate-700">Aucune recherche effectuée</div>
      <div className="text-[12.5px] text-slate-400 max-w-xs">
        Configurez vos clés API Ticketmaster et/ou OpenAgenda, entrez une ville et lancez la recherche.
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

interface EventLiveSearchViewProps {
  onImportEvents: (events: RMSMarketEvent[]) => void;
}

export const EventLiveSearchView: React.FC<EventLiveSearchViewProps> = ({ onImportEvents }) => {
  const [cfg, setCfg] = useState<LiveSearchConfig>(getLiveConfig);
  const [results, setResults] = useState<{ events: RMSMarketEvent[]; city: string } | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const { setPendingValidation } = useEventsStore();

  function handleImport(selected: RMSMarketEvent[]) {
    if (selected.length === 0) return;
    setPendingValidation(selected);
    setImportedCount(selected.length);
    onImportEvents(selected);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-violet-600" />
            Recherche d'événements Live
          </h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Ticketmaster · OpenAgenda — découverte et intégration en temps réel
          </p>
        </div>
        {importedCount > 0 && (
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            {importedCount} événement{importedCount > 1 ? 's' : ''} en attente de validation
          </div>
        )}
      </div>

      {/* API Config */}
      <ApiConfigCard cfg={cfg} onChange={setCfg} />

      {/* Search */}
      <SearchCard
        cfg={cfg}
        onResults={(r) => { setResults(r); setImportedCount(0); }}
      />

      {/* Results */}
      {results !== null
        ? results.events.length > 0
          ? <ResultsTable events={results.events} city={results.city} onImport={handleImport} />
          : (
            <div className="rounded-2xl ring-1 ring-slate-200 bg-white py-12 flex flex-col items-center gap-2 text-center">
              <RotateCcw className="w-8 h-8 text-slate-300" />
              <div className="text-[13px] font-medium text-slate-500">Aucun événement trouvé</div>
              <div className="text-[12px] text-slate-400">Essayez une autre ville ou une période plus longue.</div>
            </div>
          )
        : <EmptySearch />
      }

      {/* Supported cities */}
      <details className="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden">
        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors text-[12.5px] font-medium text-slate-700 select-none">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          {LIVE_CITIES.length} villes supportées avec géolocalisation Ticketmaster
        </summary>
        <div className="px-4 pb-4 pt-2 flex flex-wrap gap-1.5">
          {LIVE_CITIES.map((c) => (
            <span
              key={c.n}
              className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-slate-200 bg-slate-50 text-slate-600"
            >
              {c.n} <span className="text-slate-400">{c.cc}</span>
            </span>
          ))}
        </div>
      </details>
    </div>
  );
};
