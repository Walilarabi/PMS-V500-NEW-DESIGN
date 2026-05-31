/**
 * FLOWTYM — AdvancedTransferModal (T9).
 * 6 destinations : folio / chambre / réservation / société / compte interne / autre folio
 * Recherche résa debounced · Raison obligatoire · Audit log écrit dans transfer.service
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Search, Loader2, XCircle, AlertCircle, CheckCircle, Building2, BedDouble, CreditCard, Briefcase, FileText } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import {
  transferLineToFolio,
  transferLineToReservation,
  transferLineToCompany,
  transferLineToHouseAccount,
} from '@/src/domains/billing/transfer.service';
import { useHouseAccounts } from '@/src/domains/billing/hooks';
import type { InvoiceLineRow } from '@/src/domains/billing/schemas';
import type { FolioRow } from '@/src/domains/billing/schemas';
import { useAuth } from '@/src/domains/auth/AuthContext';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

type Destination = 'folio' | 'reservation' | 'company' | 'house_account';

const DEST_CONFIG: Record<Destination, { label: string; icon: React.ReactNode; color: string }> = {
  folio:         { label: 'Autre folio',          icon: <FileText size={14} />,    color: 'text-purple-600' },
  reservation:   { label: 'Autre réservation',    icon: <BedDouble size={14} />,   color: 'text-blue-600' },
  company:       { label: 'Compte société',        icon: <Building2 size={14} />,   color: 'text-emerald-600' },
  house_account: { label: 'Compte interne',        icon: <CreditCard size={14} />,  color: 'text-orange-600' },
};

interface AdvancedTransferModalProps {
  isOpen: boolean;
  line: InvoiceLineRow | null;
  folios: FolioRow[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AdvancedTransferModal({
  isOpen,
  line,
  folios,
  onClose,
  onSuccess,
}: AdvancedTransferModalProps) {
  const { session } = useAuth();
  const hotelId = session?.tenantId ?? '';

  const [destination, setDestination] = useState<Destination>('folio');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);

  // Folio destination
  const [targetFolioId, setTargetFolioId] = useState('');

  // Reservation search
  const [resvSearch, setResvSearch] = useState('');
  const [resvResults, setResvResults] = useState<Array<{ id: string; confirmation_number: string; guest_name?: string }>>([]);
  const [resvLoading, setResvLoading] = useState(false);
  const [selectedResvId, setSelectedResvId] = useState('');

  // Company search
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState<Array<{ id: string; name: string }>>([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // House account
  const { data: houseAccounts = [] } = useHouseAccounts(true);
  const [selectedHaId, setSelectedHaId] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setDestination('folio');
      setReason('');
      setError(null);
      setSuccess(false);
      setTargetFolioId('');
      setResvSearch('');
      setResvResults([]);
      setSelectedResvId('');
      setCompanySearch('');
      setCompanyResults([]);
      setSelectedCompanyId('');
      setSelectedHaId('');
    }
  }, [isOpen]);

  // Debounced reservation search
  const searchReservations = useCallback(async (q: string) => {
    if (q.length < 2) { setResvResults([]); return; }
    setResvLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('reservations')
        .select('id, confirmation_number, guests(name)')
        .or(`confirmation_number.ilike.%${q}%`)
        .limit(8);
      setResvResults(
        (data ?? []).map((r: { id: string; confirmation_number: string; guests?: { name: string } }) => ({
          id: r.id,
          confirmation_number: r.confirmation_number,
          guest_name: r.guests?.name,
        })),
      );
    } finally {
      setResvLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchReservations(resvSearch), 350);
    return () => clearTimeout(t);
  }, [resvSearch, searchReservations]);

  // Debounced company search
  const searchCompanies = useCallback(async (q: string) => {
    if (q.length < 2) { setCompanyResults([]); return; }
    setCompanyLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('companies')
        .select('id, name')
        .ilike('name', `%${q}%`)
        .limit(8);
      setCompanyResults(data ?? []);
    } finally {
      setCompanyLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchCompanies(companySearch), 350);
    return () => clearTimeout(t);
  }, [companySearch, searchCompanies]);

  if (!isOpen || !line) return null;

  const canSubmit = () => {
    if (!reason.trim()) return false;
    switch (destination) {
      case 'folio':         return !!targetFolioId && targetFolioId !== line.folio_id;
      case 'reservation':   return !!selectedResvId;
      case 'company':       return !!selectedCompanyId;
      case 'house_account': return !!selectedHaId;
    }
  };

  const handleTransfer = async () => {
    if (!canSubmit()) return;
    setError(null);
    setIsPending(true);
    try {
      switch (destination) {
        case 'folio':
          await transferLineToFolio(hotelId, line.id, targetFolioId, reason);
          break;
        case 'reservation':
          await transferLineToReservation(hotelId, line.id, selectedResvId, reason);
          break;
        case 'company':
          await transferLineToCompany(hotelId, line.id, selectedCompanyId, reason);
          break;
        case 'house_account':
          await transferLineToHouseAccount(hotelId, line.id, selectedHaId, reason);
          break;
      }
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfert échoué.');
    } finally {
      setIsPending(false);
    }
  };

  const otherFolios = folios.filter(f => f.id !== line.folio_id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
              <ArrowRight size={16} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Transférer une ligne</h2>
              <p className="text-xs text-gray-400 truncate max-w-[250px]">{line.description} · {fmtEur(line.total_ttc ?? 0)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={12} />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle size={12} />
              Transfert effectué avec succès.
            </div>
          )}

          {/* Destination selector */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Destination</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(DEST_CONFIG) as [Destination, typeof DEST_CONFIG[Destination]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setDestination(key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    destination === key
                      ? 'border-purple-300 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600',
                  )}
                >
                  <span className={destination === key ? cfg.color : 'text-gray-400'}>{cfg.icon}</span>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Destination-specific form */}
          {destination === 'folio' && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Folio de destination</label>
              {otherFolios.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun autre folio disponible sur cette facture.</p>
              ) : (
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={targetFolioId}
                  onChange={e => setTargetFolioId(e.target.value)}
                >
                  <option value="">— Choisir un folio —</option>
                  {otherFolios.map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {destination === 'reservation' && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Rechercher une réservation</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm"
                  placeholder="N° confirmation ou nom…"
                  value={resvSearch}
                  onChange={e => { setResvSearch(e.target.value); setSelectedResvId(''); }}
                />
                {resvLoading && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
              </div>
              {resvResults.length > 0 && (
                <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {resvResults.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedResvId(r.id); setResvSearch(r.confirmation_number); setResvResults([]); }}
                      className={cn('w-full text-left px-3 py-2 text-sm hover:bg-purple-50 border-b border-gray-50 last:border-0', selectedResvId === r.id && 'bg-purple-50')}
                    >
                      <span className="font-medium">{r.confirmation_number}</span>
                      {r.guest_name && <span className="text-gray-400 ml-2 text-xs">{r.guest_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {destination === 'company' && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Rechercher une société</label>
              <div className="relative">
                <Briefcase size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm"
                  placeholder="Nom de la société…"
                  value={companySearch}
                  onChange={e => { setCompanySearch(e.target.value); setSelectedCompanyId(''); }}
                />
                {companyLoading && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
              </div>
              {companyResults.length > 0 && (
                <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {companyResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCompanyId(c.id); setCompanySearch(c.name); setCompanyResults([]); }}
                      className={cn('w-full text-left px-3 py-2 text-sm hover:bg-purple-50 border-b border-gray-50 last:border-0', selectedCompanyId === c.id && 'bg-purple-50')}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {destination === 'house_account' && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Compte interne</label>
              {houseAccounts.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun compte interne actif.</p>
              ) : (
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={selectedHaId}
                  onChange={e => setSelectedHaId(e.target.value)}
                >
                  <option value="">— Choisir un compte —</option>
                  {houseAccounts.map(ha => (
                    <option key={ha.id} value={ha.id}>{ha.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              Motif du transfert <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
              placeholder="Ex : erreur de folio, transfert groupe, facturation société…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-gray-100 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
            Annuler
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!canSubmit() || isPending}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-2"
          >
            {isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ArrowRight size={13} />
            )}
            Transférer
          </Button>
        </div>
      </div>
    </div>
  );
}
