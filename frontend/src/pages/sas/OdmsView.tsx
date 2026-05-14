/**
 * FLOWTYM — OdmsView (OTA Dispute Center)
 * Gestion des litiges OTA : création, suivi, envoi email Resend, timeline.
 */
import React, { useState } from 'react';
import {
  GitMerge, Plus, Send, Eye, CheckCircle, XCircle, AlertTriangle,
  Clock, Mail, RefreshCcw, ChevronRight, Loader2, Shield, Download,
  MoreHorizontal, ArrowUpRight, Lock, MessageSquare, Paperclip, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { cn } from '@/src/lib/utils';
import {
  useSasDisputes, useSasDispute, useSasDisputeMessages,
  useSasDisputeHistory, useCreateDispute, useUpdateDisputeStatus,
  useAddDisputeMessage, useSasPartners, useSasReliability,
} from '@/src/domains/sas/hooks';
import { supabase } from '@/src/lib/supabase';
import type { SasDisputeRow, DisputeStatus } from '@/src/domains/sas/schemas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtEur = (v: number | null, currency = 'EUR') => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(v);
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'neutral' | 'warning' | 'success' | 'error'; color: string }> = {
  DRAFT:        { label: 'Brouillon',    variant: 'neutral',  color: 'text-gray-500 bg-gray-50' },
  SENT:         { label: 'Envoyé',       variant: 'warning',  color: 'text-blue-600 bg-blue-50' },
  ACKNOWLEDGED: { label: 'Accusé réception', variant: 'warning', color: 'text-amber-600 bg-amber-50' },
  IN_REVIEW:    { label: 'En examen',    variant: 'warning',  color: 'text-orange-600 bg-orange-50' },
  CORRECTED:    { label: 'Corrigé',      variant: 'success',  color: 'text-emerald-600 bg-emerald-50' },
  REJECTED:     { label: 'Rejeté',       variant: 'error',    color: 'text-red-600 bg-red-50' },
  CLOSED:       { label: 'Clôturé',      variant: 'neutral',  color: 'text-gray-500 bg-gray-50' },
  ESCALATED:    { label: 'Escaladé',     variant: 'error',    color: 'text-purple-600 bg-purple-50' },
};

const DIRECTION_ICON = {
  OUTBOUND: <Send size={12} className="text-[#8B5CF6]" />,
  INBOUND:  <Mail size={12} className="text-emerald-500" />,
  INTERNAL: <MessageSquare size={12} className="text-gray-400" />,
};

// ─── Email Preview Modal ──────────────────────────────────────────────────────

