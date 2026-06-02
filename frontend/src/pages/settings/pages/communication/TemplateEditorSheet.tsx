/**
 * FLOWTYM — Paramètres · Communication · Éditeur de modèle (slide-over).
 *
 * Compose / modifie un modèle propre à l'hôtel : objet (email), corps avec
 * insertion de variables, aperçu live, et paramétrage d'envoi (type =
 * déclencheur, langue, activation). Persistance Supabase via le service.
 */
import React, { useMemo, useRef, useState } from 'react';
import { X, Save, Loader2, Eye, Mail, MessageCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  createTemplate, updateTemplate, fillTemplate,
  TEMPLATE_KINDS, TEMPLATE_KIND_META,
  type CommTemplate, type TemplateChannel, type TemplateKind,
} from '@/src/services/communication/templates';
import { KindIcon } from './templateIcons';
import { Field, inputCls, commToast } from './shared';

/** Variables insérables — alignées sur fillTemplate / l'edge function. */
const VARIABLES: { key: string; label: string }[] = [
  { key: 'guest', label: 'Client' },
  { key: 'room', label: 'Chambre' },
  { key: 'reservation', label: 'Réservation' },
  { key: 'checkin', label: 'Arrivée' },
  { key: 'checkout', label: 'Départ' },
  { key: 'hotel', label: 'Hôtel' },
];

/** Aperçu : valeurs d'exemple pour rendre les variables. */
const PREVIEW_VARS = {
  guest: 'Marie Dupont', room: '204', reservation: 'RSV-10428',
  checkin: '12 juin 2026', checkout: '15 juin 2026', hotel: 'Hôtel Opéra',
};

interface Props {
  channel: TemplateChannel;
  /** Modèle à éditer, ou seed (depuis la bibliothèque) pour une création. */
  template: CommTemplate | null;
  /** true : on crée (même si `template` fourni comme seed de bibliothèque). */
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const TemplateEditorSheet: React.FC<Props> = ({ channel, template, isNew, onClose, onSaved }) => {
  const [name, setName] = useState(template?.label ?? '');
  const [kind, setKind] = useState<TemplateKind>(template?.kind ?? 'free');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [language, setLanguage] = useState(template?.language ?? 'fr');
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const isEmail = channel === 'email';
  const canSave = name.trim().length > 0 && body.trim().length > 0;

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    if (!el) { setBody((b) => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const previewSubject = useMemo(() => fillTemplate(subject, PREVIEW_VARS), [subject]);
  const previewBody = useMemo(() => fillTemplate(body, PREVIEW_VARS), [body]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        channel, kind, name: name.trim(),
        subject: isEmail ? subject.trim() : null,
        body, language, is_active: isActive,
      };
      if (isNew || !template?.isCustom || !template.id) {
        await createTemplate(payload);
        commToast('Modèle créé.');
      } else {
        await updateTemplate(template.id, payload);
        commToast('Modèle mis à jour.');
      }
      onSaved();
    } catch (e) {
      commToast((e as Error)?.message ?? 'Échec de l\'enregistrement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const chipCls = isEmail
    ? 'bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100'
    : 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100';

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-screen w-full max-w-[920px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <header className={cn('flex items-center gap-3 px-5 py-4 text-white', isEmail ? 'bg-violet-600' : 'bg-emerald-600')}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <KindIcon kind={kind} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              {isEmail ? <span className="inline-flex items-center gap-1"><Mail size={11} /> Email</span> : <span className="inline-flex items-center gap-1"><MessageCircle size={11} /> WhatsApp</span>}
            </p>
            <h2 className="truncate text-base font-bold">{isNew ? 'Nouveau modèle' : 'Modifier le modèle'}</h2>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
        </header>

        {/* Body — 2 colonnes : édition + aperçu */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-6 p-5 lg:grid-cols-2">
            {/* Colonne édition */}
            <div className="space-y-5">
              <Field label="Nom du modèle" hint="Visible uniquement en interne.">
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="ex : Confirmation séjour affaires" />
              </Field>

              <Field label="Objet" hint={isEmail ? undefined : 'WhatsApp n\'utilise pas d\'objet.'}>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={cn(inputCls, !isEmail && 'cursor-not-allowed bg-slate-50 text-slate-400')}
                  placeholder="Objet de l'email"
                  disabled={!isEmail}
                />
              </Field>

              <Field label="Message">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className={cn('rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 transition-colors', chipCls)}
                    >
                      + {v.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={11}
                  className={cn(inputCls, 'resize-y font-medium leading-relaxed')}
                  placeholder="Bonjour {{guest}}, …"
                />
              </Field>

              {/* Paramétrage d'envoi */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Paramétrage d'envoi</p>
                <div className="space-y-4">
                  <Field label="Type / déclencheur" hint={TEMPLATE_KIND_META[kind].trigger}>
                    <select value={kind} onChange={(e) => setKind(e.target.value as TemplateKind)} className={inputCls}>
                      {TEMPLATE_KINDS.map((k) => (
                        <option key={k} value={k}>{TEMPLATE_KIND_META[k].label}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Langue">
                      <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="de">Deutsch</option>
                        <option value="it">Italiano</option>
                      </select>
                    </Field>
                    <label className="flex cursor-pointer select-none items-center gap-2 self-end pb-2.5 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className={cn('h-4 w-4 rounded', isEmail ? 'text-violet-600' : 'text-emerald-600')} />
                      Modèle actif
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne aperçu */}
            <div>
              <div className="sticky top-0">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400"><Eye size={13} /> Aperçu</p>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className={cn('px-4 py-2.5 text-xs font-semibold text-white', isEmail ? 'bg-violet-500' : 'bg-emerald-500')}>
                    {isEmail ? (previewSubject || 'Objet de l\'email') : 'WhatsApp'}
                  </div>
                  <div className="whitespace-pre-line px-4 py-4 text-sm leading-relaxed text-slate-700 min-h-[200px]">
                    {previewBody || <span className="text-slate-300">Le message s'affichera ici…</span>}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Les variables sont remplacées par des valeurs d'exemple.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100">Annuler</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={cn('inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40', isEmail ? 'bg-violet-600 shadow-violet-200' : 'bg-emerald-600 shadow-emerald-200')}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isNew ? 'Créer le modèle' : 'Enregistrer'}
          </button>
        </footer>
      </aside>
    </div>
  );
};

export default TemplateEditorSheet;
