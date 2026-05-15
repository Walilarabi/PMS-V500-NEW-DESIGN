import React from 'react';
import { ModuleSidebar } from '@/src/components/ModuleSidebar';
import { 
  Zap, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  ShieldCheck,
  TrendingUp,
  XCircle,
  BarChart2,
  Lock,
  Globe,
  MoreVertical,
  MinusCircle,
  X,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LineChart, 
  Line,
  ComposedChart
} from 'recharts';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import { useReservations } from '@/src/contexts/ReservationContext';
import { motion, AnimatePresence } from 'motion/react';
import { Tarifs } from '@/src/components/Tarifs';
import { AutoRules } from '@/src/components/AutoRules';

// Mock data for price history simulation
const priceHistoryData = [
  { day: '01/05', baseline: 180, optimized: 180, delta: 0 },
  { day: '05/05', baseline: 180, optimized: 195, delta: 15 },
  { day: '10/05', baseline: 190, optimized: 210, delta: 20 },
  { day: '15/05', baseline: 190, optimized: 225, delta: 35 },
  { day: '20/05', baseline: 210, optimized: 245, delta: 35 },
  { day: '25/05', baseline: 210, optimized: 260, delta: 50 },
  { day: '30/05', baseline: 220, optimized: 285, delta: 65 },
  { day: '05/06', baseline: 240, optimized: 310, delta: 70 },
  { day: '10/06', baseline: 260, optimized: 330, delta: 70 },
];

