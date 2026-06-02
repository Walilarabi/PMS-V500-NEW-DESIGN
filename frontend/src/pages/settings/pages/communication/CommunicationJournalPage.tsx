/**
 * FLOWTYM — Paramètres · Communication · Journal.
 *
 * Journal RÉEL des communications (communication_logs, RLS hôtel) : date,
 * canal, destinataire, statut, provider, erreur éventuelle. Filtrable par
 * canal et par statut. Le journal unifié transverse (fiche client / fiche
 * réservation / Flowday) et l'inbound arrivent aux lots L2/L3.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, Mail, MessageCircle, Loader2, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { listCommunicationLogs, type CommunicationLogEntry } from '@/src/services/communication/communicationService';
import { CommHeader, CommPage } from './shared';

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  sent:   { label: 'Envoyé',  cls: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 size={13} /> },
  failed: { label: 'Échec',   cls: 'bg-red-50 text-red-700',         icon: <AlertTriangle size={13} /> },
  queued: { label: 'En file', cls: 'bg-amber-50 text-amber-700',     icon: <Clock size={13} /> },
};

export const CommunicationJournalPage: React.FC = () => {
  const [logs, setLogs] = useState<CommunicationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<'all' | 'email' | 'whatsapp'>('all');
  const [status, setStatus] = useState<'all' | 'sent' | 'failed' | 'queued'>('all');

  const load = () => {
    setLoading(true);
    listCommunicationLogs({ channel: channel === 'all' ? undefined : channel, limit: 200 })
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [channel]);

  const filtered = useMemo(
    () => (status === 'all' ? logs : logs.filter((l) => l.status === status)),
    [logs, status],
  );

  const selectCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500';

  return (
    <CommPage>
      <CommHeader eyebrow="Communication" title="Journal des communications" subtitle="Historique des messages envoyés (email / WhatsApp), rattachés au client et à la réservation." icon={<Inbox size={16} className="text-violet-600" />} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={selectCls}>
          <option value="all">Tous les canaux</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectCls}>
          <option value="all">Tous les statuts</option>
          <option value="sent">Envoyé</option>
          <option value="failed">Échec</option>
          <option value="queued">En file</option>
        </select>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={14} />Rafraîchir</button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-slate-400"><Loader2 className="animate-spin" size={18} />Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">Aucune communication enregistrée.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Canal</th>
                <th className="px-4 py-3 text-left">Destinataire</th>
                <th className="px-4 py-3 text-left">Objet / Aperçu</th>
                <th className="px-4 py-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((l) => {
                const st = STATUS_META[l.status] ?? STATUS_META.queued;
                return (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(l.created_at).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                        {l.channel === 'email' ? <Mail size={14} className="text-violet-500" /> : <MessageCircle size={14} className="text-emerald-500" />}
                        {l.channel === 'email' ? 'Email' : 'WhatsApp'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.to_address ?? '—'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600">{l.subject ?? l.template_kind ?? '—'}{l.error_message ? <span className="block truncate text-xs text-red-500">{l.error_message}</span> : null}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold', st.cls)}>{st.icon}{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">Le journal unifié transverse (fiche client / réservation / Flowday) et les réponses entrantes arrivent aux lots L2/L3.</p>
    </CommPage>
  );
};

export default CommunicationJournalPage;
