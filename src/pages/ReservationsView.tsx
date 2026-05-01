import React from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  Plus,
  Calendar,
  Clock,
  User,
  MoreVertical,
  Globe,
  Zap,
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  ArrowUpRight,
  Monitor,
  Users,
  LayoutGrid,
  Menu,
  List,
  Eye,
  Copy,
  Trash2,
  Pencil,
  Send,
  CreditCard,
  ChevronDown
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';

import { useReservations, Reservation } from '@/src/contexts/ReservationContext';
import ReservationFormModal, { ReservationFormData } from '@/src/components/modals/ReservationFormModal';

const STATUS_DATA = [
  { name: 'Confirmées', value: 4, color: '#10B981' },
  { name: 'Check-in', value: 2, color: '#8B5CF6' },
  { name: 'En attente', value: 3, color: '#F59E0B' },
  { name: 'Annulées', value: 1, color: '#EF4444' },
];

export const ReservationsView = () => {
  const { reservations, addReservation } = useReservations();
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const stats = [
    { label: 'Dossiers', value: reservations.length.toString(), sub: 'Actifs', icon: CheckCircle2, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/5' },
    { label: 'Confirmée', value: '1', sub: '+ 2 aujourd\'hui', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Check-in', value: '2', sub: 'Aujourd\'hui', icon: Clock, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/5' },
    { label: 'CA total', value: '2 950 €', sub: '+ 8.3% vs hier', icon: ArrowUpRight, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'En attente', value: '3', sub: 'Action requise', icon: HelpCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
  ];

  const paymentFollowUps = [
    { ref: 'RES-095', client: 'Sophie Dubois', amount: '360 €', status: 'Lien expiré', statusColor: 'red', expire: 'Expiré', room: '102' },
    { ref: 'RES-094', client: 'Pierre Bernard', amount: '360 €', status: 'Attente', statusColor: 'amber', expire: '0h 35m', room: '102' },
    { ref: 'RES-096', client: 'Marie Martin', amount: '360 €', status: 'Relancé', statusColor: 'blue', expire: '1j 4h', room: '102' },
  ];

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [channelFilter, setChannelFilter] = React.useState('ALL');
  const [roomTypeFilter, setRoomTypeFilter] = React.useState('ALL');

  const filteredReservations = reservations.map(res => ({
    ref: res.id,
    status: res.status.toUpperCase(),
    client: res.client,
    email: res.email || 'contact@client.com',
    pers: res.guests?.adults || 2,
    checkin: res.arrival,
    checkout: res.departure,
    nights: 1, // simplified
    amount: '400.50 €',
    solde: res.payment === 'Payé' ? '0 €' : '400.50 €',
    soldeColor: res.payment === 'Payé' ? 'emerald' : 'red',
    channel: (res.source || 'DIRECT').toUpperCase(),
    room: res.room,
    roomType: res.roomType
  })).filter(res => {
    const matchesSearch = res.client.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         res.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         res.room.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'ALL' || res.status === statusFilter;
    const matchesChannel = channelFilter === 'ALL' || res.channel === channelFilter;
    const matchesRoomType = roomTypeFilter === 'ALL' || res.roomType === roomTypeFilter;

    return matchesSearch && matchesStatus && matchesChannel && matchesRoomType;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F8F9FD]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Réservations</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">Gérez toutes vos réservations en un coup d'œil</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="bg-white border-gray-100 font-bold gap-2 px-4 shadow-sm">
             <Download size={16} className="text-gray-400" /> Exporter
          </Button>
          <Button variant="outline" size="sm" className="bg-white border-gray-100 font-bold gap-2 px-4 shadow-sm">
             <FileSpreadsheet size={16} className="text-emerald-500" /> Excel
          </Button>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#8B5CF6] font-bold gap-2 px-6 py-2.5 rounded-xl shadow-lg shadow-[#8B5CF6]/20"
          >
             <Plus size={18} /> Nouvelle réservation
          </Button>
          <button className="p-2 bg-white border border-gray-100 rounded-xl text-[#8B5CF6] shadow-sm hover:bg-gray-50 transition-colors">
             <MoreVertical size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
             {stats.map((s, i) => (
                <Card key={i} className="p-5 border-transparent bg-white shadow-sm flex flex-col gap-4 group hover:shadow-md transition-shadow">
                   <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-xl group-hover:scale-110 transition-transform", s.bg, s.color)}>
                         <s.icon size={20} />
                      </div>
                      <div>
                         <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                      </div>
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                      <p className={cn("text-[10px] font-bold", s.color)}>{s.sub}</p>
                   </div>
                </Card>
             ))}
           </div>
        </div>

        {/* Status Pie Chart */}
        <div className="xl:col-span-1">
           <Card className="h-full p-6 border-transparent bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Réservations par statut</p>
              </div>
              <div className="flex items-center gap-4 h-32">
                 <div className="w-24 h-24 relative">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={STATUS_DATA}
                             innerRadius={30}
                             outerRadius={45}
                             paddingAngle={5}
                             dataKey="value"
                          >
                             {STATUS_DATA.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Pie>
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-lg font-bold text-gray-900">10</span>
                       <span className="text-[8px] font-bold text-gray-400 uppercase">Total</span>
                    </div>
                 </div>
                 <div className="flex-1 space-y-1.5">
                    {STATUS_DATA.map((s, i) => (
                       <div key={i} className="flex items-center justify-between group">
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                             <span className="text-[10px] font-bold text-gray-500 group-hover:text-gray-700 transition-colors">{s.name}</span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-900">{s.value} ({s.value * 10}%)</span>
                       </div>
                    ))}
                 </div>
              </div>
           </Card>
        </div>
      </div>

      {/* Search Bar Row */}
      <Card className="px-6 py-4 flex flex-wrap items-center gap-4 border-transparent bg-white shadow-sm">
         <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
            <input 
               type="text" 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Nom, chambre, email, canal, référence..." 
               className="w-full pl-12 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[13px] outline-none font-medium text-gray-900 placeholder:text-gray-300"
            />
         </div>
         <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl cursor-not-allowed">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-[12px] font-bold text-gray-900">27 avr. - 26 mai 2026</span>
            <Clock size={14} className="text-gray-400 ml-2" />
         </div>
         <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl relative group">
            <select 
               className="absolute inset-0 opacity-0 cursor-pointer"
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value)}
            >
               <option value="ALL">Tous statuts</option>
               <option value="CONFIRMÉE">Confirmée</option>
               <option value="CHECK-IN">Check-in</option>
               <option value="CHECK-OUT">Check-out</option>
               <option value="ANNULÉE">Annulée</option>
            </select>
            <span className={cn("text-[12px] font-bold", statusFilter === 'ALL' ? "text-gray-400" : "text-[#8B5CF6]")}>
               {statusFilter === 'ALL' ? 'Tous statuts' : statusFilter}
            </span>
            <ChevronDown size={14} className="text-gray-300" />
         </div>
         <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl relative group">
            <select 
               className="absolute inset-0 opacity-0 cursor-pointer"
               value={channelFilter}
               onChange={(e) => setChannelFilter(e.target.value)}
            >
               <option value="ALL">Tous canaux</option>
               <option value="DIRECT">Direct</option>
               <option value="BOOKING.COM">Booking.com</option>
               <option value="AIRBNB">Airbnb</option>
               <option value="EXPEDIA">Expedia</option>
            </select>
            <span className={cn("text-[12px] font-bold", channelFilter === 'ALL' ? "text-gray-400" : "text-[#8B5CF6]")}>
               {channelFilter === 'ALL' ? 'Tous canaux' : channelFilter}
            </span>
            <ChevronDown size={14} className="text-gray-300" />
         </div>
         <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl relative group">
            <select 
               className="absolute inset-0 opacity-0 cursor-pointer"
               value={roomTypeFilter}
               onChange={(e) => setRoomTypeFilter(e.target.value)}
            >
               <option value="ALL">Tout type chambre</option>
               <option value="Studio">Studio</option>
               <option value="Suite">Suite</option>
               <option value="Appartement">Appartement</option>
            </select>
            <span className={cn("text-[12px] font-bold", roomTypeFilter === 'ALL' ? "text-gray-400" : "text-[#8B5CF6]")}>
               {roomTypeFilter === 'ALL' ? 'Tout type chambre' : roomTypeFilter}
            </span>
            <ChevronDown size={14} className="text-gray-300" />
         </div>
         <Button variant="outline" className="gap-2 font-bold border-gray-100 text-[#8B5CF6] h-10">
            <Filter size={16} /> Filtres
         </Button>
         <div className="flex h-10 bg-gray-50 p-1 rounded-xl gap-1">
            <button className="px-3 rounded-lg text-gray-300 hover:text-gray-500"><LayoutGrid size={18} /></button>
            <button className="px-3 rounded-lg text-gray-300 hover:text-gray-500"><Menu size={18} /></button>
            <button className="px-3 bg-white text-[#8B5CF6] rounded-lg shadow-sm"><List size={18} /></button>
         </div>
      </Card>

      {/* Suivi des paiements section */}
      <Card className="overflow-hidden border-transparent shadow-sm bg-white">
         <CardHeader className="flex flex-row items-center justify-between border-b border-gray-50">
            <div className="flex items-center gap-3">
               <div className="p-2.5 bg-[#8B5CF6]/5 text-[#8B5CF6] rounded-xl">
                  <CreditCard size={18} />
               </div>
               <div>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Suivi des paiements</h3>
                  <p className="text-[11px] text-gray-500 font-medium">3 dossiers avec solde débiteur</p>
               </div>
            </div>
            <button className="text-[10px] font-bold text-red-500 hover:underline transition-all underline-offset-4">Voir les relances (3)</button>
         </CardHeader>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-[#F9FAFB]/50">
                  <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                     <th className="px-6 py-4">Référence</th>
                     <th className="px-6 py-4">Client</th>
                     <th className="px-6 py-4">Montant</th>
                     <th className="px-6 py-4">Paiement</th>
                     <th className="px-6 py-4">Expire</th>
                     <th className="px-6 py-4">Chambre</th>
                     <th className="px-6 py-4 text-center">Action</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {paymentFollowUps.map((row) => (
                    <tr key={`p-followup-${row.ref}`} className="text-[13px] hover:bg-gray-50 transition-colors">
                       <td className="px-6 py-4 font-bold text-[#8B5CF6]">{row.ref}</td>
                       <td className="px-6 py-4 font-bold text-gray-800">{row.client}</td>
                       <td className="px-6 py-4 font-bold text-gray-900">{row.amount}</td>
                       <td className="px-6 py-4">
                          <div className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-tighter inline-flex items-center gap-1.5",
                            row.statusColor === 'red' && "bg-red-50 text-red-500",
                            row.statusColor === 'amber' && "bg-amber-50 text-amber-500",
                            row.statusColor === 'blue' && "bg-blue-50 text-blue-500"
                          )}>
                             <Zap size={10} /> {row.status}
                          </div>
                       </td>
                       <td className="px-6 py-4 text-gray-500 font-medium">{row.expire}</td>
                       <td className="px-6 py-4 text-gray-400 uppercase text-[10px] font-bold">{row.room}</td>
                       <td className="px-6 py-4 text-center">
                          <Button variant="outline" size="sm" className="px-4 py-1 text-[10px] font-bold text-[#8B5CF6] border-[#8B5CF6]/20 bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/10 gap-2 rounded-lg">
                             <Send size={12} /> Relancer
                          </Button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Toutes les réservations <span className="bg-[#8B5CF6] text-white px-2 rounded ml-2">{filteredReservations.length}</span></h3>
           </div>
           <div className="bg-white rounded-3xl shadow-sm border border-transparent overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-[#F9FAFB]/50 border-b border-gray-100">
                       <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <th className="px-4 py-4">Référence</th>
                          <th className="px-4 py-4 text-center">Statut</th>
                          <th className="px-4 py-4">Client</th>
                          <th className="px-4 py-4 text-center">Pers.</th>
                          <th className="px-4 py-4">Check-in</th>
                          <th className="px-4 py-4">Check-out</th>
                          <th className="px-4 py-4 text-center">Nuits</th>
                          <th className="px-4 py-4 text-right">Montant</th>
                          <th className="px-4 py-4 text-right">Solde</th>
                          <th className="px-4 py-4 text-center">Canal</th>
                          <th className="px-4 py-4">Chambre</th>
                          <th className="px-4 py-4 text-center">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {filteredReservations.map((row) => (
                         <tr key={`res-row-${row.ref}`} className="text-[13px] hover:bg-gray-50 transition-colors group">
                            <td className="px-4 py-5 font-bold text-[#8953F1] leading-none">{row.ref}</td>
                            <td className="px-4 py-5">
                               <div className={cn(
                                 "px-2 py-1 rounded-lg text-[9px] font-black uppercase text-center border shadow-sm",
                                 row.status === 'CHECK-OUT' ? "bg-gray-50 text-gray-400 border-gray-100" :
                                 row.status === 'CHECK-IN' ? "bg-blue-600 text-white border-blue-700" :
                                 row.status === 'CONFIRMÉE' ? "bg-emerald-500 text-white border-emerald-600" : 
                                 row.status === 'ANNULÉE' ? "bg-red-500 text-white border-red-600" :
                                 "bg-amber-400 text-white border-amber-500"
                               )}>
                                  {row.status}
                               </div>
                            </td>
                            <td className="px-4 py-5">
                               <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold",
                                    row.ref === 'RES-001' ? "bg-blue-100 text-blue-600" :
                                    row.ref === 'RES-002' ? "bg-emerald-100 text-emerald-600" :
                                    row.ref === 'RES-003' ? "bg-amber-100 text-amber-600" : "bg-purple-100 text-purple-600"
                                  )}>
                                     {row.client.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                     <div className="font-bold text-gray-900 leading-tight">{row.client}</div>
                                     <div className="text-[9px] text-gray-400 truncate max-w-[120px]">{row.email}</div>
                                  </div>
                               </div>
                            </td>
                            <td className="px-4 py-5 text-center">
                               <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-gray-400">
                                  <User size={10} /> {row.pers}
                               </div>
                            </td>
                            <td className="px-4 py-5 font-bold text-gray-500">{row.checkin}</td>
                            <td className="px-4 py-5 font-bold text-gray-500">{row.checkout}</td>
                            <td className="px-4 py-5 text-center font-bold text-gray-400">{row.nights}</td>
                            <td className="px-4 py-5 text-right font-bold text-gray-900 leading-tight">
                               {row.amount}
                               {row.ref === 'RES-002' && <div className="text-[8px] text-amber-500">Solde : 360.00 €</div>}
                               {row.ref === 'RES-003' && <div className="text-[8px] text-amber-500">Solde : 1 750.00 €</div>}
                            </td>
                            <td className="px-4 py-5 text-right font-bold">
                               <span className={cn(
                                  row.soldeColor === 'emerald' ? "text-emerald-500" : "text-red-500"
                               )}>{row.solde}</span>
                            </td>
                            <td className="px-4 py-5 text-center">
                               <div className="flex items-center justify-center">
                                  {row.channel === 'DIRECT' ? (
                                     <div className="px-2 py-1 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] text-[9px] font-black uppercase tracking-widest border border-[#8B5CF6]/20 shadow-sm">DIR</div>
                                  ) : (
                                     <div className="px-2 py-1 rounded bg-blue-50 text-blue-500 text-[9px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-1 shadow-sm">
                                        <Zap size={10} /> {row.channel.substring(0, 3)}
                                     </div>
                                  )}
                               </div>
                            </td>
                            <td className="px-4 py-5">
                               <div className="leading-none">
                                  <div className="font-bold text-gray-900 text-[11px]">{row.room}</div>
                                  <div className="text-[9px] text-gray-400 leading-tight">{row.roomType}</div>
                               </div>
                            </td>
                            <td className="px-4 py-5">
                               <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="p-1.5 text-gray-300 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 rounded-md transition-all"><Globe size={14} /></button>
                                  <button className="p-1.5 text-gray-300 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 rounded-md transition-all"><Eye size={14} /></button>
                                  <button className="p-1.5 text-gray-300 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 rounded-md transition-all"><Copy size={14} /></button>
                                  <button className="p-1.5 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-md transition-all"><Pencil size={14} /></button>
                                  <button className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"><Trash2 size={14} /></button>
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="xl:col-span-1 space-y-6">
           {/* Alertes & Actions */}
           <Card className="bg-white border-transparent shadow-sm">
              <p className="px-6 pt-6 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Alertes & Actions</p>
              <CardContent className="space-y-4 p-6 pt-2">
                 {[
                   { label: '3 relances en attente', color: 'red', action: 'Afficher' },
                   { label: '1 départ tardif prévu', color: 'blue', action: 'Voir' },
                   { label: '2 arrivées demain', color: 'rose', action: 'Voir' },
                   { label: 'Paiements à vérifier', color: 'amber', action: 'Voir' },
                 ].map((alert) => (
                   <div key={`side-alert-${alert.label.replace(/\s+/g, '-')}`} className="flex items-center justify-between group cursor-pointer border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                         <div className={cn(
                           "p-2 rounded-lg transition-transform group-hover:scale-110",
                           alert.color === 'red' && "bg-red-50 text-red-500",
                           alert.color === 'blue' && "bg-blue-50 text-blue-500",
                           alert.color === 'rose' && "bg-rose-50 text-rose-500",
                           alert.color === 'amber' && "bg-amber-50 text-amber-500"
                         )}>
                            <AlertCircle size={14} />
                         </div>
                         <span className="text-[11px] font-bold text-gray-900 group-hover:text-gray-900 transition-colors">{alert.label}</span>
                      </div>
                      <button className="text-[10px] font-black text-indigo-500 hover:underline underline-offset-4 opacity-0 group-hover:opacity-100 transition-opacity">{alert.action}</button>
                   </div>
                 ))}
              </CardContent>
           </Card>

           {/* Répartition par canal */}
           <Card className="bg-white border-transparent shadow-sm">
              <p className="px-6 pt-6 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Répartition par canal</p>
              <CardContent className="space-y-4 p-6 pt-2">
                 {[
                   { label: 'Direct', percent: 40, count: 4, color: '#8B5CF6' },
                   { label: 'Booking.com', percent: 30, count: 3, color: '#3B82F6' },
                   { label: 'Expedia', percent: 20, count: 2, color: '#06B6D4' },
                   { label: 'Airbnb', percent: 10, count: 1, color: '#F43F5E' },
                   { label: 'Autres', percent: 0, count: 0, color: '#94A3B8' },
                 ].map((item, i) => (
                   <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
                         <span className="text-gray-500">{item.label}</span>
                         <span className="text-gray-900">{item.percent}% ({item.count})</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${item.percent}%` }}
                           transition={{ duration: 1, delay: i * 0.1 }}
                           className="h-full rounded-full"
                           style={{ backgroundColor: item.color }}
                         />
                      </div>
                   </div>
                 ))}
              </CardContent>
           </Card>

           {/* Actions Rapides */}
           <div className="space-y-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions Rapides</p>
              <div className="grid grid-cols-2 gap-3">
                 {[
                   { label: 'Nouvelle réservation', icon: Plus },
                   { label: 'Walk-in', icon: LayoutGrid },
                   { label: 'Groupe', icon: Users },
                   { label: 'Simulation', icon: Monitor },
                 ].map((action, i) => (
                   <button 
                      key={i} 
                      className="flex items-center gap-2.5 p-3 bg-white border border-gray-100 rounded-2xl hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-all text-left shadow-sm group"
                   >
                      <div className="p-1.5 bg-gray-100 text-gray-400 group-hover:bg-[#8B5CF6]/10 group-hover:text-[#8B5CF6] rounded-lg transition-colors">
                         <action.icon size={14} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-900 tracking-tight leading-tight">{action.label}</span>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      </div>
      <ReservationFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(data: ReservationFormData) => {
          const newRes: Reservation = {
            id: data.reference,
            priority: 'Moyenne',
            room: data.roomNumber,
            roomType: 'STD/DLX', // fallback
            status: 'CONFORMÉE',
            statusColor: 'text-emerald-500',
            dotColor: 'bg-emerald-400',
            client: data.guestName,
            arrival: `${data.checkIn} 16:00`,
            departure: `${data.checkOut} 11:00`,
            source: data.channel.toUpperCase(),
            sourceColor: data.channel === 'Direct' ? 'bg-green-400' : 'bg-indigo-400',
            action: 'Check-in',
            governess: 'À faire',
            vip: data.segment === 'VIP',
            payment: data.paymentStatus === 'Payé' ? 'Payé' : 'Partiel',
            totalAmount: data.totalTTC,
            ownerFeeRate: 0.20,
            pmsFeeRate: 0.15,
            cleaningFee: 50,
            email: data.email,
            phone: data.phone,
            nationality: data.nationality,
            guests: { adults: data.adults, children: data.children },
            notes: data.notes
          };
          addReservation(newRes);
        }}
      />
    </div>
  );
};
