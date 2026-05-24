/**
 * FLOWTYM — Panneau "Alertes & actions recommandées" du Control Center.
 *
 * Liste les alertes ouvertes triées par sévérité.
 * Chaque alerte propose un bouton d'action (Corriger / Ouvrir /
 * Configurer / Renouveler / Voir) qui navigue vers la page concernée.
 * Bouton "Marquer comme résolue" trace l'action dans l'audit.
 */
import React from 'react';
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { AlertSeverity, ConfigAlert } from '@/src/types/settings/diagnostic';
import { MODULE_LABEL, SEVERITY_LABEL } from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { fingerprintAlert, markResolved } from '@/src/services/settings/settingsHistory';

const TONE: Record<AlertSeverity, { ring: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  critical: { ring: 'ring-rose-200',    bg: 'bg-rose-50',    text: 'text-rose-700',    icon: AlertOctagon },
  high:     { ring: 'ring-orange-200',  bg: 'bg-orange-50',  text: 'text-orange-700',  icon: ShieldAlert },
  medium:   { ring: 'ring-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-700',   icon: AlertTriangle },
  low:      { ring: 'ring-sky-200',     bg: 'bg-sky-50',     text: 'text-sky-700',     icon: Info },
  info:     { ring: 'ring-slate-200',   bg: 'bg-slate-50',   text: 'text-slate-700',   icon: Info },
};

interface RecommendedActionsPanelProps {
  alerts: ConfigAlert[];
  onNavigate: (page: PageId) => void;
}

export const RecommendedActionsPanel: React.FC<RecommendedActionsPanelProps> = ({ alerts, onNavigate }) => {
  // Plus de filtre local : la résolution est persistée dans settingsHistory,
  // donc l'alerte ne reviendra plus au prochain runDiagnostic. Le panneau
  // se contente d'afficher ce que le moteur lui passe.
  const visible = alerts;

  function handleAction(a: ConfigAlert) {
    logAudit({ action: 'alert_dismissed', module: a.module, detail: `Navigation vers ${a.action.target} depuis "${a.title}"` });
    onNavigate(a.action.target);
  }

  function handleResolve(a: ConfigAlert) {
    logAudit({ action: 'alert_resolved', module: a.module, detail: a.title });
    markResolved(a.id, 'resolved', fingerprintAlert(a.title, a.description));
    // Le prochain runDiagnostic (déclenché par l'effet du hook quand
    // n'importe quel store mute) la fera disparaître. Pour un retour
    // visuel immédiat, on déclenche un événement personnalisé que
    // l'orchestrateur Control Center peut écouter (optionnel).
    window.dispatchEvent(new CustomEvent('settings:rerun-diagnostic'));
  }

  return (
    <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
      <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900">Alertes & actions recommandées</h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            {visible.length} alerte{visible.length > 1 ? 's' : ''} ouverte{visible.length > 1 ? 's' : ''} · résolutions persistées
          </p>
        </div>
      </header>

      {visible.length === 0 ? (
        <div className="px-5 py-10 text-center text-slate-500">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
          <div className="text-[13px] font-medium text-slate-700">Aucune alerte ouverte</div>
          <div className="text-[12px] text-slate-400">Votre PMS est parfaitement configuré.</div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
          {visible.map((a) => {
            const t = TONE[a.severity];
            const Icon = t.icon;
            return (
              <li key={a.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50/60 transition-colors">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-inset shrink-0', t.bg, t.ring, t.text)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider', t.bg, t.text)}>
                      {SEVERITY_LABEL[a.severity]}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {MODULE_LABEL[a.module]}
                    </span>
                  </div>
                  <div className="text-[13px] font-medium text-slate-900 mt-1">{a.title}</div>
                  <div className="text-[12px] text-slate-600 mt-0.5">{a.description}</div>
                  {a.businessImpact && (
                    <div className="text-[11.5px] text-slate-500 mt-1 italic">
                      Impact : {a.businessImpact}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleAction(a)}
                    className="px-2.5 py-1 rounded-lg text-[12px] font-medium bg-violet-600 text-white hover:bg-violet-700 inline-flex items-center gap-1 shadow-sm shadow-violet-600/20"
                  >
                    {a.action.label} <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleResolve(a)}
                    className="px-2 py-1 rounded-lg text-[11.5px] font-medium text-slate-500 hover:bg-slate-100"
                    title="Marquer comme résolue"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
