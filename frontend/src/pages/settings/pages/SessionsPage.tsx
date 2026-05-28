/**
 * FLOWTYM — Paramètres · Sessions actives.
 *
 * Liste des sessions ouvertes sur les comptes utilisateurs : appareil,
 * navigateur, IP, dernière activité. Permet de révoquer une session
 * (force logout) ou de tout révoquer en masse en cas d'incident.
 *
 * Phase 1 : sessions simulées persistées en localStorage avec une
 * "session courante" toujours présente. Phase 2 : sync réelle avec
 * Supabase auth.sessions / NextAuth.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Monitor, Smartphone, Tablet, MapPin, Clock, ShieldOff, RefreshCw, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { usePagePermission } from '@/src/services/settings/permissionsService';
import { revokeOtherSessions } from '@/src/services/settings/settingsBackends';

const STORAGE_KEY = 'flowtym.sessions';

type DeviceKind = 'desktop' | 'mobile' | 'tablet';

interface SessionEntry {
  id: string;
  userId: string;
  userName: string;
  device: DeviceKind;
  browser: string;
  os: string;
  ip: string;
  city: string;
  country: string;
  openedAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

const DEVICE_ICON: Record<DeviceKind, React.ComponentType<{ className?: string }>> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

function loadSessions(): SessionEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(arr: SessionEntry[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function detectCurrent(): { device: DeviceKind; browser: string; os: string } {
  if (typeof window === 'undefined') return { device: 'desktop', browser: 'Inconnu', os: 'Inconnu' };
  const ua = navigator.userAgent;
  const mobile = /Mobi|Android/i.test(ua);
  const tablet = /Tablet|iPad/i.test(ua);
  const device: DeviceKind = tablet ? 'tablet' : mobile ? 'mobile' : 'desktop';
  let browser = 'Inconnu';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  let os = 'Inconnu';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  return { device, browser, os };
}


export const SessionsPage: React.FC = () => {
  const { session } = useAuth();
  const [sessions, setSessions] = useState<SessionEntry[]>(() => loadSessions());
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | DeviceKind>('all');
  const { canRead, canWrite, DeniedBanner } = usePagePermission('set_users');

  // Bootstrap : crée la session courante réelle si absente
  useEffect(() => {
    if (!session) return;
    if (sessions.find((s) => s.isCurrent)) return;
    const stored = loadSessions();
    const currentInfo = detectCurrent();
    const current: SessionEntry = {
      id: `sess_${session.userId}`,
      userId: session.userId,
      userName: session.fullName ?? session.email,
      ...currentInfo,
      city: '',
      country: '',
      ip: 'session courante',
      openedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
      lastActiveAt: new Date().toISOString(),
      isCurrent: true,
    };
    const next = [current, ...stored.filter((s) => !s.isCurrent)];
    setSessions(next);
    saveSessions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId]);

  useEffect(() => { saveSessions(sessions); }, [sessions]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function revokeSession(id: string) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    if (s.isCurrent) {
      notify('Impossible de révoquer votre propre session depuis cette page');
      return;
    }
    if (!confirm(`Révoquer la session de ${s.userName} sur ${s.browser} / ${s.os} ?`)) return;
    setSessions((arr) => arr.filter((x) => x.id !== id));
    logAudit({ action: 'module_inspected', module: 'security_backups', detail: `Session révoquée : ${s.userName} (${s.browser})` });
    notify('Session révoquée');
  }

  async function revokeAll() {
    const count = sessions.filter((s) => !s.isCurrent).length;
    if (count === 0) return;
    if (!confirm(`Révoquer ${count} session${count > 1 ? 's' : ''} (votre session courante sera conservée) ?`)) return;
    // Phase 7 — appel réel à l'Edge Function revoke-session (scope=others)
    const result = await revokeOtherSessions();
    setSessions((arr) => arr.filter((s) => s.isCurrent));
    const errMsg = 'error' in result ? result.error : 'unknown';
    logAudit({
      action: 'module_inspected', module: 'security_backups',
      detail: result.ok
        ? `${count} session(s) révoquée(s) — backend OK`
        : `Révocation locale uniquement — backend indisponible (${errMsg})`,
    });
    notify(result.ok
      ? `${count} session(s) révoquée(s)`
      : 'Backend indisponible — sessions locales seulement');
  }

  function refresh() {
    setSessions((arr) => arr.map((s) => s.isCurrent ? { ...s, lastActiveAt: new Date().toISOString() } : s));
    notify('Liste rafraîchie');
  }

  const filtered = useMemo(() => {
    return sessions
      .filter((s) => filter === 'all' || s.device === filter)
      .sort((a, b) => {
        if (a.isCurrent && !b.isCurrent) return -1;
        if (!a.isCurrent && b.isCurrent) return 1;
        return b.lastActiveAt.localeCompare(a.lastActiveAt);
      });
  }, [sessions, filter]);

  const counts = useMemo(() => ({
    total: sessions.length,
    desktop: sessions.filter((s) => s.device === 'desktop').length,
    mobile: sessions.filter((s) => s.device === 'mobile').length,
    tablet: sessions.filter((s) => s.device === 'tablet').length,
  }), [sessions]);

  if (!canRead) return <DeniedBanner />;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Sécurité & Administration</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Sessions actives</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Connexions en cours sur les comptes utilisateurs. Révoquez une session pour forcer
                la déconnexion d'un appareil compromis.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
            </button>
            <button
              onClick={() => canWrite && revokeAll()}
              disabled={!canWrite || sessions.filter((s) => !s.isCurrent).length === 0}
              title={!canWrite ? 'Permission requise : set_users (write)' : undefined}
              className="px-3 py-2 rounded-lg ring-1 ring-rose-200 bg-white text-[13px] font-medium text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShieldOff className="w-3.5 h-3.5" /> Révoquer toutes les autres
            </button>
          </div>
        </header>

        {/* Métriques */}
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Sessions totales" value={`${counts.total}`} caption="Actives en ce moment" tone="violet" />
          <Metric label="Desktop" value={`${counts.desktop}`} caption="Ordinateurs" tone="slate" icon={<Monitor className="w-4 h-4" />} />
          <Metric label="Mobile" value={`${counts.mobile}`} caption="Smartphones" tone="slate" icon={<Smartphone className="w-4 h-4" />} />
          <Metric label="Tablette" value={`${counts.tablet}`} caption="Tablettes" tone="slate" icon={<Tablet className="w-4 h-4" />} />
        </div>

        {/* Filtres */}
        <section className="flex items-center gap-2 bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
          {(['all', 'desktop', 'mobile', 'tablet'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-[12px] font-medium ring-1 transition-colors',
                filter === f ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {f === 'all' ? 'Tous' : f === 'desktop' ? 'Desktop' : f === 'mobile' ? 'Mobile' : 'Tablette'}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-500">{filtered.length} session{filtered.length > 1 ? 's' : ''}</span>
        </section>

        {/* Liste sessions */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400">
              <Activity className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              <div className="text-[13px] font-medium text-slate-700">Aucune session</div>
              <div className="text-[11.5px] mt-1">Les connexions actives apparaîtront ici.</div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const Icon = DEVICE_ICON[s.device];
                const last = relativeTime(s.lastActiveAt);
                return (
                  <li key={s.id} className={cn('px-5 py-3 flex items-start gap-3', s.isCurrent && 'bg-violet-50/30')}>
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center ring-1', s.isCurrent ? 'bg-violet-100 text-violet-700 ring-violet-200' : 'bg-slate-100 text-slate-600 ring-slate-200')}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-slate-900">{s.userName}</span>
                        {s.isCurrent && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                            Session courante
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-slate-600 mt-0.5">
                        {s.browser} · {s.os}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.city}, {s.country}</span>
                        <span className="font-mono">{s.ip}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Actif {last}</span>
                      </div>
                    </div>
                    {!s.isCurrent && (
                      <button
                        onClick={() => canWrite && revokeSession(s.id)}
                        disabled={!canWrite}
                        title={!canWrite ? 'Permission requise : set_users (write)' : undefined}
                        className="px-2.5 py-1.5 rounded-lg ring-1 ring-rose-200 bg-white text-[11.5px] font-medium text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1"
                      >
                        <ShieldOff className="w-3 h-3" /> Révoquer
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Phase 2 info */}
        <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong>Phase 2 :</strong> sync réelle avec auth.sessions (Supabase) + détection
            d'anomalie (IP inhabituelle, géolocalisation impossible) + déclencheur automatique de
            révocation et notification email.
          </div>
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

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

const Metric: React.FC<{ label: string; value: string; caption: string; tone: 'violet' | 'slate'; icon?: React.ReactNode }> = ({ label, value, caption, tone, icon }) => {
  const color = tone === 'violet' ? 'text-violet-700' : 'text-slate-700';
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4 flex items-start gap-3">
      {icon && <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center ring-1 ring-slate-100 shrink-0">{icon}</div>}
      <div className="min-w-0">
        <div className={cn('text-[20px] font-bold tabular-nums', color)}>{value}</div>
        <div className="text-[12px] font-medium text-slate-900">{label}</div>
        <div className="text-[11px] text-slate-500">{caption}</div>
      </div>
    </div>
  );
};
