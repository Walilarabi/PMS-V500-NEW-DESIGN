/**
 * FLOWTYM — CommunicationModal (Flowday).
 */
import { useState } from 'react';
import { ChevronRight, Mail, MessageCircle, Phone, Printer, Send, X } from 'lucide-react';

import type { CommunicationChannel, MessageTemplate, RoomRow } from '../types';
import { cn, fillMessageTemplate, messageTemplates } from '../helpers';

export const CommunicationModal = ({ row, onClose, onSend }: { row: RoomRow; onClose: () => void; onSend: (row: RoomRow, channel: CommunicationChannel) => void }) => {
  const [channel, setChannel] = useState<CommunicationChannel>('email');
  const [template, setTemplate] = useState<MessageTemplate>(messageTemplates[0]);
  const [messageContent, setMessageContent] = useState(() => fillMessageTemplate(messageTemplates[0], row));

  const sendMessage = () => {
    onSend(row, channel);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-purple-600 to-violet-500 p-8 text-white">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">Communication Client</h3>
              <p className="mt-1 text-sm text-white/75">CHAMBRE {row.room}</p>
            </div>
            <button onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 transition-colors"><X size={24} /></button>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-400">Client</label>
              <div className="mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-lg font-bold text-slate-900">{row.guest}</div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Canal d'envoi</label>
              <div className="mt-1 flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button onClick={() => setChannel('email')} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors', channel === 'email' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><Mail size={18} />Email</button>
                <button onClick={() => setChannel('whatsapp')} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors', channel === 'whatsapp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600')}><MessageCircle size={18} />WhatsApp</button>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-400">Email</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-slate-900"><Mail size={18} className="text-slate-400" /><span className="font-medium">arathew.smith@email.com</span></div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">WhatsApp / Tél</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-slate-900"><Phone size={18} className="text-slate-400" /><span className="font-medium">+33 6 12 34 56 78</span></div>
            </div>
          </div>

          <div className="mb-5">
            <label className="text-xs font-bold text-slate-400">Modèle de message</label>
            <div className="relative mt-1">
              <select value={template.id} onChange={(e) => { const t = messageTemplates.find((m) => m.id === e.target.value); if (t) { setTemplate(t); setMessageContent(fillMessageTemplate(t, row)); } }} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                {messageTemplates.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
              <ChevronRight size={18} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400">Contenu du message</label>
            <textarea value={messageContent} onChange={(e) => setMessageContent(e.target.value)} rows={6} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-8 py-5">
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors"><Printer size={18} />Imprimer</button>
          <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-8 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">Fermer</button>
          <button onClick={sendMessage} className={cn('ml-auto flex items-center gap-2 rounded-2xl px-8 py-3 font-bold text-white transition-colors', channel === 'email' ? 'bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/25' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25')}>{channel === 'email' ? <Send size={18} /> : <MessageCircle size={18} />}{channel === 'email' ? 'ENVOYER EMAIL' : 'WHATSAPP'}</button>
        </div>
      </div>
    </div>
  );
};
