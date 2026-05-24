/**
 * FLOWTYM — Paramètres · Connecteurs OTA & API.
 *
 * Cockpit des canaux de distribution et intégrations externes.
 * Phase 1 : liste statique des connecteurs prioritaires (Booking,
 * Expedia, Airbnb, etc.) + statut (connecté/erreur/non configuré) +
 * dernière sync + actions. Persistance localStorage pour le statut.
 * Phase 2 : connexion réelle avec OAuth + heartbeat.
 *
 * Toute connexion ajoutée alimente le score Distribution du Control
 * Center.
 */
import React, { useState, useEffect } from 'react';
import {
  Share2, Plus, RefreshCw, CheckCircle2, AlertCircle, Globe, Pause, Play, Settings as SettingsIcon, ExternalLink,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore, type ChannelConfig } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

type ConnectorStatus = 'connected' | 'error' | 'pending' | 'disabled';

interface ConnectorMeta {
  id: string;
  name: string;
  category: 'ota' | 'gds' | 'meta' | 'pms' | 'channel_manager';
  url: string;
  /** Statut courant — persisté localement. */
  status: ConnectorStatus;
  lastSyncAt?: string;
  inventoryShare?: number;     // % de chambres distribuées (mock)
  bookingsLast30d?: number;    // nb réservations 30 derniers jours (mock)
}

const STORAGE_KEY = 'flowtym.connectors';

const CATALOG: Omit<ConnectorMeta, 'status' | 'lastSyncAt' | 'inventoryShare' | 'bookingsLast30d'>[] = [
  { id: 'booking',     name: 'Booking.com',    category: 'ota', url: 'https://www.booking.com' },
  { id: 'expedia',     name: 'Expedia Group',  category: 'ota', url: 'https://www.expedia.fr' },
  { id: 'airbnb',      name: 'Airbnb',         category: 'ota', url: 'https://www.airbnb.fr' },
  { id: 'hotels',      name: 'Hotels.com',     category: 'ota', url: 'https://fr.hotels.com' },
  { id: 'agoda',       name: 'Agoda',          category: 'ota', url: 'https://www.agoda.com' },
  { id: 'ctrip',       name: 'Trip.com',       category: 'ota', url: 'https://www.trip.com' },
  { id: 'google',      name: 'Google Hotels',  category: 'meta', url: 'https://www.google.com/travel/hotels' },
  { id: 'tripadvisor', name: 'Tripadvisor',    category: 'meta', url: 'https://www.tripadvisor.fr' },
  { id: 'amadeus',     name: 'Amadeus GDS',    category: 'gds', url: 'https://amadeus.com' },
  { id: 'sabre',       name: 'Sabre GDS',      category: 'gds', url: 'https://www.sabre.com' },
  { id: 'siteminder',  name: 'SiteMinder',     category: 'channel_manager', url: 'https://www.siteminder.com' },
  { id: 'd_edge',      name: 'D-EDGE',         category: 'channel_manager', url: 'https://www.d-edge.com' },
];

const CATEGORY_LABEL = {
  ota: 'OTA',
  gds: 'GDS',
  meta: 'Méta-recherche',
  pms: 'PMS externe',
  channel_manager: 'Channel Manager',
} as const;

const STATUS_TONE: Record<ConnectorStatus, { dot: string; pill: string; text: string; label: string }> = {
  connected: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 ring-emerald-100', text: 'text-emerald-700', label: 'Connecté' },
  error:     { dot: 'bg-rose-500',    pill: 'bg-rose-50 ring-rose-100',       text: 'text-rose-700',    label: 'Erreur' },
  pending:   { dot: 'bg-amber-500',   pill: 'bg-amber-50 ring-amber-100',     text: 'text-amber-700',   label: 'En attente' },
  disabled:  { dot: 'bg-slate-300',   pill: 'bg-slate-50 ring-slate-100',     text: 'text-slate-500',   label: 'Désactivé' },
};

function loadStored(): Record<string, Partial<ConnectorMeta>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveStored(m: Record<string, Partial<ConnectorMeta>>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}

/**
 * Construit le tableau des connecteurs courant à partir du catalogue
 * + des overrides stockés en localStorage + des channels du
 * configStore (compatibilité ascendante).
 */
function buildConnectors(channels: ChannelConfig[]): ConnectorMeta[] {
  const stored = loadStored();
  return CATALOG.map((c) => {
    const override = stored[c.id] ?? {};
    const inStore = channels.find((ch) => ch.id === c.id || ch.name === c.name);
    return {
      ...c,
      status: (override.status ?? (inStore ? 'connected' : 'disabled')) as ConnectorStatus,
      lastSyncAt: override.lastSyncAt,
      inventoryShare: override.inventoryShare,
      bookingsLast30d: override.bookingsLast30d,
    };
  });
}

