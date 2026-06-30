/**
 * FLOWTYM — Composants partagés pour les pages Paramètres simples
 * (listes CRUD à plat, formulaires simples avec persistance localStorage).
 *
 * Le but : factoriser les structures répétitives (header, métriques,
 * table CRUD, drawer formulaire) pour que les pages "list-based" du
 * module Settings restent légères mais réelles.
 */
import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Save, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { useAuditLogger } from '@/src/hooks/settings/useAuditLogger';
import { useConfigBlob } from '@/src/hooks/settings/useConfigBlob';
import { usePagePermission } from '@/src/services/settings/permissionsService';

export const SettingsPageHeader: React.FC<{
  icon: LucideIcon;
  category: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, category, title, description, action }) => (
  <header className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex items-start gap-3 min-w-0">
      <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">{category}</div>
        <h1 className="text-[22px] font-bold text-slate-950 leading-tight">{title}</h1>
        <p className="text-[12.5px] text-slate-500 mt-1">{description}</p>
      </div>
    </div>
    {action}
  </header>
);

export const SettingsMetric: React.FC<{
  label: string;
  value: React.ReactNode;
  caption: string;
  tone?: 'violet' | 'emerald' | 'amber' | 'rose' | 'slate' | 'sky';
}> = ({ label, value, caption, tone = 'violet' }) => {
  const color = {
    violet: 'text-violet-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    slate: 'text-slate-700',
    sky: 'text-sky-700',
  }[tone];
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4">
      <div className={cn('text-[20px] font-bold tabular-nums truncate', color)}>{value}</div>
      <div className="text-[12px] font-medium text-slate-900 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{caption}</div>
    </div>
  );
};

export const SettingsToast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {message}
    </div>
  );
};

export const Phase2Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800">
    {children}
  </div>
);

// ─── Generic CRUD list page ──────────────────────────────────────────────

export interface GenericListItem {
  id: string;
  label: string;
  code?: string;
  description?: string;
  active?: boolean;
  meta?: Record<string, string | number | boolean>;
}

interface GenericListPageProps<T extends GenericListItem> {
  icon: LucideIcon;
  category: string;
  title: string;
  description: string;
  storageKey: string;
  module: 'inventory_planning' | 'rms_revenue' | 'finance_billing' | 'housekeeping' | 'pms_reservations' | 'security_backups' | 'integrations' | 'channel_manager' | 'automation_ai';
  defaults: T[];
  /** Champs additionnels rendus dans le formulaire. */
  extraFormFields?: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
  /** Colonnes additionnelles dans le tableau. */
  extraColumns?: { header: string; render: (item: T) => React.ReactNode }[];
  /** Phase 2 banner */
  phase2?: string;
  /** Header action (ex. bouton externe). */
  headerAction?: React.ReactNode;
  /** Métriques additionnelles. */
  customMetrics?: (items: T[]) => React.ReactNode;
  /** Empty value pour nouvelle entrée. */
  emptyItem: () => T;
  /**
   * Phase 5 — Capability RBAC.
   * Si fournie, applique automatiquement :
   *   - lecture min "read" pour afficher la page (bandeau "accès refusé" sinon)
   *   - "write" pour autoriser create/update/delete/toggle (boutons disabled
   *     + tooltip explicite sans le niveau requis)
   * Si omise, comportement legacy (page ouverte à tous).
   */
  capability?: string;
  /**
   * Phase 5 — Active la sync Supabase via useConfigBlob.
   * Si true, le storageKey est utilisé comme namespace (préfixe
   * `flowtym.` ou `flowtym.cfg.` retiré). Best-effort : si offline,
   * tout passe par localStorage comme avant.
   */
  supabaseSync?: boolean;
}

/** Dérive un namespace court à partir de la storageKey legacy. */
function deriveNamespace(storageKey: string): string {
  return storageKey
    .replace(/^flowtym\.cfg\./, '')
    .replace(/^flowtym\./, '')
    .replace(/\./g, '_');
}

