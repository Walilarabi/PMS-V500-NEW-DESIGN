import React, { useState, useCallback } from 'react';
import {
  Send, Plus, Trash2, Paperclip, Info, Loader2, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/Button';
import { useCreateTicket } from '@/src/services/support/hooks';
import {
  collectBrowserInfo,
  type TicketPriority,
  type CreateTicketInput,
} from '@/src/services/support/support.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULES = [
  'Flowday', 'SAS', 'Réservations', 'Clients', 'Revenue',
  'Finance', 'Analyse', 'Paramètres', 'Planning', 'Calendrier tarifaire', 'Autre',
];

const PROBLEM_TYPES = [
  { value: 'bouton_inactif',         label: 'Bouton inactif' },
  { value: 'erreur_affichee',        label: 'Erreur affichée' },
  { value: 'donnee_incorrecte',      label: 'Donnée incorrecte' },
  { value: 'probleme_affichage',     label: 'Problème d\'affichage' },
  { value: 'lenteur',                label: 'Lenteur' },
  { value: 'fonctionnalite_manquante', label: 'Fonctionnalité manquante' },
  { value: 'incoherence_metier',     label: 'Incohérence métier' },
  { value: 'autre',                  label: 'Autre' },
];

const PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'bloquant', label: 'Bloquant',  color: 'bg-red-50 text-red-600 border-red-200 data-[sel=true]:bg-red-600 data-[sel=true]:text-white data-[sel=true]:border-red-600' },
  { value: 'eleve',    label: 'Élevé',     color: 'bg-orange-50 text-orange-600 border-orange-200 data-[sel=true]:bg-orange-500 data-[sel=true]:text-white data-[sel=true]:border-orange-500' },
  { value: 'moyen',    label: 'Moyen',     color: 'bg-amber-50 text-amber-600 border-amber-200 data-[sel=true]:bg-amber-500 data-[sel=true]:text-white data-[sel=true]:border-amber-500' },
  { value: 'faible',   label: 'Faible',    color: 'bg-gray-50 text-gray-500 border-gray-200 data-[sel=true]:bg-gray-500 data-[sel=true]:text-white data-[sel=true]:border-gray-500' },
];

// ─── Field wrapper ────────────────────────────────────────────────────────────

