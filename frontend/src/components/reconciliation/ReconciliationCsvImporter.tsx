/**
 * FLOWTYM — CSV importer for bank/payout statements (drag&drop).
 *
 * Accepts CSV with at minimum these columns (case-insensitive, flexible headers):
 *   - amount  (or "Amount", "Montant", "Total")
 *   - date    (or "Date", "Posted At", "Payment date", "Booking date")
 *   - reference (or "Reservation", "Booking ID", "External reference")
 *   - description (optional)
 *   - currency (optional, defaults to EUR)
 *
 * Source is chosen via dropdown (BOOKING / EXPEDIA / AIRBNB / BANK_HOTEL).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle, AlertCircle, X, Save, Trash2 } from 'lucide-react';

import { useToast } from '@/src/hooks/use-toast';
import {
  useImportBankStatementsCSV, useCsvTemplates, useUpsertCsvTemplate, useDeleteCsvTemplate,
} from '@/src/domains/reconciliation/hooks';
import type { CreateBankStatementInput, ColumnMapping } from '@/src/domains/reconciliation/repository';

type ColumnAliases = ColumnMapping;
const DEFAULT_ALIASES: ColumnAliases = {
  amount: ['amount', 'montant', 'total', 'gross amount', 'net amount'],
  posted_at: ['date', 'posted at', 'payment date', 'booking date', 'check-in', 'arrival'],
  external_reference: ['reference', 'reservation', 'booking id', 'external reference', 'res id', 'booking number'],
  description: ['description', 'guest', 'guest name', 'comment', 'note'],
  currency: ['currency', 'devise'],
};

const SOURCES = ['BOOKING', 'EXPEDIA', 'AIRBNB', 'BANK_HOTEL'] as const;

const findKey = (row: Record<string, string>, aliases: string[]): string | undefined => {
  const lc = Object.keys(row).reduce<Record<string, string>>((acc, k) => {
    acc[k.toLowerCase().trim()] = k;
    return acc;
  }, {});
  for (const a of aliases) {
    if (lc[a]) return lc[a];
  }
  return undefined;
};

const parseAmount = (raw: string): number => {
  if (!raw) return NaN;
  // Handle European format: "1.234,56" or "1,234.56" or "-12.50"
  const cleaned = raw.trim().replace(/\s|€|\$|£/g, '');
  // If both `,` and `.` exist, assume `.` is thousand separator (FR format)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return Number(cleaned.replace(',', '.'));
  }
  return Number(cleaned);
};

const parseDate = (raw: string): string | null => {
  if (!raw) return null;
  // Try ISO first
  const isoMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return new Date(raw).toISOString();
  // Try DD/MM/YYYY
  const m = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (m) {
    const iso = `${m[3]}-${m[2]}-${m[1]}T00:00:00Z`;
    return new Date(iso).toISOString();
  }
  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback.toISOString();
};

export const ReconciliationCsvImporter: React.FC = () => {
  const importMutation = useImportBankStatementsCSV();
  const templatesQ = useCsvTemplates();
  const upsertTemplate = useUpsertCsvTemplate();
  const deleteTemplate = useDeleteCsvTemplate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [source, setSource] = useState<(typeof SOURCES)[number]>('BOOKING');
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [preview, setPreview] = useState<{ ok: number; bad: number; rows: CreateBankStatementInput[] } | null>(null);

  // Resolved mapping = active template OR defaults
  const aliases: ColumnAliases = (() => {
    if (activeTemplateId) {
      const tpl = (templatesQ.data ?? []).find((t) => t.id === activeTemplateId);
      if (tpl?.mapping && Object.keys(tpl.mapping).length > 0) return tpl.mapping;
    }
    return DEFAULT_ALIASES;
  })();

  // Auto-pick the user's default template once data arrives.
  useEffect(() => {
    if (activeTemplateId || !templatesQ.data) return;
    const def = templatesQ.data.find((t) => t.source === source && t.is_default) ?? templatesQ.data.find((t) => t.source === source);
    if (def) setActiveTemplateId(def.id);
  }, [templatesQ.data, source, activeTemplateId]);

  const handleFiles = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows: CreateBankStatementInput[] = [];
        let bad = 0;
        for (const r of res.data) {
          const amountKey = findKey(r, aliases.amount ?? DEFAULT_ALIASES.amount);
          const dateKey = findKey(r, aliases.posted_at ?? DEFAULT_ALIASES.posted_at);
          const refKey = findKey(r, aliases.external_reference ?? DEFAULT_ALIASES.external_reference);
          const descKey = findKey(r, aliases.description ?? DEFAULT_ALIASES.description);
          const curKey = findKey(r, aliases.currency ?? DEFAULT_ALIASES.currency);
          if (!amountKey || !dateKey) { bad += 1; continue; }
          const amt = parseAmount(r[amountKey] ?? '');
          const date = parseDate(r[dateKey] ?? '');
          if (!isFinite(amt) || !date) { bad += 1; continue; }
          rows.push({
            source,
            amount: amt,
            postedAt: date,
            externalReference: refKey ? (r[refKey] || null) : null,
            description: descKey ? (r[descKey] || null) : null,
            currency: curKey ? (r[curKey] || 'EUR') : 'EUR',
          });
        }
        setPreview({ ok: rows.length, bad, rows });
      },
      error: (err) => {
        toast({ title: 'Erreur parsing CSV', description: err.message, variant: 'destructive' });
      },
    });
  }, [source, toast, aliases]);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFiles(file);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFiles(file);
  };

  const onImport = async () => {
    if (!preview || preview.rows.length === 0) return;
    try {
      const res = await importMutation.mutateAsync(preview.rows);
      toast({
        title: 'Import réussi',
        description: `${res.inserted} ligne(s) importée(s)${res.skipped ? `, ${res.skipped} doublon(s) ignoré(s)` : ''}.`,
        variant: 'success',
      });
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast({ title: 'Échec import', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const onSaveCurrentAsTemplate = async () => {
    const name = window.prompt('Nom du template (sera réutilisable pour les prochains imports) :', `${source} — ${new Date().toLocaleDateString('fr-FR')}`);
    if (!name) return;
    try {
      await upsertTemplate.mutateAsync({
        name,
        source,
        mapping: aliases,
        defaultCurrency: 'EUR',
        isDefault: (templatesQ.data ?? []).filter((t) => t.source === source).length === 0,
      });
      toast({ title: 'Template enregistré', description: name, variant: 'success' });
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const onDeleteActiveTemplate = async () => {
    if (!activeTemplateId) return;
    const tpl = (templatesQ.data ?? []).find((t) => t.id === activeTemplateId);
    if (!tpl) return;
    if (!window.confirm(`Supprimer le template "${tpl.name}" ?`)) return;
    try {
      await deleteTemplate.mutateAsync(activeTemplateId);
      setActiveTemplateId('');
      toast({ title: 'Template supprimé', variant: 'success' });
    } catch (e) {
      toast({ title: 'Échec', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm" data-testid="recon-csv-importer">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-gray-900">Import CSV (Booking / Expedia / Airbnb / Banque)</h3>
        <div className="flex items-center gap-2">
          <select
            value={activeTemplateId}
            onChange={(e) => setActiveTemplateId(e.target.value)}
            data-testid="recon-csv-template"
            title="Choisir un template de mapping sauvegardé"
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Template : Mapping par défaut</option>
            {(templatesQ.data ?? []).filter((t) => t.source === source).map((t) => (
              <option key={t.id} value={t.id}>
                {t.is_default ? '★ ' : ''}{t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onSaveCurrentAsTemplate}
            disabled={upsertTemplate.isPending}
            data-testid="recon-csv-template-save"
            title="Enregistrer le mapping actuel comme template"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            <Save size={12} /> Enregistrer
          </button>
          {activeTemplateId && (
            <button
              type="button"
              onClick={onDeleteActiveTemplate}
              disabled={deleteTemplate.isPending}
              data-testid="recon-csv-template-delete"
              title="Supprimer ce template"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 size={12} />
            </button>
          )}
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value as (typeof SOURCES)[number]); setActiveTemplateId(''); }}
            data-testid="recon-csv-source"
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        data-testid="recon-csv-dropzone"
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors ${dragOver ? 'border-violet-500 bg-violet-50' : 'border-gray-200 bg-gray-50 hover:border-violet-300'}`}
      >
        <Upload size={28} className="text-violet-500" />
        <p className="text-sm font-semibold text-gray-700">Glissez votre CSV ici ou cliquez pour parcourir</p>
        <p className="text-[11px] text-gray-400">Colonnes attendues : amount, date, reference, description (optionnel)</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} data-testid="recon-csv-file" />
      </div>

      {preview && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4" data-testid="recon-csv-preview">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle size={14} />{preview.ok} valides</span>
              {preview.bad > 0 && <span className="inline-flex items-center gap-1 text-rose-600"><AlertCircle size={14} />{preview.bad} ignorées</span>}
            </div>
            <button
              type="button"
              onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="text-gray-400 hover:text-gray-600"
              data-testid="recon-csv-clear"
            >
              <X size={16} />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-white">
            <table className="w-full text-xs">
              <thead className="text-left text-gray-400 bg-gray-50">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Réf</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-3 py-1.5 text-gray-600">{new Date(r.postedAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-700">{r.externalReference ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500 truncate max-w-[200px]">{r.description ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-gray-900">{r.amount.toFixed(2)} {r.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 8 && <div className="px-3 py-2 text-[11px] text-gray-400 bg-gray-50 border-t">+{preview.rows.length - 8} ligne(s) supplémentaire(s)</div>}
          </div>
          <button
            type="button"
            onClick={onImport}
            disabled={importMutation.isPending || preview.rows.length === 0}
            data-testid="recon-csv-import-btn"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-bold"
          >
            <FileText size={14} />
            {importMutation.isPending ? 'Import en cours…' : `Importer ${preview.rows.length} ligne(s)`}
          </button>
        </div>
      )}
    </section>
  );
};
