/**
 * FLOWTYM — Paramètres · RGPD & Conformité.
 *
 * Checklist de conformité RGPD avec actions concrètes : mentions
 * légales, cookies, durée de conservation, droits clients, sous-
 * traitants, registres. Chaque item peut être marqué fait/à faire,
 * avec dates et responsable. Score de conformité RGPD calculé en
 * temps réel — alimente le score Conformité du Control Center.
 */
import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, CheckCircle2, AlertCircle, FileText, ArrowRight, Save, Calendar, User,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

const STORAGE_KEY = 'flowtym.rgpd';

type RgpdCategory = 'documentation' | 'consent' | 'rights' | 'security' | 'governance';

interface RgpdTask {
  id: string;
  category: RgpdCategory;
  label: string;
  description: string;
  weight: number;             // poids dans le score 0-100
  required: boolean;          // critique légalement ?
  done: boolean;
  doneAt?: string;
  owner?: string;
  notes?: string;
}

const CAT_LABEL: Record<RgpdCategory, string> = {
  documentation: 'Documentation légale',
  consent: 'Consentements clients',
  rights: 'Droits des personnes',
  security: 'Sécurité & accès',
  governance: 'Gouvernance & registres',
};

const CAT_ICON: Record<RgpdCategory, React.ComponentType<{ className?: string }>> = {
  documentation: FileText,
  consent: CheckCircle2,
  rights: User,
  security: ShieldCheck,
  governance: Calendar,
};

const DEFAULTS: RgpdTask[] = [
  { id: 'mentions_legales',   category: 'documentation', label: 'Mentions légales publiées', description: 'Pied de page du site, contacts du responsable de traitement, hébergeur.', weight: 8, required: true, done: false },
  { id: 'politique_conf',     category: 'documentation', label: 'Politique de confidentialité à jour', description: 'Finalités, base légale, durée, droits, contact DPO.', weight: 10, required: true, done: false },
  { id: 'cgv_cgu',            category: 'documentation', label: 'CGV / CGU validées', description: 'Conditions générales de vente / utilisation.', weight: 6, required: true, done: false },
  { id: 'bandeau_cookies',    category: 'consent', label: 'Bandeau cookies conforme', description: 'Consentement granulaire (CNIL), opt-out facile.', weight: 8, required: true, done: false },
  { id: 'email_consent',      category: 'consent', label: 'Consentement marketing explicite', description: 'Case opt-in séparée pour newsletter / promotions.', weight: 6, required: false, done: false },
  { id: 'sms_consent',        category: 'consent', label: 'Consentement SMS spécifique', description: 'Distinct du consentement email, mention du caractère commercial.', weight: 4, required: false, done: false },
  { id: 'droit_acces',        category: 'rights', label: 'Procédure droit d\'accès', description: 'Workflow pour répondre sous 30 jours à une demande d\'accès.', weight: 8, required: true, done: false },
  { id: 'droit_oubli',        category: 'rights', label: 'Procédure droit à l\'oubli', description: 'Anonymisation possible des données clients après le séjour.', weight: 8, required: true, done: false },
  { id: 'droit_portabilite',  category: 'rights', label: 'Export portable des données', description: 'Capable de fournir un dump JSON / CSV des données d\'un client.', weight: 5, required: false, done: false },
  { id: 'chiffrement',        category: 'security', label: 'Chiffrement en transit (TLS 1.2+)', description: 'HTTPS partout, certificats valides.', weight: 8, required: true, done: false },
  { id: 'chiffrement_repos',  category: 'security', label: 'Chiffrement au repos (DB)', description: 'AES-256 sur les colonnes sensibles (PII, paiement).', weight: 6, required: true, done: false },
  { id: 'rbac',               category: 'security', label: 'Contrôle d\'accès par rôle (RBAC)', description: 'Permissions granulaires par fonction (admin, réception, housekeeping).', weight: 5, required: true, done: false },
  { id: 'registre_traitement',category: 'governance', label: 'Registre des traitements (Art. 30)', description: 'Document obligatoire — finalités, catégories de données, durées, destinataires.', weight: 10, required: true, done: false },
  { id: 'dpa_sous_traitants', category: 'governance', label: 'DPA signés avec sous-traitants', description: 'Channel managers, OTAs, services cloud, paiement.', weight: 6, required: true, done: false },
  { id: 'dpo',                category: 'governance', label: 'DPO désigné (si applicable)', description: 'Délégué à la protection des données — recommandé > 50 employés.', weight: 2, required: false, done: false },
];