const Field = ({
  label, required, hint, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
      {label}
      {required && <span className="text-red-400">*</span>}
      {hint && (
        <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-gray-400">{hint}</span>
      )}
    </label>
    {children}
  </div>
);

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-colors';
const selectCls = inputCls + ' appearance-none cursor-pointer';

// ─── Component ───────────────────────────────────────────────────────────────

interface TicketFormProps {
  hotelId: string;
  userEmail?: string;
  userRole?: string;
  currentModule?: string;
  currentPage?: string;
  relatedEntityId?: string;
  onSuccess?: () => void;
}

export const TicketForm: React.FC<TicketFormProps> = ({
  hotelId, userEmail, userRole, currentModule, currentPage, relatedEntityId, onSuccess,
}) => {
  const createMutation = useCreateTicket();
  const [submitted, setSubmitted] = useState(false);

  const [module,         setModule]         = useState('');
  const [feature,        setFeature]        = useState('');
  const [problemType,    setProblemType]    = useState('');
  const [description,    setDescription]   = useState('');
  const [steps,          setSteps]          = useState<string[]>(['', '', '']);
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult,   setActualResult]   = useState('');
  const [priority,       setPriority]       = useState<TicketPriority>('moyen');
  const [attachmentUrl,  setAttachmentUrl]  = useState('');
  const [errors,         setErrors]         = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!module)       e.module       = 'Sélectionnez un module';
    if (!feature.trim()) e.feature    = 'Indiquez la fonctionnalité';
    if (!problemType)  e.problemType  = 'Sélectionnez le type de problème';
    if (!description.trim()) e.description = 'Décrivez le problème';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [module, feature, problemType, description]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const input: CreateTicketInput = {
      hotel_id:          hotelId,
      module,
      feature:           feature.trim(),
      problem_type:      problemType,
      description:       description.trim(),
      steps:             steps.filter(s => s.trim()),
      expected_result:   expectedResult.trim() || undefined,
      actual_result:     actualResult.trim() || undefined,
      priority,
      attachment_url:    attachmentUrl.trim() || undefined,
      user_email:        userEmail,
      user_role:         userRole,
      current_module:    currentModule,
      current_page:      currentPage,
      browser_info:      collectBrowserInfo(),
      related_entity_id: relatedEntityId,
    };

    await createMutation.mutateAsync(input);
    setSubmitted(true);
    onSuccess?.();
  }, [validate, hotelId, module, feature, problemType, description, steps, expectedResult, actualResult, priority, attachmentUrl, userEmail, userRole, currentModule, currentPage, relatedEntityId, createMutation, onSuccess]);

  const addStep = () => setSteps(s => [...s, '']);
  const removeStep = (i: number) => setSteps(s => s.filter((_, idx) => idx !== i));
  const updateStep = (i: number, v: string) => setSteps(s => s.map((x, idx) => idx === i ? v : x));

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Ticket envoyé</h3>
          <p className="text-sm text-gray-400 mt-1">Votre demande a été enregistrée. Vous pouvez suivre son avancement dans le tableau ci-dessous.</p>
        </div>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-2 text-[13px] font-semibold text-[#8B5CF6] hover:underline"
        >
          Signaler un autre problème
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Row 1 : module + feature */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Module concerné" required>
          <select
            className={cn(selectCls, errors.module && 'border-red-300 ring-2 ring-red-100')}
            value={module}
            onChange={e => { setModule(e.target.value); setErrors(er => ({ ...er, module: '' })); }}
          >
            <option value="">Sélectionner…</option>
            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {errors.module && <p className="text-[11px] text-red-500 mt-1">{errors.module}</p>}
        </Field>

        <Field label="Fonctionnalité" required>
          <input
            className={cn(inputCls, errors.feature && 'border-red-300 ring-2 ring-red-100')}
            placeholder="ex : création réservation, fiche client…"
            value={feature}
            onChange={e => { setFeature(e.target.value); setErrors(er => ({ ...er, feature: '' })); }}
          />
          {errors.feature && <p className="text-[11px] text-red-500 mt-1">{errors.feature}</p>}
        </Field>
      </div>

      {/* Row 2 : type + priorité */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Type de problème" required>
          <select
            className={cn(selectCls, errors.problemType && 'border-red-300 ring-2 ring-red-100')}
            value={problemType}
            onChange={e => { setProblemType(e.target.value); setErrors(er => ({ ...er, problemType: '' })); }}
          >
            <option value="">Sélectionner…</option>
            {PROBLEM_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {errors.problemType && <p className="text-[11px] text-red-500 mt-1">{errors.problemType}</p>}
        </Field>

        <Field label="Priorité">
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                type="button"
                data-sel={priority === p.value ? 'true' : 'false'}
                onClick={() => setPriority(p.value)}
                className={cn(
                  'flex-1 py-2 rounded-xl border text-[11px] font-bold transition-colors',
                  p.color,
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* Description */}
      <Field label="Description courte" required hint={`${description.length}/500`}>
        <textarea
          className={cn(inputCls, 'resize-none h-20', errors.description && 'border-red-300 ring-2 ring-red-100')}
          placeholder="Expliquez le problème en quelques mots…"
          maxLength={500}
          value={description}
          onChange={e => { setDescription(e.target.value); setErrors(er => ({ ...er, description: '' })); }}
        />
        {errors.description && <p className="text-[11px] text-red-500 mt-1">{errors.description}</p>}
      </Field>

      {/* Étapes */}
      <Field label="Étapes pour reproduire">
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <input
                className={cn(inputCls, 'flex-1')}
                placeholder={`Étape ${i + 1}…`}
                value={step}
                onChange={e => updateStep(i, e.target.value)}
              />
              {steps.length > 1 && (
                <button type="button" onClick={() => removeStep(i)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {steps.length < 8 && (
            <button type="button" onClick={addStep} className="flex items-center gap-1.5 text-[12px] text-[#8B5CF6] font-semibold hover:underline">
              <Plus size={13} /> Ajouter une étape
            </button>
          )}
        </div>
      </Field>

      {/* Résultats attendu / obtenu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Résultat attendu">
          <textarea
            className={cn(inputCls, 'resize-none h-20')}
            placeholder="Ce qui devrait se passer…"
            value={expectedResult}
            onChange={e => setExpectedResult(e.target.value)}
          />
        </Field>
        <Field label="Résultat obtenu">
          <textarea
            className={cn(inputCls, 'resize-none h-20')}
            placeholder="Ce qui se passe réellement…"
            value={actualResult}
            onChange={e => setActualResult(e.target.value)}
          />
        </Field>
      </div>

      {/* Pièce jointe */}
      <Field label="Capture d'écran / pièce jointe">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-100 mb-2">
          <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-[12px] text-blue-600 leading-relaxed">
            Ajoutez une capture <strong>uniquement si le problème n'est pas compréhensible</strong> avec les informations ci-dessus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Paperclip size={14} className="text-gray-300 shrink-0" />
          <input
            className={cn(inputCls, 'flex-1')}
            placeholder="URL de l'image (optionnel)…"
            value={attachmentUrl}
            onChange={e => setAttachmentUrl(e.target.value)}
          />
        </div>
      </Field>

      {/* Contexte auto */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Données techniques collectées automatiquement</p>
        <div className="flex flex-wrap gap-2">
          {[
            userEmail && `Utilisateur : ${userEmail}`,
            currentModule && `Module : ${currentModule}`,
            currentPage && `Page : ${currentPage}`,
            `Navigateur : ${navigator.userAgent.split(' ').slice(-2).join(' ')}`,
            `Écran : ${window.screen.width}×${window.screen.height}`,
            relatedEntityId && `Entité liée : ${relatedEntityId}`,
          ].filter(Boolean).map((item, i) => (
            <span key={i} className="text-[11px] font-medium text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">{item}</span>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="gap-2 shadow-lg shadow-[#8B5CF6]/20"
        >
          {createMutation.isPending
            ? <><Loader2 size={15} className="animate-spin" /> Envoi en cours…</>
            : <><Send size={15} /> Envoyer le ticket</>}
        </Button>
      </div>

      {createMutation.isError && (
        <p className="text-sm text-red-500 text-center">
          Une erreur est survenue. Veuillez réessayer.
        </p>
      )}
    </form>
  );
};
