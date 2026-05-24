/**
 * FLOWTYM — Widget "Quick Wins" du Control Center.
 *
 * Sélectionne les 3 actions à plus fort impact sur la santé système
 * et les présente comme des CTA prioritaires. Calcul d'impact basé
 * sur :
 *   • la sévérité de l'alerte (critical/high/medium = poids élevé)
 *   • le score qu'elle déprime (drivers ok=false)
 *   • la facilité d'exécution (heuristique : configuration > sécurité)
 *
 * Les actions ne sont pas redondantes avec le panneau "Alertes &
 * actions recommandées" : ce widget condense les priorités en haut
 * du cockpit pour l'attention du RM (5 secondes pour comprendre quoi
 * faire en premier).
 */
import React from 'react';
import { Zap, ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ConfigAlert, DiagnosticReport } from '@/src/types/settings/diagnostic';
import { MODULE_LABEL } from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

interface QuickWin {
  alert: ConfigAlert;
  /** Score d'opportunité 0-100 (plus c'est haut, plus c'est prioritaire). */
  opportunity: number;
  /** Estimation du gain en points de santé système si corrigé. */
  scoreLift: number;
}

const SEVERITY_WEIGHT: Record<ConfigAlert['severity'], number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 20,
  info: 5,
};

// Heuristique : actions de configuration rapides ont un poids "facilité" élevé,
// les actions sécurité demandant validation humaine ont un poids moindre.
const EFFORT_INVERSE: Record<ConfigAlert['module'], number> = {
  inventory_planning: 1.0,
  finance_billing: 0.95,
  rms_revenue: 0.9,
  channel_manager: 0.85,
  pms_reservations: 0.85,
  automation_ai: 0.8,
  housekeeping: 0.75,
  security_backups: 0.7,
  integrations: 0.65,
};

function computeQuickWins(report: DiagnosticReport): QuickWin[] {
  return report.alerts
    .map<QuickWin>((a) => {
      const opportunity = Math.round(SEVERITY_WEIGHT[a.severity] * (EFFORT_INVERSE[a.module] ?? 0.8));
      const scoreLift = Math.round(SEVERITY_WEIGHT[a.severity] / 12);
      return { alert: a, opportunity, scoreLift };
    })
    .sort((a, b) => b.opportunity - a.opportunity)
    .slice(0, 3);
}

interface QuickWinsPanelProps {
  report: DiagnosticReport;
  onNavigate: (page: PageId) => void;
}

export const QuickWinsPanel: React.FC<QuickWinsPanelProps> = ({ report, onNavigate }) => {
  const wins = computeQuickWins(report);

  if (wins.length === 0) {
    return null;
  }

  function go(w: QuickWin) {
    logAudit({
      action: 'alert_dismissed',
      module: w.alert.module,
      detail: `Quick Win activé : ${w.alert.title}`,
    });
    onNavigate(w.alert.action.target);
  }

  return (
    <section className="rounded-2xl ring-1 ring-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 shadow-sm overflow-hidden">
      <header className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white flex items-center justify-center shadow-sm shadow-violet-500/30">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-[13.5px] font-semibold text-slate-900">Quick Wins · 3 actions à plus fort impact</h3>
            <p className="text-[11px] text-slate-500">Recommandations priorisées par effort × impact</p>
          </div>
        </div>
      </header>

      <div className="grid gap-2 px-3 pb-3 md:grid-cols-3">
        {wins.map((w) => (
          <button
            key={w.alert.id}
            onClick={() => go(w)}
            className="text-left rounded-xl bg-white ring-1 ring-slate-100 hover:ring-violet-300 hover:shadow-md p-4 transition-all group"
          >
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold">
              {MODULE_LABEL[w.alert.module]}
            </div>
            <div className="text-[13.5px] font-semibold text-slate-900 mt-1.5 leading-tight line-clamp-2">
              {w.alert.title}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <ImpactBar opportunity={w.opportunity} />
              <div className="flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600">
                <TrendingUp className="w-3 h-3" /> +{w.scoreLift} pts
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11.5px] text-slate-500 italic">Effort estimé : court</span>
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-700 group-hover:text-violet-800">
                {w.alert.action.label} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

const ImpactBar: React.FC<{ opportunity: number }> = ({ opportunity }) => {
  const dots = 5;
  const filled = Math.max(1, Math.round((opportunity / 100) * dots));
  return (
    <div className="flex items-center gap-0.5" title={`Opportunité ${opportunity}/100`}>
      {Array.from({ length: dots }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'w-1 h-3 rounded-sm',
            i < filled ? 'bg-violet-500' : 'bg-slate-200',
          )}
        />
      ))}
    </div>
  );
};
