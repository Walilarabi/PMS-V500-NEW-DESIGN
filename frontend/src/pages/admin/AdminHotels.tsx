import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, CheckCircle2, XCircle, Search } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';

interface Hotel {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  currency: string | null;
}

function useAllHotels() {
  return useQuery<Hotel[]>({
    queryKey: ['admin-hotels'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('hotels')
        .select('id, name, city, country, email, phone, active, currency')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Hotel[];
    },
    staleTime: 60_000,
  });
}

export const AdminHotels: React.FC = () => {
  const { data: hotels = [], isLoading } = useAllHotels();
  const [search, setSearch] = useState('');

  const filtered = hotels.filter(h =>
    !search.trim() ||
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.city?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Hôtels</h2>
          <p className="text-sm text-gray-400 mt-0.5">{hotels.length} hôtel{hotels.length > 1 ? 's' : ''} sur la plateforme</p>
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-[13px] outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-colors placeholder:text-gray-300"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <th className="px-4 py-3">Hôtel</th>
              <th className="px-4 py-3">Localisation</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Devise</th>
              <th className="px-4 py-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td className="px-4 py-8 text-gray-400 text-sm" colSpan={5}>Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-4 py-10 text-center text-gray-400 text-sm" colSpan={5}>Aucun hôtel trouvé.</td></tr>
            ) : filtered.map(h => (
              <tr key={h.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                      <Building2 size={14} className="text-[#8B5CF6]" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900">{h.name}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{h.id.slice(0, 8)}…</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-[13px] text-gray-600">
                    <MapPin size={12} className="text-gray-300" />
                    {[h.city, h.country].filter(Boolean).join(', ') || '—'}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-[12px] text-gray-500">
                  <div>{h.email || '—'}</div>
                  {h.phone && <div className="text-gray-400">{h.phone}</div>}
                </td>
                <td className="px-4 py-3.5 text-[12px] font-mono text-gray-500">
                  {h.currency ?? '—'}
                </td>
                <td className="px-4 py-3.5 text-center">
                  {h.active ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={10} /> Actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                      <XCircle size={10} /> Inactif
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
