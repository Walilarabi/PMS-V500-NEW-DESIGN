/**
 * FLOWTYM RMS — Modale d'import événements (wizard 4 étapes).
 *
 * Étape 1 — Upload      : drop zone Excel / CSV, sélection de la source
 * Étape 2 — Analyse     : parse + analyse automatique (doublons, conflits…)
 * Étape 3 — Validation  : table de prévisualisation avec statuts IA + actions
 * Étape 4 — Résumé      : rapport d'intégration + pont RMS
 */
import React, { useRef, useState, useMemo } from 'react';
import {
  X, Upload, FileSpreadsheet, Database, Sparkles, CheckCircle2, AlertCircle,
  ChevronRight, Search, Check, Minus, RotateCcw, AlertTriangle, Info,
  Zap, TrendingUp, Calendar, MapPin, Activity,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { parseEventExcel } from '@/src/services/event-excel-parser.service';
import {
  analyzeImport,
  type ImportAnalysisReport,
  type AnalyzedEvent,
  type ImportStatus,
} from '@/src/services/event-import-analyzer.service';
import { integrateEventsToRMS } from '@/src/services/event-rms-integration.service';
import { useEventsStore } from '@/src/store/eventsStore';
import { CATEGORY_LABELS, IMPACT_LABELS } from '@/src/types/events';
import type { EventCategory } from '@/src/types/events';

type WizardStep = 'upload' | 'analyzing' | 'review' | 'done';
type ImportSource = 'excel' | 'csv' | 'lighthouse' | 'api';

interface EventImportModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Statut chips ─────────────────────────────────────────────────────────────

const STATUS_META: Record<
  ImportStatus,
  { label: string; color: string; bg: string; ring: string; icon: React.ComponentType<{ className?: string }> }
> = {
  valid:      { label: 'Valide',      color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', icon: CheckCircle2 },
  update:     { label: 'Mise à jour', color: 'text-sky-700',     bg: 'bg-sky-50',     ring: 'ring-sky-200',     icon: RotateCcw },
  duplicate:  { label: 'Doublon',     color: 'text-amber-700',   bg: 'bg-amber-50',   ring: 'ring-amber-200',   icon: AlertTriangle },
  incomplete: { label: 'Incomplet',   color: 'text-orange-700',  bg: 'bg-orange-50',  ring: 'ring-orange-200',  icon: AlertCircle },
  conflict:   { label: 'Conflit',     color: 'text-rose-700',    bg: 'bg-rose-50',    ring: 'ring-rose-200',    icon: AlertTriangle },
  invalid:    { label: 'Invalide',    color: 'text-slate-500',   bg: 'bg-slate-100',  ring: 'ring-slate-200',   icon: X },
};

function StatusChip({ status }: { status: ImportStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[10.5px] font-semibold', m.color, m.bg, m.ring)}>
      <Icon className="w-2.5 h-2.5" />
      {m.label}
    </span>
  );
}

function ConfidenceDot({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
      <span className={cn('w-2 h-2 rounded-full', color)} />
      {score}%
    </span>
  );
}

// ─── Step 1 : Upload ──────────────────────────────────────────────────────────

const SOURCES: { id: ImportSource; label: string; desc: string }[] = [
  { id: 'excel',      label: 'Excel',      desc: 'Dates Salons multi-feuilles (.xlsx / .xls)' },
  { id: 'csv',        label: 'CSV',        desc: 'Format ; ou , — colonne Nom, Début, Fin' },
  { id: 'lighthouse', label: 'Lighthouse', desc: 'Export Lighthouse — feuille Événements' },
  { id: 'api',        label: 'API',        desc: 'JSON / iCal — configurez depuis Connecteurs' },
];

function StepUpload({
  onFile,
}: {
  onFile: (file: File, source: ImportSource) => void;
}) {
  const [source, setSource] = useState<ImportSource>('excel');
  const fileRef = useRef<HTMLInputElement>(null);

  const accept = source === 'csv' ? '.csv' : '.xlsx,.xls';

  return (
    <div className="space-y-5">
      {/* Source selector */}
      <div className="grid grid-cols-4 gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSource(s.id)}
            disabled={s.id === 'api'}
            className={cn(
              'text-left rounded-xl ring-1 px-3 py-3 transition-all text-[12.5px]',
              source === s.id
                ? 'ring-violet-300 bg-violet-50/60 shadow-sm'
                : 'ring-slate-200 bg-white hover:ring-slate-300',
              s.id === 'api' && 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center mb-2',
              source === s.id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500',
            )}>
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <div className="font-semibold text-slate-900">{s.label}</div>
            <div className="text-[10.5px] text-slate-500 leading-tight mt-0.5">{s.desc}</div>
          </button>
        ))}
      </div>

      {source === 'api' ? (
        <div className="rounded-xl ring-1 ring-slate-200 px-4 py-5 text-[12.5px] text-slate-600 bg-slate-50/40 flex items-start gap-2">
          <Database className="w-4 h-4 mt-0.5 text-slate-400" />
          Configurez votre connecteur depuis <strong>Paramètres → Connecteurs</strong>.
          Les événements seront synchronisés automatiquement selon la fréquence définie.
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="rounded-xl ring-1 ring-dashed ring-slate-300 hover:ring-violet-400 hover:bg-violet-50/20 transition-all px-5 py-10 text-center cursor-pointer"
        >
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f, source);
            }}
          />
          <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3 ring-1 ring-violet-100">
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-[13px] font-semibold text-slate-900">
            Cliquer pour sélectionner un fichier
          </div>
          <div className="text-[12px] text-slate-500 mt-1">
            {source === 'csv'
              ? 'Fichier .csv avec séparateur virgule ou point-virgule'
              : 'Fichier Excel (.xlsx / .xls) — feuilles 2024, 2025, 2026, 2027 supportées'}
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            ou glissez-déposez votre fichier ici
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-2 text-[11.5px] text-violet-700 bg-violet-50/60 ring-1 ring-violet-100 rounded-xl px-3 py-2.5">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Le moteur détecte automatiquement les colonnes (Nom, Début, Fin, Lieu, Catégorie, Impact…),
          compare avec vos événements existants et génère un rapport de confiance avant toute intégration.
        </span>
      </div>
    </div>
  );
}

