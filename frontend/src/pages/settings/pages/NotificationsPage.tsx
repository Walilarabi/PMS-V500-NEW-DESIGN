/**
 * FLOWTYM — Paramètres · Notifications & Templates.
 *
 * Éditeur de templates email / SMS transactionnels du PMS.
 * Phase 1 : édition + prévisualisation live avec interpolation des
 * variables ({{guest_name}}, {{checkin_date}}, etc.). Persistance
 * localStorage. Phase 2 : sync vers le moteur d'envoi (SMTP / SMS
 * provider) avec test d'envoi réel.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Bell, Mail, MessageSquare, Save, RotateCcw, CheckCircle2, Eye, AlertCircle, Send,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useConfigStore } from '@/src/store/configStore';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';

const STORAGE_KEY = 'flowtym.notifications';

type TemplateChannel = 'email' | 'sms';

interface TemplateConfig {
  id: string;
  label: string;
  channel: TemplateChannel;
  trigger: string;
  enabled: boolean;
  subject?: string;
  body: string;
}

const VARIABLES = [
  { key: '{{guest_name}}',     label: 'Nom du client' },
  { key: '{{hotel_name}}',     label: 'Nom de l\'hôtel' },
  { key: '{{checkin_date}}',   label: 'Date d\'arrivée' },
  { key: '{{checkout_date}}',  label: 'Date de départ' },
  { key: '{{room_number}}',    label: 'Numéro de chambre' },
  { key: '{{nights}}',         label: 'Nombre de nuits' },
  { key: '{{total_amount}}',   label: 'Montant total' },
  { key: '{{booking_ref}}',    label: 'Référence réservation' },
];

const DEFAULT_TEMPLATES: TemplateConfig[] = [
  {
    id: 'confirmation',
    label: 'Confirmation de réservation',
    channel: 'email',
    trigger: 'Création d\'une réservation',
    enabled: true,
    subject: 'Votre réservation à {{hotel_name}} est confirmée',
    body: 'Bonjour {{guest_name}},\n\nNous confirmons votre réservation du {{checkin_date}} au {{checkout_date}} ({{nights}} nuits) — référence {{booking_ref}}.\n\nMontant total : {{total_amount}}.\n\nÀ très bientôt à {{hotel_name}}.',
  },
  {
    id: 'reminder',
    label: 'Rappel J-1',
    channel: 'email',
    trigger: '24h avant l\'arrivée',
    enabled: true,
    subject: 'Demain, vous arrivez à {{hotel_name}}',
    body: 'Bonjour {{guest_name}},\n\nNous avons hâte de vous accueillir demain pour votre séjour ({{nights}} nuits).\n\nCheck-in à partir de 15h00. À demain !',
  },
  {
    id: 'checkin_sms',
    label: 'SMS pré-check-in',
    channel: 'sms',
    trigger: 'Jour J, 9h',
    enabled: true,
    body: '{{hotel_name}} : votre chambre {{room_number}} est prête. Check-in à partir de 15h. À tout à l\'heure !',
  },
  {
    id: 'thank_you',
    label: 'Remerciement post-séjour',
    channel: 'email',
    trigger: 'J+1 après le départ',
    enabled: true,
    subject: 'Merci de votre visite à {{hotel_name}}',
    body: 'Bonjour {{guest_name}},\n\nMerci d\'avoir choisi {{hotel_name}} pour votre séjour. Nous serions ravis de votre retour sur votre expérience.\n\nAu plaisir de vous revoir !',
  },
  {
    id: 'no_show',
    label: 'Notification no-show',
    channel: 'email',
    trigger: 'Détection no-show',
    enabled: false,
    subject: 'Concernant votre réservation {{booking_ref}}',
    body: 'Bonjour {{guest_name}},\n\nNous n\'avons pas eu le plaisir de vous accueillir le {{checkin_date}}. Conformément à nos conditions, votre réservation a été marquée comme no-show.\n\nN\'hésitez pas à nous contacter pour toute clarification.',
  },
  {
    id: 'cancellation',
    label: 'Annulation acceptée',
    channel: 'email',
    trigger: 'Annulation client',
    enabled: true,
    subject: 'Confirmation d\'annulation — {{booking_ref}}',
    body: 'Bonjour {{guest_name}},\n\nVotre annulation est bien enregistrée. La réservation {{booking_ref}} ne sera pas facturée.\n\nNous espérons vous revoir prochainement.',
  },
];

function load(): TemplateConfig[] {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    const arr = JSON.parse(raw) as TemplateConfig[];
    // Merge avec defaults pour récupérer les nouveaux templates ajoutés en version ultérieure
    return DEFAULT_TEMPLATES.map((d) => arr.find((x) => x.id === d.id) ?? d);
  } catch { return DEFAULT_TEMPLATES; }
}

function save(arr: TemplateConfig[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export const NotificationsPage: React.FC = () => {
  const hotelName = useConfigStore((s) => s.hotel.name);
  const [templates, setTemplates] = useState<TemplateConfig[]>(() => load());
  const [activeId, setActiveId] = useState<string>(templates[0]?.id ?? '');
  const [toast, setToast] = useState<string | null>(null);

  const active = templates.find((t) => t.id === activeId) ?? templates[0];

  useEffect(() => { save(templates); }, [templates]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function update(patch: Partial<TemplateConfig>) {
    setTemplates((arr) => arr.map((t) => (t.id === active.id ? { ...t, ...patch } : t)));
  }

  function reset() {
    const def = DEFAULT_TEMPLATES.find((d) => d.id === active.id);
    if (!def) return;
    setTemplates((arr) => arr.map((t) => (t.id === active.id ? def : t)));
    notify('Template réinitialisé');
  }

  function insertVariable(v: string) {
    update({ body: `${active.body}${v}` });
  }

  function sendTest() {
    logAudit({ action: 'module_inspected', detail: `Test d'envoi template ${active.label} (mock Phase 1)` });
    notify('Test envoyé (mock Phase 1)');
  }

  function handleSave() {
    save(templates);
    logAudit({ action: 'module_inspected', detail: `Template ${active.label} enregistré` });
    notify('Template enregistré');
  }

  // Rendu de l'aperçu : interpole les variables avec des valeurs sample
  const preview = useMemo(() => interpolate(active?.body ?? '', hotelName), [active?.body, hotelName]);
  const previewSubject = useMemo(() => interpolate(active?.subject ?? '', hotelName), [active?.subject, hotelName]);

  const enabledCount = templates.filter((t) => t.enabled).length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60">
      <div className="px-6 pt-6 pb-10 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Automatisations & IA</div>
              <h1 className="text-[22px] font-bold text-slate-950 leading-tight">Notifications & Templates</h1>
              <p className="text-[12.5px] text-slate-500 mt-1">
                Templates email et SMS transactionnels avec variables dynamiques.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={sendTest} className="px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> Envoyer un test
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 inline-flex items-center gap-1.5 shadow-sm shadow-violet-600/20">
              <Save className="w-3.5 h-3.5" /> Enregistrer
            </button>
          </div>
        </header>

        {/* Compteurs */}
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Templates configurés" value={`${templates.length}`} caption={`${enabledCount} actif${enabledCount > 1 ? 's' : ''}`} tone="violet" />
          <Metric label="Email" value={`${templates.filter((t) => t.channel === 'email').length}`} caption="Templates SMTP" tone="sky" />
          <Metric label="SMS" value={`${templates.filter((t) => t.channel === 'sms').length}`} caption="Templates SMS (max 160 car.)" tone="emerald" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr_360px]">
          {/* Liste templates */}
          <aside className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden self-start">
            <header className="px-4 py-2.5 border-b border-slate-100 text-[12px] font-semibold text-slate-900">
              Templates
            </header>
            <ul className="divide-y divide-slate-50">
              {templates.map((t) => {
                const Icon = t.channel === 'email' ? Mail : MessageSquare;
                const isActive = t.id === active.id;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setActiveId(t.id)}
                      className={cn(
                        'w-full px-4 py-2.5 flex items-start gap-2.5 text-left transition-colors',
                        isActive ? 'bg-violet-50/60' : 'hover:bg-slate-50',
                      )}
                    >
                      <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', isActive ? 'text-violet-600' : 'text-slate-400')} />
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-[12.5px] font-semibold truncate', isActive ? 'text-violet-700' : 'text-slate-900')}>
                          {t.label}
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate">{t.trigger}</div>
                      </div>
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                        t.enabled ? 'bg-emerald-500' : 'bg-slate-300',
                      )} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Éditeur */}
          <section className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900">{active.label}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{active.trigger}</p>
              </div>
              <button
                onClick={() => update({ enabled: !active.enabled })}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ring-inset text-[11px] font-semibold',
                  active.enabled
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-slate-50 text-slate-500 ring-slate-200',
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', active.enabled ? 'bg-emerald-500' : 'bg-slate-300')} />
                {active.enabled ? 'Activé' : 'Désactivé'}
              </button>
            </div>

            {active.channel === 'email' && (
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Sujet</span>
                <input
                  type="text"
                  value={active.subject ?? ''}
                  onChange={(e) => update({ subject: e.target.value })}
                  className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] focus:ring-violet-500 outline-none"
                />
              </label>
            )}

            <label className="block">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
                Corps {active.channel === 'sms' && <span className="text-amber-600">(max 160 caractères)</span>}
              </span>
              <textarea
                value={active.body}
                onChange={(e) => update({ body: e.target.value })}
                rows={active.channel === 'sms' ? 4 : 10}
                maxLength={active.channel === 'sms' ? 160 : undefined}
                className="mt-1.5 w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 text-[13px] font-mono focus:ring-violet-500 outline-none resize-y"
              />
              <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                <span>{active.body.length} caractères</span>
                {active.channel === 'sms' && active.body.length > 140 && (
                  <span className="text-amber-600 inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Approche de la limite 160
                  </span>
                )}
              </div>
            </label>

            {/* Variables */}
            <div>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">
                Variables disponibles
              </div>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    title={v.label}
                    className="px-2 py-1 rounded-md ring-1 ring-slate-200 bg-slate-50 hover:bg-violet-50 hover:ring-violet-200 text-[11px] font-mono text-slate-700"
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={reset}
                className="text-[12px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Réinitialiser ce template
              </button>
            </div>
          </section>

          {/* Aperçu */}
          <aside className="space-y-3 lg:sticky lg:top-6 self-start">
            <div className="rounded-2xl ring-1 ring-slate-100 bg-white shadow-sm overflow-hidden">
              <header className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[12px] font-semibold text-slate-900">Aperçu (données échantillon)</span>
              </header>
              {active.channel === 'email' ? (
                <div className="p-4 space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">De</div>
                    <div className="text-[12px] text-slate-700">{hotelName || 'Hôtel'} &lt;noreply@hotel.fr&gt;</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Sujet</div>
                    <div className="text-[12.5px] font-semibold text-slate-900">{previewSubject}</div>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <pre className="text-[12px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{preview}</pre>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="rounded-xl bg-slate-900 text-white p-3 max-w-xs">
                    <div className="text-[10px] text-slate-400 mb-1">{hotelName || 'Hôtel'} · SMS</div>
                    <div className="text-[12px] whitespace-pre-wrap">{preview}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl ring-1 ring-violet-100 bg-violet-50/40 px-4 py-3 text-[11.5px] text-violet-800">
              <strong>Phase 2 :</strong> envoi réel via SMTP / Twilio + suivi des taux d'ouverture
              et de clic.
            </div>
          </aside>
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

function interpolate(template: string, hotelName: string): string {
  return template
    .replace(/\{\{guest_name\}\}/g, 'Marie Dupont')
    .replace(/\{\{hotel_name\}\}/g, hotelName || 'Notre hôtel')
    .replace(/\{\{checkin_date\}\}/g, '15 juin 2026')
    .replace(/\{\{checkout_date\}\}/g, '18 juin 2026')
    .replace(/\{\{room_number\}\}/g, '305')
    .replace(/\{\{nights\}\}/g, '3')
    .replace(/\{\{total_amount\}\}/g, '540 €')
    .replace(/\{\{booking_ref\}\}/g, 'FLW-2026-0042');
}

const Metric: React.FC<{ label: string; value: string; caption: string; tone: 'violet' | 'sky' | 'emerald' }> = ({ label, value, caption, tone }) => {
  const color = tone === 'violet' ? 'text-violet-700' : tone === 'sky' ? 'text-sky-700' : 'text-emerald-700';
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4">
      <div className={cn('text-[20px] font-bold tabular-nums', color)}>{value}</div>
      <div className="text-[12px] font-medium text-slate-900 mt-0.5">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{caption}</div>
    </div>
  );
};