function load(): RgpdTask[] {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const stored = JSON.parse(raw) as RgpdTask[];
    return DEFAULTS.map((d) => {
      const s = stored.find((x) => x.id === d.id);
      return s ? { ...d, done: s.done, doneAt: s.doneAt, owner: s.owner, notes: s.notes } : d;
    });
  } catch { return DEFAULTS; }
}
function save(tasks: RgpdTask[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export const RgpdPage: React.FC = () => {
  const [tasks, setTasks] = useState<RgpdTask[]>(() => load());
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { save(tasks); }, [tasks]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function toggleDone(id: string) {
    setTasks((arr) =>
      arr.map((t) =>
        t.id === id
          ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : undefined }
          : t,
      ),
    );
    const t = tasks.find((x) => x.id === id);
    if (t) {
      logAudit({ action: 'module_inspected', detail: `RGPD "${t.label}" ${!t.done ? 'validé' : 'invalidé'}` });
    }
  }

  function update(id: string, patch: Partial<RgpdTask>) {
    setTasks((arr) => arr.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  // Score : somme des poids des tâches faites / somme totale
  const maxScore = tasks.reduce((s, t) => s + t.weight, 0);
  const currentScore = tasks.filter((t) => t.done).reduce((s, t) => s + t.weight, 0);
  const scorePct = Math.round((currentScore / maxScore) * 100);

  // Items critiques manquants
  const missingCritical = tasks.filter((t) => t.required && !t.done);

  const categories: RgpdCategory[] = ['documentation', 'consent', 'rights', 'security', 'governance'];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="w-full px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Sécurité & Administration</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">RGPD & Conformité</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Checklist légale Union Européenne pour la protection des données personnelles.
              </p>
            </div>
          </div>
        </header>

        {/* Score global */}
        <section className={cn(
          'rounded-2xl ring-1 p-5 flex items-start gap-4',
          scorePct >= 80 ? 'ring-emerald-200 bg-emerald-50/60' :
          scorePct >= 50 ? 'ring-amber-200 bg-amber-50/60' :
          'ring-rose-200 bg-rose-50/60',
        )}>
          <div className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center ring-1',
            scorePct >= 80 ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' :
            scorePct >= 50 ? 'bg-amber-100 text-amber-700 ring-amber-200' :
            'bg-rose-100 text-rose-700 ring-rose-200',
          )}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold tabular-nums">{scorePct}</span>
              <span className="text-[12px] text-slate-500">/100</span>
              <span className="text-[13px] text-slate-700 ml-2 font-medium">Score RGPD</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
              <div
                className={cn('h-full', scorePct >= 80 ? 'bg-emerald-500' : scorePct >= 50 ? 'bg-amber-500' : 'bg-rose-500')}
                style={{ width: `${scorePct}%` }}
              />
            </div>
            <p className="text-[12px] text-slate-600 mt-2">
              {tasks.filter((t) => t.done).length} sur {tasks.length} items validés.
              {missingCritical.length > 0 && ` ${missingCritical.length} item${missingCritical.length > 1 ? 's' : ''} critique${missingCritical.length > 1 ? 's' : ''} encore à traiter.`}
            </p>
          </div>
        </section>

        {/* Alertes critiques manquantes */}
        {missingCritical.length > 0 && (
          <section className="rounded-2xl ring-1 ring-rose-200 bg-rose-50/60 p-4">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-rose-800 mb-2">
              <AlertCircle className="w-4 h-4" />
              {missingCritical.length} obligation{missingCritical.length > 1 ? 's' : ''} légale{missingCritical.length > 1 ? 's' : ''} non remplie{missingCritical.length > 1 ? 's' : ''}
            </div>
            <ul className="space-y-1 text-[12px] text-rose-700">
              {missingCritical.slice(0, 5).map((t) => (
                <li key={t.id}>• {t.label}</li>
              ))}
              {missingCritical.length > 5 && (
                <li className="text-rose-600 italic">+{missingCritical.length - 5} autre(s)</li>
              )}
            </ul>
          </section>
        )}

        {/* Checklist par catégorie */}
        {categories.map((cat) => {
          const items = tasks.filter((t) => t.category === cat);
          const done = items.filter((t) => t.done).length;
          const Icon = CAT_ICON[cat];
          return (
            <section key={cat} className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
              <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-violet-500" />
                  <h3 className="text-[13px] font-semibold text-slate-900">{CAT_LABEL[cat]}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] tabular-nums text-slate-500">{done}/{items.length}</span>
                  <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn('h-full', done === items.length ? 'bg-emerald-500' : 'bg-violet-500')}
                      style={{ width: `${(done / items.length) * 100}%` }}
                    />
                  </div>
                </div>
              </header>
              <ul className="divide-y divide-slate-100">
                {items.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleDone(t.id)}
                        className={cn(
                          'w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 mt-0.5',
                          t.done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white ring-2 ring-slate-300 hover:ring-violet-400',
                        )}
                      >
                        {t.done && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-[13px] font-semibold', t.done ? 'text-slate-500 line-through decoration-emerald-400' : 'text-slate-900')}>
                            {t.label}
                          </span>
                          {t.required && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                              Obligatoire
                            </span>
                          )}
                          <span className="ml-auto text-[10px] text-slate-400 tabular-nums">+{t.weight} pts</span>
                        </div>
                        <div className="text-[11.5px] text-slate-600 mt-0.5">{t.description}</div>
                        {t.done && t.doneAt && (
                          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Validé le {new Date(t.doneAt).toLocaleDateString('fr-FR')}
                            </span>
                            {t.owner && (
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3" /> {t.owner}
                              </span>
                            )}
                            <button
                              onClick={() => setEditing(editing === t.id ? null : t.id)}
                              className="ml-auto text-violet-600 hover:underline"
                            >
                              {editing === t.id ? 'Fermer' : 'Détailler'}
                            </button>
                          </div>
                        )}
                        {editing === t.id && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Responsable / DPO"
                              value={t.owner ?? ''}
                              onChange={(e) => update(t.id, { owner: e.target.value })}
                              className="px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px] focus:ring-violet-500 outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Notes…"
                              value={t.notes ?? ''}
                              onChange={(e) => update(t.id, { notes: e.target.value })}
                              className="px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 text-[12px] focus:ring-violet-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {/* Footer info */}
        <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800 flex items-start gap-2">
          <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong>Phase 2 :</strong> génération automatique du registre des traitements (Art. 30),
            workflow de réponse aux demandes d'accès, intégration CNIL e-réclamation.
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white text-[12.5px] px-4 py-2.5 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
          </div>
        )}
      </div>
    </div>
  );
};