function EmailPreviewModal({
  disputeId, onClose,
}: { disputeId: string; onClose: () => void }) {
  const [html, setHtml] = useState('');
  const [subject, setSubject] = useState('');
  const [to, setTo] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    // Preview
    supabase.functions.invoke('send-dispute-email', {
      body: { disputeId, preview: true },
    }).then(({ data, error: e }) => {
      if (e || !data) { setError(e?.message ?? 'Erreur preview'); setLoading(false); return; }
      setHtml(data.html);
      setSubject(data.subject);
      setTo(data.to ?? []);
      setLoading(false);
    });
  }, [disputeId]);

  const handleSend = async () => {
    setSending(true);
    setError('');
    const { error: e } = await supabase.functions.invoke('send-dispute-email', {
      body: { disputeId, preview: false },
    });
    if (e) { setError(e.message); setSending(false); return; }
    setSent(true);
    setSending(false);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white w-full max-w-3xl rounded-[28px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#8B5CF6] font-bold uppercase tracking-widest mb-1">
              <Mail size={12} /> Aperçu email
            </div>
            <h3 className="font-bold text-gray-900">{subject || 'Chargement…'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">À : {to.join(', ') || '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 size={18} className="animate-spin" /> Génération de l'aperçu…
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 rounded-2xl text-sm text-red-600 flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          ) : (
            <div
              className="border border-gray-100 rounded-2xl overflow-hidden"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose} className="font-bold">Annuler</Button>
          <div className="flex-1" />
          {sent ? (
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <CheckCircle size={16} /> Email envoyé avec succès
            </div>
          ) : (
            <Button
              onClick={handleSend}
              disabled={sending || loading || !!error || to.length === 0}
              className="bg-[#8B5CF6] text-white font-bold gap-2 shadow-lg shadow-[#8B5CF6]/20 px-8"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Envoyer l'email
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Dispute Detail Drawer ────────────────────────────────────────────────────

function DisputeDetailDrawer({
  disputeId, onClose,
}: { disputeId: string; onClose: () => void }) {
  const { data: dispute, isLoading } = useSasDispute(disputeId);
  const { data: messages = [] } = useSasDisputeMessages(disputeId);
  const { data: history = [] } = useSasDisputeHistory(disputeId);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [newNote, setNewNote] = useState('');
  const updateStatus = useUpdateDisputeStatus();
  const addMessage = useAddDisputeMessage();

  if (isLoading || !dispute) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 gap-2">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  const cfg = STATUS_CONFIG[dispute.status] ?? STATUS_CONFIG.DRAFT;
  const canSend = dispute.status === 'DRAFT';
  const canAcknowledge = dispute.status === 'SENT';
  const canEscalate = ['SENT', 'ACKNOWLEDGED', 'IN_REVIEW'].includes(dispute.status);
  const canClose = !['CLOSED', 'REJECTED'].includes(dispute.status);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addMessage.mutate({ disputeId, direction: 'INTERNAL', content: newNote });
    setNewNote('');
  };

  // Fusionner messages + historique pour la timeline
  const timeline = [
    ...history.map(h => ({
      id: h.id, at: h.changed_at, type: 'status' as const,
      content: `Statut : ${h.old_status ?? 'Création'} → ${h.new_status}`,
      sub: h.reason,
    })),
    ...messages.map(m => ({
      id: m.id, at: m.created_at, type: 'message' as const,
      content: m.content, direction: m.direction,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-gray-700">{dispute.reference}</span>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg', cfg.color)}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-400">{dispute.subject ?? 'Réclamation OTA'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={14} />
          </button>
        </div>

        {/* Montants */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Attendu', value: fmtEur(dispute.expected_amount), color: 'text-gray-700' },
            { label: 'Reçu', value: fmtEur(dispute.received_amount), color: 'text-red-500' },
            { label: 'Réclamé', value: fmtEur(dispute.claimed_amount), color: 'text-[#8B5CF6] font-black' },
          ].map(k => (
            <div key={k.label} className="p-3 bg-gray-50 rounded-xl text-center">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{k.label}</p>
              <p className={cn('text-sm font-bold mt-0.5', k.color)}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Actions rapides */}
        <div className="flex flex-wrap gap-2 mt-4">
          {canSend && (
            <Button
              size="sm"
              onClick={() => setShowEmailPreview(true)}
              className="bg-[#8B5CF6] text-white font-bold gap-1.5 shadow-sm"
            >
              <Eye size={12} /> Prévisualiser & Envoyer
            </Button>
          )}
          {canAcknowledge && (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: disputeId, newStatus: 'ACKNOWLEDGED' })} className="gap-1.5 font-bold text-xs">
              <CheckCircle size={12} /> Accusé reçu
            </Button>
          )}
          {canEscalate && (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: disputeId, newStatus: 'ESCALATED', reason: 'Escalade manuelle' })} className="gap-1.5 font-bold text-xs text-orange-600 border-orange-200">
              <AlertTriangle size={12} /> Escalader
            </Button>
          )}
          {canClose && (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: disputeId, newStatus: 'CLOSED', reason: 'Clôture manuelle' })} className="gap-1.5 font-bold text-xs text-gray-500">
              <Lock size={12} /> Clôturer
            </Button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
          Timeline ({timeline.length} événements)
        </h4>
        {timeline.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Aucun événement</p>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-100" />
            {timeline.map((event, idx) => (
              <div key={event.id} className="relative mb-4">
                <div className={cn(
                  'absolute -left-3.5 top-1 w-3 h-3 rounded-full border-2 border-white',
                  event.type === 'status' ? 'bg-[#8B5CF6]' :
                  (event as any).direction === 'OUTBOUND' ? 'bg-blue-400' :
                  (event as any).direction === 'INBOUND' ? 'bg-emerald-400' : 'bg-gray-300',
                )} />
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    {event.type === 'message' && DIRECTION_ICON[(event as any).direction]}
                    <p className="text-xs font-bold text-gray-700">{event.content}</p>
                  </div>
                  {(event as any).sub && (
                    <p className="text-[10px] text-gray-400">{(event as any).sub}</p>
                  )}
                  <p className="text-[9px] text-gray-300 mt-1">
                    {new Date(event.at).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add note */}
      <div className="p-4 border-t border-gray-100 shrink-0">
        <div className="flex gap-2">
          <input
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
            placeholder="Ajouter une note interne…"
            className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
          />
          <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim() || addMessage.isPending} className="bg-[#8B5CF6] text-white">
            <MessageSquare size={12} />
          </Button>
        </div>
      </div>

      {/* Email Preview Modal */}
      <AnimatePresence>
        {showEmailPreview && (
          <EmailPreviewModal
            disputeId={disputeId}
            onClose={() => setShowEmailPreview(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Create Dispute Modal ─────────────────────────────────────────────────────

function CreateDisputeModal({
  partners,
  onClose,
  onCreate,
  isLoading,
}: {
  partners: any[];
  onClose: () => void;
  onCreate: (input: any) => Promise<void>;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    partnerId: '',
    expectedAmount: '',
    receivedAmount: '',
    claimedAmount: '',
    subject: '',
    explanation: '',
  });

  const deviation = form.expectedAmount && form.receivedAmount
    ? (parseFloat(form.receivedAmount) - parseFloat(form.expectedAmount)).toFixed(2)
    : null;

  const handleSubmit = async () => {
    await onCreate({
      partnerId:      form.partnerId || undefined,
      expectedAmount: form.expectedAmount ? parseFloat(form.expectedAmount) : undefined,
      receivedAmount: form.receivedAmount ? parseFloat(form.receivedAmount) : undefined,
      claimedAmount:  form.claimedAmount  ? parseFloat(form.claimedAmount)  :
                      form.expectedAmount && form.receivedAmount
                        ? Math.abs(parseFloat(form.receivedAmount) - parseFloat(form.expectedAmount))
                        : undefined,
      subject:     form.subject || undefined,
      explanation: form.explanation || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white w-full max-w-lg rounded-[28px] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] text-[#8B5CF6] font-bold uppercase tracking-widest mb-1">
              <GitMerge size={11} /> Nouveau litige OTA
            </div>
            <h3 className="text-lg font-bold text-gray-900">Créer une réclamation</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Partenaire OTA */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
              Partenaire OTA
            </label>
            {partners.length === 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700 font-medium">
                Aucun partenaire configuré — allez dans SAS → Config. partenaires pour en ajouter.
              </div>
            ) : (
              <select
                value={form.partnerId}
                onChange={e => setForm(f => ({ ...f, partnerId: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              >
                <option value="">— Sélectionner un partenaire —</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            )}
          </div>

          {/* Sujet */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
              Sujet du litige
            </label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Ex: Commission incorrecte sur réservation BK-12345678"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </div>

          {/* Montants */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                Montant attendu (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.expectedAmount}
                onChange={e => setForm(f => ({ ...f, expectedAmount: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                Montant reçu (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.receivedAmount}
                onChange={e => setForm(f => ({ ...f, receivedAmount: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
              />
            </div>
          </div>

          {/* Écart calculé */}
          {deviation !== null && (
            <div className={cn(
              'p-3 rounded-xl text-sm font-bold flex items-center gap-2',
              parseFloat(deviation) < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            )}>
              <AlertTriangle size={14} />
              Écart calculé : {parseFloat(deviation) < 0 ? '' : '+'}{deviation} €
            </div>
          )}

          {/* Montant réclamé */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
              Montant réclamé (€) <span className="text-gray-300 normal-case font-normal">— auto-calculé si vide</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={form.claimedAmount}
              onChange={e => setForm(f => ({ ...f, claimedAmount: e.target.value }))}
              placeholder={deviation ? `${Math.abs(parseFloat(deviation)).toFixed(2)}` : '0.00'}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </div>

          {/* Explication */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
              Explication / détail de la réclamation
            </label>
            <textarea
              value={form.explanation}
              onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
              placeholder="Décrivez l'anomalie détectée et les éléments justificatifs..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-bold">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !form.subject}
            className="flex-1 bg-[#8B5CF6] text-white font-bold gap-2 shadow-lg shadow-[#8B5CF6]/20"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Créer le litige
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export const OdmsView = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: disputesData, isLoading, refetch, isFetching } = useSasDisputes({
    status: statusFilter || undefined,
  });
  const { data: reliability = [] } = useSasReliability();
  const { data: partners = [] } = useSasPartners();
  const createDispute = useCreateDispute();

  const disputes = disputesData?.rows ?? [];

  // Stats
  const openCount     = disputes.filter(d => !['CLOSED','REJECTED'].includes(d.status)).length;
  const sentCount     = disputes.filter(d => ['SENT','ACKNOWLEDGED','IN_REVIEW'].includes(d.status)).length;
  const closedCount   = disputes.filter(d => ['CORRECTED','CLOSED'].includes(d.status)).length;
  const recovered     = disputes.reduce((s, d) => s + (d.recovered_amount ?? 0), 0);
  const totalClaimed  = disputes.reduce((s, d) => s + (d.claimed_amount ?? 0), 0);

  const STATUS_FILTERS = [
    { value: '', label: 'Tous' },
    { value: 'DRAFT', label: 'Brouillon' },
    { value: 'SENT', label: 'Envoyé' },
    { value: 'IN_REVIEW', label: 'En examen' },
    { value: 'CORRECTED', label: 'Corrigé' },
    { value: 'CLOSED', label: 'Clôturé' },
  ];

  return (
    <div className="flex h-full overflow-hidden bg-[#F9FAFB]">
      {/* Left panel */}
      <div className={cn('flex flex-col', selectedId ? 'w-[55%]' : 'w-full')}>

        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#8B5CF6] rounded-xl text-white shadow-lg shadow-[#8B5CF6]/20">
                <GitMerge size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">
                  SAS · OTA Dispute Management
                </div>
                <h1 className="text-xl font-bold text-gray-900">Centre de gestion des litiges OTA</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  Réclamations automatiques, suivi du cycle de vie, génération de preuves PDF & email — natif PMS.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 font-bold">
                <RefreshCcw size={13} className={cn(isFetching && 'animate-spin')} />
                Actualiser
              </Button>
              <Button onClick={() => setShowCreate(true)} className="bg-[#8B5CF6] text-white gap-2 font-bold shadow-lg shadow-[#8B5CF6]/20">
                <Plus size={16} /> Nouveau litige
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 p-6 shrink-0">
          {[
            { label: 'Litiges ouverts', value: openCount, sub: 'En cours', icon: <AlertTriangle size={16} className="text-amber-500" />, bg: 'bg-amber-50' },
            { label: 'Envoyés / En examen', value: sentCount, sub: 'SLA partenaire', icon: <Mail size={16} className="text-blue-500" />, bg: 'bg-blue-50' },
            { label: 'Corrigés / Clôturés', value: closedCount, sub: 'Résolutions', icon: <CheckCircle size={16} className="text-emerald-500" />, bg: 'bg-emerald-50' },
            { label: 'Montant récupéré', value: fmtEur(recovered), sub: `Litiges total ${fmtEur(totalClaimed)}`, icon: <ArrowUpRight size={16} className="text-[#8B5CF6]" />, bg: 'bg-[#8B5CF6]/5' },
          ].map(k => (
            <Card key={k.label} className="p-4 bg-white border-transparent shadow-sm">
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-xl shrink-0', k.bg)}>{k.icon}</div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{k.value}</p>
                  <p className="text-[10px] text-gray-400">{k.sub}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Smart RIE — Fiabilité partenaire */}
        {reliability.length > 0 && (
          <div className="mx-6 mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden shrink-0">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
              <Shield size={14} className="text-[#8B5CF6]" />
              <h3 className="text-xs font-bold text-gray-700">Smart RIE — Fiabilité partenaire (30j)</h3>
              <p className="text-[10px] text-gray-400 ml-auto">Plus le score est haut, plus le partenaire est fiable</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50">
                  <tr>
                    {['Partenaire','Validations','Score moyen','Auto','Vigilance','Manuel','Quarantaine','Écart cumulé'].map(h => (
                      <th key={h} className="px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reliability.map(r => {
                    const partner = partners.find(p => p.id === r.partner_id);
                    return (
                      <tr key={r.id} className="text-xs hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-800">{partner?.name ?? '—'}</div>
                          <div className="text-[9px] text-gray-400 font-mono">{partner?.code}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{r.total_validations}</td>
                        <td className="px-4 py-3">
                          <span className={cn('font-black text-base', (r.avg_score ?? 0) >= 90 ? 'text-emerald-600' : (r.avg_score ?? 0) >= 70 ? 'text-amber-600' : 'text-red-600')}>
                            {r.avg_score?.toFixed(1) ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{r.auto_rate_pct?.toFixed(0) ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">0</td>
                        <td className="px-4 py-3 text-gray-600">{r.manual_rate_pct?.toFixed(0) ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.quarantine_rate_pct?.toFixed(0) ?? '—'}</td>
                        <td className="px-4 py-3 font-bold text-red-500">
                          {r.total_deviation ? fmtEur(r.total_deviation) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* File de relances */}
        <div className="mx-6 mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-amber-500" />
            <h3 className="text-xs font-bold text-gray-700">File de relances ODMS</h3>
            <span className="ml-auto text-[10px] text-gray-400 font-bold uppercase">0 EN ATTENTE</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Aucune relance planifiée. Une relance J+2 est créée automatiquement à chaque transition DRAFT → SENT.
          </p>
        </div>

        {/* Filters */}
        <div className="px-6 mb-3 flex gap-1 shrink-0">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all', statusFilter === f.value ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-gray-500 hover:bg-white')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Disputes table */}
        <div className="flex-1 overflow-y-auto mx-6 mb-6">
          <Card className="bg-white border-transparent shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-700">Litiges</h3>
              <Badge variant="neutral" className="text-xs">{disputesData?.total ?? 0}</Badge>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : disputes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <GitMerge size={28} className="mb-3 opacity-20" />
                <p className="text-sm font-bold">Aucun litige</p>
                <p className="text-xs mt-1 opacity-60">Créez votre premier litige OTA</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50 border-b border-gray-50">
                    <tr>
                      {['Référence','OTA','Statut','Écart','Recouvré','Quarantaine','Créé',''].map(h => (
                        <th key={h} className="px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {disputes.map(d => {
                      const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.DRAFT;
                      const partner = partners.find(p => p.id === d.partner_id);
                      const ecart = d.received_amount != null && d.expected_amount != null
                        ? d.received_amount - d.expected_amount : null;
                      return (
                        <tr
                          key={d.id}
                          className={cn('text-sm cursor-pointer hover:bg-gray-50/60 transition-colors', selectedId === d.id && 'bg-[#8B5CF6]/5')}
                          onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">{d.reference}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-800 text-xs">{partner?.name ?? '—'}</div>
                            <div className="text-[9px] text-gray-400 font-mono">{partner?.code}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('text-[10px] font-bold px-2 py-1 rounded-lg', cfg.color)}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {ecart !== null ? (
                              <span className={cn('font-bold text-sm', ecart < 0 ? 'text-red-500' : 'text-emerald-600')}>
                                {fmtEur(ecart)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {d.recovered_amount ? fmtEur(d.recovered_amount) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {d.partner_id ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit">
                                <Lock size={10} /> Isolée
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-[10px] text-gray-400">
                            {new Date(d.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-3">
                            <ChevronRight size={14} className={cn('text-gray-300 transition-transform', selectedId === d.id && 'rotate-90 text-[#8B5CF6]')} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Right — detail drawer */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '45%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-gray-100 bg-white overflow-hidden flex flex-col shrink-0"
          >
            <DisputeDetailDrawer
              disputeId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          </motion.div>
        )}

        {/* Sélectionne placeholder */}
        {!selectedId && disputes.length > 0 && (
          <div className="w-[45%] border-l border-gray-100 bg-white flex flex-col items-center justify-center text-gray-400">
            <Eye size={32} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">Sélectionne un litige pour afficher le détail.</p>
          </div>
        )}
      </AnimatePresence>

      {/* Modal création litige */}
      <AnimatePresence>
        {showCreate && (
          <CreateDisputeModal
            partners={partners}
            onClose={() => setShowCreate(false)}
            isLoading={createDispute.isPending}
            onCreate={async (input) => {
              await createDispute.mutateAsync(input);
              setShowCreate(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
