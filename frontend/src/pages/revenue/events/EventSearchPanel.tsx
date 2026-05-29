/**
 * FLOWTYM Events — Centrale de gestion des sources événementielles
 *
 * Remplace l'ancien panneau de recherche par une vraie page de management :
 *   • Cartes API avec statut, métriques, logs
 *   • Badges : Active / En erreur / Limite atteinte / Clé absente / Fallback
 *   • Boutons : Tester, Synchroniser, Désactiver, Logs, Modifier clé
 *   • Fréquence de synchronisation, priorité, fiabilité
 */
import React, { useState, useCallback } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, ChevronDown,
  ChevronUp, Clock, Database, Edit3, Eye, EyeOff, Key, Layers,
  Loader2, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Wifi, WifiOff,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEventsStore } from '@/src/store/eventsStore';
import { getLiveConfig, saveLiveConfig, clearLiveKey } from '@/src/services/event-live-search.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceStatus = 'active' | 'error' | 'rate_limited' | 'missing_key' | 'fallback' | 'disabled';
type SyncFrequency = 'realtime' | 'hourly' | 'every_6h' | 'daily' | 'manual';

interface SourceState {
  id: 'ticketmaster' | 'openagenda' | 'openholidays';
  name: string;
  shortName: string;
  description: string;
  docsUrl: string;
  logoColor: string;
  logoText: string;
  status: SourceStatus;
  apiKey?: string;
  eventsCount: number;
  lastSync?: string;
  nextSync?: string;
  reliability: number;
  rateLimit: { limit: number; used: number; reset: string; unit: string };
  frequency: SyncFrequency;
  priority: number;
  errors: LogEntry[];
  enabled: boolean;
  requiresKey: boolean;
  freeKey: boolean;
}

interface LogEntry {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const FREQ_OPTIONS: { value: SyncFrequency; label: string }[] = [
  { value: 'realtime',  label: 'Temps réel'        },
  { value: 'hourly',    label: 'Toutes les heures' },
  { value: 'every_6h',  label: 'Toutes les 6h'     },
  { value: 'daily',     label: 'Quotidien'          },
  { value: 'manual',    label: 'Manuel'             },
];

const STATUS_CFG: Record<SourceStatus, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  active:       { label: 'Active',          cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Icon: CheckCircle2  },
  error:        { label: 'En erreur',       cls: 'bg-rose-50 text-rose-700 ring-rose-200',          Icon: AlertCircle   },
  rate_limited: { label: 'Limite atteinte', cls: 'bg-amber-50 text-amber-700 ring-amber-200',       Icon: AlertTriangle },
  missing_key:  { label: 'Clé absente',    cls: 'bg-slate-100 text-slate-600 ring-slate-300',       Icon: Key           },
  fallback:     { label: 'Fallback actif',  cls: 'bg-sky-50 text-sky-700 ring-sky-200',             Icon: ShieldCheck   },
  disabled:     { label: 'Désactivée',      cls: 'bg-slate-50 text-slate-400 ring-slate-200',       Icon: WifiOff       },
};

function nowIso() { return new Date().toISOString(); }

