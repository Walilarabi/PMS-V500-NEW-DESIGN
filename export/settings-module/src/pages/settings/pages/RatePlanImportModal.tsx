/**
 * FLOWTYM — Modale d'import Excel des plans tarifaires distribués.
 *
 * Flux : sélection fichier → parsing (3 colonnes, forward-fill) →
 * prévisualisation (partenaires/plans détectés, nouveaux vs existants,
 * erreurs) → « Valider l'import » → écriture Supabase → toast + refresh.
 *
 * Aucune donnée fake, aucun localStorage métier : tout est persisté en base.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Users, Grid } from 'lucide-react';
import {
  parsePartnerRateExcel, type PartnerRateImportReport,
} from '@/src/services/settings/partner-rate-import.service';
import {
  importPartnerRatePlans, fetchExistingForPreview, type ImportResult,
} from '@/src/services/settings/partner-rate-import.persist';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Appelé après un import réussi (pour rafraîchir la liste / le calendrier). */
  onImported: () => void;
}

interface Preview {
  report: PartnerRateImportReport;
  uniquePlanCodes: string[];
  newPlans: number;
  existingPlans: number;
  newPartners: number;
  existingPartners: number;
}

export const RatePlanImportModal: React.FC<Props> = ({ open, onClose, onImported }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = useCallback(() => {
    setFileName(null); setParsing(false); setPreview(null);
    setParseError(null); setImporting(false); setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); setParseError(null); setPreview(null); setResult(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const report = parsePartnerRateExcel(buf, file.name);
      const existing = await fetchExistingForPreview();
      const uniquePlanCodes = [...new Set(report.plans.map((p) => p.code))];
      const newPlans = uniquePlanCodes.filter((c) => !existing.planCodes.has(c)).length;
      const newPartners = report.partners.filter((p) => !existing.partnerNames.has(p.name.toLowerCase())).length;
      setPreview({
        report,
        uniquePlanCodes,
        newPlans,
        existingPlans: uniquePlanCodes.length - newPlans,
        newPartners,
        existingPartners: report.partners.length - newPartners,
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Fichier illisible');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await importPartnerRatePlans(preview.report);
      setResult(res);
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: {
            message: `Import réussi — ${res.plansCreated} nouveau(x) plan(s), ${res.plansUpdated} mis à jour, ${res.partnersCreated} partenaire(s) créé(s)`,
            type: 'success',
          },
        }));
        onImported();
      } else {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { message: `Import partiel/échoué — ${res.errors[0] ?? 'erreur inconnue'}`, type: 'error' },
        }));
      }
    } catch (err) {
      setResult({
        ok: false, partnersCreated: 0, partnersReused: 0, plansCreated: 0,
        plansUpdated: 0, mappingsCreated: 0, mappingsUpdated: 0,
        errors: [err instanceof Error ? err.message : 'Erreur inconnue'],
      });
    } finally {
      setImporting(false);
    }
  }, [preview, onImported]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Importer les plans tarifaires (Excel)</h2>
              <p className="text-[12px] text-slate-500">Colonnes : Activation · Partenaires de distribution · Tarifs distribués</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Sélecteur fichier */}
          <div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={parsing || importing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 text-violet-700 text-[13px] font-medium hover:bg-violet-50 disabled:opacity-50"
            >
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {fileName ? `Fichier : ${fileName} — changer` : 'Choisir un fichier Excel (.xlsx)'}
            </button>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 ring-1 ring-rose-100 px-3 py-2.5 text-[12.5px] text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{parseError}</span>
            </div>
          )}

          {/* Prévisualisation */}
          {preview && !result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat icon={Users} label="Partenaires détectés" value={preview.report.partners.length}
                  sub={`${preview.newPartners} nouveau(x) · ${preview.existingPartners} existant(s)`} />
                <Stat icon={Grid} label="Plans détectés" value={preview.uniquePlanCodes.length}
                  sub={`${preview.newPlans} nouveau(x) · ${preview.existingPlans} existant(s)`} />
              </div>

              {preview.report.errors.length > 0 && (
                <div className="rounded-xl bg-amber-50 ring-1 ring-amber-100 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-800 mb-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {preview.report.errors.length} ligne(s) en erreur
                  </div>
                  <ul className="text-[11.5px] text-amber-700 space-y-0.5 max-h-28 overflow-y-auto">
                    {preview.report.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>Ligne {e.row} : {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Aperçu des 8 premiers plans */}
              <div className="rounded-xl ring-1 ring-slate-100 overflow-hidden">
                <table className="w-full text-[11.5px]">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-semibold">Plan</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Code</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Partenaire</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Pension</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.report.plans.slice(0, 8).map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-slate-700">{p.name}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-500">{p.code}</td>
                        <td className="px-3 py-1.5 text-slate-600">{p.partnerName}</td>
                        <td className="px-3 py-1.5 text-slate-600">{p.mealPlan ?? '—'}</td>
                        <td className="px-3 py-1.5">
                          <span className={p.isActive ? 'text-emerald-600' : 'text-slate-400'}>
                            {p.isActive ? 'Activé' : 'Désactivé'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.report.plans.length > 8 && (
                  <div className="px-3 py-1.5 text-[11px] text-slate-400 bg-slate-50/60">
                    … et {preview.report.plans.length - 8} autre(s) ligne(s)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Résultat */}
          {result && (
            <div className={`rounded-xl px-4 py-3 ring-1 ${result.ok ? 'bg-emerald-50 ring-emerald-100' : 'bg-rose-50 ring-rose-100'}`}>
              <div className={`flex items-center gap-2 text-[13px] font-semibold ${result.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {result.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {result.ok ? 'Import terminé' : 'Import en échec'}
              </div>
              <ul className="mt-1.5 text-[12px] text-slate-600 space-y-0.5">
                <li>{result.partnersCreated} partenaire(s) créé(s), {result.partnersReused} réutilisé(s)</li>
                <li>{result.plansCreated} plan(s) créé(s), {result.plansUpdated} mis à jour</li>
                <li>{result.mappingsCreated} mapping(s) créé(s), {result.mappingsUpdated} mis à jour</li>
              </ul>
              {result.errors.length > 0 && (
                <ul className="mt-1.5 text-[11.5px] text-rose-700 space-y-0.5">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={handleClose} className="px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
            {result?.ok ? 'Fermer' : 'Annuler'}
          </button>
          {!result?.ok && (
            <button
              onClick={handleImport}
              disabled={!preview || preview.uniquePlanCodes.length === 0 || importing}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {importing ? 'Import en cours…' : "Valider l'import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub: string }> = ({ icon: Icon, label, value, sub }) => (
  <div className="rounded-xl ring-1 ring-slate-100 bg-white px-4 py-3">
    <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium uppercase tracking-wide">
      <Icon className="w-3.5 h-3.5" /> {label}
    </div>
    <div className="text-[22px] font-bold text-violet-700 tabular-nums mt-0.5">{value}</div>
    <div className="text-[11px] text-slate-500">{sub}</div>
  </div>
);
