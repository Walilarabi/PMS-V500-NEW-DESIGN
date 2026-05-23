/**
 * FLOWTYM RMS — Bandeau de traçabilité Veille Concurrentielle
 *
 * Indique en permanence à l'utilisateur :
 *   - quelle source de données est utilisée
 *   - quelle période est affichée
 *   - quand les imports ont été faits
 *   - combien de concurrents et de jours ont été retenus / exclus
 *   - les raisons principales d'exclusion
 *
 * Lit `CompetitiveWatchData.trace` et n'a aucune logique métier.
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Database,
  FileSpreadsheet,
  Sparkles,
  CalendarDays,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useCompetitiveWatchData } from '../../../lib/rms/useCompetitiveWatchData';
import { SOURCE_LABEL, type CompetitiveSource } from '../../../store/competitiveWatchPrefsStore';

const SOURCE_ICON: Record<CompetitiveSource, React.ComponentType<{ className?: string }>> = {
  lighthouse: Database,
  expedia: FileSpreadsheet,
  mix: Sparkles,
};

function formatRelative(iso: string | null): string {
  if (!iso) return 'Aucun import';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DataSourceTraceBar: React.FC = () => {
  const data = useCompetitiveWatchData();
  const SourceIcon = SOURCE_ICON[data.trace.source];

  const isLive = data.isLive;
  const tone = isLive ? 'emerald' : 'slate';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-2xl border p-3 shadow-sm',
        tone === 'emerald'
          ? 'border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30'
          : 'border-slate-200 bg-slate-50/60'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            tone === 'emerald'
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-slate-200 text-slate-600'
          )}
        >
          <SourceIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-sm font-semibold',
                tone === 'emerald' ? 'text-emerald-900' : 'text-slate-700'
              )}
            >
              {isLive
                ? `Source · ${SOURCE_LABEL[data.trace.source]}`
                : 'Données de démonstration'}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                tone === 'emerald'
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : 'bg-slate-200 text-slate-600'
              )}
            >
              <CalendarDays className="inline h-3 w-3 mr-1" />
              {data.trace.periodLabel}
            </span>
            <span className="text-[11px] text-slate-500">
              {data.window.start} → {data.window.end}
            </span>
          </div>

          <div className="mt-1 grid gap-1 text-[11.5px] text-slate-600 md:grid-cols-2 xl:grid-cols-4">
            <TraceItem
              icon={Database}
              label="Lighthouse"
              value={formatRelative(data.trace.lighthouseImportedAt)}
            />
            <TraceItem
              icon={FileSpreadsheet}
              label="Expedia"
              value={formatRelative(data.trace.expediaImportedAt)}
            />
            <TraceItem
              icon={Users}
              label="Concurrents"
              value={
                isLive
                  ? `${data.trace.keptCompetitors} retenus / ${data.trace.totalCompetitors} détectés`
                  : '—'
              }
            />
            <TraceItem
              icon={CheckCircle2}
              label="Jours"
              value={
                isLive
                  ? `${data.trace.keptDays} affichés · ${data.trace.excludedDays} exclus`
                  : '—'
              }
            />
          </div>

          {/* Raisons d'exclusion */}
          {isLive && data.trace.exclusionSummary.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                Exclusions
              </span>
              {data.trace.exclusionSummary.slice(0, 5).map((e) => (
                <span
                  key={e.reason}
                  className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
                >
                  {e.label} <strong className="tabular-nums">×{e.count}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Top concurrents (mode Mix uniquement) */}
          {isLive && data.trace.source === 'mix' && data.trace.competitorScores.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                <Sparkles className="h-3 w-3 text-violet-500" />
                Top concurrents scorés
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.trace.competitorScores.slice(0, 10).map((c, i) => (
                  <span
                    key={c.name + i}
                    title={`Proximité ${c.components.priceProximity} · Positionnement ${c.components.positioning} · Fréquence ${c.components.frequency} · Stabilité ${c.components.stability} · Tendance ${c.components.marketTrend}`}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                      i < data.trace.keptCompetitors
                        ? 'bg-violet-50 text-violet-700 ring-violet-200'
                        : 'bg-slate-50 text-slate-500 ring-slate-200 line-through'
                    )}
                  >
                    <span>{c.name}</span>
                    <span className="rounded bg-white/70 px-1 text-[10px] font-bold tabular-nums">
                      {c.score}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {!isLive && (
            <p className="mt-1.5 text-[11.5px] text-slate-500 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
              Importez un fichier Lighthouse ou Expedia depuis le bouton « Importer »
              pour que cette vue se mette à jour sur vos données réelles.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const TraceItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <span className="inline-flex items-center gap-1.5">
    <Icon className="h-3 w-3 text-slate-400" />
    <span className="text-slate-400 font-medium">{label} :</span>
    <span className="font-semibold text-slate-700 truncate">{value}</span>
  </span>
);
