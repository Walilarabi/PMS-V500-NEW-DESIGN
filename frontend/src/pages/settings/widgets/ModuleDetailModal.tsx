/**
 * FLOWTYM — Modal "Détails module" — Control Center.
 *
 * Drawer central qui détaille le statut d'un module : problèmes
 * détectés, action recommandée, lien vers la page principale du module.
 */
import React from 'react';
import { X, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ModuleStatus, ModuleStatusLevel } from '@/src/types/settings/diagnostic';
import { STATUS_LABEL } from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

const TONE: Record<ModuleStatusLevel, { ring: string; bg: string; text: string }> = {
  operational:           { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  attention:             { ring: 'ring-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  critical:              { ring: 'ring-rose-200',    bg: 'bg-rose-50',    text: 'text-rose-700' },
  disabled:              { ring: 'ring-slate-200',   bg: 'bg-slate-50',   text: 'text-slate-600' },
  pending_configuration: { ring: 'ring-sky-200',     bg: 'bg-sky-50',     text: 'text-sky-700' },
};

interface ModuleDetailModalProps {
  module: ModuleStatus | null;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
}

export const ModuleDetailModal: React.FC<ModuleDetailModalProps> = ({ module, onClose, onNavigate }) => {
  if (!module) return null;
  const t = TONE[module.status];

  function go(target: PageId) {
    logAudit({ action: 'module_inspected', module: module!.key, detail: `Navigation vers ${target}` });
    onNavigate(target);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[560px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Module PMS</div>
            <h2 className="text-[16px] font-semibold text-slate-900 mt-0.5">{module.name}</h2>
            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1 ring-inset text-[11px] font-semibold mt-2', t.bg, t.ring, t.text)}>
              {STATUS_LABEL[module.status]}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <section>
            <h3 className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Dernière vérification</h3>
            <div className="text-[13px] text-slate-700">
              {new Date(module.lastCheckedAt).toLocaleString('fr-FR')}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Problèmes détectés</h3>
            {module.issues.length === 0 ? (
              <div className="flex items-center gap-2 text-[13px] text-emerald-700 bg-emerald-50 ring-1 ring-emerald-100 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4" /> Aucun problème détecté
              </div>
            ) : (
              <ul className="space-y-1.5">
                {module.issues.map((i, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[12.5px] text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {module.recommendedAction && (
            <section>
              <h3 className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Action recommandée</h3>
              <button
                onClick={() => go(module.recommendedAction!.target)}
                className="w-full px-4 py-2.5 rounded-xl bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center justify-center gap-2 shadow-sm shadow-violet-600/20"
              >
                {module.recommendedAction.label} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </section>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
          <span className="text-[11.5px] text-slate-500">Cliquez pour ouvrir le module dans son contexte.</span>
          <button
            onClick={() => go(module.homePage)}
            className="px-3 py-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            Ouvrir {module.name} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
