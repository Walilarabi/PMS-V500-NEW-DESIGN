/**
 * FLOWTYM — Paramètres · Numérotation (séquences de documents).
 */
import React, { useState } from 'react';
import { Save, AlertCircle, Lock } from 'lucide-react';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { useConfigBlob } from '@/src/hooks/settings/useConfigBlob';
import { usePagePermission } from '@/src/services/settings/permissionsService';
import { SettingsPageHeader, SettingsToast, Phase2Notice } from './_common';

// Hash icon helper
function Hash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

interface NumberingConfig {
  invoicePrefix: string;
  invoiceCounter: number;
  invoiceFormat: string;
  bookingPrefix: string;
  bookingCounter: number;
  bookingFormat: string;
  proformaPrefix: string;
  proformaCounter: number;
  proformaFormat: string;
  fiscalYearReset: boolean;
}

const DEFAULT: NumberingConfig = {
  invoicePrefix: 'FAC',
  invoiceCounter: 42,
  invoiceFormat: '{PREFIX}-{YEAR}-{NUMBER:5}',
  bookingPrefix: 'FLW',
  bookingCounter: 1247,
  bookingFormat: '{PREFIX}-{YEAR}-{NUMBER:4}',
  proformaPrefix: 'PRO',
  proformaCounter: 8,
  proformaFormat: '{PREFIX}-{YEAR}-{NUMBER:4}',
  fiscalYearReset: true,
};

function preview(format: string, prefix: string, counter: number): string {
  const year = new Date().getFullYear();
  return format
    .replace('{PREFIX}', prefix)
    .replace('{YEAR}', String(year))
    .replace(/\{NUMBER:(\d+)\}/, (_, pad) => String(counter).padStart(parseInt(pad), '0'))
    .replace('{NUMBER}', String(counter));
}

export const NumberingPage: React.FC = () => {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const legacy = window.localStorage.getItem('flowtym.numbering');
    const next = window.localStorage.getItem('flowtym.cfg.numbering');
    if (legacy && !next) window.localStorage.setItem('flowtym.cfg.numbering', legacy);
  }, []);
  const [cfg, setCfg] = useConfigBlob<NumberingConfig>('numbering', DEFAULT);
  const [toast, setToast] = useState<string | null>(null);
  const { canRead, canWrite, DeniedBanner } = usePagePermission('fin_invoice');

  function handleSave() {
    setCfg((c) => c); // force re-sync vers Supabase
    logAudit({ action: 'module_inspected', module: 'finance_billing', detail: 'Numérotation mise à jour' });
    setToast('Numérotation enregistrée');
    window.setTimeout(() => setToast(null), 2500);
  }

  if (!canRead) return <DeniedBanner />;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={Hash as any}
          category="Finance & Facturation"
          title="Numérotation"
          description="Séquences de numérotation des documents (factures, réservations, proformas)."
          action={<button onClick={() => canWrite && handleSave()} disabled={!canWrite} title={!canWrite ? 'Permission requise : fin_invoice (write)' : undefined} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"><Save className="w-3.5 h-3.5" /> Enregistrer</button>}
        />

        <section className="rounded-2xl ring-1 ring-amber-100 bg-amber-50/40 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-[12.5px] text-amber-900">
            <strong>Attention :</strong> les compteurs de factures sont auditables fiscalement. Une décrémentation
            manuelle est considérée comme une fraude — n'utilisez cette fonction qu'en environnement de test.
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          <NumberingCard
            title="Factures" subtitle="Documents fiscaux engageants" lockable
            prefix={cfg.invoicePrefix} format={cfg.invoiceFormat} counter={cfg.invoiceCounter}
            onChange={(patch) => setCfg({ ...cfg, ...patch })}
            prefixKey="invoicePrefix" formatKey="invoiceFormat" counterKey="invoiceCounter"
          />
          <NumberingCard
            title="Réservations" subtitle="Numéro de dossier client"
            prefix={cfg.bookingPrefix} format={cfg.bookingFormat} counter={cfg.bookingCounter}
            onChange={(patch) => setCfg({ ...cfg, ...patch })}
            prefixKey="bookingPrefix" formatKey="bookingFormat" counterKey="bookingCounter"
          />
          <NumberingCard
            title="Proformas / Devis" subtitle="Documents non fiscaux"
            prefix={cfg.proformaPrefix} format={cfg.proformaFormat} counter={cfg.proformaCounter}
            onChange={(patch) => setCfg({ ...cfg, ...patch })}
            prefixKey="proformaPrefix" formatKey="proformaFormat" counterKey="proformaCounter"
          />
        </div>

        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5">
          <label className="flex items-center gap-2 text-[13px] text-slate-700">
            <input type="checkbox" checked={cfg.fiscalYearReset} onChange={(e) => setCfg({ ...cfg, fiscalYearReset: e.target.checked })} className="w-4 h-4 accent-violet-600" />
            <span>Réinitialiser les compteurs au 1<sup>er</sup> janvier (recommandé pour la lisibilité comptable)</span>
          </label>
        </section>

        <Phase2Notice><strong>Phase 2 :</strong> intégration au moteur de facturation France 2026 (e-facture PPF + chronologie immuable).</Phase2Notice>
      </div>
      <SettingsToast message={toast} />
    </div>
  );
};

const NumberingCard: React.FC<{
  title: string;
  subtitle: string;
  prefix: string;
  format: string;
  counter: number;
  lockable?: boolean;
  prefixKey: string;
  formatKey: string;
  counterKey: string;
  onChange: (patch: Record<string, string | number>) => void;
}> = ({ title, subtitle, prefix, format, counter, lockable, prefixKey, formatKey, counterKey, onChange }) => (
  <div className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-4 space-y-3">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[13px] font-semibold text-slate-900">{title}</div>
        <div className="text-[11px] text-slate-500">{subtitle}</div>
      </div>
      {lockable && <Lock className="w-3.5 h-3.5 text-amber-500" />}
    </div>
    <div>
      <label className="block">
        <span className="text-[10.5px] uppercase tracking-wide font-semibold text-slate-500">Préfixe</span>
        <input type="text" value={prefix} onChange={(e) => onChange({ [prefixKey]: e.target.value })}
          className="mt-1 w-full px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono" />
      </label>
    </div>
    <div>
      <label className="block">
        <span className="text-[10.5px] uppercase tracking-wide font-semibold text-slate-500">Format</span>
        <input type="text" value={format} onChange={(e) => onChange({ [formatKey]: e.target.value })}
          className="mt-1 w-full px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px] font-mono" />
      </label>
      <div className="text-[10px] text-slate-400 mt-1">Variables : {'{PREFIX}, {YEAR}, {NUMBER:N}'}</div>
    </div>
    <div>
      <label className="block">
        <span className="text-[10.5px] uppercase tracking-wide font-semibold text-slate-500">Compteur courant</span>
        <input type="number" min={0} value={counter} onChange={(e) => onChange({ [counterKey]: parseInt(e.target.value) || 0 })}
          className="mt-1 w-full px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono tabular-nums" />
      </label>
    </div>
    <div className="rounded-lg bg-violet-50 px-3 py-2 ring-1 ring-violet-100">
      <div className="text-[10.5px] uppercase tracking-wide text-violet-500 font-semibold">Prochain numéro</div>
      <div className="text-[13px] font-mono font-bold text-violet-700">{preview(format, prefix, counter + 1)}</div>
    </div>
  </div>
);
