/**
 * FLOWTYM — GroupBillingPanel (T17).
 * Facturation groupe : globale / individuelle / mixte
 * Recherche multi-réservations debounced
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Users, Search, Plus, X, Loader2, CheckCircle, AlertCircle, Building2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useCreateInvoice, useAddInvoiceLine } from '@/src/domains/billing/hooks';
import { useAuth } from '@/src/domains/auth/AuthContext';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

type BillingMode = 'global' | 'individual' | 'mixed';

interface ReservationResult {
  id: string;
  confirmation_number: string;
  guest_name?: string;
  check_in: string;
  check_out: string;
  total_price?: number;
}

const MODE_CONFIG: Record<BillingMode, { label: string; description: string }> = {
  global:     { label: 'Globale',      description: 'Une seule facture pour tout le groupe' },
  individual: { label: 'Individuelle', description: 'Une facture par réservation' },
  mixed:      { label: 'Mixte',        description: 'Certains frais en commun, d\'autres individuels' },
};

export function GroupBillingPanel() {
  const { session } = useAuth();
  const hotelId = session?.tenantId ?? '';

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ReservationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<ReservationResult[]>([]);
  const [mode, setMode] = useState<BillingMode>('global');
  const [groupName, setGroupName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);

  const createInvoice = useCreateInvoice();
  const addLine = useAddInvoiceLine();

  const searchReservations = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('reservations')
        .select('id, confirmation_number, check_in, check_out, total_price, guests(name)')
        .or(`confirmation_number.ilike.%${q}%,guests.name.ilike.%${q}%`)
        .not('status', 'eq', 'cancelled')
        .limit(10);
      setResults((data ?? []).map((r: {
        id: string;
        confirmation_number: string;
        check_in: string;
        check_out: string;
        total_price?: number;
        guests?: { name: string };
      }) => ({
        id: r.id,
        confirmation_number: r.confirmation_number,
        guest_name: r.guests?.name,
        check_in: r.check_in,
        check_out: r.check_out,
        total_price: r.total_price,
      })));
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchReservations(search), 350);
    return () => clearTimeout(t);
  }, [search, searchReservations]);

  const toggleSelect = (r: ReservationResult) => {
    setSelected(prev =>
      prev.find(p => p.id === r.id)
        ? prev.filter(p => p.id !== r.id)
        : [...prev, r],
    );
  };

  const handleGenerate = async () => {
    if (selected.length === 0) return;
    setError(null);
    setIsGenerating(true);
    setGeneratedCount(0);
    try {
      if (mode === 'global') {
        const { invoice, folio } = await createInvoice.mutateAsync({
          billToName: groupName || `Groupe — ${selected.map(r => r.confirmation_number).join(', ')}`,
          notes: `Facturation groupe — ${selected.length} réservations`,
        });
        for (const r of selected) {
          if (r.total_price && r.total_price > 0) {
            await addLine.mutateAsync({
              folioId:     folio.id,
              invoiceId:   invoice.id,
              description: `Hébergement ${r.confirmation_number}${r.guest_name ? ' — ' + r.guest_name : ''}`,
              serviceDate: r.check_in,
              quantity:    1,
              unitPriceHt: r.total_price / 1.1,
              tvaRate:     10,
              source:      'manual',
            });
          }
        }
        setGeneratedCount(1);
      } else {
        for (const r of selected) {
          const { invoice, folio } = await createInvoice.mutateAsync({
            reservationId: r.id,
            billToName:    r.guest_name,
            notes:         mode === 'mixed' ? `Facturation mixte — groupe ${groupName}` : undefined,
          });
          if (r.total_price && r.total_price > 0) {
            await addLine.mutateAsync({
              folioId:     folio.id,
              invoiceId:   invoice.id,
              description: `Hébergement`,
              serviceDate: r.check_in,
              quantity:    1,
              unitPriceHt: r.total_price / 1.1,
              tvaRate:     10,
              source:      'manual',
            });
          }
          setGeneratedCount(c => c + 1);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB]">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Users size={16} className="text-purple-500" />
          <h2 className="text-base font-bold text-gray-900">Facturation groupe</h2>
        </div>
        <p className="text-xs text-gray-400">Sélectionnez les réservations et le mode de facturation</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <AlertCircle size={12} />
            {error}
          </div>
        )}

        {generatedCount > 0 && !isGenerating && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle size={12} />
            {generatedCount} facture(s) générée(s) avec succès.
          </div>
        )}

        {/* Mode selector */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">Mode de facturation</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(MODE_CONFIG) as [BillingMode, typeof MODE_CONFIG[BillingMode]][]).map(([k, cfg]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={cn('text-left p-3 rounded-xl border text-xs transition-all', mode === k ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300')}
              >
                <p className={cn('font-semibold mb-0.5', mode === k ? 'text-purple-700' : 'text-gray-700')}>{cfg.label}</p>
                <p className="text-gray-400 leading-tight">{cfg.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Group name */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Nom du groupe</label>
          <div className="relative">
            <Building2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm"
              placeholder="Ex : Congrès SNCF, Mariage Dupont…"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />
          </div>
        </div>

        {/* Search */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Ajouter des réservations</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm"
              placeholder="N° confirmation, nom du client…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {isSearching && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
          </div>

          {results.length > 0 && (
            <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {results.map(r => {
                const isSelected = selected.some(s => s.id === r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleSelect(r)}
                    className={cn('w-full text-left px-3 py-2.5 flex items-center justify-between border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors', isSelected && 'bg-purple-50')}
                  >
                    <div>
                      <span className="text-xs font-semibold text-gray-800">{r.confirmation_number}</span>
                      {r.guest_name && <span className="text-xs text-gray-400 ml-2">{r.guest_name}</span>}
                      <div className="text-[11px] text-gray-400">{r.check_in} → {r.check_out}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.total_price && <span className="text-xs text-gray-600">{fmtEur(r.total_price)}</span>}
                      {isSelected ? (
                        <CheckCircle size={14} className="text-purple-600" />
                      ) : (
                        <Plus size={14} className="text-gray-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected reservations */}
        {selected.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              {selected.length} réservation(s) sélectionnée(s) — total : {fmtEur(selected.reduce((s, r) => s + (r.total_price ?? 0), 0))}
            </label>
            <div className="space-y-1.5">
              {selected.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-3 py-2">
                  <div>
                    <span className="text-xs font-semibold">{r.confirmation_number}</span>
                    {r.guest_name && <span className="text-xs text-gray-400 ml-2">{r.guest_name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.total_price && <span className="text-xs text-gray-600">{fmtEur(r.total_price)}</span>}
                    <button onClick={() => toggleSelect(r)} className="text-gray-300 hover:text-red-400">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-gray-100 bg-white shrink-0">
        <Button
          onClick={handleGenerate}
          disabled={selected.length === 0 || isGenerating}
          className="w-full bg-purple-600 text-white font-bold gap-2"
        >
          {isGenerating ? (
            <><Loader2 size={13} className="animate-spin" /> Génération en cours… ({generatedCount}/{mode === 'global' ? 1 : selected.length})</>
          ) : (
            <>
              <CheckCircle size={13} />
              Générer {mode === 'global' ? '1 facture groupe' : `${selected.length} facture(s)`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
