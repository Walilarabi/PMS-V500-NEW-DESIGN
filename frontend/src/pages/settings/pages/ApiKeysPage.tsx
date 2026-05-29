/**
 * FLOWTYM — Paramètres · API & Webhooks.
 *
 * Gestion des clés API (création, révocation, rotation) et webhooks
 * sortants (événements souscrits, URL cible, secret de signature).
 * Phase 1 : génération de clés mock (préfixe flw_live_), persistance
 * localStorage. Phase 2 : intégration réelle avec backend + rate
 * limiting.
 */
import React, { useEffect, useState } from 'react';
import {
  Cog, Plus, Copy, Trash2, RotateCcw, Eye, EyeOff, CheckCircle2, Webhook, Zap, AlertCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { usePagePermission } from '@/src/services/settings/permissionsService';
import { useConfigBlob } from '@/src/hooks/settings/useConfigBlob';
import { createApiKey as createApiKeyBackend } from '@/src/services/settings/settingsBackends';

const KEYS_STORAGE = 'flowtym.api.keys';
const HOOKS_STORAGE = 'flowtym.api.hooks';

interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  secret: string;       // visible une fois à la création, puis masqué
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revoked: boolean;
}

interface WebhookConfig {
  id: string;
  label: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

const ALL_SCOPES = [
  { id: 'read', label: 'Lecture', desc: 'Lire réservations, clients, factures' },
  { id: 'write', label: 'Écriture', desc: 'Créer/modifier réservations et factures' },
  { id: 'admin', label: 'Admin', desc: 'Tous droits — usage sensible uniquement' },
  { id: 'rates', label: 'Tarifs', desc: 'Push / pull tarifs et restrictions' },
  { id: 'analytics', label: 'Analytics', desc: 'Accès aux exports BI / data warehouse' },
];

const ALL_EVENTS = [
  'reservation.created',
  'reservation.updated',
  'reservation.cancelled',
  'guest.checked_in',
  'guest.checked_out',
  'invoice.created',
  'payment.received',
  'rate.changed',
  'rms.decision_accepted',
];

function loadKeys(): ApiKey[] {
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveKeys(k: ApiKey[]) { localStorage.setItem(KEYS_STORAGE, JSON.stringify(k)); }
function loadHooks(): WebhookConfig[] {
  try {
    const raw = localStorage.getItem(HOOKS_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveHooks(h: WebhookConfig[]) { localStorage.setItem(HOOKS_STORAGE, JSON.stringify(h)); }

function genSecret(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const out = Array.from(bytes).map(b => chars[b % chars.length]).join('');
  return `${prefix}_${out}`;
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export const ApiKeysPage: React.FC = () => {
  // Phase 7 — migration douce vers useConfigBlob (Supabase + localStorage)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const legacyK = window.localStorage.getItem('flowtym.api.keys');
    const nextK = window.localStorage.getItem('flowtym.cfg.api_keys');
    if (legacyK && !nextK) window.localStorage.setItem('flowtym.cfg.api_keys', legacyK);
    const legacyH = window.localStorage.getItem('flowtym.api.hooks');
    const nextH = window.localStorage.getItem('flowtym.cfg.api_hooks');
    if (legacyH && !nextH) window.localStorage.setItem('flowtym.cfg.api_hooks', legacyH);
  }, []);
  const [keys, setKeys] = useConfigBlob<ApiKey[]>('api_keys', loadKeys());
  const [hooks, setHooks] = useConfigBlob<WebhookConfig[]>('api_hooks', loadHooks());
  const [tab, setTab] = useState<'keys' | 'hooks'>('keys');
  const { canRead, canWrite, canAdmin, DeniedBanner } = usePagePermission('set_api');
  const [newKeyDraft, setNewKeyDraft] = useState<{ label: string; scopes: string[] }>({ label: '', scopes: ['read'] });
  const [newHookDraft, setNewHookDraft] = useState<{ label: string; url: string; events: string[] }>({ label: '', url: '', events: ['reservation.created'] });
  const hookUrlError = newHookDraft.url.trim().length > 0 && !isValidHttpsUrl(newHookDraft.url);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  async function createKey() {
    if (!newKeyDraft.label.trim()) return;
    // Phase 7 — appel réel à l'Edge Function api-key-create. Le secret
    // est généré server-side et hashé en base. Si backend indispo, on
    // retombe sur la génération locale (dev/mock).
    const remote = await createApiKeyBackend(newKeyDraft.label.trim(), newKeyDraft.scopes);
    const key: ApiKey = remote.ok
      ? {
          id: remote.data.id,
          label: remote.data.label,
          prefix: remote.data.prefix,
          secret: remote.data.secret,
          scopes: remote.data.scopes,
          createdAt: remote.data.createdAt,
          revoked: false,
        }
      : (() => {
          const secret = genSecret('flw_live');
          return {
            id: `key_${Date.now()}`,
            label: newKeyDraft.label.trim(),
            prefix: secret.slice(0, 12),
            secret,
            scopes: newKeyDraft.scopes,
            createdAt: new Date().toISOString(),
            revoked: false,
          };
        })();
    setKeys((arr) => [key, ...arr]);
    setRevealedKey(key.id);
    setNewKeyDraft({ label: '', scopes: ['read'] });
    const errMsg = 'error' in remote ? remote.error : 'unknown';
    logAudit({
      action: 'module_inspected',
      detail: remote.ok
        ? `Clé API "${key.label}" créée via backend (scopes: ${key.scopes.join(', ')})`
        : `Clé API "${key.label}" créée localement (backend indispo: ${errMsg})`,
    });
    notify(remote.ok
      ? 'Clé créée — copiez-la maintenant, vous ne la reverrez plus en clair'
      : 'Clé créée localement uniquement — backend indisponible');
  }

  function revokeKey(id: string) {
    if (!confirm('Révoquer cette clé API ? Toute application qui l\'utilise cessera de fonctionner.')) return;
    setKeys((arr) => arr.map((k) => (k.id === id ? { ...k, revoked: true } : k)));
    logAudit({ action: 'module_inspected', detail: `Clé API révoquée : ${keys.find((k) => k.id === id)?.label}` });
    notify('Clé révoquée');
  }

  function deleteKey(id: string) {
    if (!confirm('Supprimer définitivement cette clé du registre ?')) return;
    setKeys((arr) => arr.filter((k) => k.id !== id));
    notify('Clé supprimée');
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => notify('Copié dans le presse-papier'));
  }

  function createHook() {
    if (!newHookDraft.label.trim() || !isValidHttpsUrl(newHookDraft.url)) return;
    const hook: WebhookConfig = {
      id: `hook_${Date.now()}`,
      label: newHookDraft.label.trim(),
      url: newHookDraft.url.trim(),
      events: newHookDraft.events,
      secret: genSecret('whsec'),
      active: true,
      createdAt: new Date().toISOString(),
    };
    setHooks((arr) => [hook, ...arr]);
    setNewHookDraft({ label: '', url: '', events: ['reservation.created'] });
    logAudit({ action: 'module_inspected', detail: `Webhook "${hook.label}" créé sur ${hook.url}` });
    notify('Webhook créé');
  }

  function toggleHook(id: string) {
    setHooks((arr) => arr.map((h) => (h.id === id ? { ...h, active: !h.active } : h)));
  }
  function deleteHook(id: string) {
    if (!confirm('Supprimer ce webhook ?')) return;
    setHooks((arr) => arr.filter((h) => h.id !== id));
    notify('Webhook supprimé');
  }

  if (!canRead) return <DeniedBanner />;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Cog className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Intégrations</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">API & Webhooks</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Clés d'API et webhooks sortants pour vos intégrations externes.
              </p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="inline-flex rounded-lg ring-1 ring-slate-200 bg-white p-0.5">
          {(['keys', 'hooks'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-md text-[12.5px] font-medium inline-flex items-center gap-1.5',
                tab === t ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {t === 'keys' ? <Zap className="w-3.5 h-3.5" /> : <Webhook className="w-3.5 h-3.5" />}
              {t === 'keys' ? `Clés API (${keys.filter((k) => !k.revoked).length})` : `Webhooks (${hooks.filter((h) => h.active).length})`}
            </button>
          ))}
        </div>

        {/* ─── CLÉS API ───────────────────────────────────────────────── */}
        {tab === 'keys' && (
          <div className="space-y-4">
            {/* Création */}
            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5">
              <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Nouvelle clé API</h3>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  placeholder="Libellé (ex. Intégration Booking)"
                  value={newKeyDraft.label}
                  onChange={(e) => setNewKeyDraft({ ...newKeyDraft, label: e.target.value })}
                  className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none"
                />
                <button
                  onClick={() => canAdmin && createKey()}
                  disabled={!newKeyDraft.label.trim() || !canAdmin}
                  title={!canAdmin ? 'Permission requise : set_api (admin)' : undefined}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" /> Créer la clé
                </button>
              </div>
              <div className="mt-3">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Scopes</div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SCOPES.map((s) => {
                    const active = newKeyDraft.scopes.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => setNewKeyDraft({
                          ...newKeyDraft,
                          scopes: active
                            ? newKeyDraft.scopes.filter((x) => x !== s.id)
                            : [...newKeyDraft.scopes, s.id],
                        })}
                        title={s.desc}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11.5px] font-medium ring-1',
                          active ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Liste */}
            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
              <header className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-[13px] font-semibold text-slate-900">Clés actives</h3>
              </header>
              {keys.length === 0 ? (
                <div className="px-5 py-12 text-center text-slate-400">
                  <Zap className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <div className="text-[13px] font-medium text-slate-700">Aucune clé API</div>
                  <div className="text-[11.5px] mt-1">Créez votre première clé pour brancher une intégration externe.</div>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {keys.map((k) => {
                    const showSecret = revealedKey === k.id;
                    return (
                      <li key={k.id} className={cn('px-5 py-3', k.revoked && 'opacity-60')}>
                        <div className="flex items-start gap-3">
                          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center ring-1', k.revoked ? 'bg-rose-50 text-rose-600 ring-rose-100' : 'bg-violet-50 text-violet-600 ring-violet-100')}>
                            <Zap className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-semibold text-slate-900">{k.label}</span>
                              {k.revoked && <span className="text-[10px] uppercase font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">Révoquée</span>}
                              {k.scopes.map((s) => (
                                <span key={s} className="text-[10px] uppercase font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{s}</span>
                              ))}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <code className="text-[11.5px] font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded">
                                {showSecret ? k.secret : `${k.prefix}_${'•'.repeat(28)}`}
                              </code>
                              <button onClick={() => setRevealedKey(showSecret ? null : k.id)} className="p-1 rounded hover:bg-slate-100" title={showSecret ? 'Masquer' : 'Révéler'}>
                                {showSecret ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                              </button>
                              <button onClick={() => copy(k.secret)} className="p-1 rounded hover:bg-slate-100" title="Copier">
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                            </div>
                            <div className="mt-1 text-[10.5px] text-slate-400">
                              Créée le {new Date(k.createdAt).toLocaleDateString('fr-FR')} · Dernière utilisation : {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('fr-FR') : 'jamais'}
                            </div>
                            {showSecret && !k.revoked && (
                              <div className="mt-2 flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 ring-1 ring-amber-100 rounded-lg px-3 py-2">
                                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>Conservez cette clé secrète — elle ne sera plus affichée en clair après cette session.</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!k.revoked && (
                              <button onClick={() => canAdmin && revokeKey(k.id)} disabled={!canAdmin} className={cn("p-1.5 rounded-md text-amber-700", canAdmin ? "hover:bg-amber-50" : "opacity-30 cursor-not-allowed")} title={canAdmin ? "Révoquer" : "Permission requise : set_api (admin)"}>
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => canAdmin && deleteKey(k.id)} disabled={!canAdmin} className={cn("p-1.5 rounded-md text-rose-700", canAdmin ? "hover:bg-rose-50" : "opacity-30 cursor-not-allowed")} title={canAdmin ? "Supprimer" : "Permission requise : set_api (admin)"}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* ─── WEBHOOKS ───────────────────────────────────────────────── */}
        {tab === 'hooks' && (
          <div className="space-y-4">
            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5">
              <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Nouveau webhook</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text" placeholder="Libellé (ex. Sync compta)"
                  value={newHookDraft.label}
                  onChange={(e) => setNewHookDraft({ ...newHookDraft, label: e.target.value })}
                  className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none"
                />
                <div className="flex flex-col gap-1">
                  <input
                    type="url" placeholder="https://votre-domaine.com/webhook"
                    value={newHookDraft.url}
                    onChange={(e) => setNewHookDraft({ ...newHookDraft, url: e.target.value })}
                    className={cn(
                      'px-3 py-2 rounded-lg ring-1 text-[13px] outline-none',
                      hookUrlError ? 'ring-red-400 bg-red-50/40' : 'ring-slate-200 focus:ring-violet-500',
                    )}
                  />
                  {hookUrlError && (
                    <span className="text-[11px] text-red-500">URL invalide — doit commencer par https://</span>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Événements souscrits</div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_EVENTS.map((evt) => {
                    const active = newHookDraft.events.includes(evt);
                    return (
                      <button
                        key={evt}
                        onClick={() => setNewHookDraft({
                          ...newHookDraft,
                          events: active ? newHookDraft.events.filter((x) => x !== evt) : [...newHookDraft.events, evt],
                        })}
                        className={cn(
                          'px-2 py-1 rounded-md text-[11px] font-mono ring-1',
                          active ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                        )}
                      >
                        {evt}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => canAdmin && createHook()}
                  disabled={!canAdmin || !newHookDraft.label.trim() || !isValidHttpsUrl(newHookDraft.url) || newHookDraft.events.length === 0}
                  title={!canAdmin ? 'Permission requise : set_api (admin)' : undefined}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" /> Créer le webhook
                </button>
              </div>
            </section>

            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
              <header className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-[13px] font-semibold text-slate-900">Webhooks configurés</h3>
              </header>
              {hooks.length === 0 ? (
                <div className="px-5 py-12 text-center text-slate-400">
                  <Webhook className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <div className="text-[13px] font-medium text-slate-700">Aucun webhook</div>
                  <div className="text-[11.5px] mt-1">Branchez vos systèmes externes en temps réel.</div>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {hooks.map((h) => (
                    <li key={h.id} className="px-5 py-3 flex items-start gap-3">
                      <button onClick={() => canWrite && toggleHook(h.id)} disabled={!canWrite} title={!canWrite ? 'Permission requise : set_api (write)' : undefined} className={cn('relative w-9 h-5 rounded-full transition-colors shrink-0 mt-1 disabled:opacity-40 disabled:cursor-not-allowed', h.active ? 'bg-emerald-500' : 'bg-slate-300')}>
                        <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', h.active && 'translate-x-4')} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900">{h.label}</div>
                        <code className="text-[11.5px] font-mono text-slate-700 block truncate">{h.url}</code>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {h.events.map((e) => (
                            <span key={e} className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{e}</span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => canAdmin && deleteHook(h.id)} disabled={!canAdmin} title={!canAdmin ? 'Permission requise : set_api (admin)' : undefined} className={cn("p-1.5 rounded-md text-rose-700", canAdmin ? "hover:bg-rose-50" : "opacity-30 cursor-not-allowed")}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}
      </div>
    </div>
  );
};
