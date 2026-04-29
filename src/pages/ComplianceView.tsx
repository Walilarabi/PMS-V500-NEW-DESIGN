import React from 'react';
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { 
  Download, 
  ChevronRight, 
  Info, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileText, 
  ShieldCheck, 
  Calendar,
  AlertCircle,
  LayoutDashboard,
  Receipt,
  Share2,
  ListRestart,
  Settings as SettingsIcon,
  Search,
  ExternalLink,
  ChevronDown,
  MoreHorizontal,
  BarChart3
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';

// Dummy data for sparklines
const sparklineData = [
  { value: 40 }, { value: 30 }, { value: 60 }, { value: 40 }, { value: 80 }, { value: 55 }, { value: 70 }
];

const miniChart = (color: string) => (
  <div className="h-8 w-full mt-2">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={sparklineData}>
        <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const ComplianceView = () => {
  const [activeSubTab, setActiveSubTab] = React.useState('dashboard');

  const kpis = [
    { label: 'Transmises', value: '24', sub: '+ 8 ce mois', color: '#10B981', icon: CheckCircle2 },
    { label: 'En attente', value: '3', sub: 'À envoyer', color: '#F59E0B', icon: Clock },
    { label: 'Rejetées', value: '1', sub: 'Action requise', color: '#EF4444', icon: XCircle },
    { label: 'E-reporting B2C', value: '18', sub: 'Transactions avril', color: '#3B82F6', icon: Share2 },
    { label: 'CA Facturé TTC', value: '48 290 €', sub: 'Mois en cours', color: '#8B5CF6', icon: Receipt },
    { label: 'PDP Status', value: 'Opérationnelle', sub: 'Chorus Pro simulé', color: '#10B981', icon: ShieldCheck, isStatus: true },
  ];

  const recentInvoices = [
    { id: 'FA-2026-1005', client: 'Pierre Bernard', amount: '369,60 €', status: 'Acceptée', statusColor: 'success', date: '23/04/2026' },
    { id: 'FA-2026-1006', client: 'Sophie Martin', amount: '246,40 €', status: 'En attente', statusColor: 'warning', date: '24/04/2026' },
    { id: 'FA-2026-1007', client: 'Jean Dupont', amount: '369,60 €', status: 'Rejetée', statusColor: 'danger', date: '24/04/2026' },
    { id: 'FA-2026-1008', client: 'Marie Leclerc', amount: '123,20 €', status: 'Transmise', statusColor: 'info', date: '25/04/2026' },
  ];

  const logEntries = [
    { ref: 'FA-2026-1005', message: 'Acceptée par la PDP', source: 'CHORUS PRO', time: '23/04/2026 14:32', type: 'success' },
    { ref: 'FA-2026-1006', message: 'En attente d\'acceptation', source: 'CHORUS PRO', time: '24/04/2026 09:15', type: 'warning' },
    { ref: 'FA-2026-1007', message: 'Rejetée : SIRET client invalide', source: 'CHORUS PRO', time: '24/04/2026 11:43', type: 'danger' },
  ];

  const pieData = [
    { name: 'Acceptées', value: 18, color: '#10B981' },
    { name: 'En attente', value: 3, color: '#F59E0B' },
    { name: 'Rejetées', value: 1, color: '#EF4444' },
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Internal Sidebar */}
      <aside className="w-56 border-r border-[#E5E7EB] bg-[#F9FAFB]/50 p-4 space-y-2 shrink-0 hidden md:block">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-4">Conformité Fiscale</h3>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'factures', label: 'Factures', icon: FileText },
          { id: 'b2c', label: 'E-reporting B2C', icon: Share2 },
          { id: 'journal', label: 'Journal PDP', icon: ListRestart },
          { id: 'settings', label: 'Paramètres', icon: SettingsIcon },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSubTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
              activeSubTab === item.id ? "bg-white text-[#8B5CF6] shadow-sm border border-gray-100" : "text-gray-500 hover:text-gray-900"
            )}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conformité Fiscale</h1>
            <p className="text-sm text-gray-500 mt-1 font-medium">Suivez votre conformité et vos obligations fiscales en toute sérénité.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-100 rounded-xl shadow-sm cursor-pointer">
                <Calendar size={16} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-700">27 avr. - 26 mai 2026</span>
                <ChevronDown size={14} className="text-gray-400" />
             </div>
             <Button className="gap-2 px-6">
                <Download size={16} /> Exporter <ChevronDown size={14} />
             </Button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[20px] p-4 flex items-start gap-4">
           <div className="p-2 bg-blue-100 rounded-full text-blue-600 mt-0.5">
              <Info size={18} fill="currentColor" className="text-blue-600/20" />
           </div>
           <div className="flex-1">
              <div className="flex items-center justify-between">
                 <h4 className="text-[13px] font-bold text-blue-900">Loi 2026 – Facturation électronique obligatoire</h4>
                 <div className="flex items-center gap-4">
                    <button className="text-[11px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                       En savoir plus <ExternalLink size={12} />
                    </button>
                    <button className="text-blue-300 hover:text-blue-500 transition-colors">✕</button>
                 </div>
              </div>
              <p className="text-[12px] text-blue-700 mt-1">Ce module gère l'envoi de vos factures B2B vers une Plateforme de Dématérialisation Partenaire (PDP) et l'e-reporting de vos transactions B2C.</p>
           </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
           {kpis.map((kpi, i) => (
             <Card key={i} className="p-4 flex flex-col justify-between hover:border-[#8B5CF6]/30 transition-colors cursor-default">
                <div className="flex items-center gap-2 mb-3">
                   <div className={cn(
                     "p-1.5 rounded-lg",
                     kpi.label === 'Rejetées' ? "bg-red-50 text-red-500" : 
                     kpi.label === 'En attente' ? "bg-amber-50 text-amber-500" : 
                     kpi.color === '#10B981' ? "bg-emerald-50 text-emerald-500" :
                     kpi.color === '#3B82F6' ? "bg-blue-50 text-blue-500" :
                     "bg-[#8B5CF6]/10 text-[#8B5CF6]"
                   )}>
                      <kpi.icon size={14} />
                   </div>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{kpi.label}</span>
                </div>
                <div>
                   <div className={cn(
                     "text-xl font-bold leading-none",
                     kpi.isStatus ? "text-emerald-500 text-sm" : "text-gray-900"
                   )}>
                      {kpi.value}
                   </div>
                   <div className={cn(
                     "text-[10px] font-bold mt-1",
                     kpi.label === 'Rejetées' ? "text-red-500" :
                     kpi.label === 'En attente' ? "text-amber-500" :
                     "text-emerald-500"
                   )}>{kpi.sub}</div>
                </div>
                {!kpi.isStatus ? miniChart(kpi.color) : (
                  <div className="mt-2 flex justify-end">
                     <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                     </div>
                  </div>
                )}
             </Card>
           ))}
        </div>

        {/* Main Sections Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Recent Invoices */}
           <Card className="lg:col-span-2 overflow-hidden flex flex-col">
              <CardHeader>
                 <div className="flex items-center gap-3">
                    <FileText size={18} className="text-[#8B5CF6]" />
                    <h3 className="font-bold text-gray-900">Factures récentes</h3>
                 </div>
                 <Button variant="outline" size="sm" className="bg-white shadow-sm">Voir tout</Button>
              </CardHeader>
              <div className="flex-1 min-h-[300px] overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-[#F9FAFB] border-b border-gray-100">
                       <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <th className="px-6 py-4">N° Facture</th>
                          <th className="px-6 py-4">Client</th>
                          <th className="px-6 py-4">TTC</th>
                          <th className="px-6 py-4">Statut PDP</th>
                          <th className="px-6 py-4">Date d'envoi</th>
                          <th className="px-6 py-4"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {recentInvoices.map((inv, i) => (
                         <tr key={i} className="hover:bg-gray-50 transition-colors text-[13px] group">
                            <td className="px-6 py-4 font-bold text-[#8B5CF6] group-hover:underline cursor-pointer">{inv.id}</td>
                            <td className="px-6 py-4 font-bold text-gray-900">{inv.client}</td>
                            <td className="px-6 py-4 font-bold text-gray-900">{inv.amount}</td>
                            <td className="px-6 py-4">
                               <Badge variant={inv.statusColor as any} className="gap-1.5 py-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                  {inv.status}
                               </Badge>
                            </td>
                            <td className="px-6 py-4 text-gray-500 font-medium">{inv.date}</td>
                            <td className="px-6 py-4 text-right">
                               <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={18} /></button>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
              <div className="p-4 bg-gray-50/50 border-t border-gray-50 flex justify-center mt-auto">
                 <button className="text-[11px] font-bold text-[#8B5CF6] hover:underline flex items-center gap-1">
                    Afficher toutes les factures <ChevronRight size={14} />
                 </button>
              </div>
           </Card>

           {/* PDP Rates Donut Chart */}
           <Card className="flex flex-col">
              <CardHeader>
                 <div className="flex items-center gap-3">
                    <BarChart3 size={18} className="text-[#8B5CF6]" />
                    <h3 className="font-bold text-gray-900">Taux PDP ce mois</h3>
                 </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center">
                 <div className="relative w-48 h-48 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={pieData}
                             cx="50%"
                             cy="50%"
                             innerRadius={60}
                             outerRadius={80}
                             paddingAngle={5}
                             dataKey="value"
                             stroke="none"
                          >
                             {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Pie>
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-3xl font-bold text-gray-900">85.7%</span>
                       <span className="text-[10px] font-bold text-gray-400 uppercase">Taux global</span>
                    </div>
                 </div>

                 {/* Legend */}
                 <div className="w-full space-y-3">
                    {pieData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-[12px] font-medium text-gray-500">{item.name}</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <span className="text-[12px] font-bold text-gray-900">85.7%</span>
                             <span className="text-[11px] text-gray-400">({item.value})</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </CardContent>
              <div className="px-6 pb-6 mt-auto">
                 <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-gray-100 flex items-center gap-4">
                    <div className="p-2.5 bg-white rounded-xl shadow-sm text-[#8B5CF6]">
                       <Calendar size={18} />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest mb-0.5">Prochaine échéance</p>
                       <p className="text-[13px] font-bold text-gray-900 leading-none">E-reporting B2C — 31 mai 2026</p>
                       <p className="text-[10px] text-gray-400 mt-1 uppercase font-medium">15 Transactions à déclarer</p>
                    </div>
                 </div>
              </div>
           </Card>
        </div>

        {/* Dashboard PDP Logs */}
        <Card className="overflow-hidden">
           <CardHeader>
              <div className="flex items-center gap-3">
                 <ListRestart size={18} className="text-[#8B5CF6]" />
                 <h3 className="font-bold text-gray-900">Derniers échanges PDP</h3>
              </div>
              <Button variant="outline" size="sm" className="bg-white gap-2 text-gray-600 shadow-sm">
                 Journal complet <ChevronRight size={14} />
              </Button>
           </CardHeader>
           <div className="overflow-x-auto px-6 pb-6">
              <div className="divide-y divide-gray-50">
                 {logEntries.map((log, i) => (
                   <div key={i} className="py-4 flex flex-wrap items-center gap-6 group">
                      <div className={cn(
                        "p-2 rounded-full",
                        log.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 
                        log.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                      )}>
                         {log.type === 'success' ? <CheckCircle2 size={16} /> : log.type === 'warning' ? <Clock size={16} /> : <AlertCircle size={16} />}
                      </div>
                      
                      <div className="min-w-[120px]">
                         <span className="text-[13px] font-bold text-gray-900">{log.ref}</span>
                      </div>

                      <div className="flex-1 min-w-[200px]">
                         <span className="text-[13px] font-medium text-gray-600 leading-relaxed">{log.message}</span>
                      </div>

                      <div className="px-3 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-400">
                         {log.source}
                      </div>

                      <div className="text-[13px] text-gray-400 font-medium">
                         {log.time}
                      </div>

                      <Button variant="outline" size="sm" className="hidden group-hover:flex bg-white py-1">
                         Voir détails
                      </Button>
                   </div>
                 ))}
              </div>
           </div>
        </Card>
      </div>
    </div>
  );
};
