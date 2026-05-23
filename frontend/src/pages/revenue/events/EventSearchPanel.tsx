/**
 * FLOWTYM RMS — Panneau "Recherche d'événements" (moteur multi-sources).
 *
 * Sidebar à droite quand visible. Permet :
 *   • paramétrer ville + période + impact min ;
 *   • choisir les sources à interroger ;
 *   • lancer la recherche async (loader, logs, erreurs) ;
 *   • activer la synchronisation automatique.
 *
 * Le résultat est mergé directement dans le store par applySearchResult.
 */
import React, { useState } from 'react';
import {
  Search, Loader2, MapPin, RefreshCw, Info, CheckCircle2, AlertCircle, History,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import { searchEvents } from '@/src/services/event-search.engine';
import type { EventImpactLevel } from '@/src/types/events';
import { IMPACT_LABELS } from '@/src/types/events';

const CITIES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Nice', 'Lille', 'Toulouse'];

interface EventSearchPanelProps {
  open: boolean;
  onToggle: () => void;
}

export const EventSearchPanel: React.FC<EventSearchPanelProps> = ({ open, onToggle }) => {
  const { sources, toggleSource, applySearchResult, autoSync, setAutoSync, syncLogs } = useEventsStore();
  const [city, setCity] = useState('Paris');
  const [from, setFrom] = useState('2026-06-01');
  const [to, setTo] = useState('2026-09-30');
  const [radius, setRadius] = useState(50);
  const [minImpact, setMinImpact] = useState<EventImpactLevel | ''>('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const citySources = sources.filter((s) => s.city === city);
  const allChecked = citySources.every((s) => s.active);

  async function run() {
    setLoading(true);
    setLastResult(null);
    try {
      const r = await searchEvents({
        city,
        fromDate: from,
        toDate: to,
        sourceIds: citySources.filter((s) => s.active).map((s) => s.id),
        minImpact: minImpact || undefined,
      });
      const entry = applySearchResult(r);
      setLastResult({
        ok: true,
        msg: `${entry.added} ajoutés · ${entry.updated} mis à jour · ${entry.duplicates} doublons fusionnés (${entry.sourcesQueried} sources)`,
      });
    } catch (e) {
      setLastResult({ ok: false, msg: String((e as Error).message) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside
      className={cn(
        'shrink-0 bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden transition-all',
        open ? 'w-[340px]' : 'w-12',
      )}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="px-4 py-3 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
            <Search className="w-4 h-4" />
          </div>
          {open && (
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-900 truncate">Recherche d'événements</div>
              <div className="text-[10.5px] uppercase tracking-wide text-violet-600 font-bold">Nouveau</div>
            </div>
          )}
        </div>
        {open && <span className="text-slate-400 text-lg leading-none">›</span>}
      </div>

      {!open ? null : (
        <div className="px-4 py-4 space-y-4">
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Notre moteur recherche pour vous les événements à venir à <strong>{city}</strong> via plusieurs sources officielles.
          </p>

          {/* Localisation */}
          <section>
            <SectionTitle index={1} label="Localisation" />
            <div className="space-y-2 mt-2">
              <Labeled label="Ville">
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
                  >
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </Labeled>
              <Labeled label="Rayon">
                <select
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
                >
                  {[5, 10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}
                </select>
              </Labeled>
            </div>
          </section>

          {/* Période */}
          <section>
            <SectionTitle index={2} label="Période" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Labeled label="Date de début">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
                />
              </Labeled>
              <Labeled label="Date de fin">
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
                />
              </Labeled>
            </div>
            <Labeled label="Impact minimum" className="mt-2">
              <select
                value={minImpact}
                onChange={(e) => setMinImpact(e.target.value as EventImpactLevel | '')}
                className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
              >
                <option value="">Tous</option>
                {(['low', 'medium', 'high', 'critical'] as EventImpactLevel[]).map((l) =>
                  <option key={l} value={l}>{IMPACT_LABELS[l]}</option>,
                )}
              </select>
            </Labeled>
          </section>

          {/* Sources */}
          <section>
            <SectionTitle index={3} label="Sources à interroger" />
            <label className="flex items-center gap-2 mt-2 mb-2 text-[12px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => citySources.forEach((s) => toggleSource(s.id, e.target.checked))}
                className="w-3.5 h-3.5 accent-violet-600"
              />
              Sélectionner toutes les sources
            </label>
            <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
              {citySources.map((s) => (
                <label key={s.id} className="flex items-center justify-between gap-2 py-1 cursor-pointer">
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={s.active}
                      onChange={(e) => toggleSource(s.id, e.target.checked)}
                      className="w-3.5 h-3.5 accent-violet-600 shrink-0"
                    />
                    <span className="text-[12.5px] text-slate-700 truncate">{s.name}</span>
                  </span>
                  <span className="text-[10.5px] text-slate-400 flex items-center gap-1 shrink-0" title={`Fiabilité ${s.reliabilityScore}%`}>
                    <Info className="w-3 h-3" />
                    {s.reliabilityScore}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <button
            disabled={loading}
            onClick={run}
            className={cn(
              'w-full mt-2 px-3 py-2.5 rounded-xl font-medium text-[13px] flex items-center justify-center gap-2',
              'bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-sm hover:shadow-md transition-all',
              loading && 'opacity-70 cursor-wait',
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Recherche en cours…' : 'Rechercher'}
          </button>

          {/* Result */}
          {lastResult && (
            <div
              className={cn(
                'flex items-start gap-2 text-[12px] rounded-xl px-3 py-2 ring-1',
                lastResult.ok
                  ? 'bg-emerald-50 ring-emerald-100 text-emerald-700'
                  : 'bg-rose-50 ring-rose-100 text-rose-700',
              )}
            >
              {lastResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
              <span>{lastResult.msg}</span>
            </div>
          )}

          {/* Logs */}
          {syncLogs.length > 0 && (
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-[12px] text-slate-500 ring-1 ring-slate-100">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Dernière recherche : {new Date(syncLogs[0].at).toLocaleString('fr-FR')}
                </span>
                <span className="text-violet-600 text-[11.5px] font-medium">{showHistory ? 'Masquer' : 'Voir l\'historique'}</span>
              </button>
              {showHistory && (
                <ul className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                  {syncLogs.map((l, i) => (
                    <li key={i} className="flex items-center justify-between text-[11.5px]">
                      <span>{new Date(l.at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>{l.added} + · {l.updated} ↺ · {l.duplicates} ⛓</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Auto sync */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-violet-50/60 ring-1 ring-violet-100">
            <div className="text-[12px]">
              <div className="font-medium text-slate-900 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-violet-600" />
                Synchronisation automatique
              </div>
              <p className="text-slate-500 mt-0.5">
                Les nouveaux événements seront proposés pour intégration dans votre bibliothèque.
              </p>
            </div>
            <button
              onClick={() => setAutoSync(!autoSync)}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors shrink-0',
                autoSync ? 'bg-violet-600' : 'bg-slate-300',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  autoSync && 'translate-x-4',
                )}
              />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

function SectionTitle({ index, label }: { index: number; label: string }) {
  return (
    <h4 className="text-[12px] font-semibold text-slate-900">
      <span className="text-slate-400 mr-1">{index}.</span> {label}
    </h4>
  );
}

function Labeled({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="text-[10.5px] uppercase tracking-wide text-slate-400 font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
