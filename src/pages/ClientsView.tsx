import React from 'react';
import { 
  Search, 
  Filter, 
  UserPlus, 
  Download,
  MoreVertical,
  MoreHorizontal,
  Mail,
  Phone,
  Briefcase,
  Users,
  Crown,
  Star,
  Medal,
  Gem,
  ArrowRight
} from 'lucide-react';
import { Card, CardHeader } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';

import { useReservations } from '@/src/contexts/ReservationContext';

export const ClientsView = () => {
  const { reservations } = useReservations();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [segmentFilter, setSegmentFilter] = React.useState('ALL');
  const [loyaltyFilter, setLoyaltyFilter] = React.useState('ALL');
  const [countryFilter, setCountryFilter] = React.useState('ALL');

  const stats = [
    { label: 'Clients totaux', value: (1453 + (reservations.length - 5)).toLocaleString(), sub: `+${reservations.length} ce mois-ci`, icon: Users, bg: 'bg-[#8B5CF6]/10', color: 'text-[#8B5CF6]' },
    { label: 'Taux de fidélité', value: '78%', sub: 'Clients récurrents', icon: Star, bg: 'bg-emerald-50', color: 'text-emerald-500' },
    { label: 'CLV moyen', value: '1 240 €', sub: '+5.3% vs mois dernier', icon: Crown, bg: 'bg-amber-50', color: 'text-amber-500' },
    { label: 'VIP actifs', value: '42', sub: 'Action requise', icon: Gem, bg: 'bg-blue-50', color: 'text-blue-500' },
  ];

  const clients = [
    ...reservations.map(res => ({
        name: res.client,
        email: res.email || 'client@example.com',
        phone: res.phone || '+33 6 00 00 00 00',
        company: res.company || 'Individuel',
        segment: 'leisure',
        loyalty: 'medal',
        lastStay: res.arrival,
        totalSpent: 400
    })).slice(0, 5),
    { name: 'Pierre Bernard', email: 'pierre.b@orange.fr', phone: '+33 6 98 76 54 32', company: 'Tech Corp', segment: 'business', loyalty: 'star', lastStay: '23/04/2026', totalSpent: 840 },
    { name: 'Sophie Dubois', email: 'sophie.d@yahoo.fr', phone: '+33 6 54 32 10 98', company: 'Individuel', segment: 'leisure', loyalty: 'medal', lastStay: '07/04/2026', totalSpent: 360 },
  ];

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.phone.includes(searchQuery) ||
                         (client.company && client.company.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSegment = segmentFilter === 'ALL' || client.segment === segmentFilter;
    const matchesLoyalty = loyaltyFilter === 'ALL' || client.loyalty === loyaltyFilter;
    const matchesCountry = countryFilter === 'ALL' || (client as any).country === countryFilter; // Assuming country field

    return matchesSearch && matchesSegment && matchesLoyalty && matchesCountry;
  });

  const getSegmentIcon = (segment: string) => {
    switch (segment) {
      case 'business': return <Briefcase size={14} />;
      case 'vip': return <Crown size={14} />;
      default: return <Users size={14} />;
    }
  };

  const getLoyaltyIcon = (loyalty: string) => {
    switch (loyalty) {
      case 'star': return <Star size={14} fill="currentColor" />;
      case 'medal': return <Medal size={14} fill="currentColor" />;
      case 'crown': return <Crown size={14} fill="currentColor" />;
      case 'gem': return <Gem size={14} fill="currentColor" />;
      default: return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F9FAFB]">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 leading-tight">Fiches Clients</h1>
           <p className="text-gray-500 text-sm font-medium mt-1">Consultez et gérez la base de données de vos clients</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="gap-2 px-4 shadow-sm bg-white"><Download size={14} /> Exporter</Button>
           <Button className="gap-2 shadow-lg shadow-[#8B5CF6]/20">
             <UserPlus size={16} /> Nouveau client
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Card key={i} className="p-4 flex flex-col justify-between">
             <div className="flex items-start justify-between">
                <div className={cn("p-2.5 rounded-xl", s.bg, s.color)}>
                   <s.icon size={20} />
                </div>
                <Badge variant={s.color.includes('emerald') ? 'success' : 'neutral'} className="text-[10px] py-0.5">Stats</Badge>
             </div>
             <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900 leading-none">{s.value}</div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">{s.label}</div>
                <p className={cn("text-[10px] font-bold mt-2", s.color.includes('emerald') ? 'text-emerald-500' : 'text-gray-400')}>{s.sub}</p>
             </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
           <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-1 focus:ring-[#8B5CF6] outline-none w-72" 
                  placeholder="Nom, email, tél, société..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                 <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl relative group">
                    <select 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      value={segmentFilter}
                      onChange={(e) => setSegmentFilter(e.target.value)}
                    >
                      <option value="ALL">Tous segments</option>
                      <option value="leisure">Leisure</option>
                      <option value="business">Business</option>
                      <option value="vip">VIP</option>
                    </select>
                    <span className="text-[11px] font-bold text-gray-400 capitalize">{segmentFilter === 'ALL' ? 'Segments' : segmentFilter}</span>
                    <ArrowRight size={10} className="text-gray-300" />
                 </div>
                 <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl relative group">
                    <select 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      value={loyaltyFilter}
                      onChange={(e) => setLoyaltyFilter(e.target.value)}
                    >
                      <option value="ALL">Toute fidélité</option>
                      <option value="medal">Bronze</option>
                      <option value="star">Argent</option>
                      <option value="crown">Or</option>
                      <option value="gem">Diamant</option>
                    </select>
                    <span className="text-[11px] font-bold text-gray-400 capitalize">{loyaltyFilter === 'ALL' ? 'Fidélité' : loyaltyFilter}</span>
                    <ArrowRight size={10} className="text-gray-300" />
                 </div>
                 <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl relative group">
                    <select 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      value={countryFilter}
                      onChange={(e) => setCountryFilter(e.target.value)}
                    >
                      <option value="ALL">Tous pays</option>
                      <option value="FR">France</option>
                      <option value="UK">UK</option>
                      <option value="US">USA</option>
                    </select>
                    <span className="text-[11px] font-bold text-gray-400 capitalize">{countryFilter === 'ALL' ? 'Pays' : countryFilter}</span>
                    <ArrowRight size={10} className="text-gray-300" />
                 </div>
                 <Button variant="outline" size="sm" className="font-bold gap-2 focus:ring-1 focus:ring-[#8B5CF6]"><Filter size={14} /> Filtres</Button>
              </div>
           </div>
           <Badge variant="neutral" className="font-bold">Total {filteredClients.length} affichés</Badge>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F9FAFB] border-b border-gray-100">
               <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                 <th className="px-6 py-4">Client / Société</th>
                 <th className="px-6 py-4">Contact</th>
                 <th className="px-6 py-4">Fidélité / Segment</th>
                 <th className="px-6 py-4">Préférences</th>
                 <th className="px-6 py-4">Dernier séjour</th>
                 <th className="px-6 py-4 text-right">Dépenses Net</th>
                 <th className="px-6 py-4 text-center">Actions</th>
               </tr>
            </thead>
          <tbody className="divide-y divide-gray-50">
               {filteredClients.map((client, i) => (
                 <tr key={i} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center font-bold text-[#8B5CF6]">
                             {client.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex flex-col">
                             <span className="font-bold text-gray-900 text-[13px]">{client.name}</span>
                             <span className="text-[11px] text-gray-400 font-bold uppercase tracking-tight mt-0.5">{client.company}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-5 min-w-[200px]">
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-gray-500">
                             <Mail size={12} className="text-[#8B5CF6]" />
                             <span className="text-[11px] font-medium">{client.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                             <Phone size={12} />
                             <span className="text-[11px] font-medium">{client.phone}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                         <div className={cn(
                           "w-8 h-8 rounded-xl flex items-center justify-center",
                           client.loyalty === 'crown' ? 'bg-amber-100 text-amber-600' : 
                           client.loyalty === 'gem' ? 'bg-blue-100 text-blue-600' :
                           'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                         )}>
                           {getLoyaltyIcon(client.loyalty)}
                         </div>
                         <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-gray-500">
                            {getSegmentIcon(client.segment)}
                            <span className="text-[10px] font-bold uppercase tracking-tight">{client.segment}</span>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] font-bold bg-[#8B5CF6]/5 text-[#8B5CF6] px-1.5 py-0.5 rounded">Étage moyen</span>
                          {client.segment === 'leisure' && <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Sans gluten</span>}
                       </div>
                    </td>
                    <td className="px-6 py-5 font-bold text-gray-400 text-[13px]">{client.lastStay}</td>
                    <td className="px-6 py-5 text-right font-bold text-gray-900 text-[13px]">{client.totalSpent} €</td>
                    <td className="px-6 py-5 text-center">
                       <button className="p-2 hover:bg-[#8B5CF6]/10 text-gray-400 hover:text-[#8B5CF6] rounded-xl transition-colors">
                          <MoreHorizontal size={20} />
                       </button>
                    </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Footer list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card className="p-6">
            <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center justify-between">
               Top clients (par dépenses)
               <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-wider">Voir tout</span>
            </h3>
            <div className="space-y-4">
               {clients.map((c, i) => (
                 <div key={i} className="flex items-center gap-4 group">
                    <div className="text-xs font-bold text-gray-300 w-4">{i+1}</div>
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-900">{c.name.split(' ').map(n=>n[0]).join('')}</div>
                    <div className="flex-1">
                       <div className="text-[13px] font-bold text-gray-900">{c.name}</div>
                       <div className="w-full bg-gray-100 h-1 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-[#8B5CF6]" style={{ width: `${(c.totalSpent / 4250) * 100}%` }} />
                       </div>
                    </div>
                    <div className="text-[13px] font-bold text-[#8B5CF6] group-hover:underline">{c.totalSpent} €</div>
                 </div>
               ))}
            </div>
         </Card>
         
         <Card className="p-6">
            <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center justify-between">
               Clients récents
               <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Nouveaux</span>
            </h3>
            <div className="space-y-4">
               {[
                 { name: 'Julien Moreau', stay: '25/04/2026', tag: 'NOUVEAU' },
                 { name: 'Emma Lefebvre', stay: '22/04/2026', tag: 'NOUVEAU' },
                 { name: 'Thomas Petit', stay: '20/04/2026', tag: 'NOUVEAU' },
                 { name: 'Sophie Martin', stay: '15/04/2026', tag: 'RETOUR' },
               ].map((c, i) => (
                 <div key={i} className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-white",
                      i % 2 === 0 ? 'bg-[#8B5CF6]' : 'bg-emerald-500'
                    )}>{c.name.split(' ').map(n=>n[0]).join('')}</div>
                    <div className="flex-1">
                       <div className="text-[13px] font-bold text-gray-900">{c.name}</div>
                       <div className="text-[11px] text-gray-400">Dernier séjour: {c.stay}</div>
                    </div>
                    <Badge variant={c.tag === 'NOUVEAU' ? 'success' : 'info'} className="text-[9px] py-0">{c.tag}</Badge>
                 </div>
               ))}
            </div>
         </Card>
      </div>
    </div>
  );
};
