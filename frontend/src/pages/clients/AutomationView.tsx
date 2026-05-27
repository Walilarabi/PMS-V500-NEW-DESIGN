/**
 * FLOWTYM — CRM Automation View (Wave C7)
 *
 * Moteur d'automatisations : règles déclencheur → action évaluées
 * sur la base clients. Création, exécution, journal d'exécution.
 */

import React, { useState } from 'react';
import {
  Zap, Plus, Play, Pencil, Trash2, Loader2, ArrowRight,
  ChevronDown, ChevronUp, CheckCircle2, Clock, Bell, Tag,
  Mail, MessageSquare, UserPlus, Award, Cake, Moon, Frown,
  ShieldAlert, Sparkles, Activity,
} from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import {
  useAutomations, useToggleAutomation, useDeleteAutomation,
  useRunAutomation, useAutomationRuns,
} from '@/src/services/crm/hooks';
import { triggerMeta, actionMeta, type Automation } from '@/src/services/crm/automation.service';
import { AutomationFormModal } from './AutomationFormModal';

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(' ');

const TRIGGER_ICONS: Record<string, React.ElementType> = {
  new_guest: UserPlus, loyalty_tier: Award, birthday: Cake, dormant: Moon,
  low_satisfaction: Frown, high_risk: ShieldAlert, vip: Sparkles,
};
const ACTION_ICONS: Record<string, React.ElementType> = {
  email: Mail, sms: MessageSquare, tag: Tag, notify: Bell,
};

const fmtDate = (iso: string | null) => {
  if (!iso) return 'Jamais';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

// ─── Component ───────────────────────────────────────────────────────────────

export const AutomationView = () => {
  const { data: automations = [], isLoading } = useAutomations();
  const [modal, setModal] = useState<Automation | null | 'new'>(null);

  const total      = automations.length;
  const active     = automations.filter((a) => a.enabled).length;
  const executions = automations.reduce((s, a) => s + a.run_count, 0);

  const kpis = [
    { label: 'Automatisations', value: total,      icon: Zap,      color: '#8B5CF6' },
    { label: 'Actives',         value: active,     icon: Activity, color: '#10B981' },
    { label: 'Exécutions',      value: executions, icon: Play,     color: '#3B82F6' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <div className="space-y-5">

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-4">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${k.color}18` }}>
                <k.icon size={18} style={{ color: k.color }} />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{k.value}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">
                  {k.label}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Déclenchez des actions automatiques selon le comportement des clients.
          </p>
          <Button size="sm" onClick={() => setModal('new')}>
            <Plus size={13} /> Nouvelle automatisation
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center text-sm text-gray-400 py-12">Chargement…</div>
        ) : automations.length === 0 ? (
          <Card className="p-12 text-center">
            <Zap size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-bold text-gray-500">Aucune automatisation</p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
              Créez votre première règle pour automatiser les relances, les
              messages d'anniversaire ou le suivi des clients à risque.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setModal('new')}>
              <Plus size={13} /> Créer une automatisation
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {automations.map((a) => (
              <AutomationCard key={a.id} automation={a} onEdit={() => setModal(a)} />
            ))}
          </div>
        )}
      </div>

      {modal !== null && (
        <AutomationFormModal
          automation={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

// ─── Automation card ──────────────────────────────────────────────────────────

const AutomationCard: React.FC<{ automation: Automation; onEdit: () => void }> = ({
  automation: a,
  onEdit,
}) => {
  const [expanded, setExpanded] = useState(false);

  const toggle  = useToggleAutomation();
  const del     = useDeleteAutomation();
  const run     = useRunAutomation();
  const runsQ   = useAutomationRuns(expanded ? a.id : null);

  const tMeta = triggerMeta(a.trigger_type);
  const aMeta = actionMeta(a.action_type);
  const TIcon = TRIGGER_ICONS[a.trigger_type] ?? Zap;
  const AIcon = ACTION_ICONS[a.action_type] ?? Bell;

  const handleDelete = () => {
    if (window.confirm(`Supprimer l'automatisation "${a.name}" ?`)) {
      del.mutate(a.id);
    }
  };

  return (
    <Card className={cn('overflow-hidden', !a.enabled && 'opacity-70')}>
      <div className="p-4">
        {/* Head */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
              <Zap size={16} className="text-[#8B5CF6]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900">{a.name}</div>
              {a.description && (
                <div className="text-xs text-gray-400 truncate">{a.description}</div>
              )}
            </div>
          </div>

          {/* Enabled switch */}
          <button
            type="button"
            onClick={() => toggle.mutate({ id: a.id, enabled: !a.enabled })}
            className={cn(
              'relative w-10 rounded-full transition-colors shrink-0',
              a.enabled ? 'bg-[#8B5CF6]' : 'bg-gray-200',
            )}
            style={{ height: 22 }}
            aria-label="Activer/désactiver"
          >
            <span
              className="absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-all"
              style={{ left: a.enabled ? 20 : 2 }}
            />
          </button>
        </div>

        {/* Trigger → action flow */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#8B5CF6]/10 text-[#8B5CF6] px-2.5 py-1 rounded-lg">
            <TIcon size={13} /> {tMeta?.label ?? a.trigger_type}
          </span>
          <ArrowRight size={13} className="text-gray-300" />
          <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">
            <AIcon size={13} /> {aMeta?.label ?? a.action_type}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Play size={11} /> {a.run_count} exécution{a.run_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 size={11} /> {a.last_matched} traité{a.last_matched !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} /> {fmtDate(a.last_run_at)}
          </span>
        </div>

        {/* Run result banner */}
        {run.isSuccess && run.variables === a.id && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            <span className="text-xs font-medium text-emerald-700">
              {run.data.matched === 0
                ? 'Aucun nouveau client à traiter.'
                : `${run.data.matched} client${run.data.matched > 1 ? 's' : ''} traité${run.data.matched > 1 ? 's' : ''} — ${run.data.applied} appliqué${run.data.applied > 1 ? 's' : ''}, ${run.data.queued} en file.`}
            </span>
          </div>
        )}
        {run.isError && run.variables === a.id && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-600">
            Échec de l'exécution.
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <Button
            size="sm"
            onClick={() => run.mutate(a.id)}
            disabled={run.isPending && run.variables === a.id}
          >
            {run.isPending && run.variables === a.id
              ? <Loader2 size={12} className="animate-spin" />
              : <Play size={12} />}
            Exécuter
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil size={12} /> Modifier
          </Button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Supprimer"
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Journal
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Run log */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {runsQ.isLoading ? (
              <p className="text-[11px] text-gray-400 text-center py-3">Chargement…</p>
            ) : (runsQ.data ?? []).length === 0 ? (
              <p className="text-[11px] text-gray-300 text-center py-3">
                Aucune exécution enregistrée.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {(runsQ.data ?? []).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 text-[11px] py-1"
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        r.status === 'applied' ? 'bg-emerald-500'
                          : r.status === 'queued' ? 'bg-amber-500'
                          : 'bg-gray-300',
                      )}
                    />
                    <span className="font-medium text-gray-700 truncate flex-1">
                      {r.guest_name}
                    </span>
                    <span className={cn(
                      'font-bold',
                      r.status === 'applied' ? 'text-emerald-600'
                        : r.status === 'queued' ? 'text-amber-600'
                        : 'text-gray-400',
                    )}>
                      {r.status === 'applied' ? 'Appliqué'
                        : r.status === 'queued' ? 'En file' : r.status}
                    </span>
                    <span className="text-gray-300 w-24 text-right shrink-0">
                      {fmtDate(r.ran_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default AutomationView;
