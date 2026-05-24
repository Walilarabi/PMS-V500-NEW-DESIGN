/**
 * FLOWTYM — Paramètres · Informations hôtel.
 *
 * Vraie page éditable branchée sur useConfigStore.updateHotel.
 * Toute saisie est validée à la volée (zod-like inline) et alimente
 * automatiquement le moteur de diagnostic du Control Center
 * (les drivers "Profil hôtel" se mettent à jour en temps réel).
 *
 * Persistance : Zustand persisté → localStorage. Phase 2 ajoutera la
 * synchronisation Supabase + RBAC.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Hotel, Save, Sparkles, AlertCircle, Building2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore } from '@/src/store/configStore';
import type { PageId } from '@/src/types';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { usePagePermission } from '@/src/services/settings/permissionsService';

interface HotelInfoPageProps {
  onNavigate: (page: PageId) => void;
}

interface ValidationIssue {
  field: string;
  message: string;
}

const STARS_OPTIONS = [0, 1, 2, 3, 4, 5];
const COUNTRIES = [
  { code: 'FR', label: 'France' },
  { code: 'BE', label: 'Belgique' },
  { code: 'CH', label: 'Suisse' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'MC', label: 'Monaco' },
  { code: 'IT', label: 'Italie' },
  { code: 'ES', label: 'Espagne' },
  { code: 'DE', label: 'Allemagne' },
  { code: 'GB', label: 'Royaume-Uni' },
  { code: 'US', label: 'États-Unis' },
];

export const HotelInfoPage: React.FC<HotelInfoPageProps> = ({ onNavigate }) => {
  const stored = useConfigStore((s) => s.hotel);
  const updateHotel = useConfigStore((s) => s.updateHotel);

  const [draft, setDraft] = useState(stored);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const { canRead, canWrite, DeniedBanner } = usePagePermission('set_hotel');

  // Si le store change ailleurs (réseau, autre onglet), on resynchronise
  useEffect(() => { setDraft(stored); }, [stored.name, stored.email]);

  const issues = useMemo<ValidationIssue[]>(() => {
    const out: ValidationIssue[] = [];
    if (!draft.name.trim()) out.push({ field: 'name', message: 'Le nom commercial est requis.' });
    if (draft.email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(draft.email))
      out.push({ field: 'email', message: 'Format email invalide.' });
    if (draft.zip && !/^\d{4,5}$/.test(draft.zip))
      out.push({ field: 'zip', message: 'Code postal : 4-5 chiffres attendus.' });
    if (draft.phone && draft.phone.replace(/[^\d+]/g, '').length < 8)
      out.push({ field: 'phone', message: 'Téléphone trop court.' });
    return out;
  }, [draft]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(stored),
    [draft, stored],
  );

  const completionScore = useMemo(() => {
    const fields = [draft.name, draft.address, draft.city, draft.zip, draft.country, draft.phone, draft.email];
    const filled = fields.filter((f) => f && String(f).trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [draft]);

  function set<K extends keyof typeof draft>(key: K, value: typeof draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSave() {
    if (issues.length > 0) return;
    updateHotel(draft);
    setSavedAt(new Date().toISOString());
    logAudit({ action: 'module_inspected', detail: `Profil hôtel mis à jour : ${draft.name}` });
    window.setTimeout(() => setSavedAt(null), 3000);
  }

  function handleReset() {
    setDraft(stored);
  }

  if (!canRead) return <DeniedBanner />;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Hotel className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                <Building2 className="w-3 h-3" /> Établissement
              </div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Informations hôtel</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Identité commerciale, coordonnées légales et profil de l'établissement.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={!dirty}
              className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              onClick={() => canWrite && handleSave()}
              disabled={!dirty || issues.length > 0 || !canWrite}
              title={!canWrite ? 'Permission requise : set_hotel (write)' : undefined}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" /> Enregistrer
            </button>
          </div>
        </header>

        {/* ─── Bandeau état ─────────────────────────────────────────────── */}
        <div className="grid gap-3 md:grid-cols-3">
          <StatusTile
            label="Score de complétude"
            value={`${completionScore}%`}
            caption="7 champs critiques"
            tone={completionScore >= 90 ? 'good' : completionScore >= 60 ? 'attention' : 'critical'}
            icon={<Sparkles className="w-4 h-4" />}
          />
          <StatusTile
            label="Validation"
            value={issues.length === 0 ? 'OK' : `${issues.length} erreur${issues.length > 1 ? 's' : ''}`}
            caption={issues.length === 0 ? 'Aucune erreur de format' : 'Corriger avant sauvegarde'}
            tone={issues.length === 0 ? 'good' : 'critical'}
            icon={issues.length === 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          />
          <StatusTile
            label="Dernière sauvegarde"
            value={savedAt ? new Date(savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
            caption={dirty ? 'Modifications non enregistrées' : 'Synchronisé'}
            tone={dirty ? 'attention' : 'good'}
            icon={<Save className="w-4 h-4" />}
          />
        </div>

        {/* ─── Formulaire ───────────────────────────────────────────────── */}
        <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-6 space-y-6">
          <Section title="Identité commerciale">
            <Grid cols={2}>
              <Field label="Nom commercial" required error={fieldErr(issues, 'name')}>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="input"
                  placeholder="Ex. Hôtel Paris Centre"
                />
              </Field>
              <Field label="Classement hôtelier">
                <select
                  value={draft.stars}
                  onChange={(e) => set('stars', parseInt(e.target.value, 10))}
                  className="input"
                >
                  {STARS_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n === 0 ? 'Non classé' : `${n} étoile${n > 1 ? 's' : ''}`}</option>
                  ))}
                </select>
              </Field>
            </Grid>
          </Section>

          <Section title="Adresse">
            <Grid cols={1}>
              <Field label="Adresse complète">
                <input
                  type="text"
                  value={draft.address}
                  onChange={(e) => set('address', e.target.value)}
                  className="input"
                  placeholder="1 avenue des Champs-Élysées"
                />
              </Field>
            </Grid>
            <Grid cols={3}>
              <Field label="Code postal" error={fieldErr(issues, 'zip')}>
                <input
                  type="text"
                  value={draft.zip}
                  onChange={(e) => set('zip', e.target.value)}
                  className="input"
                  placeholder="75001"
                />
              </Field>
              <Field label="Ville">
                <input
                  type="text"
                  value={draft.city}
                  onChange={(e) => set('city', e.target.value)}
                  className="input"
                  placeholder="Paris"
                />
              </Field>
              <Field label="Pays">
                <select
                  value={draft.country}
                  onChange={(e) => set('country', e.target.value)}
                  className="input"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </Field>
            </Grid>
          </Section>

          <Section title="Contact">
            <Grid cols={2}>
              <Field label="Email hôtel" error={fieldErr(issues, 'email')}>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="input"
                  placeholder="contact@hotel.fr"
                />
              </Field>
              <Field label="Téléphone" error={fieldErr(issues, 'phone')}>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className="input"
                  placeholder="+33 1 23 45 67 89"
                />
              </Field>
            </Grid>
          </Section>

          <Section title="Logo & branding">
            <Grid cols={1}>
              <Field label="URL du logo">
                <input
                  type="url"
                  value={draft.logo}
                  onChange={(e) => set('logo', e.target.value)}
                  className="input"
                  placeholder="https://…/logo.png"
                />
              </Field>
            </Grid>
            <div className="flex items-center justify-between rounded-xl bg-violet-50/40 ring-1 ring-violet-100 px-4 py-3 text-[12.5px]">
              <span className="text-slate-700">
                Personnalisation complète du branding (couleurs, typo, signatures email)
              </span>
              <button
                onClick={() => onNavigate('settings_branding' as PageId)}
                className="text-violet-700 hover:underline font-medium"
              >
                Aller au branding →
              </button>
            </div>
          </Section>
        </section>

        {/* ─── Erreurs détaillées ───────────────────────────────────────── */}
        {issues.length > 0 && (
          <section className="rounded-2xl ring-1 ring-rose-200 bg-rose-50/60 p-4">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-rose-800 mb-2">
              <AlertCircle className="w-4 h-4" /> {issues.length} erreur{issues.length > 1 ? 's' : ''} de validation
            </div>
            <ul className="space-y-1 text-[12px] text-rose-700">
              {issues.map((i) => (
                <li key={i.field}>• {i.message}</li>
              ))}
            </ul>
          </section>
        )}

        {savedAt && (
          <div className="rounded-xl ring-1 ring-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12.5px] text-emerald-800 font-medium inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Profil hôtel mis à jour
          </div>
        )}

        <style>{`
          .input {
            width: 100%; padding: 0.625rem 0.75rem; border-radius: 0.625rem;
            background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
            outline: none; font-size: 13px; color: #0f172a;
          }
          .input:focus { box-shadow: inset 0 0 0 2px #7c3aed; }
        `}</style>
      </div>
    </div>
  );
};