export function GenericListPage<T extends GenericListItem>({
  icon, category, title, description, storageKey, module: moduleKey,
  defaults, extraFormFields, extraColumns, phase2, headerAction, customMetrics, emptyItem,
  capability, supabaseSync,
}: GenericListPageProps<T>) {
  // RBAC (optionnel, opt-in via prop `capability`)
  const { canRead, canWrite, DeniedBanner } = usePagePermission(capability ?? '__no_capability__');
  const rbacEnabled = !!capability;
  const effCanRead = rbacEnabled ? canRead : true;
  const effCanWrite = rbacEnabled ? canWrite : true;

  // Persistance : Supabase sync (opt-in) OU localStorage legacy
  const namespace = deriveNamespace(storageKey);
  const [blobItems, setBlobItems] = useConfigBlob<T[]>(namespace, defaults);
  const [legacyItems, setLegacyItems] = useState<T[]>(() => {
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : defaults;
    } catch { return defaults; }
  });
  const items = supabaseSync ? blobItems : legacyItems;
  const setItems = supabaseSync ? setBlobItems : setLegacyItems;

  const [editing, setEditing] = useState<T | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<T>(emptyItem());
  const [toast, setToast] = useState<string | null>(null);
  const audit = useAuditLogger();

  // Legacy : continue à persister sous l'ancienne clé pour rétrocompat
  // (en plus du blob Supabase si supabaseSync est activé)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!supabaseSync) {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
    }
  }, [items, storageKey, supabaseSync]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function startAdd() {
    setDraft({ ...emptyItem(), id: `${storageKey}_${Date.now()}` } as T);
    setAdding(true);
    setEditing(null);
  }
  function startEdit(it: T) {
    setDraft({ ...it });
    setEditing(it);
    setAdding(false);
  }
  function cancel() { setEditing(null); setAdding(false); }
  function persist() {
    if (!draft.label.trim()) return;
    if (adding) {
      setItems((arr) => [...arr, draft]);
      audit({
        action: 'module_inspected',
        module: moduleKey,
        detail: `${title} : "${draft.label}" créé`,
        meta: { entityId: draft.id, entityLabel: draft.label, op: 'create' },
      });
      notify(`"${draft.label}" créé`);
    } else if (editing) {
      setItems((arr) => arr.map((x) => (x.id === editing.id ? draft : x)));
      audit({
        action: 'module_inspected',
        module: moduleKey,
        detail: `${title} : "${draft.label}" modifié`,
        meta: { entityId: draft.id, entityLabel: draft.label, op: 'update' },
      });
      notify(`"${draft.label}" mis à jour`);
    }
    cancel();
  }
  function remove(it: T) {
    if (!confirm(`Supprimer "${it.label}" ?`)) return;
    setItems((arr) => arr.filter((x) => x.id !== it.id));
    audit({
      action: 'module_inspected',
      module: moduleKey,
      detail: `${title} : "${it.label}" supprimé`,
      severity: 'warning',
      meta: { entityId: it.id, entityLabel: it.label, op: 'delete' },
    });
    notify('Supprimé');
  }
  function toggleActive(it: T) {
    setItems((arr) => arr.map((x) => (x.id === it.id ? ({ ...x, active: !x.active } as T) : x)));
  }

  const activeCount = items.filter((x) => x.active !== false).length;

  // RBAC early return
  if (rbacEnabled && !effCanRead) return <DeniedBanner />;

  const writeTooltip = !effCanWrite && rbacEnabled
    ? `Permission requise : ${capability} (write)`
    : undefined;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={icon}
          category={category}
          title={title}
          description={description}
          action={
            <div className="flex items-center gap-2">
              {headerAction}
              <button
                onClick={() => effCanWrite && startAdd()}
                disabled={!effCanWrite}
                title={writeTooltip}
                className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          }
        />

        {customMetrics ? customMetrics(items) : (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            <SettingsMetric label="Entrées" value={`${items.length}`} caption="Au total" />
            <SettingsMetric label="Actives" value={`${activeCount}`} caption="Disponibles à l'usage" tone="emerald" />
            <SettingsMetric label="Désactivées" value={`${items.length - activeCount}`} caption="Conservées en référence" tone="slate" />
          </div>
        )}

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
          {items.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-400 text-[12.5px]">
              Aucune entrée. Cliquez sur "Ajouter" pour commencer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50/60 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Libellé</th>
                    {extraColumns?.map((c) => (
                      <th key={c.header} className="px-3 py-2.5 font-medium">{c.header}</th>
                    ))}
                    <th className="px-3 py-2.5 font-medium text-center w-24">Statut</th>
                    <th className="px-3 py-2.5 font-medium text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className={cn('border-t border-slate-100 hover:bg-slate-50/60', it.active === false && 'opacity-60')}>
                      <td className="px-5 py-2.5">
                        <div className="text-[12.5px] font-semibold text-slate-900">{it.label}</div>
                        {it.code && <div className="text-[10.5px] text-slate-500 font-mono">{it.code}</div>}
                        {it.description && <div className="text-[11px] text-slate-500 line-clamp-1">{it.description}</div>}
                      </td>
                      {extraColumns?.map((c, i) => (
                        <td key={i} className="px-3 py-2.5 text-[12px] text-slate-700">{c.render(it)}</td>
                      ))}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => effCanWrite && toggleActive(it)}
                          disabled={!effCanWrite}
                          title={writeTooltip}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed',
                            it.active !== false ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200',
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full', it.active !== false ? 'bg-emerald-500' : 'bg-slate-300')} />
                          {it.active !== false ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => effCanWrite && startEdit(it)}
                            disabled={!effCanWrite}
                            title={writeTooltip}
                            className={cn('p-1.5 rounded-md text-slate-500', effCanWrite ? 'hover:bg-slate-100' : 'opacity-30 cursor-not-allowed')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => effCanWrite && remove(it)}
                            disabled={!effCanWrite}
                            title={writeTooltip}
                            className={cn('p-1.5 rounded-md', effCanWrite ? 'hover:bg-rose-50 text-rose-600' : 'text-rose-300 opacity-40 cursor-not-allowed')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {phase2 && <Phase2Notice><strong>Phase 2 :</strong> {phase2}</Phase2Notice>}
      </div>

      {(adding || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45" onClick={cancel}>
          <div onClick={(e) => e.stopPropagation()} className="w-[520px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-slate-900">
                {adding ? `Ajouter — ${title}` : `Modifier — ${editing?.label}`}
              </h2>
              <button onClick={cancel} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <FormField label="Libellé" required>
                <input type="text" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="genericInput" />
              </FormField>
              {('code' in draft) && (
                <FormField label="Code">
                  <input type="text" value={draft.code ?? ''} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className="genericInput font-mono" />
                </FormField>
              )}
              {('description' in draft) && (
                <FormField label="Description">
                  <input type="text" value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="genericInput" />
                </FormField>
              )}
              {extraFormFields?.(draft, (p) => setDraft({ ...draft, ...p }))}
              <label className="flex items-center gap-2 text-[13px] text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.active !== false}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  className="w-4 h-4 accent-violet-600"
                />
                Actif
              </label>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex justify-end gap-2">
              <button onClick={cancel} className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100">Annuler</button>
              <button
                onClick={() => effCanWrite && persist()}
                disabled={!draft.label.trim() || !effCanWrite}
                title={writeTooltip}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" /> {adding ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
            <style>{`
              .genericInput {
                width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
                background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
                outline: none; font-size: 13px;
              }
              .genericInput:focus { box-shadow: inset 0 0 0 2px #7c3aed; }
            `}</style>
          </div>
        </div>
      )}

      <SettingsToast message={toast} />
    </div>
  );
}

export const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</span>
      {required && <span className="text-rose-500 text-[11px]">*</span>}
    </div>
    {children}
  </label>
);
