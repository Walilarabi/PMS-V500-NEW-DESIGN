import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Download, Send, X, Save, Search, AlertTriangle, Eye } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── PDF generation ───────────────────────────────────────────────────────────

async function downloadInvoicePDF(inv: PlatformInvoice): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(139, 92, 246);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('FLOWTYM', 14, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Plateforme SaaS PMS Hôtelier', 14, 22);

  // Invoice title
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('FACTURE', 140, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(inv.number, 140, 22);

  // Infos
  doc.setFontSize(9);
  doc.text(`Émetteur : Flowtym SAS`, 14, 40);
  doc.text(`Destinataire : ${inv.hotel_name ?? inv.hotel_id}`, 14, 46);
  doc.text(`Date d'émission : ${new Date(inv.created_at).toLocaleDateString('fr-FR')}`, 140, 40);
  if (inv.due_date) doc.text(`Échéance : ${new Date(inv.due_date).toLocaleDateString('fr-FR')}`, 140, 46);
  if (inv.period_start && inv.period_end) {
    doc.text(`Période : ${new Date(inv.period_start).toLocaleDateString('fr-FR')} – ${new Date(inv.period_end).toLocaleDateString('fr-FR')}`, 14, 52);
  }

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 58, 196, 58);

  // Table header
  doc.setFillColor(248, 248, 248);
  doc.rect(14, 62, 182, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Désignation', 16, 67.5);
  doc.text('Montant HT', 140, 67.5);
  doc.text('TVA', 165, 67.5);
  doc.text('TTC', 182, 67.5);

  // Table row
  doc.setFont('helvetica', 'normal');
  doc.text('Abonnement Flowtym PMS', 16, 78);
  doc.text(`${inv.amount_ht.toFixed(2)} ${inv.currency}`, 140, 78);
  doc.text(`${inv.tva_rate}%`, 165, 78);
  doc.text(`${inv.amount_ttc.toFixed(2)} ${inv.currency}`, 182, 78);

  doc.line(14, 82, 196, 82);

  // Totals
  doc.setFont('helvetica', 'bold');
  doc.text('Total HT', 140, 90);
  doc.text(`${inv.amount_ht.toFixed(2)} €`, 182, 90);
  doc.text(`TVA ${inv.tva_rate}%`, 140, 96);
  doc.setFont('helvetica', 'normal');
  doc.text(`${inv.tva_amount.toFixed(2)} €`, 182, 96);

  doc.setFillColor(139, 92, 246);
  doc.rect(130, 100, 66, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL TTC', 140, 106.5);
  doc.text(`${inv.amount_ttc.toFixed(2)} €`, 182, 106.5);

  if (inv.notes) {
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(`Notes : ${inv.notes}`, 14, 120);
  }

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Flowtym SAS — TVA FR12345678901 — IBAN FR76 XXXX XXXX XXXX XXXX', 14, 280);
  doc.text(`Facture ${inv.number} — Émise le ${new Date(inv.created_at).toLocaleDateString('fr-FR')}`, 14, 284);

  doc.save(`${inv.number}.pdf`);
}

interface PlatformInvoice {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  number: string;
  status: string;
  amount_ht: number;
  tva_rate: number;
  tva_amount: number;
  amount_ttc: number;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Brouillon',  color: 'bg-gray-100 text-gray-500' },
  pending:   { label: 'En attente', color: 'bg-amber-50 text-amber-600' },
  paid:      { label: 'Payée',      color: 'bg-emerald-50 text-emerald-600' },
  failed:    { label: 'Échouée',    color: 'bg-red-50 text-red-600' },
  cancelled: { label: 'Annulée',    color: 'bg-gray-100 text-gray-400' },
};

function useInvoices() {
  return useQuery<PlatformInvoice[]>({
    queryKey: ['admin-platform-invoices'],
    queryFn: async () => {
      const { data, error } = await db
        .from('platform_invoices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const { data: hotels } = await db.from('hotels').select('id, name');
      const hotelMap: Record<string, string> = {};
      (hotels ?? []).forEach((h: { id: string; name: string }) => { hotelMap[h.id] = h.name; });
      return (data ?? []).map((i: PlatformInvoice) => ({ ...i, hotel_name: hotelMap[i.hotel_id] }));
    },
    staleTime: 30_000,
  });
}

function useHotelList() {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ['admin-hotel-list'],
    queryFn: async () => { const { data } = await db.from('hotels').select('id, name').order('name'); return data ?? []; },
    staleTime: 60_000,
  });
}

function nextInvoiceNumber(existing: PlatformInvoice[]): string {
  const prefix = `PLAT-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-`;
  const nums = existing
    .filter(i => i.number.startsWith(prefix))
    .map(i => parseInt(i.number.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(4,'0')}`;
}

type StatusFilter = 'all' | keyof typeof STATUS_META;

export const AdminBilling: React.FC = () => {
  const qc = useQueryClient();
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: hotelList = [] }           = useHotelList();
  const [search, setSearch]    = useState('');
  const [statusF, setStatusF]  = useState<StatusFilter>('all');
  const [showNew, setShowNew]  = useState(false);
  const EMPTY = { hotel_id: '', amount_ht: 0, tva_rate: 20, period_start: '', period_end: '', due_date: '', notes: '' };
  const [form, setForm] = useState(EMPTY);

  const filtered = invoices.filter(i => {
    const q = search.toLowerCase();
    const m = !q || i.number.toLowerCase().includes(q) || i.hotel_name?.toLowerCase().includes(q);
    const s = statusF === 'all' || i.status === statusF;
    return m && s;
  });

  const createMut = useMutation({
    mutationFn: async (f: typeof EMPTY) => {
      const ht  = Number(f.amount_ht);
      const tva = ht * (Number(f.tva_rate) / 100);
      const { error } = await db.from('platform_invoices').insert({
        hotel_id:     f.hotel_id,
        number:       nextInvoiceNumber(invoices),
        status:       'draft',
        amount_ht:    ht,
        tva_rate:     Number(f.tva_rate),
        tva_amount:   tva,
        amount_ttc:   ht + tva,
        currency:     'EUR',
        period_start: f.period_start || null,
        period_end:   f.period_end   || null,
        due_date:     f.due_date     || null,
        notes:        f.notes        || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-platform-invoices'] }); toast.success('Facture créée.'); setShowNew(false); setForm(EMPTY); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const upd: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'paid') upd.paid_at = new Date().toISOString();
      const { error } = await db.from('platform_invoices').update(upd).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-platform-invoices'] }); toast.success('Statut mis à jour.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPaid    = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount_ttc, 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount_ttc, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Facturation</h1>
          <p className="text-sm text-gray-400 mt-0.5">{invoices.length} facture{invoices.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setShowNew(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-xl text-[13px] font-bold hover:bg-[#7C3AED] shadow-sm">
          <Plus size={15} /> Nouvelle facture
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total encaissé',    value: `${totalPaid.toFixed(2)} €`,    color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CreditCard },
          { label: 'En attente',        value: `${totalPending.toFixed(2)} €`, color: 'text-amber-600',   bg: 'bg-amber-50',   icon: AlertTriangle },
          { label: 'Factures ce mois',  value: invoices.filter(i => new Date(i.created_at).getMonth() === new Date().getMonth()).length, color: 'text-blue-600', bg: 'bg-blue-50', icon: CreditCard },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', c.bg)}><c.icon size={16} className={c.color} /></div>
            <div><p className="text-xl font-black text-gray-900">{c.value}</p><p className="text-[11px] text-gray-400">{c.label}</p></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="N° facture, hôtel…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" />
        </div>
        {(['all', ...Object.keys(STATUS_META)] as StatusFilter[]).map(s => (
          <button key={s} onClick={() => setStatusF(s)}
            className={cn('px-3 py-2 rounded-xl text-[12px] font-semibold border transition-colors',
              statusF === s ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]' : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50')}>
            {s === 'all' ? 'Toutes' : STATUS_META[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">Numéro</th><th className="px-4 py-3">Hôtel</th><th className="px-4 py-3">Montant TTC</th><th className="px-4 py-3">Période</th><th className="px-4 py-3">Échéance</th><th className="px-4 py-3 text-center">Statut</th><th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Aucune facture.</td></tr>
            ) : filtered.map(inv => {
              const meta = STATUS_META[inv.status] ?? { label: inv.status, color: 'bg-gray-100 text-gray-500' };
              return (
                <tr key={inv.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3.5 font-mono text-[12px] font-bold text-gray-900">{inv.number}</td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-700">{inv.hotel_name ?? inv.hotel_id.slice(0,8)}</td>
                  <td className="px-4 py-3.5 font-bold text-[13px] text-gray-900">{inv.amount_ttc.toFixed(2)} {inv.currency}</td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-500">
                    {inv.period_start && inv.period_end
                      ? `${new Date(inv.period_start).toLocaleDateString('fr-FR')} – ${new Date(inv.period_end).toLocaleDateString('fr-FR')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-gray-500">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3.5 text-center">
                    <select
                      value={inv.status}
                      onChange={e => updateStatus.mutate({ id: inv.id, status: e.target.value })}
                      className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border-0 cursor-pointer outline-none', meta.color)}
                    >
                      {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => { toast.promise(downloadInvoicePDF(inv), { loading: 'Génération PDF…', success: 'PDF téléchargé.', error: 'Erreur PDF.' }); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50" title="Télécharger PDF">
                        <Download size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (inv.hotel_name) {
                            toast.success(`Email simulé vers ${inv.hotel_name}. (Intégration SMTP à configurer.)`);
                          } else {
                            toast.error('Email hôtel manquant.');
                          }
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50" title="Envoyer par email">
                        <Send size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New invoice drawer */}
      {showNew && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowNew(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-[440px] bg-white shadow-2xl z-50 flex flex-col overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-gray-900">Nouvelle facture</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
            </div>
            <div className="space-y-3">
              <Label label="Hôtel *">
                <select value={form.hotel_id} onChange={e => setForm(f => ({ ...f, hotel_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30">
                  <option value="">Sélectionner…</option>
                  {hotelList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </Label>
              <Label label="Montant HT (€) *"><FInp value={String(form.amount_ht)} onChange={v => setForm(f => ({ ...f, amount_ht: Number(v) }))} /></Label>
              <Label label="TVA (%)"><FInp value={String(form.tva_rate)} onChange={v => setForm(f => ({ ...f, tva_rate: Number(v) }))} /></Label>
              <div className="p-3 bg-gray-50 rounded-xl text-[12px] text-gray-600">
                TVA : <strong>{(Number(form.amount_ht) * Number(form.tva_rate) / 100).toFixed(2)} €</strong> — TTC : <strong>{(Number(form.amount_ht) * (1 + Number(form.tva_rate) / 100)).toFixed(2)} €</strong>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Label label="Début période"><input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></Label>
                <Label label="Fin période"><input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></Label>
              </div>
              <Label label="Échéance"><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" /></Label>
              <Label label="Notes">
                <textarea value={form.notes} rows={3} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 resize-none" />
              </Label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600">Annuler</button>
              <button onClick={() => { if (!form.hotel_id) { toast.error('Sélectionnez un hôtel.'); return; } createMut.mutate(form); }} disabled={createMut.isPending}
                className="flex-1 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                <Save size={13} />{createMut.isPending ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Label: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div><p className="text-[11px] font-bold text-gray-500 mb-1">{label}</p>{children}</div>
);

const FInp: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6]" />
);
