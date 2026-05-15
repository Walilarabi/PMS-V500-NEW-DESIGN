/**
 * FLOWTYM — Create OTA Dispute Modal.
 *
 * Picks an at-risk validation (QUARANTINE / MANUAL_REVIEW / WARNING),
 * composes the email + draft using the ODMS engines, lets the user tweak
 * the subject and description, and persists the dispute.
 */
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, FileText, Send } from 'lucide-react';

import { useToast } from '@/src/hooks/use-toast';
import { useActiveHotel } from '@/src/domains/hotel/hooks';
import { useAuth } from '@/src/domains/auth/AuthContext';
import { useRecentValidations, useOpenAnomalies, useRieConfiguration } from '@/src/domains/rie/hooks';
import { useCreateDispute } from '@/src/domains/odms/hooks';
import {
  composeDisputeFromValidation,
  type ValidationLite,
  type AnomalyLite,
  type PartnerExtended,
} from '@/src/domains/odms/compose';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preselectedValidationId?: string | null;
}

const fmtEUR = (n: number | null | undefined): string =>
  typeof n === 'number'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)
    : '—';

export const CreateDisputeModal: React.FC<Props> = ({ isOpen, onClose, preselectedValidationId }) => {
  const validationsQ = useRecentValidations(50);
  const anomaliesQ = useOpenAnomalies(200);
  const cfgQ = useRieConfiguration();
  const hotelQ = useActiveHotel();
  const { session } = useAuth();
  const create = useCreateDispute();
  const { toast } = useToast();

  const validations = (validationsQ.data ?? []) as ValidationLite[];
  const anomalies = (anomaliesQ.data ?? []) as AnomalyLite[];

  const eligible = useMemo(
    () => validations.filter((v) => v.decision !== 'AUTO_INTEGRATE'),
    [validations],
  );

  const [selectedId, setSelectedId] = useState<string | null>(preselectedValidationId ?? null);
  React.useEffect(() => {
    if (preselectedValidationId) setSelectedId(preselectedValidationId);
    else if (!selectedId && eligible.length > 0) setSelectedId(eligible[0].id);
  }, [preselectedValidationId, eligible, selectedId]);

  const validation = eligible.find((v) => v.id === selectedId) ?? null;
  const partner = useMemo(() => {
    if (!validation?.partner_id) return null;
    return (cfgQ.data?.partners ?? []).find((p) => p.id === validation.partner_id) as PartnerExtended ?? null;
  }, [validation, cfgQ.data]);

  const composed = useMemo(() => {
    if (!validation) return null;
    return composeDisputeFromValidation({
      hotelName: hotelQ.data?.name ?? '—',
      partner,
      validation,
      anomalies,
      signatureName: session?.fullName ?? 'Direction',
      signatureRole: 'Direction & Revenue Integrity',
    });
  }, [validation, partner, hotelQ.data, anomalies, session?.fullName]);

  const [subjectOverride, setSubjectOverride] = useState<string>('');
  const [descriptionOverride, setDescriptionOverride] = useState<string>('');

  React.useEffect(() => {
    if (composed) {
      setSubjectOverride(composed.draft.subject);
      setDescriptionOverride(composed.draft.description ?? '');
    }
  }, [composed?.draft.subject, composed?.draft.description, composed]);

  const handleCreate = async () => {
    if (!composed) return;
    try {
      const dispute = await create.mutateAsync({
        ...composed.draft,
        subject: subjectOverride.trim() || composed.draft.subject,
        description: descriptionOverride.trim() || composed.draft.description,
      });
      toast({
        title: 'Litige créé',
        description: `Dossier ${dispute.reference} en statut DRAFT — prêt à être envoyé.`,
        variant: 'success',
      });
      onClose();
    } catch (e) {
      toast({
        title: 'Échec',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          data-testid="odms-create-modal"
        >
          <motion.div
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-white">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-violet-600">
                  Revenue Integrity · ODMS
                </p>
                <h2 className="text-xl font-bold text-gray-900">Nouveau litige OTA</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                data-testid="odms-create-close"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-5 flex-1 overflow-hidden">
              {/* Pickable validations */}
              <aside className="md:col-span-2 border-r border-gray-100 overflow-y-auto p-4 bg-gray-50/50">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                  Validations à risque ({eligible.length})
                </p>
                {eligible.length === 0 ? (
                  <p className="text-xs text-gray-400 mt-4">
                    Aucune validation suspecte. Lance le simulateur RIE pour générer un cas test.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {eligible.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(v.id)}
                          data-testid={`odms-pick-validation-${v.id}`}
                          className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                            selectedId === v.id
                              ? 'border-violet-300 bg-violet-50'
                              : 'border-gray-200 bg-white hover:border-violet-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-800">
                              {v.partner_id?.slice(0, 6) ?? 'Partenaire'} · {v.collection_type ?? '—'}
                            </span>
                            <span className="text-[10px] tabular-nums text-rose-600 font-bold">
                              {fmtEUR(v.delta_amount)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                            <span>Score {v.score}/100</span>
                            <span className="uppercase tracking-wider font-semibold">{v.decision}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>

              {/* Preview */}
              <section className="md:col-span-3 overflow-y-auto p-6 space-y-4">
                {!composed ? (
                  <div className="text-center text-gray-400 py-12 text-sm">
                    Sélectionne une validation pour générer le brouillon.
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 flex items-start gap-3">
                      <AlertTriangle className="text-rose-500 mt-0.5" size={16} />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Écart détecté</p>
                        <p className="text-sm text-gray-700 mt-1">{composed.draft.description}</p>
                        <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                          <Stat label="Attendu" value={fmtEUR(composed.draft.expectedAmount)} />
                          <Stat label="Reçu" value={fmtEUR(composed.draft.receivedAmount)} />
                          <Stat label="Réclamé" value={fmtEUR(composed.draft.claimedAmount)} tone="rose" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                        Sujet de l'email
                      </label>
                      <input
                        type="text"
                        value={subjectOverride}
                        onChange={(e) => setSubjectOverride(e.target.value)}
                        data-testid="odms-create-subject"
                        className="mt-1 w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                        Note interne
                      </label>
                      <textarea
                        value={descriptionOverride}
                        onChange={(e) => setDescriptionOverride(e.target.value)}
                        rows={3}
                        data-testid="odms-create-description"
                        className="mt-1 w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700"
                      />
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1">
                        <FileText size={12} /> Aperçu de l'email généré
                      </p>
                      <div className="mt-2 text-xs text-gray-700 space-y-1">
                        <p><span className="text-gray-500">À : </span>{composed.email.to.join(', ') || <em className="text-amber-600">aucun destinataire (configurer le partenaire)</em>}</p>
                        <p><span className="text-gray-500">Cc : </span>{composed.email.cc.join(', ') || '—'}</p>
                      </div>
                      <pre className="mt-3 text-[11px] bg-white border border-gray-100 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-gray-700">
                        {composed.email.body_text}
                      </pre>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                        Pièces jointes prévues ({composed.email.attachments.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {composed.email.attachments.map((a) => (
                          <span
                            key={a.kind}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 text-violet-700 text-[11px] font-semibold"
                          >
                            <FileText size={11} /> {a.filename}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>

            <footer className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Le litige sera créé en statut <strong>DRAFT</strong>. Vous pourrez l'envoyer depuis la fiche du dossier.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  data-testid="odms-create-cancel"
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!composed || create.isPending}
                  data-testid="odms-create-submit"
                  className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Send size={14} />
                  {create.isPending ? 'Création…' : 'Créer le brouillon'}
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'rose' | 'default' }> = ({ label, value, tone }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
    <p className={`text-sm font-bold tabular-nums ${tone === 'rose' ? 'text-rose-700' : 'text-gray-900'}`}>{value}</p>
  </div>
);

export default CreateDisputeModal;