export const ConnectorsPage: React.FC = () => {
  const channels = useConfigStore((s) => s.channels);
  const updateChannels = useConfigStore((s) => s.updateChannels);

  const [connectors, setConnectors] = useState<ConnectorMeta[]>(() => buildConnectors(channels));
  const [filter, setFilter] = useState<'all' | ConnectorMeta['category']>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => { setConnectors(buildConnectors(channels)); }, [channels]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function persist(updates: Partial<Record<string, Partial<ConnectorMeta>>>) {
    const stored = loadStored();
    for (const [id, patch] of Object.entries(updates)) {
      stored[id] = { ...stored[id], ...patch };
    }
    saveStored(stored);
    setConnectors(buildConnectors(channels));
  }

  function connect(c: ConnectorMeta) {
    // Ajoute au store global pour que le moteur de diagnostic le voie
    if (!channels.find((ch) => ch.id === c.id)) {
      updateChannels([...channels, { id: c.id, name: c.name, color: '#7C3AED' }]);
    }
    persist({
      [c.id]: {
        status: 'connected',
        lastSyncAt: new Date().toISOString(),
        inventoryShare: 100,
        bookingsLast30d: 12 + Math.floor(Math.random() * 50),
      },
    });
    logAudit({ action: 'module_inspected', module: 'channel_manager', detail: `Connecteur ${c.name} activé` });
    notify(`${c.name} connecté`);
  }

  function disconnect(c: ConnectorMeta) {
    updateChannels(channels.filter((ch) => ch.id !== c.id));
    persist({ [c.id]: { status: 'disabled', inventoryShare: 0, bookingsLast30d: 0 } });
    logAudit({ action: 'module_inspected', module: 'channel_manager', detail: `Connecteur ${c.name} désactivé` });
    notify(`${c.name} désactivé`);
  }

  async function syncNow(c: ConnectorMeta) {
    setSyncing(c.id);
    await new Promise((r) => setTimeout(r, 900));
    const success = Math.random() > 0.1;
    persist({
      [c.id]: {
        status: success ? 'connected' : 'error',
        lastSyncAt: new Date().toISOString(),
      },
    });
    logAudit({
      action: 'module_inspected', module: 'channel_manager',
      detail: `Sync ${c.name} ${success ? 'OK' : 'échouée'}`,
    });
    notify(success ? `${c.name} synchronisé` : `Erreur sync ${c.name}`);
    setSyncing(null);
  }

  const filtered = connectors.filter((c) => filter === 'all' || c.category === filter);
  const total = connectors.length;
  const connected = connectors.filter((c) => c.status === 'connected').length;
  const errored = connectors.filter((c) => c.status === 'error').length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Distribution & OTA</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Connecteurs</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                OTAs, GDS, méta-recherche et channel managers connectés au PMS.
              </p>
            </div>
          </div>
        </header>

        {/* Métriques */}
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Connecteurs actifs" value={`${connected}`} caption={`/${total} disponibles`} tone="emerald" />
          <Metric label="En erreur" value={`${errored}`} caption={errored === 0 ? 'Tout opérationnel' : 'Action requise'} tone={errored > 0 ? 'critical' : 'slate'} />
          <Metric label="OTAs" value={`${connectors.filter((c) => c.category === 'ota' && c.status === 'connected').length}`} caption="Booking, Expedia, Airbnb…" tone="violet" />
          <Metric label="Channel Managers" value={`${connectors.filter((c) => c.category === 'channel_manager' && c.status === 'connected').length}`} caption="Mutualisation OTA" tone="sky" />
        </div>

        {/* Filtres */}
        <section className="flex flex-wrap items-center gap-2 bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
          {(['all', 'ota', 'gds', 'meta', 'channel_manager'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-[12px] font-medium ring-1 transition-colors',
                filter === f ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {f === 'all' ? 'Tous' : CATEGORY_LABEL[f as keyof typeof CATEGORY_LABEL]}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-500">{filtered.length} / {total}</span>
        </section>

        {/* Cartes connecteurs */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const tone = STATUS_TONE[c.status];
            return (
              <div key={c.id} className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-[14px] font-bold">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 truncate">{c.name}</div>
                    <div className="text-[10.5px] uppercase tracking-wide font-semibold text-slate-400">
                      {CATEGORY_LABEL[c.category]}
                    </div>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[10.5px] font-semibold', tone.pill, tone.text)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', tone.dot)} />
                    {tone.label}
                  </span>
                </div>

                {c.status === 'connected' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Inventaire</div>
                      <div className="text-[13px] font-bold text-slate-900 tabular-nums">{c.inventoryShare ?? 100}%</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Réservations 30j</div>
                      <div className="text-[13px] font-bold text-slate-900 tabular-nums">{c.bookingsLast30d ?? 0}</div>
                    </div>
                  </div>
                )}

                {c.lastSyncAt && (
                  <div className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3" />
                    Dernière sync : {new Date(c.lastSyncAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}

                <div className="flex items-center gap-1 pt-1">
                  {c.status === 'disabled' ? (
                    <button
                      onClick={() => connect(c)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[12px] font-medium hover:bg-violet-700 inline-flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Connecter
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => syncNow(c)}
                        disabled={syncing === c.id}
                        className="flex-1 px-2 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[11.5px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1 disabled:opacity-60"
                      >
                        <RefreshCw className={cn('w-3 h-3', syncing === c.id && 'animate-spin')} />
                        {syncing === c.id ? 'Sync…' : 'Sync'}
                      </button>
                      <button
                        onClick={() => disconnect(c)}
                        className="px-2 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[11.5px] font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                        title="Désactiver"
                      >
                        <Pause className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[11.5px] text-slate-500 hover:bg-slate-50"
                    title="Site externe"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; caption: string; tone: 'violet' | 'sky' | 'emerald' | 'critical' | 'slate' }> = ({ label, value, caption, tone }) => {
  const color =
    tone === 'violet' ? 'text-violet-700' :
    tone === 'sky' ? 'text-sky-700' :
    tone === 'emerald' ? 'text-emerald-700' :
    tone === 'critical' ? 'text-rose-700' :
    'text-slate-700';
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4">
      <div className={cn('text-[20px] font-bold tabular-nums', color)}>{value}</div>
      <div className="text-[12px] font-medium text-slate-900 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{caption}</div>
    </div>
  );
};
