/**
 * FLOWTYM — Modal "Personnaliser le tableau" — Control Center.
 *
 * Permet d'afficher/masquer/réordonner les widgets du cockpit.
 * Les préférences sont sauvegardées dans localStorage et tracées
 * dans l'audit.
 */
import React, { useState, useEffect } from 'react';
import { X, GripVertical, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

export type WidgetId = 'kpis' | 'modules' | 'alerts' | 'checklist' | 'guided' | 'logs';

export interface WidgetPref {
  id: WidgetId;
  label: string;
  description: string;
  visible: boolean;
  order: number;
}

const STORAGE_KEY = 'flowtym.controlcenter.layout';

const DEFAULT_LAYOUT: WidgetPref[] = [
  { id: 'kpis',      label: 'Cartes KPI',                description: '5 KPIs de santé du PMS',                       visible: true, order: 0 },
  { id: 'modules',   label: 'État des modules',           description: 'Tableau de statut des 8 modules clés',         visible: true, order: 1 },
  { id: 'alerts',    label: 'Alertes & recommandations',  description: 'Actions actionnables triées par sévérité',     visible: true, order: 2 },
  { id: 'checklist', label: 'Checklist de configuration', description: 'Progression par domaine',                      visible: true, order: 3 },
  { id: 'guided',    label: 'Configuration guidée',       description: 'Parcours d\'installation en 8 étapes',        visible: true, order: 4 },
  { id: 'logs',      label: 'Journaux système',           description: 'Flux temps réel des derniers événements',      visible: true, order: 5 },
];

export function loadLayout(): WidgetPref[] {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const stored = JSON.parse(raw) as WidgetPref[];
    // merge avec DEFAULT pour gérer les nouveaux widgets ajoutés plus tard
    return DEFAULT_LAYOUT.map((d) => {
      const found = stored.find((s) => s.id === d.id);
      return found ? { ...d, visible: found.visible, order: found.order } : d;
    }).sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(prefs: WidgetPref[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

interface DashboardCustomizerModalProps {
  open: boolean;
  onClose: () => void;
  onChange: (prefs: WidgetPref[]) => void;
}

export const DashboardCustomizerModal: React.FC<DashboardCustomizerModalProps> = ({ open, onClose, onChange }) => {
  const [prefs, setPrefs] = useState<WidgetPref[]>(() => loadLayout());

  useEffect(() => {
    if (open) setPrefs(loadLayout());
  }, [open]);

  if (!open) return null;

  function toggle(id: WidgetId) {
    setPrefs((p) => p.map((x) => (x.id === id ? { ...x, visible: !x.visible } : x)));
  }
  function move(id: WidgetId, dir: -1 | 1) {
    setPrefs((p) => {
      const arr = [...p];
      const idx = arr.findIndex((x) => x.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= arr.length) return p;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr.map((x, i) => ({ ...x, order: i }));
    });
  }
  function reset() {
    setPrefs(DEFAULT_LAYOUT);
  }
  function apply() {
    saveLayout(prefs);
    onChange(prefs);
    logAudit({
      action: 'dashboard_customized',
      detail: `Widgets visibles : ${prefs.filter((p) => p.visible).map((p) => p.label).join(', ')}`,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[520px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Personnaliser le tableau</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Affichez, masquez ou réordonnez les widgets du Control Center.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
          {prefs.map((p, i) => (
            <li key={p.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(p.id, -1)}
                  disabled={i === 0}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  aria-label="Monter"
                >▲</button>
                <button
                  onClick={() => move(p.id, 1)}
                  disabled={i === prefs.length - 1}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  aria-label="Descendre"
                >▼</button>
              </div>
              <GripVertical className="w-4 h-4 text-slate-300" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-slate-900">{p.label}</div>
                <div className="text-[11.5px] text-slate-500">{p.description}</div>
              </div>
              <button
                onClick={() => toggle(p.id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11.5px] font-medium inline-flex items-center gap-1',
                  p.visible ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-100' : 'bg-slate-100 text-slate-500',
                )}
              >
                {p.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {p.visible ? 'Visible' : 'Masqué'}
              </button>
            </li>
          ))}
        </ul>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
          <button
            onClick={reset}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100">
              Annuler
            </button>
            <button
              onClick={apply}
              className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-[12px] font-medium hover:bg-violet-700"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