// ─── Helpers UI ──────────────────────────────────────────────────────────

function fieldErr(issues: ValidationIssue[], key: string): string | undefined {
  return issues.find((i) => i.field === key)?.message;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-3">{title}</h3>
    <div className="space-y-3">{children}</div>
  </div>
);

const Grid: React.FC<{ cols: 1 | 2 | 3; children: React.ReactNode }> = ({ cols, children }) => (
  <div
    className={cn(
      'grid gap-3',
      cols === 1 && 'grid-cols-1',
      cols === 2 && 'grid-cols-1 md:grid-cols-2',
      cols === 3 && 'grid-cols-1 md:grid-cols-3',
    )}
  >
    {children}
  </div>
);

const Field: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, error, children }) => (
  <label className="block">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</span>
      {required && <span className="text-rose-500 text-[11px]">*</span>}
    </div>
    {children}
    {error && <div className="mt-1 text-[11px] text-rose-600">{error}</div>}
  </label>
);

const StatusTile: React.FC<{
  label: string;
  value: string;
  caption: string;
  tone: 'good' | 'attention' | 'critical';
  icon: React.ReactNode;
}> = ({ label, value, caption, tone, icon }) => {
  const palette =
    tone === 'good' ? { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-100' } :
    tone === 'attention' ? { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-100' } :
    { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-100' };
  return (
    <div className={cn('rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4')}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center ring-1 ring-inset', palette.bg, palette.ring, palette.text)}>
          {icon}
        </div>
      </div>
      <div className={cn('text-[18px] font-bold tabular-nums mt-2', palette.text)}>{value}</div>
      <div className="text-[12px] font-medium text-slate-900">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{caption}</div>
    </div>
  );
};
