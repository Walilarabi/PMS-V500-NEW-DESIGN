import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  HeadphonesIcon, AlertTriangle, Eye, Building2, Users, CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAdmin } from '@/src/domains/admin/AdminContext';
import { cn } from '@/src/lib/utils';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const VIEWS = [
  { id: 'direction',        label: 'Direction',           desc: 'Vue dashboard, KPIs, Flowboard' },
  { id: 'reception',        label: 'Réception',           desc: 'Gestion arrivées/départs, réservations' },
  { id: 'gouvernante',      label: 'Gouvernante',         desc: 'Gestion du ménage, tâches HK' },
  { id: 'femme_de_chambre', label: 'Femme de chambre',    desc: 'Tâches assignées, statuts' },
  { id: 'maintenance',      label: 'Maintenance',         desc: 'Tickets de maintenance' },
  { id: 'petit_dejeuner',   label: 'Petit déjeuner',      desc: 'Suivi service petit-déjeuner' },
  { id: 'revenue_manager',  label: 'Revenue Manager',     desc: 'Revenue management, tarification' },
];

function useHotelList() {
  return useQuery<{ id: string; name: string; city: string | null; active: boolean }[]>({
    queryKey: ['admin-hotel-list'],
    queryFn: async () => {
      const { data } = await db.from('hotels').select('id, name, city, active').order('name');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

async function logSupportMode(adminEmail: string, hotelId: string, hotelName: string, viewRole: string) {
  await db.from('platform_logs').insert({
    admin_email: adminEmail,
    action:      'support_mode_activated',
    entity:      'hotel',
    entity_id:   hotelId,
    hotel_id:    hotelId,
    hotel_name:  hotelName,
    payload:     { view_role: viewRole },
    level:       'warning',
  });
}

export const AdminSupportMode: React.FC = () => {
  const { admin } = useAdmin();
  const { data: hotels = [] } = useHotelList();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedHotel, setSelectedHotel] = useState<{ id: string; name: string } | null>(null);
  const [selectedView, setSelectedView]   = useState<string | null>(null);
  const [hotelSearch, setHotelSearch]     = useState('');
  const [activating, setActivating]       = useState(false);

  const filteredHotels = hotels.filter(h => {
    const q = hotelSearch.toLowerCase();
    return !q || h.name.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q);
  });

  const handleActivate = async () => {
    if (!selectedHotel || !selectedView) return;
    setActivating(true);
    try {
      await logSupportMode(admin?.email ?? 'unknown', selectedHotel.id, selectedHotel.name, selectedView);
      toast.success('Mode support activé. Toutes les actions sont journalisées.');
      setStep(3);
    } catch {
      toast.error('Erreur lors de l\'activation du mode support.');
    } finally {
      setActivating(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedHotel(null);
    setSelectedView(null);
    setHotelSearch('');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">Mode Support</h1>
        <p className="text-sm text-gray-400 mt-0.5">Simuler la vue d'un utilisateur hôtel pour assistance</p>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-bold text-amber-800">Avertissement</p>
          <p className="text-[12px] text-amber-700 mt-0.5">
            Toutes les actions effectuées en mode support seront enregistrées dans le journal d'audit de la plateforme.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-3">
        {[1, 2, 3].map(n => (
          <React.Fragment key={n}>
            <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-bold',
              step >= n ? 'bg-[#8B5CF6] text-white' : 'bg-gray-100 text-gray-400')}>
              <span>{n}.</span>
              <span>{n === 1 ? 'Sélectionner hôtel' : n === 2 ? 'Choisir vue' : 'Confirmer'}</span>
            </div>
            {n < 3 && <ArrowRight size={14} className="text-gray-300 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Select hotel */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="relative">
            <input value={hotelSearch} onChange={e => setHotelSearch(e.target.value)} placeholder="Rechercher un hôtel…"
              className="w-full pl-4 pr-3 py-2.5 rounded-xl border border-gray-200 text-[13px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30" />
          </div>
          <div className="grid grid-cols-1 gap-2">
            {filteredHotels.map(h => (
              <button
                key={h.id}
                onClick={() => { setSelectedHotel({ id: h.id, name: h.name }); setStep(2); }}
                className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/3 text-left transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                  <Building2 size={15} className="text-[#8B5CF6]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13px] text-gray-900">{h.name}</p>
                  {h.city && <p className="text-[11px] text-gray-400">{h.city}</p>}
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', h.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400')}>
                  {h.active ? 'Actif' : 'Inactif'}
                </span>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-[#8B5CF6] transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select view */}
      {step === 2 && selectedHotel && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-[#8B5CF6]/8 rounded-xl">
            <Building2 size={14} className="text-[#8B5CF6]" />
            <span className="text-[13px] font-bold text-[#8B5CF6]">{selectedHotel.name}</span>
            <button onClick={() => setStep(1)} className="ml-auto text-[11px] text-gray-400 hover:text-gray-600 underline">Changer</button>
          </div>
          <p className="text-[12px] font-bold text-gray-500">Sélectionnez la vue à simuler :</p>
          <div className="grid grid-cols-2 gap-2">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedView(v.id)}
                className={cn('p-4 rounded-2xl border text-left transition-all',
                  selectedView === v.id ? 'border-[#8B5CF6] bg-[#8B5CF6]/8' : 'border-gray-100 bg-white hover:border-gray-200')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users size={13} className={selectedView === v.id ? 'text-[#8B5CF6]' : 'text-gray-400'} />
                  <span className={cn('font-bold text-[13px]', selectedView === v.id ? 'text-[#8B5CF6]' : 'text-gray-800')}>{v.label}</span>
                  {selectedView === v.id && <CheckCircle2 size={13} className="text-[#8B5CF6] ml-auto" />}
                </div>
                <p className="text-[11px] text-gray-400">{v.desc}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600">Retour</button>
            <button
              onClick={() => selectedView && setStep(3)}
              disabled={!selectedView}
              className="flex-1 py-2 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold disabled:opacity-40 hover:bg-[#7C3AED]"
            >
              Continuer
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm / Activate */}
      {step === 3 && selectedHotel && selectedView && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center">
                <Eye size={22} className="text-[#8B5CF6]" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Résumé</h3>
                <p className="text-[12px] text-gray-400">Vérifiez avant d'activer</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Hôtel',    value: selectedHotel.name },
                { label: 'Vue',      value: VIEWS.find(v => v.id === selectedView)?.label ?? selectedView },
                { label: 'Admin',    value: admin?.email ?? '—' },
                { label: 'Journalisé', value: 'Oui — journal d\'audit plateforme' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-[12px] text-gray-400 w-24 shrink-0">{r.label}</span>
                  <span className="text-[13px] font-bold text-gray-900">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-[12px] text-red-700">
              <strong>Cette session sera enregistrée.</strong> Toutes les actions effectuées en mode support
              sont journalisées dans le journal d'audit avec votre identifiant admin.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={handleReset} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-50">
              Annuler
            </button>
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex-1 py-2.5 rounded-xl bg-[#8B5CF6] text-white text-[13px] font-bold hover:bg-[#7C3AED] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <HeadphonesIcon size={14} />
              {activating ? 'Activation…' : 'Activer le mode support'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 text-center">Après activation, ouvrez le PMS hôtel dans un nouvel onglet pour voir la vue simulée.</p>
        </div>
      )}
    </div>
  );
};
