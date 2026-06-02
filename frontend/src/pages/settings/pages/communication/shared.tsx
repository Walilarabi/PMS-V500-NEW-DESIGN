/**
 * FLOWTYM — Paramètres · Communication — éléments d'UI partagés.
 *
 * Mutualisés par les sous-pages Email / SMS / WhatsApp / Templates /
 * Automatisation / Journal pour une interface premium et cohérente.
 */
import React, { useState } from 'react';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ConnectionStatus } from '@/src/services/communication/communicationSettings.service';

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500';

/** Toast applicatif global (écouté par le Toaster). */
export function commToast(message: string, type: 'success' | 'error' = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

/**
 * Conteneur de page Communication : occupe toute la largeur de l'écran et
 * gère le scroll vertical propre (le `<main>` parent est en overflow-hidden).
 */
export const CommPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 overflow-y-auto bg-slate-50/60">
    <div className="w-full px-6 pt-6 pb-12">{children}</div>
  </div>
);

/** En-tête de section premium, cohérent sur toutes les sous-pages. */
export const CommHeader: React.FC<{ eyebrow: string; title: string; subtitle?: string; icon?: React.ReactNode }> = ({ eyebrow, title, subtitle, icon }) => (
  <div className="mb-6">
    <div className="mb-1 flex items-center gap-2">
      {icon}
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">{eyebrow}</span>
    </div>
    <h1 className="text-2xl font-black text-slate-900">{title}</h1>
    {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
  </div>
);

export const StatusPill: React.FC<{ status?: ConnectionStatus; active?: boolean }> = ({ status, active }) => {
  const s: ConnectionStatus = !active ? 'disconnected' : (status ?? 'disconnected');
  const map: Record<ConnectionStatus, { label: string; cls: string }> = {
    connected: { label: 'Connecté', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    disconnected: { label: 'Non connecté', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
    error: { label: 'Erreur', cls: 'bg-red-50 text-red-700 ring-red-200' },
  };
  const m = map[s];
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1', m.cls)}>{m.label}</span>;
};

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <div>
    <label className="text-xs font-bold text-slate-500">{label}</label>
    <div className="mt-1">{children}</div>
    {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </div>
);

/** Champ secret en écriture seule : affiche "configuré" sans révéler la valeur. */
export const SecretField: React.FC<{
  label: string; present: boolean; onSave: (v: string) => Promise<void>; placeholder?: string;
}> = ({ label, present, onSave, placeholder }) => {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const handle = async () => {
    setSaving(true);
    try { await onSave(value); setValue(''); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    finally { setSaving(false); }
  };
  return (
    <Field label={label} hint={present ? '✓ Secret enregistré (masqué). Saisir une nouvelle valeur pour le remplacer.' : 'Aucun secret enregistré.'}>
      <div className="flex gap-2">
        <input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder ?? (present ? '••••••••' : '')} className={inputCls} autoComplete="new-password" />
        <button onClick={handle} disabled={saving || value.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <KeyRound size={14} />}
          {saved ? 'OK' : 'Enregistrer'}
        </button>
      </div>
    </Field>
  );
};

/** Bandeau "section à venir" — informatif, sans bouton mort. */
export const ComingSoonPanel: React.FC<{ lot: string; title: string; children: React.ReactNode }> = ({ lot, title, children }) => (
  <div className="rounded-3xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center">
    <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-700">{lot}</span>
    <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>
    <div className="mx-auto mt-2 max-w-md text-sm text-slate-500">{children}</div>
  </div>
);