// ─── Step 2 : Analyzing ───────────────────────────────────────────────────────

function StepAnalyzing({ fileName }: { fileName: string }) {
  const steps = [
    'Lecture du fichier Excel…',
    'Détection automatique des colonnes…',
    'Normalisation des dates et des lieux…',
    'Calcul des scores d\'impact…',
    'Comparaison avec les événements existants…',
    'Détection des doublons sémantiques…',
    'Identification des conflits de dates…',
    'Rapport d\'analyse prêt',
  ];
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    const timer = window.setInterval(() => setPhase((p) => Math.min(p + 1, steps.length - 1)), 180);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="py-6 space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7 text-violet-600 animate-pulse" />
        </div>
        <div className="text-[14px] font-semibold text-slate-900">Analyse en cours…</div>
        <div className="text-[12px] text-slate-500 mt-1 font-mono truncate max-w-xs mx-auto">{fileName}</div>
      </div>
      <div className="space-y-2 max-w-sm mx-auto">
        {steps.map((s, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2 text-[12px] transition-colors',
              i < phase ? 'text-emerald-600' : i === phase ? 'text-violet-700 font-medium' : 'text-slate-300',
            )}
          >
            {i < phase ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : i === phase ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0" />
            )}
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3 : Review table ────────────────────────────────────────────────────

const STATUS_FILTERS: { key: ImportStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'Tous' },
  { key: 'valid',     label: 'Valides' },
  { key: 'update',    label: 'Mises à jour' },
  { key: 'conflict',  label: 'Conflits' },
  { key: 'duplicate', label: 'Doublons' },
  { key: 'incomplete',label: 'Incomplets' },
  { key: 'invalid',   label: 'Invalides' },
];

