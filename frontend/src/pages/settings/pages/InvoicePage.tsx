/**
 * FLOWTYM — Paramètres · Facture (mentions, footer, pied de page).
 */
import React, { useEffect, useState } from 'react';
import { Receipt, Save, CheckCircle2, FileText } from 'lucide-react';
import { useConfigStore } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { SettingsPageHeader, SettingsToast, Phase2Notice } from './_common';

const STORAGE_KEY = 'flowtym.invoice.config';

interface InvoiceConfig {
  legalMentions: string;
  paymentTerms: string;
  footerText: string;
  showLogo: boolean;
  showBankDetails: boolean;
  bankIban: string;
  bankBic: string;
  language: 'fr' | 'en';
  signatureName: string;
}

const DEFAULT: InvoiceConfig = {
  legalMentions: 'TVA intracom : FR76123456789\nSIRET : 12345678900012\nRCS Paris B 123 456 789',
  paymentTerms: 'Paiement à réception. Pénalités de retard : taux légal en vigueur.',
  footerText: 'Merci de votre confiance et au plaisir de vous accueillir à nouveau.',
  showLogo: true,
  showBankDetails: true,
  bankIban: 'FR76 1234 5678 9012 3456 7890 123',
  bankBic: 'BNPAFRPPXXX',
  language: 'fr',
  signatureName: 'Le Directeur',
};

function load(): InvoiceConfig {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT; } catch { return DEFAULT; }
}
function save(c: InvoiceConfig) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); }

export const InvoicePage: React.FC = () => {
  const hotelName = useConfigStore((s) => s.hotel.name);
  const [cfg, setCfg] = useState<InvoiceConfig>(() => load());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { save(cfg); }, [cfg]);

  function handleSave() {
    save(cfg);
    logAudit({ action: 'module_inspected', module: 'finance_billing', detail: 'Paramètres facture mis à jour' });
    setToast('Paramètres enregistrés');
    window.setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <SettingsPageHeader
          icon={Receipt}
          category="Finance & Facturation"
          title="Paramètres facture"
          description="Mentions légales, pied de page, coordonnées bancaires et options d'affichage."
          action={
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Enregistrer
            </button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-4">
            <Field label="Mentions légales" hint="SIRET, TVA intracom, RCS — affichées en bas de facture">
              <textarea value={cfg.legalMentions} onChange={(e) => setCfg({ ...cfg, legalMentions: e.target.value })} rows={4}
                className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono focus:ring-violet-500 outline-none resize-y" />
            </Field>
            <Field label="Conditions de paiement">
              <textarea value={cfg.paymentTerms} onChange={(e) => setCfg({ ...cfg, paymentTerms: e.target.value })} rows={3}
                className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none resize-y" />
            </Field>
            <Field label="Texte de bas de facture">
              <textarea value={cfg.footerText} onChange={(e) => setCfg({ ...cfg, footerText: e.target.value })} rows={2}
                className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none resize-y" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IBAN">
                <input type="text" value={cfg.bankIban} onChange={(e) => setCfg({ ...cfg, bankIban: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono focus:ring-violet-500 outline-none" />
              </Field>
              <Field label="BIC">
                <input type="text" value={cfg.bankBic} onChange={(e) => setCfg({ ...cfg, bankBic: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono focus:ring-violet-500 outline-none" />
              </Field>
              <Field label="Langue par défaut">
                <select value={cfg.language} onChange={(e) => setCfg({ ...cfg, language: e.target.value as 'fr' | 'en' })}
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px]">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="Signature">
                <input type="text" value={cfg.signatureName} onChange={(e) => setCfg({ ...cfg, signatureName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-[13px] text-slate-700">
                <input type="checkbox" checked={cfg.showLogo} onChange={(e) => setCfg({ ...cfg, showLogo: e.target.checked })} className="w-4 h-4 accent-violet-600" />
                Afficher le logo
              </label>
              <label className="flex items-center gap-2 text-[13px] text-slate-700">
                <input type="checkbox" checked={cfg.showBankDetails} onChange={(e) => setCfg({ ...cfg, showBankDetails: e.target.checked })} className="w-4 h-4 accent-violet-600" />
                Afficher RIB
              </label>
            </div>
          </section>

          {/* Aperçu */}
          <aside className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden self-start">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-[12px] font-semibold text-slate-900">Aperçu</span>
            </div>
            <div className="p-5 text-[10px] text-slate-700 space-y-3">
              <div className="font-bold text-[14px] text-slate-900">{hotelName || 'Hôtel'}</div>
              <div className="text-[9px] text-slate-500 whitespace-pre-line border-b pb-2">
                {cfg.legalMentions}
              </div>
              <div className="text-[10px]">FACTURE Nº 2026-0042 — du 15/06/2026</div>
              <div className="border-t pt-2 text-[9px] text-slate-600 whitespace-pre-line">
                {cfg.paymentTerms}
              </div>
              {cfg.showBankDetails && (
                <div className="border-t pt-2 text-[9px] text-slate-600">
                  <div>IBAN : <span className="font-mono">{cfg.bankIban}</span></div>
                  <div>BIC : <span className="font-mono">{cfg.bankBic}</span></div>
                </div>
              )}
              <div className="border-t pt-2 italic text-[9px] text-slate-500">{cfg.footerText}</div>
              <div className="text-right text-[10px] mt-3">— {cfg.signatureName}</div>
            </div>
          </aside>
        </div>

        <Phase2Notice><strong>Phase 2 :</strong> rendu réel des factures PDF + intégration au workflow de facturation Facturation X.</Phase2Notice>
      </div>
      <SettingsToast message={toast} />
    </div>
  );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</span>
    {hint && <span className="ml-2 text-[10px] text-slate-400 normal-case font-normal">{hint}</span>}
    <div className="mt-1.5">{children}</div>
  </label>
);
