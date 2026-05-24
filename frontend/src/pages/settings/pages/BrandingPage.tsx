/**
 * FLOWTYM — Paramètres · Branding.
 *
 * Personnalisation visuelle de l'établissement : logo, couleur
 * primaire, signature email, message d'accueil. Persisté en
 * localStorage (préfixe flowtym.branding) — la Phase 2 branchera ces
 * valeurs sur les templates email, la facture PDF et le portail client.
 *
 * Prévisualisation en direct (carte démo + bouton sample) pour valider
 * visuellement avant enregistrement.
 */
import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Palette, CheckCircle2, Mail, FileText, RotateCcw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { useConfigBlob } from '@/src/hooks/settings/useConfigBlob';

interface BrandingConfig {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  emailSignature: string;
  welcomeMessage: string;
  fontStyle: 'modern' | 'classic' | 'editorial';
}

const PRESET_COLORS = [
  '#7C3AED', // violet Flowtym
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // rose
  '#0F172A', // slate
  '#D946EF', // fuchsia
  '#14B8A6', // teal
];

const DEFAULT: BrandingConfig = {
  logoUrl: '',
  primaryColor: '#7C3AED',
  secondaryColor: '#0F172A',
  emailSignature: 'Cordialement,\nL\'équipe de l\'hôtel',
  welcomeMessage: 'Bienvenue dans votre établissement.',
  fontStyle: 'modern',
};