function StepReview({
  report,
  items,
  onItemsChange,
}: {
  report: ImportAnalysisReport;
  items: AnalyzedEvent[];
  onItemsChange: (items: AnalyzedEvent[]) => void;
}) {
  const [filter, setFilter] = useState<ImportStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const selectedCount = useMemo(() => items.filter((i) => i.selected).length, [items]);

  const displayed = useMemo(() =>
    items.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (query && !item.event.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    }),
  [items, filter, query]);

  function toggleItem(idx: number) {
    const globalIdx = items.indexOf(displayed[idx]);
    if (globalIdx < 0) return;
    const next = [...items];
    next[globalIdx] = { ...next[globalIdx], selected: !next[globalIdx].selected };
    onItemsChange(next);
  }

  function toggleAll(checked: boolean) {
    onItemsChange(
      items.map((item) => {
        const isDisplayed = displayed.includes(item);
        return isDisplayed ? { ...item, selected: checked } : item;
      }),
    );
  }

  function selectAllItems() {
    onItemsChange(items.map((item) => ({ ...item, selected: item.status !== 'invalid' })));
  }

  function deselectAllItems() {
    onItemsChange(items.map((item) => ({ ...item, selected: false })));
  }

  function selectByStatus(status: ImportStatus) {
    onItemsChange(items.map((item) => item.status === status ? { ...item, selected: true } : item));
  }

  const allDisplayedSelected = displayed.length > 0 && displayed.every((i) => i.selected);

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      {/* Stats bar — cliquable pour filtrer */}
      <div className="grid grid-cols-6 gap-2 shrink-0">
        {(['valid','update','duplicate','incomplete','conflict','invalid'] as ImportStatus[])
          .map((status) => {
            const count = report.stats[status] ?? 0;
            const m = STATUS_META[status];
            const active = filter === status;
            return (
              <button
                key={status}
                onClick={() => setFilter(active ? 'all' : status)}
                disabled={count === 0}
                className={cn(
                  'rounded-xl px-2 py-2 ring-1 ring-inset text-center transition-all',
                  active ? `${m.bg} ${m.ring}` : 'bg-white ring-slate-200 hover:ring-slate-300',
                  count === 0 && 'opacity-40 cursor-not-allowed',
                )}
              >
                <div className={cn('text-[18px] font-bold tabular-nums', m.color)}>{count}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
              </button>
            );
          })}
      </div>

      {/* Bulk actions bar — explicit and always visible */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Actions rapides
        </span>
        <button
          onClick={selectAllItems}
          className="px-2.5 py-1 rounded-md bg-white ring-1 ring-slate-200 hover:ring-violet-300 hover:bg-violet-50 text-[11.5px] font-medium text-slate-700 flex items-center gap-1"
        >
          <Check className="w-3 h-3 text-emerald-600" /> Tout sélectionner ({items.filter((i) => i.status !== 'invalid').length})
        </button>
        <button
          onClick={deselectAllItems}
          className="px-2.5 py-1 rounded-md bg-white ring-1 ring-slate-200 hover:ring-slate-300 text-[11.5px] font-medium text-slate-700 flex items-center gap-1"
        >
          <Minus className="w-3 h-3 text-slate-500" /> Tout désélectionner
        </button>
        {report.stats.valid > 0 && (
          <button
            onClick={() => selectByStatus('valid')}
            className="px-2.5 py-1 rounded-md bg-white ring-1 ring-emerald-200 hover:bg-emerald-50 text-[11.5px] font-medium text-emerald-700 flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" /> Valides uniquement ({report.stats.valid})
          </button>
        )}
        <span className="ml-auto text-[12px] text-slate-600">
          <span className="font-bold text-slate-900 tabular-nums">{selectedCount}</span>
          {' / '}
          <span className="tabular-nums">{items.length}</span>
          {' sélectionné' + (selectedCount > 1 ? 's' : '')}
        </span>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par nom…"
            className="w-full pl-9 pr-3 py-2 rounded-lg ring-1 ring-slate-200 bg-slate-50 focus:bg-white focus:ring-violet-500 outline-none text-[13px]"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as ImportStatus | 'all')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium ring-1 transition-all',
                filter === f.key
                  ? 'bg-violet-50 text-violet-700 ring-violet-200'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl ring-1 ring-slate-100 bg-white">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2.5 font-medium w-10">
                <input
                  type="checkbox"
                  checked={allDisplayedSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="w-3.5 h-3.5 accent-violet-600"
                  title="Sélectionner toutes les lignes affichées"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">Statut</th>
              <th className="px-3 py-2.5 font-medium">Événement</th>
              <th className="px-3 py-2.5 font-medium">Dates</th>
              <th className="px-3 py-2.5 font-medium">Lieu</th>
              <th className="px-3 py-2.5 font-medium">Impact</th>
              <th className="px-3 py-2.5 font-medium">Source</th>
              <th className="px-3 py-2.5 font-medium text-right">Confiance IA</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((item, idx) => (
              <tr
                key={item.event.id}
                className={cn(
                  'border-t border-slate-100 hover:bg-slate-50/60 transition-colors',
                  !item.selected && 'opacity-50',
                )}
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleItem(idx)}
                    className="w-3.5 h-3.5 accent-violet-600"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <StatusChip status={item.status} />
                </td>
                <td className="px-3 py-2.5 max-w-[200px]">
                  <div className="font-medium text-slate-900 truncate" title={item.event.name}>
                    {item.event.name}
                  </div>
                  {item.issues.length > 0 && (
                    <div className="text-[10.5px] text-amber-600 truncate mt-0.5" title={item.issues.join(' · ')}>
                      {item.issues[0]}
                    </div>
                  )}
                  {item.existingMatch && (
                    <div className="text-[10.5px] text-slate-400 truncate">
                      → {item.existingMatch.name}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1 text-slate-700">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {item.event.startDate}
                    {item.event.startDate !== item.event.endDate && (
                      <span className="text-slate-400"> → {item.event.endDate}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 max-w-[140px]">
                  <div className="flex items-center gap-1 text-slate-600 truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{item.event.venue || item.event.city || '—'}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <ImpactCell level={item.event.impact.level} adr={item.event.impact.adr} />
                </td>
                <td className="px-3 py-2.5 text-slate-500 text-[11.5px] max-w-[100px] truncate">
                  {item.event.primarySource || '—'}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <ConfidenceDot score={item.confidence} />
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-[12.5px]">
                  Aucun événement ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImpactCell({ level, adr }: { level: string; adr: number }) {
  const colors: Record<string, string> = {
    hyper_compression: 'text-purple-700 bg-purple-50 ring-purple-200',
    critical: 'text-rose-700 bg-rose-50 ring-rose-200',
    high: 'text-orange-700 bg-orange-50 ring-orange-200',
    medium: 'text-amber-700 bg-amber-50 ring-amber-200',
    low: 'text-sky-700 bg-sky-50 ring-sky-200',
    very_low: 'text-slate-500 bg-slate-50 ring-slate-200',
  };
  const labels: Record<string, string> = {
    hyper_compression: 'Hyper',
    critical: 'Critique',
    high: 'Fort',
    medium: 'Moyen',
    low: 'Faible',
    very_low: 'Très faible',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('inline-flex px-1.5 py-0.5 rounded-md ring-1 ring-inset text-[10px] font-bold', colors[level] ?? colors.very_low)}>
        {labels[level] ?? level}
      </span>
      {adr > 0 && (
        <span className="text-[10.5px] text-emerald-600 font-medium flex items-center gap-0.5">
          <TrendingUp className="w-2.5 h-2.5" />+{adr}%
        </span>
      )}
    </div>
  );
}

// ─── Step 4 : Done / Summary ──────────────────────────────────────────────────

function StepDone({
  added,
  updated,
  duplicates,
  rmsIntegrated,
  onClose,
}: {
  added: number;
  updated: number;
  duplicates: number;
  rmsIntegrated: number;
  onClose: () => void;
}) {
  return (
    <div className="py-4 space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <div className="text-[15px] font-bold text-slate-900">Import réussi</div>
        <div className="text-[12px] text-slate-500 mt-1">
          Les événements sélectionnés ont été intégrés dans la base Flowtym.
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <SummaryKpi label="Ajoutés" value={added} tone="emerald" />
        <SummaryKpi label="Mis à jour" value={updated} tone="sky" />
        <SummaryKpi label="Doublons ignorés" value={duplicates} tone="amber" />
        <SummaryKpi label="Dates RMS enrichies" value={rmsIntegrated} tone="violet" />
      </div>

      <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 flex items-start gap-3">
        <Zap className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
        <div className="text-[12.5px] text-slate-700">
          <span className="font-semibold">Propagation RMS automatique</span> — les événements
          haute priorité ont été injectés dans le Central Pricing Engine. Les recommandations
          tarifaires et l'Autopilote sont maintenant alimentés par ces données.
        </div>
      </div>

      <div className="flex items-start gap-2 text-[11.5px] text-slate-500">
        <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
        <span>
          Rendez-vous dans <strong>Revenue → Calendrier tarifaire</strong> pour visualiser
          les nouvelles recommandations, ou dans <strong>Autopilote</strong> pour les appliquer.
        </span>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 shadow-sm shadow-violet-600/20"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function SummaryKpi({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'sky' | 'amber' | 'violet' }) {
  const colors = {
    emerald: 'text-emerald-700 bg-emerald-50 ring-emerald-200',
    sky: 'text-sky-700 bg-sky-50 ring-sky-200',
    amber: 'text-amber-700 bg-amber-50 ring-amber-200',
    violet: 'text-violet-700 bg-violet-50 ring-violet-200',
  }[tone];
  return (
    <div className={cn('rounded-xl px-3 py-3 ring-1 ring-inset text-center', colors)}>
      <div className="text-[22px] font-bold tabular-nums">{value}</div>
      <div className="text-[10.5px] font-medium mt-0.5">{label}</div>
    </div>
  );
}

// ─── Wizard principal ─────────────────────────────────────────────────────────

const STEP_LABELS: Record<WizardStep, string> = {
  upload:    '1. Upload',
  analyzing: '2. Analyse',
  review:    '3. Validation',
  done:      '4. Résumé',
};
const STEP_ORDER: WizardStep[] = ['upload', 'analyzing', 'review', 'done'];

export const EventImportModal: React.FC<EventImportModalProps> = ({ open, onClose }) => {
  const { bulkUpsert, events: existingEvents } = useEventsStore();

  const [step, setStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ImportAnalysisReport | null>(null);
  const [reviewItems, setReviewItems] = useState<AnalyzedEvent[]>([]);
  const [importResult, setImportResult] = useState<{
    added: number; updated: number; duplicates: number; rmsIntegrated: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setStep('upload');
      setFileName('');
      setReport(null);
      setReviewItems([]);
      setImportResult(null);
      setError(null);
    }
  }, [open]);

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setStep('analyzing');
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseEventExcel(buf, file.name);
      // Petite pause pour laisser l'animation s'afficher
      await new Promise((r) => window.setTimeout(r, parsed.events.length > 50 ? 1400 : 900));
      const analyzed = analyzeImport(parsed, existingEvents);
      setReport(analyzed);
      setReviewItems(analyzed.items);
      setStep('review');
    } catch (e) {
      setError(`Erreur d'analyse : ${(e as Error).message}`);
      setStep('upload');
    }
  }

  function handleConfirmImport() {
    if (!report) return;
    setError(null);
    const toImport = reviewItems
      .filter((i) => i.selected && i.status !== 'invalid')
      .map((i) => i.event);

    if (toImport.length === 0) {
      setError('Aucun événement sélectionné. Utilisez "Tout sélectionner" ou cochez au moins une ligne.');
      return;
    }

    let stats: { added: number; updated: number; duplicates: number };
    try {
      stats = bulkUpsert(toImport);
    } catch (e) {
      setError(`Échec de l'intégration : ${(e as Error).message}`);
      return;
    }

    // Pont RMS — propage les événements haute priorité (non-bloquant)
    let rmsIntegrated = 0;
    try {
      const highImpact = toImport.filter((ev) => ev.impact.compression >= 60);
      integrateEventsToRMS(highImpact);
      rmsIntegrated = highImpact.length;
    } catch (e) {
      console.warn('[Events import] RMS integration failed (non-blocking):', e);
    }

    setImportResult({
      added: stats.added,
      updated: stats.updated,
      duplicates: stats.duplicates,
      rmsIntegrated,
    });
    setStep('done');
  }

  if (!open) return null;

  const activeStepIdx = STEP_ORDER.indexOf(step);
  const selectedCount = reviewItems.filter((i) => i.selected).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
      onClick={() => step !== 'analyzing' && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-0',
          step === 'review' ? 'w-[1100px] max-w-[97vw] h-[88vh]' : 'w-[680px] max-w-[92vw]',
        )}
        style={step === 'review' ? undefined : { maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-violet-600" />
              Importer des événements
            </h2>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Analyse IA · Validation · Intégration RMS
            </p>
          </div>
          <button
            onClick={() => step !== 'analyzing' && onClose()}
            className={cn('p-1.5 rounded-lg', step === 'analyzing' ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100')}
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-slate-50 flex items-center gap-2 shrink-0">
          {STEP_ORDER.map((s, i) => (
            <React.Fragment key={s}>
              <span className={cn(
                'text-[11.5px] font-medium px-2.5 py-1 rounded-full',
                activeStepIdx === i
                  ? 'bg-violet-100 text-violet-700'
                  : activeStepIdx > i
                  ? 'text-emerald-600'
                  : 'text-slate-400',
              )}>
                {activeStepIdx > i ? '✓ ' : ''}{STEP_LABELS[s]}
              </span>
              {i < STEP_ORDER.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex-1 min-h-0 overflow-hidden flex flex-col">
          {error && (
            <div className="mb-4 flex items-start gap-2 text-[12.5px] rounded-xl px-3 py-2.5 ring-1 bg-rose-50 ring-rose-100 text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'upload' && <StepUpload onFile={handleFile} />}
          {step === 'analyzing' && <StepAnalyzing fileName={fileName} />}
          {step === 'review' && report && (
            <StepReview
              report={report}
              items={reviewItems}
              onItemsChange={setReviewItems}
            />
          )}
          {step === 'done' && importResult && (
            <StepDone {...importResult} onClose={onClose} />
          )}
        </div>

        {/* Footer (review step only) */}
        {step === 'review' && report && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between shrink-0">
            <div className="text-[12px] text-slate-500">
              <span className="font-semibold text-slate-900">{selectedCount}</span> événement{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''} sur{' '}
              <span className="font-semibold text-slate-900">{report.totalRows}</span> analysés
              {report.warnings.length > 0 && (
                <span className="ml-2 text-amber-600">· {report.warnings.length} avertissement{report.warnings.length > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmImport}
                className={cn(
                  'px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 shadow-sm transition-all',
                  selectedCount === 0
                    ? 'bg-slate-100 text-slate-400 ring-1 ring-slate-200 cursor-pointer hover:bg-slate-200'
                    : 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-600/20',
                )}
                title={selectedCount === 0 ? 'Cochez au moins une ligne pour activer l\'intégration' : undefined}
              >
                <Check className="w-4 h-4" />
                {selectedCount === 0
                  ? 'Sélectionnez des événements'
                  : `Intégrer ${selectedCount} événement${selectedCount > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
