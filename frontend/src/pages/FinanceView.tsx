import React from 'react';
import { 
  ChevronRight, 
  Wallet, 
  History, 
  AlertCircle,
  FileCheck,
  CreditCard,
  Banknote,
  Clock,
  MoreHorizontal,
  ChevronLeft,
  ChevronDown,
  Search,
  Calendar,
  Lock,
  Plus,
  Zap,
  ShieldCheck,
  FileText,
  Download,
  Send,
  FileWarning,
  FileUp,
  Receipt,
  FileSignature,
  Filter,
  Eye,
  EyeOff,
  ArrowUpRight,
  Printer,
  HelpCircle,
  Share2,
  LayoutGrid,
  Table as TableIcon,
  Users
} from 'lucide-react';
// mock context removed — data via Supabase hooks
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import { AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

const FACTURATION_PIE_DATA = [
  { name: 'Encaissé', value: 60, amount: '1 108,79 €', color: '#10B981' },
  { name: 'En attente', value: 20, amount: '369,60 €', color: '#F59E0B' },
  { name: 'En retard', value: 15, amount: '246,40 €', color: '#EF4444' },
  { name: 'Brouillons', value: 5, amount: '123,20 €', color: '#94A3B8' },
];

const CASH_FLOW_DATA = [
  { day: 'Aujourd\'hui', value: 246, color: '#EF4444' },
  { day: 'Demain', value: 123, color: '#F59E0B' },
  { day: '29 avr.', value: 360, color: '#10B981' },
  { day: '30 avr.', value: 0, color: '#10B981' },
  { day: '01 mai', value: 480, color: '#10B981' },
  { day: '02 mai', value: 210, color: '#F59E0B' },
  { day: '03 mai', value: 0, color: '#10B981' },
];

export interface FinanceViewProps {
  activeTab?: string;
}

export const FinanceView = ({ activeTab = 'facturation' }: FinanceViewProps) => {
  const [financeTab, setFinanceTab] = React.useState<'facturation' | 'cloture' | 'caisse' | 'impayes' | 'proprietaires'>('facturation');
  const [showKpis, setShowKpis] = React.useState(true);
  const [countedCash, setCountedCash] = React.useState('');
  const reservations = [];

  const initialCash = 500;
  const totalEncaissements = 5270;
  const theoreticalFinal = initialCash + totalEncaissements;
  const cashGap = countedCash !== '' ? parseFloat(countedCash.replace(',', '.')) - theoreticalFinal : 0;
  const isClotureReady = countedCash !== '' && Math.abs(cashGap) < 0.01;

  // Synchronize internal state with prop
  React.useEffect(() => {
    if (['facturation', 'caisse', 'impayes', 'cloture', 'proprietaires'].includes(activeTab)) {
      setFinanceTab(activeTab as any);
    }
  }, [activeTab]);

  const renderFacturation = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">Facturation</h2>
          <p className="text-gray-500 text-sm font-medium mt-1">Suivez, relancez et encaissez vos factures en toute simplicité.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowKpis(!showKpis)}
            className="bg-white border-gray-100 font-bold gap-2 px-4 shadow-sm"
          >
             {showKpis ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-gray-400" />}
             {showKpis ? 'Masquer' : 'Afficher'} KPIs
          </Button>
          <Button variant="outline" className="bg-white border-gray-100 font-bold gap-2 px-4 shadow-sm">
             <Calendar size={16} className="text-gray-400" /> 27 avr. - 26 mai 2026
          </Button>
          <Button className="bg-[#8B5CF6] font-bold gap-2 px-6 py-2.5 rounded-xl shadow-lg shadow-[#8B5CF6]/20">
             <Plus size={18} /> Nouvelle facture <ChevronDown size={14} />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showKpis && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-8"
          >
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 bg-white border-transparent shadow-sm group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">À encaisser maintenant</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">246,40 €</p>
                    <p className="text-[10px] font-medium text-gray-400 mt-1"><span className="text-red-500 font-bold">2</span> factures en retard</p>
                  </div>
                  <div className="p-3 bg-red-50 text-red-500 rounded-2xl group-hover:scale-110 transition-transform">
                    <AlertCircle size={24} />
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4 bg-red-50/50 border-red-100 text-red-600 font-bold hover:bg-red-50">
                  Relancer maintenant
                </Button>
              </Card>

              <Card className="p-6 bg-white border-transparent shadow-sm group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">En attente de paiement</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">369,60 €</p>
                    <p className="text-[10px] font-medium text-gray-400 mt-1"><span className="text-[#8B5CF6] font-bold">1</span> facture en attente</p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl group-hover:scale-110 transition-transform">
                    <Clock size={24} />
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4 bg-amber-50/50 border-amber-100 text-amber-600 font-bold hover:bg-amber-50">
                  Envoyer un rappel
                </Button>
              </Card>

              <Card className="p-6 bg-white border-transparent shadow-sm group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Encaissé ce mois-ci</p>
                    <p className="text-2xl font-bold text-emerald-500 mt-1">1 108,79 €</p>
                    <p className="text-[10px] font-medium text-gray-400 mt-1"><span className="text-emerald-500 font-bold">4</span> factures payées</p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl group-hover:scale-110 transition-transform">
                    <FileCheck size={24} />
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4 bg-emerald-50/50 border-emerald-100 text-emerald-600 font-bold hover:bg-emerald-50">
                  Voir l'historique
                </Button>
              </Card>

              <Card className="p-6 bg-white border-transparent shadow-sm group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brouillons</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">2</p>
                    <p className="text-[10px] font-medium text-gray-400 mt-1">Factures non émises</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4 bg-blue-50/50 border-blue-100 text-blue-600 font-bold hover:bg-blue-50">
                  Continuer
                </Button>
              </Card>
            </div>

            {/* Analytics Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <Card className="p-6 bg-white border-transparent shadow-sm">
                <div className="flex items-center gap-2 mb-8">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Aperçu des encaissements</h3>
                  <HelpCircle size={14} className="text-gray-300" />
                </div>
                <div className="flex items-center gap-12">
                  <div className="w-48 h-48 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={FACTURATION_PIE_DATA}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {FACTURATION_PIE_DATA.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-gray-900 leading-none">1 108,79 €</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1">CA facturé (TTC)</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    {FACTURATION_PIE_DATA.map((item) => (
                      <div key={`fact-pie-${item.name}`} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="font-bold text-gray-500">{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">{item.amount} ({item.value}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white border-transparent shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Cash flow prévisionnel</h3>
                  <div className="px-3 py-1 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-400 border border-gray-100">7 prochains jours</div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={CASH_FLOW_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis 
                        dataKey="day" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#9CA3AF' }}
                        dy={10}
                      />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: '#F9FAFB' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-3 rounded-xl shadow-xl border-none font-bold text-[11px]">
                                {payload[0].value} €
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={24}>
                        {CASH_FLOW_DATA.map((entry) => (
                          <Cell key={`cash-cell-${entry.day}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between mt-4">
                  {CASH_FLOW_DATA.map((d) => (
                    <div key={`cash-label-${d.day}`} className="text-center w-full">
                        <span className="text-[10px] font-bold" style={{ color: d.color }}>{d.value}€</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Table Card */}
      <Card className="bg-white border-transparent shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between gap-4">
           <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher facture, client, chambre..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-50/50 border border-transparent rounded-2xl text-sm font-medium outline-none focus:bg-white focus:border-[#8B5CF6]/20 transition-all"
              />
              <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B5CF6] hover:bg-[#8B5CF6]/5 p-1 rounded-lg">
                 <Search size={16} />
              </button>
           </div>
           
           <div className="flex bg-gray-100 p-1.5 rounded-2xl">
              {['Tous', 'Brouillons', 'Émises', 'Payées', 'En retard', 'Avoirs'].map((f) => (
                <button key={f} className={cn(
                  "px-6 py-2.5 text-xs font-bold rounded-xl transition-all",
                  f === 'Tous' ? "bg-[#5C4FE5] text-white shadow-md shadow-[#5C4FE5]/20" : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                )}>{f}</button>
              ))}
           </div>

           <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 font-bold border-gray-100">
                 <Filter size={14} /> Filtres
              </Button>
              <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-100">
                 <button className="p-1.5 text-gray-400"><LayoutGrid size={12} /></button>
                 <button className="p-1.5 bg-white text-[#8B5CF6] rounded shadow-sm"><TableIcon size={12} /></button>
              </div>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F9FAFB] border-b border-gray-50">
              <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-5">N° FACTURE</th>
                <th className="px-6 py-5">CLIENT</th>
                <th className="px-6 py-5">CHAMBRE</th>
                <th className="px-6 py-5">SÉJOUR</th>
                <th className="px-6 py-5">NUITS</th>
                <th className="px-6 py-5">TOTAL TTC</th>
                <th className="px-6 py-5">PAYÉ</th>
                <th className="px-6 py-5">SOLDE</th>
                <th className="px-6 py-5">STATUT</th>
                <th className="px-6 py-5">ÉCHÉANCE</th>
                <th className="px-6 py-5 text-center">ACTION</th>
                <th className="px-6 py-5">SCORE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { id: 'FA-2026-1005', client: 'Pierre Bernard', initials: 'PB', room: '101', stay: '20/04/26 → 23/04/26', nights: 3, total: '369,60 €', paid: '369,60 €', balance: '0,00 €', status: 'Payée', dueDate: '23/04/2026', score: 99 },
                { id: 'FA-2026-1006', client: 'Sophie Martin', initials: 'SM', room: '205', stay: '22/04/26 → 24/04/26', nights: 2, total: '246,40 €', paid: '—', balance: '246,40 €', status: 'En retard', dueDate: '24/04/2026', delay: '2 jours', score: 35 },
                { id: 'FA-2026-1007', client: 'Jean Dupont', initials: 'JD', room: '312', stay: '24/04/26 → 27/04/26', nights: 3, total: '369,60 €', paid: '—', balance: '369,60 €', status: 'En attente', dueDate: '27/04/2026', delay: '5 jours', score: 65 },
                { id: 'FA-2026-1008', client: 'Marie Leclerc', initials: 'ML', room: '118', stay: '25/04/26 → 26/04/26', nights: 1, total: '123,20 €', paid: '—', balance: '123,20 €', status: 'Brouillon', dueDate: '—', score: null },
              ].map((row) => (
                <tr key={`fact-row-${row.id}`} className="hover:bg-gray-50 transition-all text-sm group">
                  <td className="px-6 py-5 font-bold text-[#8B5CF6]">{row.id}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">{row.initials}</div>
                      <span className="font-bold text-gray-900">{row.client}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold text-gray-500">Ch. {row.room}</td>
                  <td className="px-6 py-5 text-gray-400 font-medium">{row.stay}</td>
                  <td className="px-6 py-5 text-center font-bold">{row.nights}</td>
                  <td className="px-6 py-5 font-bold text-gray-900">{row.total}</td>
                  <td className="px-6 py-5 font-bold text-emerald-500">{row.paid}</td>
                  <td className="px-6 py-5 font-bold text-red-500">{row.balance}</td>
                  <td className="px-6 py-5">
                    <Badge className={cn(
                      "text-[10px] font-bold uppercase py-0.5 px-3",
                      row.status === 'Payée' ? "bg-emerald-50 text-emerald-600 border-none" :
                      row.status === 'En retard' ? "bg-red-50 text-red-600 border-none" :
                      row.status === 'En attente' ? "bg-amber-50 text-amber-600 border-none" : "bg-blue-50 text-blue-600 border-none"
                    )}>
                      {row.status === 'Payée' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2" />}
                      {row.status === 'En retard' && <AlertCircle size={12} className="mr-2" />}
                      {row.status === 'En attente' && <Clock size={12} className="mr-2" />}
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-5">
                     <span className="font-bold text-gray-900">{row.dueDate}</span>
                     {row.delay && <p className="text-[10px] text-amber-600 font-bold mt-0.5">{row.delay}</p>}
                  </td>
                  <td className="px-6 py-5">
                     <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><Eye size={16} /></button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><Download size={16} /></button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><Send size={16} /></button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><MoreHorizontal size={16} /></button>
                     </div>
                  </td>
                  <td className="px-6 py-5">
                    {row.score && (
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "font-bold text-[11px]",
                          row.score > 80 ? "text-emerald-500" : row.score > 50 ? "text-amber-500" : "text-red-500"
                        )}>{row.score}</span>
                        <div className="flex gap-0.5">
                           {[1,2,3].map(bar => (
                             <div key={bar} className={cn(
                               "w-1 rounded-full",
                               bar === 1 ? "h-2" : bar === 2 ? "h-3" : "h-4",
                               row.score > 80 ? "bg-emerald-500" : row.score > 50 ? "bg-amber-500" : "bg-red-500",
                               bar > (row.score/33) && "opacity-20"
                             )} />
                           ))}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
           <div className="text-[11px] font-bold text-gray-400"> Affichage de <span className="text-gray-900">1 à 4</span> sur <span className="text-gray-900">42</span> factures</div>
           <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="w-8 h-8 p-0 rounded-lg border-gray-200 text-gray-400" disabled>
                 <ChevronLeft size={16} />
              </Button>
              {[1, 2, 3, '...', 12].map((p, i) => (
                <Button 
                  key={`page-${p}-${i}`} 
                  variant={p === 1 ? 'default' : 'outline'} 
                  size="sm" 
                  className={cn(
                    "w-8 h-8 p-0 rounded-lg font-bold text-[11px]",
                    p === 1 ? "bg-[#8B5CF6] shadow-sm" : "border-gray-200 text-gray-500 hover:bg-white"
                  )}
                >
                  {p}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="w-8 h-8 p-0 rounded-lg border-gray-200 text-gray-400 hover:bg-white">
                 <ChevronRight size={16} />
              </Button>
           </div>
        </div>
      </Card>

      {/* Quick Actions Footer */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-10">
        <Card className="xl:col-span-2 p-6 bg-white border-transparent shadow-sm">
           <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-widest mb-6">Actions rapides</h3>
           <div className="flex items-center gap-6">
              {[
                { label: 'Relancer tout', icon: Zap },
                { label: 'Envoyer liens de paiement', icon: Share2 },
                { label: 'Imprimer', icon: Printer },
                { label: 'Export comptable', icon: FileUp },
              ].map((action) => (
                <button key={`quick-acc-${action.label.replace(/\s+/g, '-')}`} className="flex-1 flex items-center gap-3 p-4 bg-gray-50/50 hover:bg-[#8B5CF6]/5 border border-gray-100 rounded-2xl transition-all group">
                   <div className="p-2 bg-white text-gray-400 group-hover:text-[#8B5CF6] rounded-xl shadow-sm transition-colors">
                      <action.icon size={16} />
                   </div>
                   <span className="text-[11px] font-bold text-gray-700">{action.label}</span>
                </button>
              ))}
           </div>
        </Card>

        <Card className="xl:col-span-1 p-6 bg-[#8B5CF6]/5 border-transparent border-l-4 border-l-[#8B5CF6] flex items-center gap-6">
           <div className="p-4 bg-white rounded-3xl text-[#8B5CF6] shadow-sm"><Zap size={24} /></div>
           <div>
              <h3 className="text-sm font-bold text-gray-900 tracking-tight">Conseil du jour</h3>
              <p className="text-[11px] text-gray-500 mt-1">
                2 factures en retard représentent <span className="font-bold text-red-500">246,40 €</span>. 
                Relancez-les pour améliorer votre trésorerie.
              </p>
           </div>
        </Card>
      </div>
    </div>
  );
  const renderImpayes = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-2xl">
              <FileWarning size={24} />
           </div>
           <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Débiteurs</h2>
              <p className="text-gray-500 text-sm font-medium mt-1">Suivi des créances et recouvrement</p>
           </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-l-4 border-l-[#8B5CF6] bg-white group hover:shadow-xl transition-all duration-300">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-[#8B5CF6]/5 text-[#8B5CF6] rounded-2xl group-hover:scale-110 transition-transform">
                 <Wallet size={24} />
              </div>
              <div>
                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total en attente</div>
                 <div className="text-2xl font-bold text-gray-900">8 220.00€</div>
              </div>
           </div>
        </Card>
        <Card className="p-6 border-l-4 border-l-red-500 bg-white group hover:shadow-xl transition-all duration-300">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-500 rounded-2xl group-hover:scale-110 transition-transform">
                 <AlertCircle size={24} />
              </div>
              <div>
                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">En retard / Litige</div>
                 <div className="text-2xl font-bold text-gray-900">5 420.00€</div>
              </div>
           </div>
        </Card>
        <Card className="p-6 border-l-4 border-l-amber-500 bg-white group hover:shadow-xl transition-all duration-300">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl group-hover:scale-110 transition-transform">
                 <FileText size={24} />
              </div>
              <div>
                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dossiers actifs</div>
                 <div className="text-2xl font-bold text-gray-900">5</div>
              </div>
           </div>
        </Card>
      </div>

      {/* Debtors Table */}
      <Card className="overflow-hidden bg-white border-transparent">
         <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
               <AlertCircle size={18} className="text-[#8B5CF6]" />
               <h3 className="font-bold text-gray-900 tracking-tight">Débiteurs & Impayés</h3>
            </div>
            <Button variant="outline" size="sm" className="bg-white gap-2 font-bold shadow-sm border-gray-100">
               <Download size={14} /> Export CSV
            </Button>
         </CardHeader>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-[#F9FAFB] border-b border-gray-100">
                  <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                     <th className="px-6 py-4">Client</th>
                     <th className="px-6 py-4">Facture</th>
                     <th className="px-6 py-4">Canal</th>
                     <th className="px-6 py-4">Montant</th>
                     <th className="px-6 py-4">Échéance</th>
                     <th className="px-6 py-4">Jours de retard</th>
                     <th className="px-6 py-4">Statut</th>
                     <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50 bg-white">
                  {[
                    { client: 'Dupont SA', email: 'm.dupont@dupont.com', ref: 'INV-0962', channel: 'Direct', amount: '1 250.00€', due: '2026-04-15', delay: '+6j', status: 'RETARD', color: 'rose' },
                    { client: 'Tech Corp', email: 'b.martin@tech.com', ref: 'INV-0971', channel: 'Expedia', amount: '3 600.00€', due: '2026-04-10', delay: '+11j', status: 'LITIGE', color: 'red' },
                    { client: 'M. Bernard', email: 'pierre.bernard@orange.fr', ref: 'INV-0990', channel: 'Booking', amount: '120.00€', due: '2026-04-20', delay: '+1j', status: 'RETARD', color: 'rose' },
                    { client: 'SNCF Voyages', email: 'r.petit@sncf.fr', ref: 'INV-0995', channel: 'Direct', amount: '2 800.00€', due: '2026-04-25', delay: '-4j', status: 'À ÉCHÉANCE', color: 'blue' },
                    { client: 'Mme Dupont', email: 'claire.d@gmail.com', ref: 'INV-0948', channel: 'Direct', amount: '450.00€', due: '2026-04-01', delay: '+20j', status: 'RECOUVREMENT', color: 'red' },
                  ].map((row) => (
                    <tr key={`debtor-${row.ref}`} className="hover:bg-gray-50/50 transition-colors text-[13px] group">
                       <td className="px-6 py-5">
                          <div className="font-bold text-gray-900 leadings-tight mb-1">{row.client}</div>
                          <div className="text-[11px] text-gray-400 font-medium">{row.email}</div>
                       </td>
                       <td className="px-6 py-5">
                          <span className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-500">{row.ref}</span>
                       </td>
                       <td className="px-6 py-5 text-gray-500 font-medium">{row.channel}</td>
                       <td className="px-6 py-5 font-bold text-gray-900">{row.amount}</td>
                       <td className="px-6 py-5 text-gray-500 font-medium">{row.due}</td>
                       <td className="px-6 py-5">
                          <span className={cn(
                         "font-bold",
                             row.delay.startsWith('+') ? "text-red-500" : "text-blue-500"
                          )}>{row.delay}</span>
                       </td>
                       <td className="px-6 py-5">
                          <div className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest inline-block",
                            row.color === 'rose' && "bg-amber-50 text-amber-600",
                            row.color === 'red' && "bg-red-50 text-red-600",
                            row.color === 'blue' && "bg-blue-50 text-blue-600"
                          )}>
                             {row.status}
                          </div>
                       </td>
                       <td className="px-6 py-5">
                          <div className="flex items-center justify-center gap-2">
                             <Button size="sm" variant="outline" className="px-4 py-1 text-[10px] font-bold text-emerald-500 border-emerald-100 bg-emerald-50 hover:bg-emerald-100 transition-all scale-90 group-hover:scale-100 shadow-none">Réglé</Button>
                             <button className="p-2 text-gray-300 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 rounded-lg transition-all">
                                <Send size={14} />
                             </button>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </Card>

      {/* Empty Selection State */}
      <Card className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/50 border-dashed border-2 border-gray-100 shadow-none rounded-3xl">
         <div className="w-16 h-16 bg-white border border-gray-100 rounded-3xl flex items-center justify-center text-[#8B5CF6] shadow-sm transform rotate-3">
            <Calendar size={28} />
         </div>
         <div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Aucune Sélection</h4>
            <p className="text-[11px] text-gray-400 font-bold tracking-tight max-w-xs mx-auto mt-1">Sélectionnez une réservation pour voir les détails et gérer le dossier.</p>
         </div>
      </Card>
    </div>
  );

  const renderCloture = () => (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-2xl">
              <Lock size={24} />
           </div>
           <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Clôture & Sauvegarde</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 text-left">Audit journalier et archivage des données financières</p>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <Button className="gap-2 shadow-lg shadow-[#8B5CF6]/20 py-2.5">
              <Lock size={16} /> Clôture du jour
           </Button>
           <Button variant="outline" className="gap-2 bg-white font-bold py-2.5">
              <History size={16} /> Historique
           </Button>
        </div>
      </div>

      {/* Archive Search Bar */}
      <Card className="px-6 py-4 flex items-center gap-4 border-transparent bg-white shadow-sm">
         <div className="flex items-center gap-3 text-[13px] font-bold text-gray-400">
            <Search size={16} className="text-gray-300" />
            Accès rapide archive :
         </div>
         <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl">
            <input type="text" placeholder="jj/mm/aaaa" className="bg-transparent border-none text-[13px] outline-none text-gray-900 w-24 placeholder:text-gray-300 font-bold" />
            <Calendar size={14} className="text-gray-400" />
         </div>
         <Button variant="secondary" size="sm" className="rounded-lg px-6 font-bold">Consulter</Button>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         {/* Main Audit Area */}
         <div className="lg:col-span-3 space-y-6">
            {/* Status Alert Card */}
            <Card className="p-8 border-red-100 bg-white relative overflow-hidden group">
               <div className="flex items-start gap-6">
                  <div className="p-4 bg-red-50 text-red-500 rounded-2xl relative z-10 group-hover:scale-105 transition-transform">
                     <AlertCircle size={32} />
                  </div>
                  <div className="flex-1 relative z-10">
                     <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xl font-bold text-gray-900 leading-tight">Clôture du 29 avril 2026</h3>
                        <span className="text-xs font-bold text-[#8B5CF6]">0%</span>
                     </div>
                     <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-6">Conditions non remplies</span>
                     
                     <div className="space-y-4">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                           Progression de l'audit interne
                        </div>
                        <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                           <div className="w-0 h-full bg-[#8B5CF6] transition-all duration-500" />
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400 py-3 px-4 bg-gray-100 rounded-xl mt-4 border border-gray-100">
                           <History size={14} />
                           <div className="flex items-center gap-1.5 leading-none">
                              <span className="w-4 h-4 bg-white border border-gray-200 rounded flex items-center justify-center text-[10px] text-gray-500 font-bold">2</span> 
                              <span>clients encore en séjour.</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="absolute top-0 right-0 w-64 h-64 bg-red-50/20 rounded-full -mr-32 -mt-32 pointer-events-none" />
            </Card>

            {/* Blockers Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="p-6 bg-white border border-gray-100/50 group hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-4">
                     <div className="p-3.5 bg-[#8B5CF6]/5 text-[#8B5CF6] rounded-2xl group-hover:rotate-12 transition-transform">
                        <FileCheck size={24} />
                     </div>
                     <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 leading-none">Factures ouvertes</div>
                        <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5 tracking-tight">0</div>
                        <div className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">Bloquant pour clôture</div>
                     </div>
                  </div>
               </Card>
               <Card className="p-6 bg-white border border-gray-100/50 group hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-4">
                     <div className="p-3.5 bg-[#8B5CF6]/5 text-[#8B5CF6] rounded-2xl group-hover:rotate-12 transition-transform">
                        <Wallet size={24} />
                     </div>
                     <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 leading-none">Écart de caisse</div>
                        <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5 tracking-tight">0.00€</div>
                        <div className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">Audit manuel requis</div>
                     </div>
                  </div>
               </Card>
            </div>

            {/* Cash Reconciliation Section */}
            <Card className="overflow-hidden bg-white">
               <CardHeader className="bg-white border-b border-gray-50 flex flex-row items-center gap-3">
                  <Banknote size={18} className="text-[#8B5CF6]" />
                  <h3 className="font-bold text-gray-900 tracking-tight text-left">Fermeture de caisse réception</h3>
               </CardHeader>
               <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2 text-left">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Montant initial</label>
                        <div className="p-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-900 border border-transparent">
                           500 €
                        </div>
                     </div>
                     <div className="space-y-2 text-left">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total encaissements</label>
                        <div className="p-4 bg-gray-100/50 rounded-xl text-sm font-bold text-gray-900 border border-transparent">
                           5 270 €
                        </div>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2 text-left">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Montant final (compté)</label>
                        <input 
                           type="text" 
                           value={countedCash}
                           onChange={(e) => setCountedCash(e.target.value)}
                           placeholder="Saisir le total" 
                           className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-bold text-gray-900 border border-gray-100 outline-none transition-colors placeholder:text-gray-300" 
                        />
                     </div>
                     <div className="space-y-2 text-left">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">Écart</label>
                        <div className={cn(
                          "p-4 rounded-xl text-sm font-bold border border-transparent transition-colors",
                          Math.abs(cashGap) < 0.01 ? "bg-gray-50 text-gray-900" : 
                          cashGap > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        )}>
                           {cashGap > 0 ? '+' : ''}{cashGap.toFixed(2)} €
                        </div>
                     </div>
                  </div>
               </CardContent>
               <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                  <Button variant="outline" className="bg-white gap-2 font-black border-gray-100 py-3 px-6 shadow-sm">
                     <FileText size={16} /> Consulter folios
                  </Button>
                  <Button disabled variant="secondary" className="gap-2 font-black opacity-40 grayscale py-3 px-8">
                     <Lock size={16} /> Lancer la clôture
                  </Button>
               </div>
            </Card>
         </div>

         {/* Sidebar Dossiers */}
         <div className="lg:col-span-1 space-y-6">
            <Card className="flex flex-col bg-white border-transparent">
               <CardHeader className="bg-white">
                  <div className="flex items-center gap-3">
                     <Zap size={18} className="text-[#8B5CF6]" />
                     <h3 className="font-bold text-gray-900 tracking-tight">Dossiers d'audit</h3>
                  </div>
               </CardHeader>
               <CardContent className="space-y-4 p-4">
                  {[
                    { label: 'Main courante prestations', icon: FileCheck },
                    { label: 'Main courante règlements', icon: Banknote },
                    { label: 'Encaissements & dépenses', icon: CreditCard },
                    { label: 'Rapport taxe de séjour', icon: FileText },
                  ].map((item) => (
                    <button key={`audit-doc-${item.label.replace(/\s+/g, '-')}`} className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 rounded-2xl transition-colors group text-left">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-[#8B5CF6]/5 text-[#8B5CF6] rounded-xl group-hover:scale-110 transition-transform">
                             <item.icon size={16} />
                          </div>
                          <span className="text-[12px] font-bold text-gray-400 group-hover:text-[#8B5CF6] transition-colors">{item.label}</span>
                       </div>
                       <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
               </CardContent>
            </Card>

            <Card className="p-6 flex flex-col items-center text-center space-y-4 bg-white relative overflow-hidden">
               <div className="p-3 bg-[#8B5CF6]/5 text-[#8B5CF6] rounded-2xl relative z-10">
                  <ShieldCheck size={24} />
               </div>
               <div className="relative z-10">
                  <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-widest">Archivage V2.3 Digital Core</h4>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                     <span className="text-[10px] font-bold text-gray-400 uppercase">Cloud Backup</span>
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-500 uppercase">Actif</span>
                  </div>
               </div>
               <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#8B5CF6]/5 rounded-full -mr-16 -mb-16 pointer-events-none" />
            </Card>
         </div>
      </div>
    </div>
  );

  const renderCaisse = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sub-nav Sidebar */}
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-4 text-left">Mouvements de Caisse</h3>
        <button className={cn(
          "w-full px-5 py-4 rounded-3xl flex items-center gap-4 text-left transition-all border group",
          "bg-white border-gray-100 shadow-sm"
        )}>
           <div className="p-2 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-xl group-hover:scale-110 transition-transform"><Banknote size={18} /></div>
           <div>
              <div className="text-sm font-bold text-gray-900">Petite Caisse</div>
              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Ouverte • Ali L.</div>
           </div>
        </button>
        <button className="w-full px-5 py-4 rounded-3xl flex items-center gap-4 text-left opacity-40 hover:opacity-100 group transition-all border border-transparent">
           <div className="p-2 bg-gray-100 text-gray-400 rounded-xl group-hover:scale-110 transition-transform"><History size={18} /></div>
           <div>
              <div className="text-sm font-bold text-gray-900">Historique</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Accéder aux archives</div>
           </div>
        </button>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <Card className="p-6 relative overflow-hidden group bg-white">
              <div className="flex gap-4 items-center">
                 <div className="p-3 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-2xl group-hover:scale-110 transition-transform"><Wallet size={20} /></div>
                 <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Solde Actuel</div>
                    <div className="text-3xl font-bold text-gray-900 tracking-tight">103.30 €</div>
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B5CF6]/5 rounded-full -mr-12 -mt-12" />
           </Card>
           <Card className="p-6 relative overflow-hidden group bg-white">
              <div className="flex gap-4 items-center">
                 <div className="p-3 bg-red-50 text-red-500 rounded-2xl group-hover:scale-110 transition-transform"><AlertCircle size={20} /></div>
                 <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Sorties (Jour)</div>
                    <div className="text-3xl font-bold text-gray-900 tracking-tight">96.70 €</div>
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50/20 rounded-full -mr-12 -mt-12" />
           </Card>
        </div>

        <Card className="bg-white overflow-hidden border-transparent shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                 <button className="px-4 py-1.5 text-[10px] font-bold bg-white text-[#8B5CF6] rounded-lg shadow-sm uppercase tracking-widest">Historique des flux</button>
                 <button className="px-4 py-1.5 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest">Contrôle physique</button>
              </div>
              <Button size="sm" className="gap-2 shadow-lg shadow-[#8B5CF6]/20 font-bold">
                 <Plus size={16} /> Saisir une dépense
              </Button>
           </CardHeader>
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-[#F9FAFB] border-b border-gray-100">
                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                       <th className="px-6 py-4">Date</th>
                       <th className="px-6 py-4">Catégorie</th>
                       <th className="px-6 py-4">Fournisseur</th>
                       <th className="px-6 py-4">Description</th>
                       <th className="px-6 py-4 text-right">Sortie</th>
                       <th className="px-6 py-4 text-right">Entrée</th>
                       <th className="px-6 py-4 text-right">Solde</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50 bg-white">
                    {[
                      { date: '2026-04-20 15:00', cat: 'TRANSPORT', vendor: 'G7 Taxi', desc: 'Remboursement taxi client VIP', out: '35.00€', in: '-', solde: '103.30€' },
                      { date: '2026-04-21 11:00', cat: 'ALIMENTATION', vendor: 'Boulangerie Ange', desc: 'Café + croissants équipe', out: '18.20€', in: '-', solde: '138.30€' },
                      { date: '2026-04-21 09:30', cat: 'MENAGE', vendor: 'CORA', desc: 'Achat produits ménage', out: '43.50€', in: '-', solde: '156.50€' },
                      { date: '2026-04-21 08:00', cat: 'FONDS DE CAISSE', vendor: 'Interne', desc: 'Fond de caisse ouverture', out: '-', in: '+200.00€', solde: '200.00€' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors text-[13px]">
                         <td className="px-6 py-5 text-gray-500 font-bold">{row.date}</td>
                         <td className="px-6 py-5">
                            <span className="px-2 py-0.5 bg-[#8B5CF6]/5 text-[#8B5CF6] text-[9px] font-bold rounded-md uppercase tracking-widest">{row.cat}</span>
                         </td>
                         <td className="px-6 py-5 font-bold text-gray-900">{row.vendor}</td>
                         <td className="px-6 py-5 text-gray-500 max-w-[200px] truncate">{row.desc}</td>
                         <td className="px-6 py-5 text-right font-bold text-red-500 leading-none">{row.out}</td>
                         <td className="px-6 py-5 text-right font-bold text-emerald-500 leading-none">{row.in}</td>
                         <td className="px-6 py-5 text-right font-bold text-gray-900 leading-none">{row.solde}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </Card>
      </div>
    </div>
  );

  const renderProprietaires = () => {
    const totalPayout = reservations.reduce((acc, res) => acc + res.ownerPayout, 0);
    const totalCommission = reservations.reduce((acc, res) => acc + res.pmsCommission, 0);
    const totalCleaning = reservations.reduce((acc, res) => acc + res.cleaningFee, 0);

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Reversements Propriétaires</h2>
            <p className="text-gray-500 text-sm font-medium mt-1">Calcul des commissions et des reversements nets par période.</p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" className="bg-white border-gray-100 font-bold gap-2 px-4 shadow-sm">
                <Download size={16} className="text-gray-400" /> Exporter le rapport
             </Button>
             <Button className="bg-[#8B5CF6] font-bold gap-2 px-6 py-2.5 rounded-xl shadow-lg shadow-[#8B5CF6]/20">
                <Plus size={18} /> Nouveau virement
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-white border-transparent shadow-sm group">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Net à reverser</p>
            <p className="text-2xl font-bold text-gray-900">{totalPayout.toLocaleString()} €</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-emerald-500">+ 12% vs mois dernier</span>
            </div>
          </Card>
          <Card className="p-6 bg-white border-transparent shadow-sm group">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Commissions PMS</p>
            <p className="text-2xl font-bold text-[#8B5CF6]">{totalCommission.toLocaleString()} €</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-gray-400">Taux moyen: 15.2%</span>
            </div>
          </Card>
          <Card className="p-6 bg-white border-transparent shadow-sm group">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Ménages</p>
            <p className="text-2xl font-bold text-orange-500">{totalCleaning.toLocaleString()} €</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-gray-400">Rétrocession complète</span>
            </div>
          </Card>
          <Card className="p-6 bg-white border-transparent shadow-sm group">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Taux de Reversement</p>
            <p className="text-2xl font-bold text-emerald-500">72.4%</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-gray-400">Optimisé</span>
            </div>
          </Card>
        </div>

        <Card className="bg-white border-transparent shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Détail par Réservation</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 font-bold border-gray-100 h-9">
                <Filter size={14} /> Filtres
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F9FAFB] border-b border-gray-50">
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4">ID RÉSERVATION</th>
                  <th className="px-6 py-4">PROPRIÉTÉ / CHAMBRE</th>
                  <th className="px-6 py-4">MONTANT BRUT</th>
                  <th className="px-6 py-4">COMMISSION PMS</th>
                  <th className="px-6 py-4">FRAIS MÉNAGE</th>
                  <th className="px-6 py-4">NET PROPRIÉTAIRE</th>
                  <th className="px-6 py-4">SAISON</th>
                  <th className="px-6 py-4 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reservations.map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50 transition-all text-sm group">
                    <td className="px-6 py-5 font-bold text-[#8B5CF6]">{res.id}</td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-gray-900">Appartement {res.room}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase">{res.roomType}</div>
                    </td>
                    <td className="px-6 py-5 font-bold text-gray-900">{res.totalAmount.toLocaleString()} €</td>
                    <td className="px-6 py-5 font-bold text-rose-500">-{res.pmsCommission.toLocaleString()} € <span className="text-[9px] font-medium text-gray-400">({(res.pmsFeeRate * 100).toFixed(0)}%)</span></td>
                    <td className="px-6 py-5 font-bold text-orange-500">-{res.cleaningFee.toLocaleString()} €</td>
                    <td className="px-6 py-5 font-bold text-emerald-500 underline decoration-dotted underline-offset-4 cursor-help" title="Calcul: Brut - Comm - Ménage">{res.ownerPayout.toLocaleString()} €</td>
                    <td className="px-6 py-5">
                      <Badge className={cn(
                        "text-[9px] font-bold uppercase",
                        res.season === 'Haute' ? "bg-rose-50 text-rose-500 border-none" : "bg-blue-50 text-blue-500 border-none"
                      )}>
                        {res.season}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button className="p-2 hover:bg-[#8B5CF6]/5 text-gray-400 hover:text-[#8B5CF6] rounded-xl transition-all">
                        <FileText size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#F9FAFB] scrollbar-hide">
      <motion.div
         key={financeTab}
         initial={{ opacity: 0, y: 10 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.3 }}
      >
        {financeTab === 'facturation' && renderFacturation()}
        {financeTab === 'cloture' && renderCloture()}
        {financeTab === 'caisse' && renderCaisse()}
        {financeTab === 'impayes' && renderImpayes()}
        {financeTab === 'proprietaires' && renderProprietaires()}
      </motion.div>
    </div>
  );
};