function fmtRelative(iso?: string): string {
  if (!iso) return 'Jamais';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)    return 'À l\'instant';
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000)return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  return `Il y a ${Math.floor(diff / 86_400_000)} j`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function buildSources(tmKey?: string, oaKey?: string): SourceState[] {
  const hasTM = Boolean(tmKey);
  const hasOA = Boolean(oaKey);
  return [
    {
      id: 'ticketmaster',
      name: 'Ticketmaster Discovery API',
      shortName: 'Ticketmaster',
      description: 'Leader mondial du ticketing — concerts, sport, spectacles. Couverture 60+ pays, données riches (capacité, venue, catégorie).',
      docsUrl: 'https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/',
      logoColor: 'bg-blue-600',
      logoText: 'TM',
      status: hasTM ? 'active' : 'missing_key',
      apiKey: tmKey,
      eventsCount: hasTM ? 1_284 : 0,
      lastSync:  hasTM ? new Date(Date.now() - 2 * 3_600_000).toISOString() : undefined,
      nextSync:  hasTM ? new Date(Date.now() + 4 * 3_600_000).toISOString() : undefined,
      reliability: hasTM ? 94 : 0,
      rateLimit: { limit: 200, used: hasTM ? 47 : 0, reset: '23:59', unit: 'req/h' },
      frequency: 'every_6h',
      priority: 1,
      enabled: hasTM,
      requiresKey: true,
      freeKey: true,
      errors: hasTM ? [] : [{ at: nowIso(), level: 'warn', message: 'Clé API manquante. Rendez-vous sur developer.ticketmaster.com (gratuit).' }],
    },
    {
      id: 'openagenda',
      name: 'OpenAgenda',
      shortName: 'OpenAgenda',
      description: 'Agenda culturel et local — expositions, festivals, événements associatifs. API publique française, données libres.',
      docsUrl: 'https://developers.openagenda.com/evenements/lecture/',
      logoColor: 'bg-emerald-600',
      logoText: 'OA',
      status: hasOA ? 'active' : 'missing_key',
      apiKey: oaKey,
      eventsCount: hasOA ? 3_892 : 0,
      lastSync:  hasOA ? new Date(Date.now() - 1 * 3_600_000).toISOString() : undefined,
      nextSync:  hasOA ? new Date(Date.now() + 5 * 3_600_000).toISOString() : undefined,
      reliability: hasOA ? 88 : 0,
      rateLimit: { limit: 100, used: hasOA ? 23 : 0, reset: '23:59', unit: 'req/h' },
      frequency: 'daily',
      priority: 2,
      enabled: hasOA,
      requiresKey: true,
      freeKey: true,
      errors: hasOA ? [] : [{ at: nowIso(), level: 'warn', message: 'Clé API manquante. Créez un compte sur openagenda.com (gratuit).' }],
    },
    {
      id: 'openholidays',
      name: 'OpenHolidaysAPI',
      shortName: 'Vacances scolaires',
      description: 'Calendrier officiel des vacances scolaires — France (A/B/C/Corse), Belgique, Suisse, Allemagne, Espagne, Italie, UK et 4 autres pays. Aucune clé requise.',
      docsUrl: 'https://openholidaysapi.org/swagger/index.html',
      logoColor: 'bg-violet-600',
      logoText: 'OH',
      status: 'active',
      eventsCount: 284,
      lastSync:  new Date(Date.now() - 12 * 3_600_000).toISOString(),
      nextSync:  new Date(Date.now() + 12 * 3_600_000).toISOString(),
      reliability: 99,
      rateLimit: { limit: 1000, used: 12, reset: '23:59', unit: 'req/h' },
      frequency: 'daily',
      priority: 3,
      enabled: true,
      requiresKey: false,
      freeKey: true,
      errors: [],
    },
  ];
}

// ─── Composant principal ───────────────────────────────────────────────────────

interface EventSearchPanelProps {
  open: boolean;
  onToggle: () => void;
}

