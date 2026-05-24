/**
 * FLOWTYM — Paramètres · Taxes locales.
 *
 * Page éditable branchée sur useConfigStore.updateTaxes.
 * Trois leviers fiscaux : TVA hébergement, TVA restauration / F&B,
 * taxe de séjour municipale. Toute modification met immédiatement à
 * jour le score Conformité du Control Center (driver "TVA + taxe
 * séjour").
 */
import React, { useEffect, useState } from 'react';
import { Percent, Save, CheckCircle2, AlertCircle, Calculator } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { syncConfigBlobToSupabase, fetchConfigBlobFromSupabase } from '@/src/services/settings/settingsPersistence';

export const LocalTaxesPage: React.FC = () => {
  const stored = useConfigStore((s) => s.taxes);
  const updateTaxes = useConfigStore((s) => s.updateTaxes);

  const [draft, setDraft] = useState(stored);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => { setDraft(stored); }, [stored.hebergement, stored.fb, stored.sejour]);

  // Réconciliation Supabase au mount : si on a une config taxes côté
  // Supabase, on l'applique au configStore (source de vérité).
  useEffect(() => {
    let cancelled = false;
    fetchConfigBlobFromSupabase<typeof stored>('taxes').then((remote) => {
      if (cancelled || !remote) return;
      // N'écrase pas si le local diffère (utilisateur en cours d'édition)
      if (JSON.stringify(remote) !== JSON.stringify(stored)) {
        updateTaxes(remote);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const compliance = (draft.hebergement > 0 ? 35 : 0) + (draft.fb > 0 ? 35 : 0) + (draft.sejour > 0 ? 30 : 0);

  function save() {
    updateTaxes(draft);
    // Sync Supabase best-effort (non bloquant)
    void syncConfigBlobToSupabase('taxes', draft);
    setSavedAt(new Date().toISOString());
    logAudit({ action: 'module_inspected', module: 'finance_billing', detail: `Taxes mises à jour : héb. ${draft.hebergement}% · F&B ${draft.fb}% · séjour ${draft.sejour}€` });
    window.setTimeout(() => setSavedAt(null), 3000);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Établissement</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Taxes locales</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                TVA hébergement et restauration, taxe de séjour municipale.
              </p>
            </div>
          </div>
          <button
            onClick={save}
            disabled={!dirty}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20 disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" /> Enregistrer
          </button>
        </header>

        {/* Bandeau impact conformité */}
        <section className={cn(
          'rounded-2xl ring-1 p-5 flex items-start gap-3',
          compliance >= 80 ? 'ring-emerald-200 bg-emerald-50/60' :
          compliance >= 40 ? 'ring-amber-200 bg-amber-50/60' :
          'ring-rose-200 bg-rose-50/60',
        )}>
          <Calculator className={cn(
            'w-5 h-5 mt-0.5 shrink-0',
            compliance >= 80 ? 'text-emerald-600' : compliance >= 40 ? 'text-amber-600' : 'text-rose-600',
          )} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-slate-900">
              Impact conformité : {compliance}/100
            </div>
            <p className="text-[12.5px] text-slate-700 mt-1">
              Ces 3 paramètres alimentent directement le score Conformité du Control Center.
              Sans TVA configurée, vos factures ne sont pas conformes à la fiscalité française 2026.
            </p>
          </div>
        </section>

        {/* Formulaire */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-6 space-y-5">
          <NumberRow
            label="TVA hébergement"
            description="Taux appliqué aux nuitées (France 2026 : 10%)"
            value={draft.hebergement}
            onChange={(v) => setDraft({ ...draft, hebergement: v })}
            suffix="%"
            min={0}
            max={30}
            step={0.5}
            critical={draft.hebergement === 0}
          />
          <NumberRow
            label="TVA restauration / F&B"
            description="Taux appliqué au petit-déjeuner et à la restauration (France 2026 : 10%)"
            value={draft.fb}
            onChange={(v) => setDraft({ ...draft, fb: v })}
            suffix="%"
            min={0}
            max={30}
            step={0.5}
            critical={draft.fb === 0}
          />
          <NumberRow
            label="Taxe de séjour municipale"
            description="Forfait par nuitée et par personne adulte"
            value={draft.sejour}
            onChange={(v) => setDraft({ ...draft, sejour: v })}
            suffix="€ / nuit / pers."
            min={0}
            max={20}
            step={0.05}
            critical={draft.sejour === 0}
          />
        </section>

        {savedAt && (
          <div className="rounded-xl ring-1 ring-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12.5px] text-emerald-800 font-medium inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Taxes mises à jour
          </div>
        )}
      </div>
    </div>
  );
};

const NumberRow: React.FC<{
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  min: number; max: number; step: number;
  critical?: boolean;
}> = ({ label, description, value, onChange, suffix, min, max, step, critical }) => (
  <div className={cn(
    'flex flex-col md:flex-row md:items-center gap-3 rounded-xl p-4',
    critical ? 'bg-rose-50/40 ring-1 ring-rose-100' : 'bg-slate-50/60 ring-1 ring-slate-100',
  )}>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-slate-900">{label}</span>
        {critical && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
            <AlertCircle className="w-3 h-3" /> Non configuré
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-slate-500 mt-0.5">{description}</p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step}
        className="w-28 px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[14px] font-semibold text-slate-900 text-right tabular-nums focus:ring-2 focus:ring-violet-500 outline-none"
      />
      <span className="text-[12px] text-slate-500 min-w-[100px]">{suffix}</span>
    </div>
  </div>
);
