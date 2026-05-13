/**
 * FLOWTYM — ReconciliationView
 * Rapprochement automatique payouts OTA + encaissements directs vs réservations.
 * Correspond au screenshot "Reconciliation Center".
 */
import React, { useState, useCallback } from 'react';
import {
  RefreshCcw,
  Upload,
  Star,
  Trash2,
  CheckCircle,
  AlertTriangle,
  EyeOff,
  TrendingUp,
  Loader2,
  ChevronDown,
  X,
  Save,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { cn } from '@/src/lib/utils';
import {
  useReconciliationLines,
  useReconciliationStats,
  useImportCsvLines,
  useUpdateReconciliationStatus,
  useCsvTemplates,
  useUpsertCsvTemplate,
  useDeleteCsvTemplate,
} from '@/src/domains/finance/hooks';
import type {
  ReconciliationLineRow,
  ReconciliationSource,
  ImportCsvLine,
} from '@/src/domains/finance/schemas';

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsvText(
  text: string,
  mapping: Record<string, string>,
  source: ReconciliationSource,
): ImportCsvLine[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const results: ImportCsvLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });

    const amountStr = row[mapping.amount ?? 'amount'] ?? row['Montant'] ?? '';
    const dateStr = row[mapping.date ?? 'date'] ?? row['Date'] ?? '';
    const reference = row[mapping.reference ?? 'reference'] ?? row['Référence'] ?? `CSV-${i}`;

    const amount = parseFloat(amountStr.replace(',', '.').replace(/[^0-9.-]/g, ''));
    const dateMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2})/);
    let date = '';
    if (dateMatch) {
      date = dateMatch[4]
        ? `${dateMatch[4]}-${dateMatch[5]}-${dateMatch[6]}`
        : `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }

    if (!isNaN(amount) && date) {
      results.push({ source, reference, amount, date, description: row['Description'] });
    }
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  BOOKING: 'text-blue-600 bg-blue-50',
  EXPEDIA: 'text-yellow-700 bg-yellow-50',
  AIRBNB: 'text-rose-600 bg-rose-50',
  BANK_HOTEL: 'text-emerald-600 bg-emerald-50',
  DIRECT: 'text-violet-600 bg-violet-50',
};

const STATUS_FILTERS = ['Tous', 'À rapprocher', 'Rapproché', 'En litige', 'Ignoré'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_MAP: Record<StatusFilter, string | undefined> = {
  'Tous': undefined,
  'À rapprocher': 'pending',
  'Rapproché': 'matched',
  'En litige': 'disputed',
  'Ignoré': 'ignored',
};

function fmtEur(v: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ReconciliationView = () => {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('Tous');
  const [selectedSource, setSelectedSource] = useState<ReconciliationSource>('BOOKING');
  const [templateName, setTemplateName] = useState('');
  const [showTemplateInput, setShowTemplateInput] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const statusParam = STATUS_MAP[activeFilter];
  const { data: linesData, isLoading } = useReconciliationLines({ status: statusParam });
  const { data: stats } = useReconciliationStats();
  const { data: templates = [] } = useCsvTemplates();

  const importLines = useImportCsvLines();
  const updateStatus = useUpdateReconciliationStatus();
  const upsertTemplate = useUpsertCsvTemplate();
  const deleteTemplate = useDeleteCsvTemplate();

  const rows = linesData?.rows ?? [];

  // CSV Drop
  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

      const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
      const mapping = selectedTemplate?.mapping ?? {};

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseCsvText(text, mapping, selectedSource);
        if (parsed.length > 0) {
          importLines.mutate(parsed);
        }
      };
      reader.readAsText(file, 'utf-8');
    },
    [selectedSource, selectedTemplateId, templates, importLines],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls', '.xlsx'] },
    multiple: false,
  });

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    upsertTemplate.mutate({
      name: templateName,
      source: selectedSource,
      mapping: { amount: 'Montant', date: 'Date', reference: 'Référence' },
      is_default: false,
    });
    setTemplateName('');
    setShowTemplateInput(false);
  };

  const handleAction = (row: ReconciliationLineRow, action: 'matched' | 'disputed' | 'ignored') => {
    updateStatus.mutate({ id: row.id, status: action });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9FAFB]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">
            <span>Finance</span>
            <span>·</span>
            <span className="text-[#8B5CF6]">Rapprochement</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Reconciliation Center
            <span className="ml-3 text-base font-medium text-gray-400">
              — {/* hotel name via auth session */}
            </span>
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Rapprochement automatique payouts OTA + encaissements directs vs réservations &amp; calculs RIE.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
          <Button className="bg-[#8B5CF6] text-white gap-2 font-bold shadow-lg shadow-[#8B5CF6]/20">
            <Upload size={16} />
            Importer une ligne
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'À Rapprocher',
            value: stats?.pending ?? 0,
            sub: stats ? fmtEur(stats.pendingAmount) : '—',
            icon: <AlertTriangle size={18} className="text-amber-500" />,
            bg: 'bg-amber-50',
          },
          {
            label: 'Rapprochés',
            value: stats?.matched ?? 0,
            sub: stats ? fmtEur(stats.matchedAmount) : '—',
            icon: <CheckCircle size={18} className="text-emerald-500" />,
            bg: 'bg-emerald-50',
          },
          {
            label: 'Couverture',
            value: `${stats?.coveragePercent ?? 0}%`,
            sub: `${stats ? (stats.matched + stats.pending + stats.disputed) : 0} lignes`,
            icon: <TrendingUp size={18} className="text-[#8B5CF6]" />,
            bg: 'bg-[#8B5CF6]/5',
          },
          {
            label: 'Suggestions Auto',
            value: stats?.autoSuggestions ?? 0,
            sub: 'Confiance > 40',
            icon: <RefreshCcw size={18} className="text-blue-500" />,
            bg: 'bg-blue-50',
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-5 bg-white border-transparent shadow-sm">
            <div className="flex items-start gap-3">
              <div className={cn('p-2 rounded-xl shrink-0', kpi.bg)}>{kpi.icon}</div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {kpi.label}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{kpi.value}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* CSV Importer */}
      <Card className="p-6 bg-white border-transparent shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            Import CSV (Booking / Expedia / Airbnb / Banque)
          </h3>
          <div className="flex items-center gap-2">
            {/* Template selector */}
            <div className="relative">
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 pr-8 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 appearance-none"
              >
                <option value="">Choisir un template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.is_default ? '★ ' : ''}{t.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Save template */}
            {!showTemplateInput ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplateInput(true)}
                className="gap-1.5 text-[#8B5CF6] border-[#8B5CF6]/30 bg-[#8B5CF6]/5 font-bold"
              >
                <Save size={12} />
                Enregistrer
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Nom du template"
                  className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                />
                <Button size="sm" onClick={handleSaveTemplate} className="bg-[#8B5CF6] text-white font-bold">
                  OK
                </Button>
                <button onClick={() => setShowTemplateInput(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Source selector */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as ReconciliationSource)}
              className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-600 focus:outline-none"
            >
              {['BOOKING', 'EXPEDIA', 'AIRBNB', 'BANK_HOTEL', 'DIRECT'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
            isDragActive
              ? 'border-[#8B5CF6] bg-[#8B5CF6]/5'
              : 'border-gray-200 hover:border-[#8B5CF6]/50 hover:bg-gray-50',
          )}
        >
          <input {...getInputProps()} />
          {importLines.isPending ? (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Loader2 size={28} className="animate-spin text-[#8B5CF6]" />
              <p className="text-sm font-medium">Import en cours…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-[#8B5CF6]/10 rounded-2xl text-[#8B5CF6]">
                <Upload size={24} />
              </div>
              <p className="text-sm font-bold text-gray-700">
                Glissez votre CSV ici ou cliquez pour parcourir
              </p>
              <p className="text-xs text-gray-400">
                Colonnes attendues : amount, date, reference, description (optionnel)
              </p>
            </div>
          )}
        </div>

        {importLines.isError && (
          <p className="text-xs text-red-500 font-medium">{String(importLines.error)}</p>
        )}
      </Card>

      {/* Lines Table */}
      <Card className="bg-white border-transparent shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-900 text-sm">Lignes bancaires</h3>
            <Badge variant="neutral" className="font-bold text-xs">
              {linesData?.total ?? 0}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  activeFilter === f
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Chargement…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <RefreshCcw size={28} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucune ligne bancaire</p>
            <p className="text-xs mt-1 opacity-60">Importez un fichier CSV pour commencer le rapprochement</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F9FAFB] border-b border-gray-50">
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-5 py-4">Source</th>
                  <th className="px-5 py-4">Référence</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">Montant</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Statut</th>
                  <th className="px-5 py-4">Suggestion</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/60 transition-colors text-sm group">
                    <td className="px-5 py-4">
                      <span className={cn('text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider', SOURCE_COLORS[row.source] ?? 'text-gray-600 bg-gray-100')}>
                        {row.source}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-600">{row.reference}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs max-w-[200px] truncate">{row.description ?? '—'}</td>
                    <td className="px-5 py-4 font-bold text-gray-900">{fmtEur(row.amount)}</td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {new Date(row.line_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant={
                          row.status === 'matched' ? 'success' :
                          row.status === 'disputed' ? 'error' :
                          row.status === 'ignored' ? 'neutral' : 'warning'
                        }
                        className="text-[10px] font-bold px-2 py-0.5 capitalize"
                      >
                        {row.status === 'pending' ? 'À rapprocher' :
                         row.status === 'matched' ? 'Rapproché' :
                         row.status === 'disputed' ? 'En litige' : 'Ignoré'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-gray-400">
                      {row.match_score !== null ? (
                        <span className={cn(
                          'font-bold',
                          (row.match_score ?? 0) >= 80 ? 'text-emerald-600' :
                          (row.match_score ?? 0) >= 50 ? 'text-amber-600' : 'text-red-500'
                        )}>
                          {row.match_score}%
                          {row.match_delta !== null && (
                            <span className="ml-1 text-gray-400">
                              Δ {fmtEur(row.match_delta)}
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        {row.status !== 'matched' && (
                          <button
                            onClick={() => handleAction(row, 'matched')}
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-1 text-[10px] font-bold text-[#8B5CF6] hover:bg-[#8B5CF6]/10 px-2 py-1 rounded-lg transition-colors"
                          >
                            <CheckCircle size={12} />
                            Rapprocher
                          </button>
                        )}
                        {row.status !== 'disputed' && (
                          <button
                            onClick={() => handleAction(row, 'disputed')}
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-1 text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                          >
                            <AlertTriangle size={12} />
                            Litige
                          </button>
                        )}
                        {row.status !== 'ignored' && (
                          <button
                            onClick={() => handleAction(row, 'ignored')}
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors"
                          >
                            <EyeOff size={12} />
                            Ignorer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