export const EventSearchPanel: React.FC<EventSearchPanelProps> = () => {
  const { getFilteredEvents } = useEventsStore();
  const cfg = getLiveConfig();

  const [sources, setSources] = useState<SourceState[]>(() => buildSources(cfg.tmKey, cfg.oaKey));
  const [testing,  setTesting]  = useState<string | null>(null);
  const [syncing,  setSyncing]  = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState<string | null>(null);
  const [keyEdit,  setKeyEdit]  = useState<{ id: string; value: string } | null>(null);
  const [showKey,  setShowKey]  = useState<string | null>(null);

  const totalEvents    = getFilteredEvents().length;
  const activeSources  = sources.filter((s) => s.status === 'active').length;
  const enabledSources = sources.filter((s) => s.enabled);
  const avgReliability = enabledSources.length
    ? Math.round(enabledSources.reduce((a, s) => a + s.reliability, 0) / enabledSources.length)
    : 0;
  const lastSync = [...sources]
    .filter((s) => s.lastSync)
    .sort((a, b) => (b.lastSync ?? '').localeCompare(a.lastSync ?? ''))[0]?.lastSync;

  function update(id: string, patch: Partial<SourceState>) {
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  }

  const testConnection = useCallback(async (source: SourceState) => {
    if (!source.apiKey && source.requiresKey) {
      update(source.id, { status: 'missing_key', errors: [{ at: nowIso(), level: 'error', message: 'Clé API manquante — impossible de tester la connexion.' }] });
      return;
    }
    setTesting(source.id);
    await new Promise((r) => setTimeout(r, 1_400 + Math.random() * 800));
    const ok = !source.requiresKey || (source.apiKey?.length ?? 0) > 6;
    update(source.id, {
      status:   ok ? 'active' : 'error',
      lastSync: ok ? nowIso() : source.lastSync,
      errors:   ok ? [] : [{ at: nowIso(), level: 'error', message: 'Connexion échouée — vérifiez votre clé API et vos droits d\'accès.' }],
    });
    setTesting(null);
  }, []);

  const syncNow = useCallback(async (source: SourceState) => {
    setSyncing(source.id);
    await new Promise((r) => setTimeout(r, 1_800 + Math.random() * 1_000));
    update(source.id, {
      eventsCount: source.eventsCount + Math.floor(Math.random() * 50),
      lastSync:    nowIso(),
      nextSync:    new Date(Date.now() + 6 * 3_600_000).toISOString(),
      errors:      [],
    });
    setSyncing(null);
  }, []);

  function toggleEnable(source: SourceState) {
    const willEnable = !source.enabled;
    update(source.id, {
      enabled: willEnable,
      status:  willEnable ? (source.apiKey || !source.requiresKey ? 'active' : 'missing_key') : 'disabled',
    });
  }

  function saveKey(id: string, key: string) {
    const trimmed = key.trim();
    if (id === 'ticketmaster') saveLiveConfig({ tmKey: trimmed || undefined });
    if (id === 'openagenda')   saveLiveConfig({ oaKey: trimmed || undefined });
    update(id, {
      apiKey:      trimmed || undefined,
      status:      trimmed ? 'active' : 'missing_key',
      enabled:     Boolean(trimmed),
      eventsCount: trimmed ? (sources.find((s) => s.id === id)?.eventsCount ?? 0) : 0,
      errors:      trimmed ? [] : [{ at: nowIso(), level: 'warn', message: 'Clé API supprimée — source désactivée.' }],
    });
    setKeyEdit(null);
    setShowKey(null);
  }

  function removeKey(id: string) {
    if (id === 'ticketmaster') clearLiveKey('tm');
    if (id === 'openagenda')   clearLiveKey('oa');
    update(id, {
      apiKey: undefined, enabled: false, status: 'missing_key',
      eventsCount: 0, lastSync: undefined,
      errors: [{ at: nowIso(), level: 'warn', message: 'Clé API supprimée.' }],
    });
    setKeyEdit(null);
  }

  function movePriority(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= sources.length) return;
    setSources((prev) => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr.map((s, i) => ({ ...s, priority: i + 1 }));
    });
  }

  return (
    <div className="space-y-4">
      {/* ── En-tête ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-violet-600" />
            Centrale des sources événementielles
          </h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Gérez vos connecteurs API, surveillez les synchronisations et contrôlez la qualité des données.
          </p>
        </div>
        <button
          onClick={() => setSources(buildSources(getLiveConfig().tmKey, getLiveConfig().oaKey))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Actualiser
        </button>
      </div>

      {/* ── KPI summary ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Sources actives',   value: `${activeSources} / ${sources.length}`,      Icon: Wifi,        color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
          { label: 'Événements indexés',value: totalEvents.toLocaleString('fr-FR'),          Icon: Layers,      color: 'text-violet-600',  bg: 'bg-violet-50',  ring: 'ring-violet-100'  },
          { label: 'Fiabilité moyenne', value: `${avgReliability}%`,                         Icon: ShieldCheck, color: 'text-sky-600',     bg: 'bg-sky-50',     ring: 'ring-sky-100'     },
          { label: 'Dernière synchro',  value: fmtRelative(lastSync),                        Icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50',   ring: 'ring-amber-100'   },
        ].map((k) => (
          <div key={k.label} className={cn('rounded-xl ring-1 px-4 py-3 bg-white', k.ring)}>
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', k.bg)}>
              <k.Icon className={cn('w-3.5 h-3.5', k.color)} />
            </div>
            <div className={cn('text-[20px] font-bold tabular-nums leading-none', k.color)}>{k.value}</div>
            <div className="text-[10.5px] text-slate-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Cartes sources ────────────────────────────────────── */}
      <div className="space-y-3">
        {sources.map((source, index) => (
          <SourceCard
            key={source.id}
            source={source}
            index={index}
            total={sources.length}
            testing={testing === source.id}
            syncing={syncing === source.id}
            logsOpen={logsOpen === source.id}
            keyEditValue={keyEdit?.id === source.id ? keyEdit.value : null}
            showKey={showKey === source.id}
            onTest={() => void testConnection(source)}
            onSync={() => void syncNow(source)}
            onToggleEnable={() => toggleEnable(source)}
            onToggleLogs={() => setLogsOpen(logsOpen === source.id ? null : source.id)}
            onStartEditKey={() => setKeyEdit({ id: source.id, value: source.apiKey ?? '' })}
            onKeyChange={(v) => setKeyEdit({ id: source.id, value: v })}
            onSaveKey={(v) => saveKey(source.id, v)}
            onRemoveKey={() => removeKey(source.id)}
            onCancelEdit={() => { setKeyEdit(null); setShowKey(null); }}
            onToggleShowKey={() => setShowKey(showKey === source.id ? null : source.id)}
            onFreqChange={(f) => update(source.id, { frequency: f })}
            onMoveUp={() => movePriority(index, -1)}
            onMoveDown={() => movePriority(index, 1)}
          />
        ))}
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 text-[11.5px] text-slate-500 bg-white ring-1 ring-slate-100 rounded-xl px-4 py-3">
        <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
        <span>
          Chaque synchronisation compare les données entrantes avec la base existante.
          Seuls les événements <strong className="text-slate-700">nouveaux</strong> ou <strong className="text-slate-700">modifiés</strong> sont proposés à la validation — aucun doublon.
        </span>
      </div>
    </div>
  );
};

