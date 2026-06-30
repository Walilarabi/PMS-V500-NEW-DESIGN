/**
 * FLOWTYM — Paramètres · Fiscalité France 2026.
 */
import React, { useState } from 'react';
import { Percent, Save, ShieldCheck, AlertCircle, Globe } from 'lucide-react';
import { useConfigStore } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { usePagePermission } from '@/src/services/settings/permissionsService';
import { useConfigBlob } from '@/src/hooks/settings/useConfigBlob';
import { SettingsPageHeader, SettingsToast, Phase2Notice } from './_common';

interface FiscalConfig {
  einvoiceProvider: 'ppf' | 'pdp' | 'none';
  pdpProvider?: string;
  fiscalYearStart: string;        // MM-DD
  immutableArchive: boolean;
  factureXSupport: boolean;
  pisteAuditFiable: boolean;
  einvoiceMode: 'test' | 'production';
  euInvoicingScheme: 'B2C' | 'B2B' | 'BOTH';
}

const DEFAULT: FiscalConfig = {
  einvoiceProvider: 'ppf',
  pdpProvider: '',
  fiscalYearStart: '01-01',
  immutableArchive: true,
  factureXSupport: true,
  pisteAuditFiable: true,
  einvoiceMode: 'test',
  euInvoicingScheme: 'BOTH',
};

export const FiscalPage: React.FC = () => {
  const taxes = useConfigStore((s) => s.taxes);
  const [cfg, setCfg] = useConfigBlob<FiscalConfig>('fiscal_config', DEFAULT);
  const [toast, setToast] = useState<string | null>(null);
  const { canRead, canWrite, DeniedBanner } = usePagePermission('set_fiscal');

  function handleSave() {
    if (!canWrite) return;
    logAudit({ action: 'module_inspected', module: 'finance_billing', detail: 'Paramètres fiscaux mis à jour' });
    setToast('Paramètres fiscaux enregistrés');
    window.setTimeout(() => setToast(null), 2500);
  }

  const taxConfigured = taxes.hebergement > 0 && taxes.fb > 0 && taxes.sejour > 0;
  const checks = [
    { label: 'TVA hébergement renseignée', ok: taxes.hebergement > 0 },
    { label: 'TVA restauration renseignée', ok: taxes.fb > 0 },
    { label: 'Taxe de séjour renseignée', ok: taxes.sejour > 0 },
    { label: 'Archive immuable activée', ok: cfg.immutableArchive },
    { label: 'Piste d\'audit fiable', ok: cfg.pisteAuditFiable },
    { label: 'Support Factur-X', ok: cfg.factureXSupport },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  if (!canRead) return <DeniedBanner />;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={Percent}
          category="Finance & Facturation"
          title="Fiscalité 2026 & e-facture"
          description="Conformité PPF / PDP, Factur-X, archivage immuable, piste d'audit fiable."
          action={
            <button
              onClick={handleSave}
              disabled={!canWrite}
              title={!canWrite ? 'Permission requise : set_fiscal (write)' : undefined}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" /> Enregistrer
            </button>
          }
        />

        <section className={`rounded-2xl ring-1 p-5 flex items-start gap-4 ${score >= 80 ? 'ring-emerald-200 bg-emerald-50/60' : score >= 50 ? 'ring-amber-200 bg-amber-50/60' : 'ring-rose-200 bg-rose-50/60'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${score >= 80 ? 'bg-emerald-100 text-emerald-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold tabular-nums">{score}</span><span className="text-[12px] text-slate-500">/100</span>
              <span className="ml-2 text-[13px] text-slate-700 font-medium">Conformité fiscale 2026</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11.5px] mt-3">
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {c.ok ? <ShieldCheck className="w-3 h-3 text-emerald-500" /> : <AlertCircle className="w-3 h-3 text-rose-500" />}
                  <span className={c.ok ? 'text-emerald-700' : 'text-rose-700'}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Mode e-facture</span>
              <select value={cfg.einvoiceProvider} onChange={(e) => setCfg({ ...cfg, einvoiceProvider: e.target.value as FiscalConfig['einvoiceProvider'] })}
                className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
                <option value="ppf">Portail Public de Facturation (PPF)</option>
                <option value="pdp">Plateforme Dématérialisation Partenaire (PDP)</option>
                <option value="none">Aucun (avant 1er septembre 2026)</option>
              </select>
            </label>
            {cfg.einvoiceProvider === 'pdp' && (
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">PDP choisi</span>
                <input type="text" value={cfg.pdpProvider} onChange={(e) => setCfg({ ...cfg, pdpProvider: e.target.value })}
                  placeholder="Ex. Sage, Cegid, DocuWare…"
                  className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]" />
              </label>
            )}
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Environnement</span>
              <select value={cfg.einvoiceMode} onChange={(e) => setCfg({ ...cfg, einvoiceMode: e.target.value as 'test' | 'production' })}
                className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
                <option value="test">Test / Bac à sable</option>
                <option value="production">Production</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Schéma EU</span>
              <select value={cfg.euInvoicingScheme} onChange={(e) => setCfg({ ...cfg, euInvoicingScheme: e.target.value as 'B2C' | 'B2B' | 'BOTH' })}
                className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
                <option value="B2C">B2C uniquement</option>
                <option value="B2B">B2B uniquement</option>
                <option value="BOTH">B2B + B2C</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Début exercice fiscal</span>
              <input type="text" value={cfg.fiscalYearStart} onChange={(e) => setCfg({ ...cfg, fiscalYearStart: e.target.value })}
                placeholder="MM-DD" className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            <ToggleRow label="Archive immuable" checked={cfg.immutableArchive} onChange={(v) => setCfg({ ...cfg, immutableArchive: v })} />
            <ToggleRow label="Support Factur-X" checked={cfg.factureXSupport} onChange={(v) => setCfg({ ...cfg, factureXSupport: v })} />
            <ToggleRow label="Piste d'audit fiable" checked={cfg.pisteAuditFiable} onChange={(v) => setCfg({ ...cfg, pisteAuditFiable: v })} />
          </div>
        </section>

        <section className="rounded-2xl ring-1 ring-violet-100 bg-violet-50/40 p-4 flex items-start gap-3">
          <Globe className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-[12.5px] text-slate-700">
            <strong>Calendrier France 2026 :</strong> à partir du 1<sup>er</sup> septembre 2026, toutes les
            entreprises devront émettre leurs factures B2B au format électronique via le PPF ou une PDP
            agréée. Les factures B2C restent au format actuel mais doivent être déclarées (e-reporting).
          </div>
        </section>

        <Phase2Notice><strong>Phase 2 :</strong> connexion réelle au PPF / PDP, scellement cryptographique des archives.</Phase2Notice>
      </div>
      <SettingsToast message={toast} />
    </div>
  );
};

const ToggleRow: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-violet-600" />
    {label}
  </label>
);