export const BrandingPage: React.FC = () => {
  const hotelName = useConfigStore((s) => s.hotel.name);
  const hotelLogo = useConfigStore((s) => s.hotel.logo);
  const updateHotel = useConfigStore((s) => s.updateHotel);

  // Migration douce ancien localStorage → nouveau namespace.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const legacy = window.localStorage.getItem('flowtym.branding');
    const next = window.localStorage.getItem('flowtym.cfg.branding');
    if (legacy && !next) window.localStorage.setItem('flowtym.cfg.branding', legacy);
  }, []);

  const [cfg, setCfg] = useConfigBlob<BrandingConfig>('branding', DEFAULT);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (hotelLogo && !cfg.logoUrl) setCfg((c) => ({ ...c, logoUrl: hotelLogo }));
  }, [hotelLogo, cfg.logoUrl, setCfg]);

  function update<K extends keyof BrandingConfig>(k: K, v: BrandingConfig[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }

  function handleSave() {
    // useConfigBlob persiste déjà à chaque update — handleSave ne fait
    // plus que propager le logo au store global + journaliser.
    setCfg((c) => c); // force re-sync
    if (cfg.logoUrl !== hotelLogo) updateHotel({ logo: cfg.logoUrl });
    setSavedAt(new Date().toISOString());
    logAudit({ action: 'module_inspected', detail: 'Branding mis à jour' });
    window.setTimeout(() => setSavedAt(null), 3000);
  }

  function reset() {
    setCfg(DEFAULT);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Établissement</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Branding</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Logo, couleurs, signatures email et identité visuelle de l'établissement.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20">
              <Save className="w-3.5 h-3.5" /> Enregistrer
            </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          {/* Éditeur */}
          <div className="space-y-4">
            {/* Logo */}
            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-3">
              <Section title="Logo">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">URL du logo</span>
                  <input
                    type="url"
                    value={cfg.logoUrl}
                    onChange={(e) => update('logoUrl', e.target.value)}
                    placeholder="https://…/logo.png"
                    className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none"
                  />
                </label>
                {cfg.logoUrl ? (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 flex items-center gap-3">
                    <img
                      src={cfg.logoUrl}
                      alt="Logo"
                      className="w-16 h-16 object-contain bg-white rounded-lg ring-1 ring-slate-200"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                    <div className="text-[12px] text-slate-600">
                      Aperçu du logo. Synchronisé avec le profil hôtel.
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 text-[12px] text-slate-500">
                    Aucun logo défini.
                  </div>
                )}
              </Section>
            </section>

            {/* Couleurs */}
            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-4">
              <Section title="Couleur primaire">
                <p className="text-[12px] text-slate-500 mb-2">
                  Utilisée pour les actions principales, badges et accents. Le violet Flowtym par défaut.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => update('primaryColor', c)}
                      className={cn(
                        'w-9 h-9 rounded-xl ring-1 ring-slate-200 transition-all',
                        cfg.primaryColor === c && 'ring-2 ring-offset-2 ring-violet-500 scale-110',
                      )}
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={cfg.primaryColor}
                    onChange={(e) => update('primaryColor', e.target.value)}
                    className="w-9 h-9 rounded-xl ring-1 ring-slate-200 cursor-pointer overflow-hidden"
                  />
                  <code className="ml-2 text-[11px] font-mono text-slate-500">{cfg.primaryColor}</code>
                </div>
              </Section>

              <Section title="Couleur secondaire">
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={`s-${c}`}
                      onClick={() => update('secondaryColor', c)}
                      className={cn(
                        'w-9 h-9 rounded-xl ring-1 ring-slate-200 transition-all',
                        cfg.secondaryColor === c && 'ring-2 ring-offset-2 ring-slate-700 scale-110',
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={cfg.secondaryColor}
                    onChange={(e) => update('secondaryColor', e.target.value)}
                    className="w-9 h-9 rounded-xl ring-1 ring-slate-200 cursor-pointer overflow-hidden"
                  />
                  <code className="ml-2 text-[11px] font-mono text-slate-500">{cfg.secondaryColor}</code>
                </div>
              </Section>
            </section>

            {/* Style typographique */}
            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5">
              <Section title="Style typographique">
                <div className="grid grid-cols-3 gap-2">
                  {(['modern', 'classic', 'editorial'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => update('fontStyle', s)}
                      className={cn(
                        'px-3 py-3 rounded-xl ring-1 text-center transition-all',
                        cfg.fontStyle === s
                          ? 'ring-violet-300 bg-violet-50/60'
                          : 'ring-slate-200 bg-white hover:ring-slate-300',
                      )}
                    >
                      <div className="text-[14px] font-semibold text-slate-900 capitalize">{s}</div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">
                        {s === 'modern' && 'Sans-serif, neutre'}
                        {s === 'classic' && 'Serif élégant'}
                        {s === 'editorial' && 'Display, magazine'}
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
            </section>

            {/* Signatures */}
            <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-4">
              <Section title="Signature email">
                <textarea
                  value={cfg.emailSignature}
                  onChange={(e) => update('emailSignature', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none resize-none"
                />
              </Section>
              <Section title="Message d'accueil">
                <textarea
                  value={cfg.welcomeMessage}
                  onChange={(e) => update('welcomeMessage', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none resize-none"
                />
              </Section>
            </section>
          </div>

          {/* Prévisualisation */}
          <aside className="space-y-4 lg:sticky lg:top-6 self-start">
            <div className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-violet-500" />
                <h3 className="text-[12px] font-semibold text-slate-900">Prévisualisation</h3>
              </div>
              {/* Header preview */}
              <div className="p-5" style={{ background: cfg.primaryColor }}>
                <div className="flex items-center gap-3">
                  {cfg.logoUrl && (
                    <img src={cfg.logoUrl} alt="" className="w-9 h-9 object-contain bg-white/95 rounded-lg p-1" />
                  )}
                  <div className="min-w-0">
                    <div className="text-white text-[13px] font-bold truncate">{hotelName || 'Mon Hôtel'}</div>
                    <div className="text-white/70 text-[10.5px]">Branding en direct</div>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div className="rounded-xl p-3 text-[12px]" style={{ background: cfg.secondaryColor, color: 'white' }}>
                  Bandeau secondaire — couleur {cfg.secondaryColor}.
                </div>
                <button
                  className="w-full px-3 py-2 rounded-lg text-[12px] font-medium text-white"
                  style={{ background: cfg.primaryColor }}
                >
                  Action principale
                </button>
                <div className="p-3 rounded-lg bg-slate-50 text-[12px] text-slate-600">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 mb-1.5">
                    <Mail className="w-3 h-3" /> Signature email
                  </div>
                  <pre className="whitespace-pre-wrap text-[11px] text-slate-600 font-sans">{cfg.emailSignature}</pre>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 text-[12px] text-slate-600">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 mb-1.5">
                    <FileText className="w-3 h-3" /> Message d'accueil
                  </div>
                  <p className="text-[12px] italic text-slate-700">{cfg.welcomeMessage}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800">
              <strong>Phase 2 :</strong> ces valeurs alimenteront automatiquement les templates email,
              les factures PDF, le portail client et l'écran de check-in.
            </div>
          </aside>
        </div>

        {savedAt && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Branding enregistré
          </div>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-2">{title}</div>
    {children}
  </div>
);
