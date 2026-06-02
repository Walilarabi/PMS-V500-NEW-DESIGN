/**
 * FLOWTYM — CommunicationModal (Flowday).
 *
 * Envoi RÉEL email / WhatsApp au client. Contact lu depuis la réservation,
 * modèles depuis communication_templates (fallback défauts), envoi via les
 * edge functions (logué dans communication_logs). États explicites :
 * non configuré → renvoi vers Paramètres ; contact manquant ; erreur API.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Mail, MessageCircle, Phone, Send, Settings, X } from 'lucide-react';

import type { CommunicationChannel, RoomRow } from '../types';
import { cn } from '../helpers';
import { supabase } from '@/src/lib/supabase';
import { sendEmail, sendWhatsApp } from '@/src/services/communication/communicationService';
import { fetchTemplates, fillTemplate, defaultTemplates, type CommTemplate, type TemplateVars } from '@/src/services/communication/templates';
import { getEmailSettings, getWhatsAppSettings } from '@/src/services/communication/communicationSettings.service';

type Status = { active: boolean; loaded: boolean };

export const CommunicationModal = ({ row, onClose, onSend }: { row: RoomRow; onClose: () => void; onSend: (row: RoomRow, channel: CommunicationChannel) => void }) => {
  const [channel, setChannel] = useState<CommunicationChannel>('email');
  const [templates, setTemplates] = useState<CommTemplate[]>(() => defaultTemplates('email'));
  const [templateId, setTemplateId] = useState<string>(() => defaultTemplates('email')[0].id);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [hotelName, setHotelName] = useState('notre établissement');
  const [emailStatus, setEmailStatus] = useState<Status>({ active: false, loaded: false });
  const [waStatus, setWaStatus] = useState<Status>({ active: false, loaded: false });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const vars: Partial<TemplateVars> = useMemo(() => ({
    guest: row.guest,
    room: row.room,
    reservation: row.reservationId,
    checkin: (row.arrival ?? '').slice(0, 10),
    checkout: (row.departure ?? '').slice(0, 10),
    hotel: hotelName,
  }), [row, hotelName]);

  // Charger le statut de connexion des deux canaux + nom hôtel (une fois)
  useEffect(() => {
    let alive = true;
    getEmailSettings().then((s) => alive && setEmailStatus({ active: Boolean(s?.is_active), loaded: true })).catch(() => alive && setEmailStatus({ active: false, loaded: true }));
    getWhatsAppSettings().then((s) => alive && setWaStatus({ active: Boolean(s?.is_active), loaded: true })).catch(() => alive && setWaStatus({ active: false, loaded: true }));
    supabase.from('hotels').select('name').limit(1).maybeSingle().then(({ data }) => {
      if (alive && data?.name) setHotelName(data.name as string);
    });
    return () => { alive = false; };
  }, []);

  // Charger les modèles à chaque changement de canal
  useEffect(() => {
    let alive = true;
    fetchTemplates(channel)
      .then((tpls) => { if (!alive) return; applyTemplates(tpls); })
      .catch(() => { if (!alive) return; applyTemplates(defaultTemplates(channel)); });
    function applyTemplates(tpls: CommTemplate[]) {
      const list = tpls.length ? tpls : defaultTemplates(channel);
      setTemplates(list);
      const first = list[0];
      setTemplateId(first.id);
      setSubject(first.subject ? fillTemplate(first.subject, vars) : '');
      setBodyText(fillTemplate(first.body, vars));
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const selectTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setSubject(t.subject ? fillTemplate(t.subject, vars) : '');
    setBodyText(fillTemplate(t.body, vars));
  };

  const isEmail = channel === 'email';
  const contact = isEmail ? row.email : row.phone;
  const status = isEmail ? emailStatus : waStatus;
  const notConfigured = status.loaded && !status.active;
  const noContact = !contact;
  const canSend = !sending && !notConfigured && !noContact && bodyText.trim().length > 0 && (!isEmail || subject.trim().length > 0);

  const handleSend = async () => {
    setError(null);
    if (!contact) {
      setError(isEmail ? 'Ce client n\'a pas d\'adresse email.' : 'Ce client n\'a pas de numéro mobile.');
      return;
    }
    setSending(true);
    try {
      const templateKind = templates.find((t) => t.id === templateId)?.kind;
      const result = isEmail
        ? await sendEmail({ to: contact, subject, body: bodyText, reservationId: row.reservationUuid ?? null, guestId: row.guestId ?? null, templateKind })
        : await sendWhatsApp({ to: contact, text: bodyText, reservationId: row.reservationUuid ?? null, guestId: row.guestId ?? null, templateKind });

      if (result.success) {
        setSuccess(true);
        onSend(row, channel);
        setTimeout(onClose, 1200);
      } else {
        setError(result.message ?? 'Échec de l\'envoi.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l\'envoi.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-purple-600 to-violet-500 p-8 text-white">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">Communication Client</h3>
              <p className="mt-1 text-sm text-white/75">{row.guest} · CHAMBRE {row.room}</p>
            </div>
            <button onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 transition-colors"><X size={24} /></button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-8">
          <div className="mb-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-400">Client</label>
              <div className="mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-lg font-bold text-slate-900">{row.guest}</div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Canal d'envoi</label>
              <div className="mt-1 flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button onClick={() => { setChannel('email'); setError(null); }} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors', isEmail ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><Mail size={18} />Email</button>
                <button onClick={() => { setChannel('whatsapp'); setError(null); }} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors', !isEmail ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><MessageCircle size={18} />WhatsApp</button>
              </div>
            </div>
          </div>

          {/* Contact réel */}
          <div className="mb-6">
            <label className="text-xs font-bold text-slate-400">{isEmail ? 'Email du client' : 'Numéro WhatsApp / Tél'}</label>
            <div className={cn('mt-1 flex items-center gap-2 rounded-2xl border px-5 py-4', noContact ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-900')}>
              {isEmail ? <Mail size={18} className="shrink-0 text-slate-400" /> : <Phone size={18} className="shrink-0 text-slate-400" />}
              <span className="font-medium">{contact ?? (isEmail ? 'Aucune adresse email enregistrée' : 'Aucun numéro mobile enregistré')}</span>
            </div>
          </div>

          {/* Bandeau non configuré */}
          {notConfigured && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              <span className="flex items-center gap-2"><AlertTriangle size={18} />{isEmail ? 'Email hôtel non configuré.' : 'WhatsApp Business non configuré.'}</span>
              <span className="flex items-center gap-1.5 font-semibold"><Settings size={15} />Paramètres &gt; Communication</span>
            </div>
          )}

          <div className="mb-5">
            <label className="text-xs font-bold text-slate-400">Modèle de message</label>
            <div className="relative mt-1">
              <select value={templateId} onChange={(e) => selectTemplate(e.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                {templates.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {isEmail && (
            <div className="mb-5">
              <label className="text-xs font-bold text-slate-400">Objet</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-400">{isEmail ? 'Contenu du message' : 'Message WhatsApp'}</label>
            <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={6} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
              <CheckCircle2 size={18} className="shrink-0" /><span>{isEmail ? 'Email envoyé.' : 'Message WhatsApp envoyé.'}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-8 py-5">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-8 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Fermer</button>
          <button onClick={handleSend} disabled={!canSend} className={cn('ml-auto flex items-center gap-2 rounded-2xl px-8 py-3 font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50', isEmail ? 'bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/25' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25')}>
            {sending ? <Loader2 size={18} className="animate-spin" /> : isEmail ? <Send size={18} /> : <MessageCircle size={18} />}
            {sending ? 'Envoi…' : isEmail ? 'ENVOYER EMAIL' : 'ENVOYER WHATSAPP'}
          </button>
        </div>
      </div>
    </div>
  );
};
