import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Layers, Clock, RotateCcw, FlaskConical, Shield } from 'lucide-react';
import { buildRiskAnalysis, RISK_COLORS, type RiskScore } from '@/src/services/support/risk';
import { cn } from '@/src/lib/utils';
import type { TicketPriority } from '@/src/services/support/support.service';

interface Props {
  module:   string;
  feature:  string;
  priority: TicketPriority;
}

const TEST_CHECKLIST = [
  'Module impacté testé',
  'Composants liés vérifiés',
  'Permissions vérifiées',
  'Responsive testé (mobile/tablette)',
  'Console sans erreur',
  'Données réelles (pas de mock)',
  'Flux utilisateur complet',
  'Performance vérifiée',
  'Absence de régression confirmée',
];

export const DiagnosticPanel: React.FC<Props> = ({ module, feature, priority }) => {
  const [open, setOpen]         = useState(true);
  const [tests, setTests]       = useState<Record<number, boolean>>({});

  if (!module || !priority) return null;

  const analysis = buildRiskAnalysis(module, feature, priority);
  const colors   = RISK_COLORS[analysis.score];
  const doneTests = Object.values(tests).filter(Boolean).length;

  return (
    <div className={cn('rounded-2xl border overflow-hidden', colors.border)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3', colors.bg)}
      >
        <div className="flex items-center gap-2.5">
          <Shield size={15} className={colors.text} />
          <span className={cn('text-[13px] font-bold', colors.text)}>Analyse de risque</span>
          <RiskBadge score={analysis.score} />
        </div>
        {open ? <ChevronUp size={15} className={colors.text} /> : <ChevronDown size={15} className={colors.text} />}
      </button>

      {open && (
        <div className="bg-white p-4 space-y-4">
          {/* Risk row */}
          <div className="grid grid-cols-3 gap-3">
            <MetaItem
              icon={Clock}
              label="Temps estimé"
              value={analysis.estimatedTime}
            />
            <MetaItem
              icon={RotateCcw}
              label="Rollback possible"
              value={analysis.rollbackPossible ? 'Oui' : 'Non — critique'}
              danger={!analysis.rollbackPossible}
            />
            <MetaItem
              icon={FlaskConical}
              label="Tests requis"
              value={analysis.testsRequired ? 'Obligatoires' : 'Recommandés'}
              warn={analysis.testsRequired}
            />
          </div>

          {/* Affected modules */}
          {analysis.affectedModules.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Layers size={13} className="text-gray-400" />
                <span className="text-[12px] font-bold text-gray-600">Modules potentiellement impactés</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.affectedModules.map(m => (
                  <span key={m} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-lg">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Flags */}
          {(analysis.impactsRevenue || analysis.impactsFinance || analysis.impactsOTA || analysis.sharedComponent) && (
            <div className="flex flex-wrap gap-2">
              {analysis.sharedComponent  && <Flag label="Composant partagé" />}
              {analysis.impactsRevenue   && <Flag label="Impacte Revenue" />}
              {analysis.impactsFinance   && <Flag label="Impacte Finance" danger />}
              {analysis.impactsOTA       && <Flag label="Impacte OTA" danger />}
            </div>
          )}

          {/* Strategy */}
          <div className={cn('rounded-xl p-3 border', colors.border, colors.bg)}>
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className={cn(colors.text, 'mt-0.5 flex-shrink-0')} />
              <div>
                <p className={cn('text-[12px] font-bold mb-0.5', colors.text)}>Stratégie recommandée</p>
                <p className={cn('text-[12px] leading-relaxed', colors.text)}>{analysis.strategy}</p>
              </div>
            </div>
          </div>

          {/* Test checklist */}
          {analysis.testsRequired && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold text-gray-600">Checklist de validation ({doneTests}/{TEST_CHECKLIST.length})</span>
                <span className={cn('text-[11px] font-bold', doneTests === TEST_CHECKLIST.length ? 'text-green-600' : 'text-gray-400')}>
                  {doneTests === TEST_CHECKLIST.length ? 'Complète' : 'En cours'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {TEST_CHECKLIST.map((item, i) => (
                  <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!tests[i]}
                      onChange={() => setTests(prev => ({ ...prev, [i]: !prev[i] }))}
                      className="h-3.5 w-3.5 rounded border-gray-300 accent-[#8B5CF6]"
                    />
                    <span className={cn(
                      'text-[12px] transition-colors',
                      tests[i] ? 'line-through text-gray-300' : 'text-gray-600 group-hover:text-gray-900',
                    )}>
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const RiskBadge: React.FC<{ score: RiskScore }> = ({ score }) => {
  const c = RISK_COLORS[score];
  return (
    <span className={cn('px-2 py-0.5 rounded-lg text-[11px] font-bold border', c.bg, c.text, c.border)}>
      {c.label}
    </span>
  );
};

const MetaItem: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  danger?: boolean;
  warn?: boolean;
}> = ({ icon: Icon, label, value, danger, warn }) => (
  <div className="bg-gray-50 rounded-xl p-3">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={12} className="text-gray-400" />
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{label}</span>
    </div>
    <span className={cn(
      'text-[12px] font-bold',
      danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-gray-700',
    )}>
      {value}
    </span>
  </div>
);

const Flag: React.FC<{ label: string; danger?: boolean }> = ({ label, danger }) => (
  <span className={cn(
    'text-[11px] font-bold px-2.5 py-1 rounded-lg border',
    danger
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-amber-50 text-amber-700 border-amber-200',
  )}>
    ⚠ {label}
  </span>
);
