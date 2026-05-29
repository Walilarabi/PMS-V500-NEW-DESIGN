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
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Loader2, MapPin, RefreshCw, Info, CheckCircle2, AlertCircle, History, Building2,
  Plus, Trash2, X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import { searchEvents } from '@/src/services/event-search.engine';
import { useConfigStore } from '@/src/store/configStore';
import type { EventImpactLevel, EventSource, SourceMethod, SyncFrequency } from '@/src/types/events';
import { IMPACT_LABELS } from '@/src/types/events';
import type { SyncLogEntry } from '@/src/store/eventsStore';

const CITIES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Nice', 'Lille', 'Toulouse'];

interface EventSearchPanelProps {
  open: boolean;
  onToggle: () => void;
}

export const EventSearchPanel: React.FC<EventSearchPanelProps> = ({ open, onToggle }) => {
  const { sources, toggleSource, applySearchResult, autoSync, setAutoSync, syncLogs, addSource, removeSource } = useEventsStore();
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const hotelCity = useConfigStore((s) => s.hotel.city);
  const hotelName = useConfigStore((s) => s.hotel.name);

  // Ville par défaut = ville de l'hôtel configuré (logique métier RMS)
  const [city, setCity] = useState<string>(hotelCity || 'Paris');
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10);
  });
  const [radius, setRadius] = useState(50);
  const [minImpact, setMinImpact] = useState<EventImpactLevel | ''>('');
  const [loading, setLoading] = useState(false);
  const [lastReport, setLastReport] = useState<SyncLogEntry | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Suit la configuration de l'hôtel — si on change d'hôtel, la ville suit
  useEffect(() => {
    if (hotelCity) setCity(hotelCity);
  }, [hotelCity]);

  const citySources = sources.filter((s) => s.city === city);
  const allChecked = citySources.length > 0 && citySources.every((s) => s.active);

  async function run() {
    setLoading(true);
    setLastReport(null);
    setLastError(null);
    try {
      const r = await searchEvents({
        city,
        fromDate: from,
        toDate: to,
        sourceIds: citySources.filter((s) => s.active).map((s) => s.id),
        minImpact: minImpact || undefined,
      });
      const entry = applySearchResult(r);
      setLastReport(entry);
    } catch (e) {
      setLastError(String((e as Error).message));
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
          {/* Contexte hôtel : la ville cible est tirée automatiquement de la configuration */}
          <div className="flex items-start gap-2 rounded-xl bg-violet-50/60 ring-1 ring-violet-100 px-3 py-2 text-[12px]">
            <Building2 className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-900 font-medium truncate">{hotelName || 'Votre hôtel'}</div>
              <div className="text-slate-500">
                Le moteur cible automatiquement <strong className="text-slate-700">{hotelCity || city}</strong> et interroge {citySources.length} sources actives.
              </div>
            </div>
          </div>

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
                {(['low', 'medium', 'high', 'critical', 'hyper_compression'] as EventImpactLevel[]).map((l) =>
                  <option key={l} value={l}>{IMPACT_LABELS[l]}</option>,
                )}
              </select>
            </Labeled>
          </section>

          {/* Sources */}
          <section>
            <div className="flex items-center justify-between">
              <SectionTitle index={3} label="Sources à interroger" />
              <button
                onClick={() => setAddSourceOpen(true)}
                className="text-[11px] font-medium text-violet-700 hover:text-violet-800 flex items-center gap-1 px-2 py-1 rounded-lg ring-1 ring-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors"
                title="Ajouter une nouvelle source"
              >
                <Plus className="w-3 h-3" /> Nouvelle source
              </button>
            </div>
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
                <div key={s.id} className="flex items-center justify-between gap-2 py-1 group">
                  <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={s.active}
                      onChange={(e) => toggleSource(s.id, e.target.checked)}
                      className="w-3.5 h-3.5 accent-violet-600 shrink-0"
                    />
                    <span className="text-[12.5px] text-slate-700 truncate">{s.name}</span>
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10.5px] text-slate-400 flex items-center gap-1" title={`Fiabilité ${s.reliabilityScore}%`}>
                      <Info className="w-3 h-3" />
                      {s.reliabilityScore}
                    </span>
                    {s.id.startsWith('custom_') && (
                      <button
                        onClick={() => removeSource(s.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-700"
                        title="Supprimer cette source"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {citySources.length === 0 && (
                <div className="text-[12px] text-slate-400 italic py-2 text-center">
                  Aucune source pour {city}. Ajoutez-en une.
                </div>
              )}
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
          {lastError && (
            <div className="flex items-start gap-2 text-[12px] rounded-xl px-3 py-2 ring-1 bg-rose-50 ring-rose-100 text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>{lastError}</span>
            </div>
          )}

          {/* Rapport de synchronisation (apparaît à la fin d'une recherche) */}
          {lastReport && <SyncReport report={lastReport} />}

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

      {addSourceOpen && (
        <AddSourceModal
          city={city}
          existingSources={sources}
          syncLogs={syncLogs}
          onClose={() => setAddSourceOpen(false)}
          onAdd={(src) => {
            addSource(src);
            setAddSourceOpen(false);
          }}
        />
      )}
    </aside>
  );
};

// ─── Modal : Ajouter une nouvelle source ──────────────────────────────────

const SOURCE_KINDS: { value: SourceMethod; label: string; description: string }[] = [
  { value: 'api',      label: 'API externe',         description: 'API officielle (Ticketmaster, Eventbrite, Songkick…)' },
  { value: 'rss',      label: 'Flux RSS',            description: 'Flux RSS d\'un site événementiel' },
  { value: 'ical',     label: 'iCal / Agenda',       description: 'Agenda culturel, office du tourisme' },
  { value: 'json_feed', label: 'Flux JSON',          description: 'Flux JSON ouvert' },
  { value: 'xml',      label: 'Flux XML',            description: 'Flux XML d\'une billetterie' },
  { value: 'scraping', label: 'Scraping web',        description: 'Site sans API (salle, billetterie, agenda)' },
  { value: 'manual',   label: 'Saisie manuelle',     description: 'Source maintenue manuellement' },
];

const FREQUENCY_OPTIONS: { value: SyncFrequency; label: string }[] = [
  { value: 'realtime', label: 'Temps réel' },
  { value: '6h',       label: 'Toutes les 6 heures' },
  { value: 'daily',    label: 'Quotidienne' },
  { value: 'weekly',   label: 'Hebdomadaire' },
  { value: 'monthly',  label: 'Mensuelle' },
  { value: 'manual',   label: 'Manuelle' },
];

interface AddSourceModalProps {
  city: string;
  existingSources: EventSource[];
  syncLogs: SyncLogEntry[];
  onClose: () => void;
  onAdd: (source: EventSource) => void;
}

const AddSourceModal: React.FC<AddSourceModalProps> = ({ city, existingSources, syncLogs, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState<SourceMethod>('api');
  const [frequency, setFrequency] = useState<SyncFrequency>('daily');
  const [reliability, setReliability] = useState(75);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Journal des dernières recherches (toutes sources confondues) — utile pour juger la couverture
  const recentLogs = useMemo(() => syncLogs.slice(0, 5), [syncLogs]);

  function handleSubmit() {
    if (!name.trim()) {
      setError('Le nom de la source est requis');
      return;
    }
    if (method !== 'manual' && !url.trim()) {
      setError('URL ou endpoint API requis pour cette méthode');
      return;
    }
    // Anti-doublon : même nom dans la même ville
    if (existingSources.some((s) => s.city === city && s.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('Une source du même nom existe déjà pour cette ville');
      return;
    }

    const newSource: EventSource = {
      id: `custom_${Date.now()}_${Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
      city,
      country: 'France',
      name: name.trim(),
      type: 'multi',
      url: url.trim() || undefined,
      method,
      syncFrequency: frequency,
      status: 'idle',
      reliabilityScore: reliability,
      active,
      apiAvailable: method === 'api' || method === 'json_feed' || method === 'xml',
      priority: 'standard',
      notes: notes.trim() || undefined,
    };
    onAdd(newSource);
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-900">Ajouter une source</h3>
              <p className="text-[11.5px] text-slate-500">Élargir la couverture événementielle pour <strong>{city}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">Nom de la source</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Zenith Paris, Ticketmaster FR, Office Tourisme…"
              className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">URL / Endpoint API</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.exemple.com/events ou https://salle.com/agenda"
              className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1.5">Type de source</label>
            <div className="grid grid-cols-2 gap-1.5">
              {SOURCE_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setMethod(k.value)}
                  className={cn(
                    'text-left px-2.5 py-1.5 rounded-lg ring-1 transition-all',
                    method === k.value
                      ? 'ring-violet-500 bg-violet-50 text-violet-900'
                      : 'ring-slate-200 hover:ring-slate-300 bg-white text-slate-700',
                  )}
                >
                  <div className="text-[12px] font-medium">{k.label}</div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5 leading-tight">{k.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">Fréquence de synchro</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as SyncFrequency)}
                className="w-full px-3 py-2 text-[13px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
              >
                {FREQUENCY_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">
                Fiabilité <span className="text-violet-600 font-semibold">{reliability}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={reliability}
                onChange={(e) => setReliability(parseInt(e.target.value, 10))}
                className="w-full accent-violet-600 mt-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: source officielle de la salle, mise à jour 1 fois/jour…"
              className="w-full px-3 py-2 text-[12.5px] rounded-lg ring-1 ring-slate-200 bg-white focus:ring-violet-500 outline-none"
            />
          </div>

          <label className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-100 cursor-pointer">
            <div className="text-[12.5px]">
              <div className="font-medium text-slate-900">Activer immédiatement</div>
              <div className="text-slate-500 text-[11.5px]">La source sera interrogée à la prochaine recherche</div>
            </div>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-violet-600 shrink-0"
            />
          </label>

          {recentLogs.length > 0 && (
            <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1.5 flex items-center gap-1.5">
                <History className="w-3 h-3" /> Dernières recherches effectuées
              </div>
              <ul className="space-y-1">
                {recentLogs.map((l, i) => (
                  <li key={i} className="text-[11.5px] text-slate-600 flex items-center justify-between">
                    <span>{new Date(l.at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="tabular-nums">{l.added} + · {l.updated} ↺ · {l.duplicates} ⛓</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-[12px] rounded-xl px-3 py-2 ring-1 bg-rose-50 ring-rose-100 text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-[13px] font-medium text-white bg-gradient-to-r from-violet-600 to-violet-500 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter la source
          </button>
        </div>
      </div>
    </div>
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

// ─── Rapport de synchronisation premium ───────────────────────────────────

function SyncReport({ report }: { report: SyncLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const okSources = (report.perSource ?? []).filter((s) => s.status === 'ok');
  const errSources = (report.perSource ?? []).filter((s) => s.status === 'error');
  const totalEvents = okSources.reduce((s, x) => s + x.events, 0);

  return (
    <div className="rounded-xl ring-1 ring-emerald-100 bg-emerald-50/60 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-emerald-100">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-emerald-800">Recherche terminée</div>
          <div className="text-[11px] text-emerald-700/80">
            {new Date(report.at).toLocaleString('fr-FR')} · {report.durationMs} ms
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-3 py-3 text-[12px]">
        <Stat label="Sources scannées" value={report.sourcesQueried} />
        <Stat label="Événements trouvés" value={totalEvents} />
        <Stat label="À valider" value={report.pending} tone="positive" />
        <Stat label="Déjà connus" value={Math.max(0, totalEvents - report.pending)} />
        <Stat label="Doublons fusionnés" value={report.duplicates} />
        <Stat label="Erreurs" value={report.errors} tone={report.errors > 0 ? 'warn' : undefined} />
      </div>
      {report.pending > 0 && (
        <div className="px-3 py-2 border-t border-emerald-100 bg-emerald-100/40 text-[11.5px] text-emerald-800 font-medium">
          La fenêtre de validation s'ouvre automatiquement — accepte ou refuse chaque événement pour qu'il alimente le RMS.
        </div>
      )}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-1.5 text-[11.5px] font-medium text-emerald-700 hover:bg-emerald-100/40 border-t border-emerald-100"
      >
        {expanded ? 'Masquer le détail' : 'Voir le détail par source'}
      </button>
      {expanded && (
        <div className="border-t border-emerald-100 bg-white max-h-44 overflow-y-auto">
          {okSources.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {okSources.map((s) => (
                <li key={s.sourceId} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                  <span className="truncate text-slate-700">{s.sourceName}</span>
                  <span className="text-[11.5px] font-semibold text-emerald-700 tabular-nums shrink-0 ml-2">
                    {s.events} évén.
                  </span>
                </li>
              ))}
            </ul>
          )}
          {errSources.length > 0 && (
            <div className="border-t border-slate-100">
              <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-rose-500 font-semibold">
                Sources en erreur
              </div>
              <ul className="divide-y divide-slate-100">
                {errSources.map((s) => (
                  <li key={s.sourceId} className="px-3 py-1.5 text-[11.5px]">
                    <div className="text-slate-700 font-medium truncate">{s.sourceName}</div>
                    <div className="text-rose-600 text-[11px]">{s.message}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'positive' | 'warn' }) {
  const color =
    tone === 'positive' ? 'text-emerald-700' : tone === 'warn' ? 'text-rose-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-lg px-2.5 py-1.5 ring-1 ring-slate-100">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
      <div className={cn('text-[15px] font-semibold tabular-nums', color)}>{value}</div>
    </div>
  );
}
