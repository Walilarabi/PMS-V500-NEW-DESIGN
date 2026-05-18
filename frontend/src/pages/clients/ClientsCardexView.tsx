import React from 'react';
import { Search, User, Mail, Phone, ShieldAlert } from 'lucide-react';
import { Card, CardHeader } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { useGuests } from '@/src/domains/guests/hooks';

export const ClientsCardexView = () => {
  const [search, setSearch] = React.useState('');
  const guestsQ = useGuests({ limit: 200, search });
  const guests = guestsQ.data?.rows ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9FAFB]" data-testid="clients-cardex-view">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cardex clients</h1>
        <p className="text-sm text-gray-500 mt-1">Fiches particuliers avec contact, segment et niveau de fidélité.</p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-1 focus:ring-[#8B5CF6] outline-none"
            />
          </div>
          <Badge variant="neutral" className="font-bold">{guestsQ.data?.total ?? guests.length} clients</Badge>
        </CardHeader>

        {guestsQ.isError && (
          <div className="px-6 pb-4 text-sm text-red-600 flex items-center gap-2">
            <ShieldAlert size={14} /> Chargement impossible.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F9FAFB] border-b border-gray-100">
              <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Segment</th>
                <th className="px-6 py-4">Fidélité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {guests.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <User size={14} className="text-[#8B5CF6]" />
                    {[g.first_name, g.last_name].filter(Boolean).join(' ').trim() || g.last_name}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1"><Mail size={12} /> {g.email || '—'}</span>
                      <span className="flex items-center gap-1"><Phone size={12} /> {g.phone || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs uppercase font-bold text-gray-500">{g.segment || '—'}</td>
                  <td className="px-6 py-4 text-xs uppercase font-bold text-gray-500">{g.loyalty_level || 'none'}</td>
                </tr>
              ))}
              {!guestsQ.isLoading && guests.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-sm text-gray-500" colSpan={4}>
                    Aucun client trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ClientsCardexView;
