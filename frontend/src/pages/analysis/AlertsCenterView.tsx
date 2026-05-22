/**
 * FLOWTYM — Centre d'alertes
 *
 * Page dédiée au CRUD des watchers + inbox des alertes déclenchées.
 */

import React, { useEffect, useState } from 'react';
import {
  BellRing, Plus, RefreshCw, Trash2, Edit2, Power, PowerOff,
  AlertTriangle, AlertCircle, Info, Loader2, Check, CheckCheck,
} from 'lucide-react';
import {
  listWatchers, createWatcher, updateWatcher, deleteWatcher, toggleWatcher,
  listTriggers, acknowledgeTrigger, acknowledgeAll, evaluateWatchers,
  METRIC_LABELS, PERIOD_LABELS,
  type AlertWatcher, type AlertTrigger,
  type AlertMetric, type AlertOperator, type AlertPeriod, type AlertSeverity,
} from '../../services/analysis/alerts.service';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const SEVERITY_CONFIG: Record<AlertSeverity, { bg: string; text: string; border: string; icon: typeof AlertCircle }> = {
  critical: { bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200',    icon: AlertCircle },
  warning:  { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200',  icon: AlertTriangle },
  info:     { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200',   icon: Info },
};

export const AlertsCenterView: React.FC = () => {
  const [watchers, setWatchers] = useState<AlertWatcher[]>([]);
  const [triggers, setTriggers] = useState<AlertTrigger[]>([]);
  const [tab, setTab] = useState<'inbox' | 'watchers'>('inbox');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AlertWatcher | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unack'>('unack');

  const reload = async () => {
    setLoading(true);
    try {
      const [w, t] = await Promise.all([
        listWatchers().catch(() => []),
        listTriggers({ limit: 200 }).catch(() => []),
      ]);
      setWatchers(w);
      setTriggers(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      await evaluateWatchers();
      await reload();
    } catch (e) {
      alert("Erreur lors de l'évaluation : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEvaluating(false);
    }
  };

  const handleAckAll = async () => {
    if (!confirm("Marquer toutes les alertes comme lues ?")) return;
    await acknowledgeAll();
    await reload();
  };

  const handleAck = async (id: string) => {
    await acknowledgeTrigger(id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, acknowledged: true, acknowledged_at: new Date().toISOString() } : t));
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await toggleWatcher(id, enabled);
    setWatchers(prev => prev.map(w => w.id === id ? { ...w, enabled } : w));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce watcher ? Tous ses déclenchements seront supprimés aussi.")) return;
    await deleteWatcher(id);
    await reload();
  };

  const filteredTriggers = filter === 'unack' ? triggers.filter(t => !t.acknowledged) : triggers;
  const unackCount = triggers.filter(t => !t.acknowledged).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 border border-gray-300 rounded p-0.5 bg-white">
          <button
            onClick={() => setTab('inbox')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5',
              tab === 'inbox' ? 'bg-violet-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <BellRing className="w-3.5 h-3.5" />
            Inbox
            {unackCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unackCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('watchers')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded transition-colors',
              tab === 'watchers' ? 'bg-violet-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            Watchers ({watchers.length})
          </button>
        </div>

        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="px-3 py-1.5 text-xs font-semibold border border-gray-300 bg-white text-gray-700 rounded hover:bg-gray-50 flex items-center gap-1.5"
        >
          {evaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Évaluer maintenant
        </button>

        <div className="flex-1" />

        {tab === 'inbox' && unackCount > 0 && (
          <button
            onClick={handleAckAll}
            className="px-3 py-1.5 text-xs font-semibold border border-emerald-300 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 flex items-center gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Tout marquer lu
          </button>
        )}

        {tab === 'watchers' && (
          <button
            onClick={() => { setEditing(null); setShowCreate(true); }}
            className="px-3 py-1.5 text-xs font-bold bg-violet-600 text-white rounded hover:bg-violet-700 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau watcher
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Chargement…
        </div>
      ) : tab === 'inbox' ? (
        <InboxView
          triggers={filteredTriggers}
          watchers={watchers}
          filter={filter}
          onFilterChange={setFilter}
          onAck={handleAck}
        />
      ) : (
        <WatchersListView
          watchers={watchers}
          onToggle={handleToggle}
          onEdit={(w) => { setEditing(w); setShowCreate(true); }}
          onDelete={handleDelete}
          onCreate={() => { setEditing(null); setShowCreate(true); }}
        />
      )}

      {showCreate && (
        <WatcherEditorModal
          initial={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={async () => {
            setShowCreate(false);
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
};

// ─── Inbox ────────────────────────────────────────────────────────────────

function InboxView({
  triggers, watchers, filter, onFilterChange, onAck,
}: {
  triggers: AlertTrigger[];
  watchers: AlertWatcher[];
  filter: 'all' | 'unack';
  onFilterChange: (f: 'all' | 'unack') => void;
  onAck: (id: string) => void;
}) {
  const watcherById = new Map(watchers.map(w => [w.id, w]));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Filtre :</span>
        <button
          onClick={() => onFilterChange('unack')}
          className={cn('px-2.5 py-1 rounded font-semibold', filter === 'unack' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-700')}
        >
          Non lues
        </button>
        <button
          onClick={() => onFilterChange('all')}
          className={cn('px-2.5 py-1 rounded font-semibold', filter === 'all' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-700')}
        >
          Toutes
        </button>
        <span className="ml-auto text-gray-500">{triggers.length} alerte{triggers.length > 1 ? 's' : ''}</span>
      </div>

      {triggers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <BellRing className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {filter === 'unack' ? 'Aucune alerte non lue' : 'Aucune alerte'}
          </p>
          <p className="text-xs text-gray-500">
            Les déclenchements de vos watchers apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {triggers.map(t => {
            const cfg = SEVERITY_CONFIG[t.severity as AlertSeverity] ?? SEVERITY_CONFIG.info;
            const Icon = cfg.icon;
            const watcher = watcherById.get(t.watcher_id);
            const metricLabel = watcher ? METRIC_LABELS[watcher.metric] : '—';
            return (
              <div
                key={t.id}
                className={cn(
                  'rounded-lg border p-3 flex items-start gap-3',
                  cfg.bg, cfg.border,
                  t.acknowledged && 'opacity-50'
                )}
              >
                <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', cfg.text)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-sm font-bold', cfg.text)}>
                      {watcher?.name ?? 'Watcher supprimé'}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide font-bold text-gray-500">{metricLabel}</span>
                  </div>
                  <p className={cn('text-xs', cfg.text, 'opacity-90')}>{t.message}</p>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {new Date(t.triggered_at).toLocaleString('fr-FR')}
                    {t.acknowledged && t.acknowledged_at && (
                      <span className="ml-2 text-emerald-700">
                        ✓ Acquittée {new Date(t.acknowledged_at).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>
                {!t.acknowledged && (
                  <button
                    onClick={() => onAck(t.id)}
                    title="Marquer comme lue"
                    className="px-2 py-1 text-xs font-bold bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Lu
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Watchers list ────────────────────────────────────────────────────────

function WatchersListView({
  watchers, onToggle, onEdit, onDelete, onCreate,
}: {
  watchers: AlertWatcher[];
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (w: AlertWatcher) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}) {
  if (watchers.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <BellRing className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-700 mb-1">Aucun watcher défini</p>
        <p className="text-xs text-gray-500 mb-4">
          Créez votre premier watcher pour être alerté quand un KPI franchit un seuil.
        </p>
        <button
          onClick={onCreate}
          className="px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-md hover:bg-violet-700 inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Créer un watcher
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {watchers.map(w => {
        const cfg = SEVERITY_CONFIG[w.severity];
        const Icon = cfg.icon;
        return (
          <div key={w.id} className={cn('bg-white rounded-lg border p-4', w.enabled ? cfg.border : 'border-gray-200', !w.enabled && 'opacity-60')}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={cn('w-4 h-4 flex-shrink-0', cfg.text)} />
                <span className="text-sm font-bold text-gray-900 truncate">{w.name}</span>
              </div>
              <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', cfg.bg, cfg.text)}>
                {w.severity}
              </span>
            </div>
            <div className="text-xs text-gray-700">
              <strong className="font-mono">{METRIC_LABELS[w.metric]}</strong>{' '}
              <span className="font-mono">{w.operator}</span>{' '}
              <strong className="font-mono">{w.threshold}</strong>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Période : {PERIOD_LABELS[w.period]}
              {w.last_value !== null && <> · Valeur actuelle : <strong>{Number(w.last_value).toFixed(2)}</strong></>}
            </div>
            {w.notes && <p className="text-[11px] text-gray-400 mt-1 italic line-clamp-2">{w.notes}</p>}
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => onToggle(w.id, !w.enabled)}
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-bold',
                  w.enabled ? 'text-emerald-700' : 'text-gray-400'
                )}
              >
                {w.enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                {w.enabled ? 'Actif' : 'Inactif'}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => onEdit(w)} title="Éditer" className="p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(w.id)} title="Supprimer" className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal CRUD ───────────────────────────────────────────────────────────

function WatcherEditorModal({
  initial, onClose, onSaved,
}: {
  initial: AlertWatcher | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    metric: (initial?.metric ?? 'revpar') as AlertMetric,
    operator: (initial?.operator ?? '<') as AlertOperator,
    threshold: initial?.threshold?.toString() ?? '50',
    period: (initial?.period ?? 'today') as AlertPeriod,
    severity: (initial?.severity ?? 'warning') as AlertSeverity,
    notes: initial?.notes ?? '',
    enabled: initial?.enabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.name.trim()) { setError('Le nom est obligatoire'); return; }
    const threshold = Number(form.threshold);
    if (!Number.isFinite(threshold)) { setError('Seuil invalide'); return; }
    setError(null);
    setSaving(true);
    try {
      if (initial) {
        await updateWatcher(initial.id, {
          name: form.name.trim(),
          metric: form.metric,
          operator: form.operator,
          threshold,
          period: form.period,
          severity: form.severity,
          notes: form.notes || null,
          enabled: form.enabled,
        });
      } else {
        await createWatcher({
          name: form.name.trim(),
          metric: form.metric,
          operator: form.operator,
          threshold,
          period: form.period,
          severity: form.severity,
          enabled: form.enabled,
          notes: form.notes || undefined,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">{initial ? 'Modifier le watcher' : 'Nouveau watcher'}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Définissez un seuil KPI à surveiller</p>
        </div>
        <div className="p-6 space-y-3">
          <Field label="Nom du watcher">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: RevPAR critique < 60€"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Métrique">
              <select
                value={form.metric}
                onChange={e => setForm({ ...form, metric: e.target.value as AlertMetric })}
                className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
              >
                {Object.entries(METRIC_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Opérateur">
              <select
                value={form.operator}
                onChange={e => setForm({ ...form, operator: e.target.value as AlertOperator })}
                className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
              >
                <option value="<">{'<'} (inférieur)</option>
                <option value="<=">{'≤'} (inf. ou égal)</option>
                <option value=">">{'>'} (supérieur)</option>
                <option value=">=">{'≥'} (sup. ou égal)</option>
                <option value="=">{'='} (égal)</option>
              </select>
            </Field>
            <Field label="Seuil">
              <input
                type="number"
                step="0.01"
                value={form.threshold}
                onChange={e => setForm({ ...form, threshold: e.target.value })}
                className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Période">
              <select
                value={form.period}
                onChange={e => setForm({ ...form, period: e.target.value as AlertPeriod })}
                className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
              >
                {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Sévérité">
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value as AlertSeverity })}
                className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none"
              >
                <option value="info">Info</option>
                <option value="warning">Attention</option>
                <option value="critical">Critique</option>
              </select>
            </Field>
          </div>

          <Field label="Notes (optionnel)">
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Contexte, plan d'action…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 accent-violet-600"
            />
            Watcher actif
          </label>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-white">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {initial ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">{label}</span>
      {children}
    </label>
  );
}