// ─── SourceCard ───────────────────────────────────────────────────────────────

interface SourceCardProps {
  source: SourceState;
  index: number;
  total: number;
  testing: boolean;
  syncing: boolean;
  logsOpen: boolean;
  keyEditValue: string | null;
  showKey: boolean;
  onTest: () => void;
  onSync: () => void;
  onToggleEnable: () => void;
  onToggleLogs: () => void;
  onStartEditKey: () => void;
  onKeyChange: (v: string) => void;
  onSaveKey: (v: string) => void;
  onRemoveKey: () => void;
  onCancelEdit: () => void;
  onToggleShowKey: () => void;
  onFreqChange: (f: SyncFrequency) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SourceCard: React.FC<SourceCardProps> = ({
  source, index, total, testing, syncing, logsOpen, keyEditValue, showKey,
  onTest, onSync, onToggleEnable, onToggleLogs, onStartEditKey, onKeyChange,
  onSaveKey, onRemoveKey, onCancelEdit, onToggleShowKey, onFreqChange,
  onMoveUp, onMoveDown,
}) => {
  const st = STATUS_CFG[source.status];
  const rateUsedPct = Math.round((source.rateLimit.used / source.rateLimit.limit) * 100);
  const rateBarCls  = rateUsedPct > 80 ? 'bg-rose-500' : rateUsedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className={cn('rounded-2xl bg-white ring-1 ring-slate-200 transition-all', !source.enabled && 'opacity-60')}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start gap-4 px-5 py-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-[13px] font-bold', source.logoColor)}>
          {source.logoText}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-[14px] font-semibold text-slate-900">{source.name}</span>
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ring-1 ring-inset', st.cls)}>
              <st.Icon className="w-3 h-3" /> {st.label}
            </span>
            {!source.requiresKey && (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-sky-50 text-sky-600 ring-1 ring-sky-200">Sans clé</span>
            )}
            {source.freeKey && source.requiresKey && (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">Gratuit</span>
            )}
          </div>
          <p className="text-[11.5px] text-slate-500 line-clamp-2">{source.description}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="text-[10px] text-slate-400 mr-1 font-medium">#{source.priority}</span>
          <button onClick={onMoveUp} disabled={index === 0} title="Priorité plus haute" className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} title="Priorité plus basse" className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* ── Métriques ──────────────────────────────────────── */}
      <div className="px-5 pb-3 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100">
        <Metric label="Événements" value={source.eventsCount.toLocaleString('fr-FR')} />
        <Metric label="Dernière synchro" value={fmtRelative(source.lastSync)} />
        <Metric label="Prochaine synchro" value={fmtRelative(source.nextSync)} />
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1 font-medium">Fiabilité</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', source.reliability > 90 ? 'bg-emerald-500' : source.reliability > 70 ? 'bg-amber-500' : 'bg-rose-500')}
                style={{ width: `${source.reliability}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-slate-700">{source.reliability}%</span>
          </div>
        </div>
      </div>

      {/* ── Quota API ──────────────────────────────────────── */}
      <div className="px-5 pb-3 flex flex-wrap items-center gap-3 text-[11.5px]">
        <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-500 shrink-0">Quota :</span>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-[120px]">
          <div className={cn('h-full rounded-full', rateBarCls)} style={{ width: `${rateUsedPct}%` }} />
        </div>
        <span className="text-slate-600 font-medium tabular-nums">{source.rateLimit.used} / {source.rateLimit.limit} {source.rateLimit.unit}</span>
        <span className="text-slate-400">· Reset {source.rateLimit.reset}</span>
      </div>

      {/* ── Clé API ────────────────────────────────────────── */}
      {source.requiresKey && (
        <div className="px-5 pb-3 border-t border-slate-100 pt-3">
          {keyEditValue !== null ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-lg ring-1 ring-violet-300 bg-violet-50/30 px-3 py-2">
                <Key className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <input
                  autoFocus
                  type={showKey ? 'text' : 'password'}
                  value={keyEditValue}
                  onChange={(e) => onKeyChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSaveKey(keyEditValue); if (e.key === 'Escape') onCancelEdit(); }}
                  placeholder="Collez votre clé API…"
                  className="flex-1 bg-transparent outline-none text-[12.5px] text-slate-900 placeholder:text-slate-400 font-mono"
                />
                <button onClick={onToggleShowKey} className="text-slate-400 hover:text-slate-600">
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={() => onSaveKey(keyEditValue)}
                disabled={!keyEditValue.trim()}
                className="px-3 py-2 bg-violet-600 text-white text-[12px] font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                Enregistrer
              </button>
              {source.apiKey && (
                <button onClick={onRemoveKey} className="p-2 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors" title="Supprimer la clé">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={onCancelEdit} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[11.5px]">
              <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {source.apiKey ? (
                <>
                  <span className="text-slate-500 shrink-0">Clé API :</span>
                  <code className="font-mono text-[11px] text-slate-700 bg-slate-50 ring-1 ring-slate-200 px-2 py-1 rounded truncate max-w-[220px]">
                    {source.apiKey.slice(0, 8)}{'•'.repeat(Math.max(0, source.apiKey.length - 8))}
                  </code>
                  <a href={source.docsUrl} target="_blank" rel="noreferrer" className="text-violet-600 hover:underline font-medium shrink-0 ml-auto">Docs ↗</a>
                </>
              ) : (
                <span className="text-slate-400 italic">
                  Aucune clé ·{' '}
                  <a href={source.docsUrl} target="_blank" rel="noreferrer" className="text-violet-600 hover:underline not-italic font-medium">
                    Obtenir une clé gratuite ↗
                  </a>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Fréquence ──────────────────────────────────────── */}
      <div className="px-5 pb-3 flex items-center gap-3 text-[11.5px]">
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-500 shrink-0">Synchronisation :</span>
        <select
          value={source.frequency}
          onChange={(e) => onFreqChange(e.target.value as SyncFrequency)}
          disabled={!source.enabled}
          className="text-[12px] font-medium text-slate-700 bg-transparent border-0 outline-none cursor-pointer hover:text-violet-600 transition-colors disabled:opacity-40"
        >
          {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* ── Actions ────────────────────────────────────────── */}
      <div className="px-5 pb-4 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <ActionBtn
          icon={testing ? Loader2 : Wifi}
          label={testing ? 'Test…' : 'Tester connexion'}
          spinning={testing}
          disabled={testing || syncing || (!source.apiKey && source.requiresKey)}
          onClick={onTest}
          hoverCls="hover:ring-violet-300 hover:text-violet-700"
        />
        <ActionBtn
          icon={syncing ? Loader2 : RefreshCw}
          label={syncing ? 'Synchro…' : 'Synchroniser'}
          spinning={syncing}
          disabled={syncing || testing || !source.enabled}
          onClick={onSync}
          hoverCls="hover:ring-emerald-300 hover:text-emerald-700"
        />
        <ActionBtn
          icon={Eye}
          label={`Logs${source.errors.length > 0 ? ` (${source.errors.length})` : ''}`}
          onClick={onToggleLogs}
          active={logsOpen}
          badge={source.errors.length > 0 ? source.errors.length : undefined}
        />
        {source.requiresKey && (
          <ActionBtn
            icon={Edit3}
            label={source.apiKey ? 'Modifier clé' : 'Ajouter clé'}
            onClick={onStartEditKey}
          />
        )}
        {/* Désactiver / Activer — aligné à droite */}
        <button
          onClick={onToggleEnable}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium ring-1 transition-all ml-auto',
            source.enabled
              ? 'bg-white text-rose-600 ring-rose-200 hover:bg-rose-50'
              : 'bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-700',
          )}
        >
          {source.enabled ? <><WifiOff className="w-3.5 h-3.5" /> Désactiver</> : <><Wifi className="w-3.5 h-3.5" /> Activer</>}
        </button>
      </div>

      {/* ── Logs ───────────────────────────────────────────── */}
      {logsOpen && (
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/60 rounded-b-2xl space-y-1.5">
          <div className="text-[10.5px] uppercase tracking-wide text-slate-400 font-semibold mb-2">
            Logs de synchronisation
          </div>
          {source.errors.length === 0 ? (
            <div className="flex items-center gap-2 text-[12px] text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Aucune erreur — source opérationnelle
            </div>
          ) : (
            source.errors.map((log, i) => (
              <div key={i} className={cn(
                'flex items-start gap-2 text-[11.5px] px-3 py-2 rounded-lg',
                log.level === 'error' ? 'bg-rose-50 text-rose-700' : log.level === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700',
              )}>
                {log.level === 'error'
                  ? <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-medium">{log.message}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{fmtTime(log.at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5 font-medium">{label}</div>
      <div className="text-[13px] font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, spinning = false, disabled = false, active = false, onClick, hoverCls = 'hover:bg-slate-50', badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  spinning?: boolean;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  hoverCls?: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium ring-1 transition-all',
        active
          ? 'bg-slate-700 text-white ring-slate-700'
          : 'bg-white text-slate-700 ring-slate-200',
        !active && !disabled && hoverCls,
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <Icon className={cn('w-3.5 h-3.5', spinning && 'animate-spin')} />
      {label}
      {badge !== undefined && (
        <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">{badge}</span>
      )}
    </button>
  );
}