export const RevenueView = ({ activeTab: propTab = 'tarifs' }: { activeTab?: string }) => {
  const [activeTab, setActiveTab] = React.useState<'tarifs' | 'auto_rules' | 'yield' | 'promotions' | 'channels'>('tarifs');
  const [selectedRule, setSelectedRule] = React.useState<any>(null);
  const { reservations } = useReservations();

  React.useEffect(() => {
    if (['tarifs', 'auto_rules', 'yield', 'promotions', 'channels'].includes(propTab)) {
      setActiveTab(propTab as any);
    }
  }, [propTab]);

  const rules = [
    { title: 'R1 - Forte demande (volume)', trigger: 'Volume de ventes > 4 paliers', desc: 'Augmente les prix lorsque les ventes dépassent des seuils de capacité.', active: true },
    { title: 'R2 - Annulations tardives', trigger: 'Annulations tardives > 2 paliers', desc: 'Réagit aux annulations de dernière minute pour reconquérir la demande.', active: true },
    { title: 'R3 - Creux prolongé', trigger: 'Creux de demande > 3 paliers', desc: 'Réduit les prix si aucune réservation sur J+7 à J+45.', active: true },
    { title: 'R4 - Peak last minute', trigger: 'Peak last minute > 2 paliers', desc: 'Exploite la forte demande J-7 à J-1 quand occupation > 80%.', active: true },
    { title: 'R5 - LOS dynamique', trigger: 'Séjour minimum (LOS) > 2 paliers', desc: 'Impose un séjour minimum les week-ends ou événements.', active: false },
    { title: 'R6 - Parité tarifaire', trigger: 'Parité concurrentielle > 3 paliers', desc: 'Ajuste les prix face aux concurrents pour garder la compétitivité.', active: true },
    { title: 'R7 - Early bird', trigger: 'Early bird > 2 paliers', desc: 'Remises pour réservation anticipée (30-60 jours).', active: true },
    { title: 'R8 - Déplacement groupe', trigger: 'Déplacement groupe > 2 paliers', desc: 'Détecte les groupes qui risquent de déplacer des individuels rentables.', active: false },
  ];

  const renderRuleSimulation = () => {
    if (!selectedRule) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#8B5CF6]/10 rounded-2xl text-[#8B5CF6]">
                <TrendingUp size={24} />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">Configuration : {selectedRule.title}</h2>
                <p className="text-gray-500 text-sm font-medium mt-1">Simulez l'impact de cette règle sur vos tarifs historiques.</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedRule(null)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={24} className="text-gray-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
            {/* Simulation Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-gray-50 rounded-3xl text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Impact Moyen</p>
                <p className="text-2xl font-bold text-emerald-500">+14.2%</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold text-gray-400">Par rapport au prix de base</span>
                </div>
              </div>
              <div className="p-6 bg-gray-50 rounded-3xl text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Gain Marginal Estimé</p>
                <p className="text-2xl font-bold text-[#8B5CF6]">3 420 €</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold text-gray-400">Sur les 30 derniers jours</span>
                </div>
              </div>
              <div className="p-6 bg-[#8B5CF6] rounded-3xl text-white text-left shadow-lg shadow-[#8B5CF6]/20">
                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1 text-white">Score d'Efficacité</p>
                <p className="text-2xl font-bold">92/100</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold opacity-80">Recommandé pour activation</span>
                </div>
              </div>
            </div>

            {/* Price Impact Chart */}
            <Card className="p-6 border-transparent shadow-sm overflow-hidden bg-white">
              <div className="flex items-center justify-between mb-8">
                <div className="text-left">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest leading-none">Simulation de l'impact tarifaire</h3>
                  <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-tight italic">Visualisation du delta de prix vs baseline</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Baseline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#8B5CF6]" />
                    <span className="text-[10px] font-bold text-[#8B5CF6] uppercase">Optimisé</span>
                  </div>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={priceHistoryData}>
                    <defs>
                      <linearGradient id="colorDelta" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }} 
                      tickFormatter={(value) => `${value}€`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="optimized" stroke="none" fill="url(#colorDelta)" name="Zone Impact" />
                    <Line type="monotone" dataKey="baseline" stroke="#D1D5DB" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Prix de base" />
                    <Line type="monotone" dataKey="optimized" stroke="#8B5CF6" strokeWidth={4} dot={{ fill: '#8B5CF6', r: 4, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Prix Optimisé" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Parameters Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left pb-4">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Paramètres de la règle</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Seuil d'occupation</p>
                      <p className="text-sm font-bold text-gray-900">75%</p>
                    </div>
                    <button className="text-[#8B5CF6] p-1.5 hover:bg-[#8B5CF6]/5 rounded-lg transition-all border border-transparent hover:border-[#8B5CF6]/20">Modifier</button>
                  </div>
                  <div className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Incrément de prix</p>
                      <p className="text-sm font-bold text-gray-900">+ 15.00 €</p>
                    </div>
                    <button className="text-[#8B5CF6] p-1.5 hover:bg-[#8B5CF6]/5 rounded-lg transition-all border border-transparent hover:border-[#8B5CF6]/20">Modifier</button>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Résumé Analytics</h3>
                <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100/50 text-blue-900 flex gap-4">
                  <div className="shrink-0 text-blue-500 mt-0.5">
                    <Info size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium leading-relaxed">
                      L'activation de cette règle sur la période de Mai a permis de capturer un volume additionnel de <span className="font-bold">42 nuits</span> pour un ADR moyen de <span className="font-bold">214€</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 rounded-b-[32px]">
            <Button variant="ghost" className="font-bold h-12 px-6" onClick={() => setSelectedRule(null)}>Annuler</Button>
            <Button className="bg-[#8B5CF6] text-white font-bold h-12 px-10 rounded-2xl shadow-lg shadow-[#8B5CF6]/20">Enregistrer & Appliquer</Button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderYield = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         {rules.map((rule, i) => (
            <Card 
              key={`rule-${rule.title.replace(/\s+/g, '-')}`} 
              onClick={() => setSelectedRule(rule)}
              className="flex flex-col group hover:shadow-xl hover:shadow-[#8B5CF6]/5 transition-all text-left cursor-pointer"
            >
               <CardHeader className="items-start">
                  <div className="flex gap-4">
                     <div className={cn(
                       "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                       i % 2 === 0 ? "bg-[#8B5CF6]/10 text-[#8B5CF6]" : "bg-blue-50 text-blue-500"
                     )}>
                        {i % 4 === 0 ? <TrendingUp size={24} /> : i % 4 === 1 ? <XCircle size={24} /> : i % 4 === 2 ? <BarChart2 size={24} /> : <Zap size={24} />}
                     </div>
                     <div>
                        <h3 className="font-bold text-gray-900 group-hover:text-[#8B5CF6] transition-colors">{rule.title}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{rule.trigger}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className={cn(
                        "w-10 h-5 rounded-full p-0.5 relative transition-colors cursor-pointer",
                        rule.active ? "bg-[#8B5CF6]" : "bg-gray-200"
                     )}>
                        <div className={cn(
                           "absolute h-4 w-4 bg-white rounded-full shadow-sm transition-all",
                           rule.active ? "right-0.5" : "left-0.5"
                        )} />
                     </div>
                     <button className="text-gray-300 hover:text-gray-500"><MoreVertical size={18} /></button>
                  </div>
               </CardHeader>
               <CardContent className="flex-1 flex flex-col pt-4">
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed line-clamp-2">{rule.desc}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                     <Badge variant="neutral" className="bg-gray-50 text-[9px] px-2 py-0.5 font-bold tracking-tighter">P1 45-55% → 2 act.</Badge>
                     <Badge variant="neutral" className="bg-gray-50 text-[9px] px-2 py-0.5 font-bold tracking-tighter">P2 56-75% → 3 act.</Badge>
                     <Badge variant="neutral" className="bg-gray-50 text-[9px] px-2 py-0.5 font-bold tracking-tighter">P3 76-89% → 3 act.</Badge>
                     <Badge variant="neutral" className="bg-gray-50 text-[9px] px-2 py-0.5 font-bold tracking-tighter cursor-pointer hover:bg-gray-100">+1</Badge>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                     <div className="flex gap-2">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Système</span>
                        <Badge variant={rule.active ? 'success' : 'neutral'} className="text-[8px] py-0">{rule.active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                     </div>
                     <button className="text-[11px] font-bold text-[#8B5CF6] flex items-center gap-1 hover:underline">
                        Configurer <ChevronRight size={14} />
                     </button>
                  </div>
               </CardContent>
            </Card>
         ))}
      </div>
      {/* ... keeping other sections ... */}
    </div>
  );

  const renderChannels = () => {
    // Analytics calculation from spec
    // Coût d'acquisition (CAC) : Amount * Commission_Rate
    // Rentabilité Nette : Amount - (Amount * Commission_Rate)

    const distribution = reservations.reduce((acc, res) => {
      const source = (res as any).channelName === 'Website' ? 'Direct' : 'OTA';
      const channelName = (res as any).channelName || res.source; // Fallback to source if channelName is missing
      if (!acc[channelName]) {
        acc[channelName] = { 
          name: channelName, 
          source, 
          bookings: 0, 
          revenue: 0, 
          cac: 0 
        };
      }
      acc[channelName].bookings += 1;
      acc[channelName].revenue += res.totalAmount;
      acc[channelName].cac += res.totalAmount * (channelName === 'Website' ? 0 : 0.15); // Mock 15% for OTA
      return acc;
    }, {} as Record<string, any>);

    const channelDetails = Object.values(distribution) as Array<{ name: string; source: string; bookings: number; revenue: number; cac: number }>;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 bg-white border-transparent shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Rentabilité Canaux</p>
             <p className="text-2xl font-bold text-emerald-500">84.8%</p>
             <p className="text-[10px] font-bold text-gray-400 mt-1">Après déduction commissions</p>
          </Card>
          <Card className="p-6 bg-white border-transparent shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Coût d'Acquisition Moyen</p>
             <p className="text-2xl font-bold text-rose-500">18.40 €</p>
             <p className="text-[10px] font-bold text-gray-400 mt-1">Par réservation</p>
          </Card>
          <Card className="p-6 bg-white border-transparent shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mix Direct</p>
             <p className="text-2xl font-bold text-[#8B5CF6]">42%</p>
             <p className="text-[10px] font-bold text-emerald-500 mt-1">+5% vs mois dernier</p>
          </Card>
        </div>

        <Card className="bg-white border-transparent shadow-sm overflow-hidden">
          <CardHeader>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Performance par Canal Distribution</h3>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F9FAFB] border-b border-gray-50">
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4">CANAL</th>
                  <th className="px-6 py-4">TYPE</th>
                  <th className="px-6 py-4">RÉSERVATIONS</th>
                  <th className="px-6 py-4">REVENU BRUT</th>
                  <th className="px-6 py-4">COÛT (CAC)</th>
                  <th className="px-6 py-4">RENTABILITÉ NETTE</th>
                  <th className="px-6 py-4">SANTÉ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {channelDetails.map((d) => (
                  <tr key={d.name} className="hover:bg-gray-50 transition-all text-sm group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3 font-bold text-gray-900">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          d.source === 'Direct' ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500"
                        )}>
                          <Globe size={16} />
                        </div>
                        {d.name}
                      </div>
                    </td>
                    <td className="px-6 py-5 font-bold text-gray-400 uppercase text-[10px]">{d.source}</td>
                    <td className="px-6 py-5 font-bold text-gray-900">{d.bookings}</td>
                    <td className="px-6 py-5 font-bold text-gray-900">{d.revenue.toLocaleString()} €</td>
                    <td className="px-6 py-5 font-bold text-rose-500">-{d.cac.toLocaleString()} €</td>
                    <td className="px-6 py-4 font-bold text-emerald-500">{(d.revenue - d.cac).toLocaleString()} €</td>
                    <td className="px-6 py-5">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            d.source === 'Direct' ? "bg-emerald-500 w-[95%]" : "bg-blue-400 w-[78%]"
                          )}
                        />
                      </div>
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
    <div className="flex h-full bg-[#F9FAFB]">
      <ModuleSidebar
        items={[
          { id: 'tarifs', label: 'Tarifs & Dispos', icon: BarChart2 },
          { id: 'auto_rules', label: 'Règles Auto', icon: Zap },
          { id: 'yield', label: 'Règles Yielder', icon: Zap },
          { id: 'channels', label: 'Performance Canaux', icon: Globe },
          { id: 'promotions', label: 'Offres & Promos', icon: Zap },
        ]}
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab as any)}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F9FAFB] scrollbar-hide">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <button className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors shadow-sm"><ChevronRight size={20} className="rotate-180" /></button>
           <div className="flex items-center gap-3 text-left">
              <div className="p-2.5 bg-[#8B5CF6] rounded-2xl text-white shadow-lg shadow-[#8B5CF6]/20">
                 <Zap size={24} fill="currentColor" />
              </div>
            <div>
               <h1 className="text-2xl font-bold text-gray-900 leading-tight">Optimisation Revenue</h1>
               <p className="text-gray-500 text-sm font-medium mt-1">Pilotez vos tarifs et analysez vos canaux de distribution.</p>
            </div>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="gap-2 px-4 shadow-sm bg-white font-bold"><ShieldCheck size={16} />Garde-fous</Button>
           <Button className="bg-[#8B5CF6] text-white gap-2 shadow-lg shadow-[#8B5CF6]/20 py-2.5 font-bold">
             <Plus size={16} /> Nouvelle action
           </Button>
        </div>
      </div>


      <div className="flex-1">
        {activeTab === 'tarifs' && <Tarifs />}
        {activeTab === 'auto_rules' && <AutoRules />}
        {activeTab === 'yield' && renderYield()}
        {activeTab === 'channels' && renderChannels()}
        {activeTab === 'promotions' && <div className="text-left p-20 bg-white rounded-3xl border border-dashed text-gray-300 font-bold uppercase tracking-widest text-center">Module Promotions en cours de modernisation</div>}
      </div>

      <AnimatePresence>
        {selectedRule && renderRuleSimulation()}
      </AnimatePresence>
      </div>
    </div>
  );
};
