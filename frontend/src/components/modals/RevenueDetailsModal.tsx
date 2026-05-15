import React, { useEffect, useMemo, useState } from 'react';
import { 
  X, 
  Calendar, 
  TrendingUp, 
  Users, 
  Zap, 
  BarChart2, 
  Target, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingDown,
  Activity,
  Globe,
  PieChart,
  DollarSign,
  Briefcase,
  ExternalLink,
  ChevronRight,
  Download,
  RefreshCw,
  Plus,
  Euro,
  ZapOff,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';

interface RevenueDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: string;
  initialTab?: 'day' | 'events' | 'channels' | 'forecast' | 'alerts' | 'score';
}

export const RevenueDetailsModal: React.FC<RevenueDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedDate = "25 mai 2026",
  initialTab = 'day'
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const formattedSelectedDate = useMemo(() => {
    const parsed = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return selectedDate;
    return parsed.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }, [selectedDate]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'day', label: 'Analyse du Jour', icon: Calendar },
    { id: 'events', label: 'Événements', icon: Zap },
    { id: 'channels', label: 'Canaux', icon: Globe },
    { id: 'forecast', label: 'Forecast J+30', icon: TrendingUp },
    { id: 'alerts', label: 'Alertes', icon: AlertCircle },
    { id: 'score', label: 'Scoring', icon: Target },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-900/40 backdrop-blur-md overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl flex flex-col h-[88vh] overflow-hidden border border-white/20"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <TrendingUp size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-800 leading-tight">Détails Complets — Mai 2026</h2>
                <Badge className="bg-emerald-50 text-emerald-600 border-none text-xs font-bold px-2 py-0.5 rounded-md">LIVE DATA</Badge>
              </div>
              <p className="text-base font-medium text-gray-500 mt-1">Intelligence Revenue Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-all shadow-sm">
               <Download size={16} /> Exporter Rapport
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-all shadow-sm">
               <RefreshCw size={16} /> Actualiser
            </button>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-10 border-b border-gray-100 bg-white shrink-0 flex items-center gap-8 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "py-4 px-2 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap text-sm",
                activeTab === tab.id ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-gray-500 hover:text-gray-800 font-normal"
              )}
            >
              <tab.icon size={16} className={activeTab === tab.id ? "text-indigo-600" : "text-gray-400"} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[#F8FAFC]">
          <AnimatePresence mode="wait">
            {activeTab === 'day' && (
              <motion.div 
                key="tab-day"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                      <h3 className="text-lg font-semibold text-gray-800">Détail du jour : {formattedSelectedDate}</h3>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   {[
                     { label: 'Taux d\'occupation', val: '89%', color: 'text-emerald-500', icon: PieChart },
                     { label: 'ADR (Prix moyen)', val: '128,50 €', color: 'text-indigo-600', icon: DollarSign },
                     { label: 'RevPAR', val: '114,36 €', color: 'text-violet-500', icon: Activity },
                     { label: 'CA Journalier', val: '12 800 €', color: 'text-emerald-600', icon: Euro },
                   ].map((kpi, i) => (
                     <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                           <kpi.icon size={20} />
                        </div>
                        <div>
                           <p className="text-xs font-medium text-gray-500 mb-1">{kpi.label}</p>
                           <p className={cn("text-3xl font-bold tracking-tight", kpi.color)}>{kpi.val}</p>
                        </div>
                     </div>
                   ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="space-y-8">
                      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                         <h4 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                            <Activity size={18} className="text-indigo-500" /> Flux d'activité
                         </h4>
                         <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                            {[
                              { label: 'Réservations', val: '18', icon: Calendar },
                              { label: 'Clients in-house', val: '142', icon: Users },
                              { label: 'Arrivées', val: '23', icon: ArrowUpRight },
                              { label: 'Départs', val: '19', icon: ArrowDownRight },
                              { label: 'Personnel en poste', val: '12', icon: Briefcase },
                              { label: 'Taux de no-show', val: '2.3%', icon: AlertCircle, color: 'text-rose-500' },
                            ].map((item, i) => (
                              <div key={i} className="flex items-center justify-between border-b border-gray-50 pb-4">
                                 <div className="flex items-center gap-3">
                                    <item.icon size={16} className="text-gray-400" />
                                    <span className="text-xs font-medium text-gray-500">{item.label}</span>
                                 </div>
                                 <span className={cn("text-sm font-bold", item.color || "text-gray-900")}>{item.val}</span>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="bg-slate-800 p-8 rounded-3xl text-white shadow-md">
                         <div className="flex items-center justify-between mb-6">
                            <h4 className="text-sm font-medium text-slate-300">Recommandations Yield</h4>
                            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                               <Zap size={16} className="text-indigo-300" />
                            </div>
                         </div>
                         <div className="space-y-4">
                            {[
                              "⚠️ Forte demande détectée → augmenter les prix de +12%",
                              "📊 Taux OTA élevé (67%) → activer offre directe",
                              "🔄 Pickup en hausse → fermer les classes basses"
                            ].map((rec, i) => (
                              <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-4 transition-all hover:bg-white/10 cursor-pointer">
                                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                 <p className="text-sm font-medium text-slate-100">{rec}</p>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>

                   <div className="space-y-8">
                      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                         <h4 className="text-lg font-semibold text-gray-800 mb-6">Top canaux du jour</h4>
                         <div className="space-y-6">
                            {[
                              { name: 'Booking.com', val: '42%', count: '8 résas', color: 'bg-[#003580]', w: 'w-[42%]' },
                              { name: 'Direct', val: '28%', count: '5 résas', color: 'bg-[#8B5CF6]', w: 'w-[28%]' },
                              { name: 'Expedia', val: '15%', count: '3 résas', color: 'bg-[#FDA44F]', w: 'w-[15%]' },
                              { name: 'Walk-in', val: '10%', count: '2 résas', color: 'bg-[#10B981]', w: 'w-[10%]' },
                            ].map((ch, i) => (
                              <div key={i} className="space-y-2">
                                 <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-3">
                                       <div className={cn("w-2 h-2 rounded-full", ch.color)} />
                                       <span className="text-sm font-semibold text-gray-800">{ch.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                       <span className="text-xs font-medium text-gray-400">{ch.count}</span>
                                       <span className="text-lg font-bold text-gray-900">{ch.val}</span>
                                    </div>
                                 </div>
                                 <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full transition-all duration-1000", ch.color, ch.w)} />
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                         <h4 className="text-lg font-semibold text-gray-800 mb-6">Répartition par type de chambre</h4>
                         <div className="grid grid-cols-2 gap-4">
                            {[
                              { type: 'Standard', occ: '45%', color: 'text-gray-600', bg: 'bg-gray-50' },
                              { type: 'Supérieur', occ: '72%', color: 'text-indigo-600', bg: 'bg-indigo-50/50' },
                              { type: 'Deluxe', occ: '88%', color: 'text-violet-600', bg: 'bg-violet-50/50' },
                              { type: 'Suite', occ: '95%', color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
                            ].map((rt, i) => (
                              <div key={i} className={cn("p-5 rounded-2xl border border-transparent transition-all hover:shadow-sm cursor-default text-center", rt.bg)}>
                                 <p className="text-xs font-medium text-gray-500 mb-2">{rt.type}</p>
                                 <p className={cn("text-3xl font-bold", rt.color)}>{rt.occ}</p>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
                {/* ── Événements extérieurs ── */}
                <motion.div
                  key="tab-day-events"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-0"
                >
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm mt-8">
                    <h4 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                      <Zap size={18} className="text-indigo-500" /> Événements extérieurs du jour
                    </h4>
                    <div className="space-y-4">
                      {[
                        { name: 'Salon du Tourisme', loc: 'Parc des Expositions', time: '10:00 – 18:00', impact: '+25% DEMANDE', color: 'text-indigo-600' },
                        { name: 'Match : PSG vs OM', loc: 'Parc des Princes', time: '21:00', impact: '+15% DEMANDE', color: 'text-emerald-600' },
                      ].map((evt, idx) => (
                        <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{evt.name}</p>
                              <p className="text-xs font-medium text-gray-500 mt-0.5">{evt.loc}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-gray-500">{evt.time}</p>
                            <p className={cn("text-xs font-bold mt-1", evt.color)}>{evt.impact}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* ── KPI du jour avec comparaisons N-1 ── */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm mt-8">
                  <h4 className="text-lg font-semibold text-gray-800 mb-6">KPI du jour — Comparatif N-1</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { label: 'Taux d\'occupation', val: '72%', trend: '↗ 8 pts vs N-1', color: 'text-emerald-600' },
                      { label: 'Chiffre d\'Affaires', val: '9 980 €', trend: '↗ 1 250 € vs N-1', color: 'text-emerald-600' },
                      { label: 'ADR', val: '137 €', trend: '↗ 4 € vs N-1', color: 'text-emerald-600' },
                      { label: 'RevPAR', val: '99 €', trend: '↗ 11 € vs N-1', color: 'text-emerald-600' },
                    ].map((k, idx) => (
                      <div key={idx} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col items-center text-center">
                        <span className="text-xs font-medium text-gray-500 mb-2">{k.label}</span>
                        <span className="text-2xl font-bold text-gray-800 mb-1">{k.val}</span>
                        <span className={cn("text-xs font-bold", k.color)}>{k.trend}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Pickup J-30 → J ── */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm mt-8">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-lg font-semibold text-gray-800">Pickup — Évolution des réservations</h4>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-indigo-500" /><span className="text-xs font-medium text-gray-500">2025</span></div>
                      <div className="flex items-center gap-2"><div className="w-4 h-0.5 border-t-2 border-dashed border-gray-300" /><span className="text-xs font-medium text-gray-500">2024</span></div>
                    </div>
                  </div>
                  <div className="h-48 relative px-4">
                    <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                      <path d="M0,35 Q25,32 50,20 T100,5" fill="none" stroke="#6366f1" strokeWidth="1.2" />
                      <path d="M0,38 Q25,36 50,30 T100,25" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2,2" />
                      <circle cx="0" cy="35" r="1.5" fill="#6366f1" />
                      <circle cx="50" cy="20" r="1.5" fill="#6366f1" />
                      <circle cx="100" cy="5" r="1.5" fill="#6366f1" />
                    </svg>
                    <div className="absolute inset-0 flex items-end justify-between pb-1 px-1 pointer-events-none">
                      {['J-30','J-21','J-14','J-7','J-3','J'].map(l => <span key={l} className="text-xs font-medium text-gray-400">{l}</span>)}
                    </div>
                    <div className="absolute right-4 top-4 bg-white/90 backdrop-blur-sm p-5 rounded-2xl border border-gray-100 shadow-md">
                      <div className="text-xs font-medium text-gray-500 mb-1">Pickup J-3</div>
                      <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-500" />
                        <span className="text-2xl font-bold text-gray-800">+12%</span>
                      </div>
                      <div className="text-xs font-medium text-gray-400 mt-1">vs même jour N-1</div>
                    </div>
                  </div>
                </div>

                {/* ── Recommandations enrichies ── */}
                <div className="bg-slate-800 p-8 rounded-3xl text-white shadow-md mt-8">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-semibold text-white">Recommandations Intelligence Yield</h4>
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><Zap size={20} className="text-indigo-400" /></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { title: 'Demande élevée', desc: 'Augmenter les prix de +10 à +15%', icon: TrendingUp, color: 'text-emerald-400' },
                      { title: 'Forte dépendance OTA (60%)', desc: 'Booster les ventes directes', icon: Target, color: 'text-orange-400' },
                      { title: 'Pickup en accélération', desc: 'Surveiller l\'inventaire disponible', icon: Activity, color: 'text-indigo-300' },
                    ].map((r, idx) => (
                      <div key={idx} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer flex flex-col gap-3">
                        <r.icon size={20} className={r.color} />
                        <p className="text-sm font-semibold text-white">{r.title}</p>
                        <p className="text-xs font-medium text-slate-300">{r.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </motion.div>
            )}

            {activeTab === 'events' && (
              <motion.div 
                key="tab-events"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                 <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-gray-50 bg-indigo-50/20 flex items-center justify-between">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                             <Zap size={28} />
                          </div>
                          <div>
                             <h3 className="text-xl font-bold text-gray-800 leading-tight">🎪 Salon de l'Automobile</h3>
                             <p className="text-xs font-semibold text-indigo-600 mt-1">Impact Majeur Détecté</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-medium text-gray-500 mb-2">Période de l'événement</p>
                          <Badge className="bg-white border-gray-200 text-gray-800 text-sm font-semibold px-4 py-1.5 rounded-lg shadow-sm">10 - 15 Mai 2026</Badge>
                       </div>
                    </div>

                     <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                       <div className="lg:col-span-2 space-y-8">
                          <div className="grid grid-cols-2 gap-6">
                             <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100">
                                <p className="text-sm font-medium text-gray-500 mb-6">Impact sur l'hôtel</p>
                                <div className="space-y-5">
                                   {[
                                     { label: 'Hausse d\'occupation', val: '+24%', icon: TrendingUp, color: 'text-emerald-600' },
                                     { label: 'ADP (Average Daily Price)', val: '+18%', icon: DollarSign, color: 'text-indigo-600' },
                                     { label: 'Réservations générées', val: '47 chambres', icon: Calendar, color: 'text-indigo-600' },
                                     { label: 'CA généré', val: '32 450 €', icon: DollarSign, color: 'text-emerald-600' },
                                   ].map((item, i) => (
                                     <div key={i} className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3">
                                           <item.icon size={16} className="text-gray-400" />
                                           <span className="text-xs font-medium text-gray-600">{item.label}</span>
                                        </div>
                                        <span className={cn("text-base font-bold", item.color)}>{item.val}</span>
                                     </div>
                                   ))}
                                </div>
                             </div>

                             <div className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm">
                                <p className="text-sm font-medium text-gray-500 mb-8">Profil clientèle</p>
                                <div className="flex flex-col items-center">
                                   <div className="relative w-40 h-40 mb-8">
                                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                         <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-100" strokeWidth="4" />
                                         <circle cx="18" cy="18" r="16" fill="none" className="stroke-indigo-600" strokeWidth="4" strokeDasharray="65 100" />
                                         <circle cx="18" cy="18" r="16" fill="none" className="stroke-indigo-300" strokeWidth="4" strokeDasharray="25 100" strokeDashoffset="-65" />
                                         <circle cx="18" cy="18" r="16" fill="none" className="stroke-orange-400" strokeWidth="4" strokeDasharray="10 100" strokeDashoffset="-90" />
                                      </svg>
                                   </div>
                                   <div className="w-full space-y-3">
                                      {[
                                        { label: 'Professionnels', val: '65%', color: 'bg-indigo-600' },
                                        { label: 'Exposants', val: '25%', color: 'bg-indigo-300' },
                                        { label: 'Presse', val: '10%', color: 'bg-orange-400' },
                                      ].map((p, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                           <div className="flex items-center gap-2">
                                              <div className={cn("w-2 h-2 rounded-full", p.color)} />
                                              <span className="text-xs font-medium text-gray-600">{p.label}</span>
                                           </div>
                                           <span className="text-sm font-bold text-gray-800">{p.val}</span>
                                        </div>
                                      ))}
                                   </div>
                                </div>
                             </div>
                          </div>

                          <div className="p-8 rounded-3xl bg-slate-800 text-white shadow-md">
                             <h4 className="text-sm font-semibold text-slate-300 mb-6">Recommandations Stratégiques</h4>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                  { label: 'Prix dynamique', val: 'Activer sur D-30', icon: TrendingUp },
                                  { label: 'Package événement', val: 'Créer offre spéciale', icon: Zap },
                                  { label: 'Équipe dédiée', val: 'Prévoir renfort', icon: Users },
                                ].map((r, i) => (
                                  <div key={i} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer">
                                     <r.icon size={20} className="text-indigo-400 mb-3" />
                                     <p className="text-xs font-medium text-slate-400 mb-1">{r.label}</p>
                                     <p className="text-sm font-bold text-white">{r.val}</p>
                                  </div>
                                ))}
                             </div>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm flex flex-col items-center text-center">
                             <div className="w-20 h-20 rounded-2xl bg-rose-500 text-white flex items-center justify-center text-xl font-bold mb-4 shadow-sm">FORT</div>
                             <p className="text-sm font-semibold text-gray-800 mb-2">Impact Estimé</p>
                             <p className="text-xs font-medium text-gray-500 leading-relaxed px-4">L'événement coïncide avec une période de base déjà forte, saturation attendue à J-15.</p>
                          </div>

                          <div className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm">
                             <h4 className="text-sm font-medium text-gray-500 mb-6">Informations Lieu</h4>
                             <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 mb-4 border border-gray-100">
                                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                                   <Target size={20} />
                                </div>
                                <div className="text-left">
                                   <p className="text-sm font-bold text-gray-800">Paris Expo</p>
                                   <p className="text-xs font-medium text-gray-500 mt-0.5">Porte de Versailles</p>
                                </div>
                             </div>
                             <Button variant="ghost" className="w-full gap-2 text-indigo-600 font-semibold text-sm">
                                <ExternalLink size={16} /> Voir sur la carte
                             </Button>
                          </div>

                          <Button className="w-full h-14 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm gap-2">
                             <RefreshCw size={18} /> Recalculer Yield
                          </Button>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'channels' && (
              <motion.div 
                key="tab-channels"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                       <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                       <h3 className="text-lg font-semibold text-gray-800">Analyse détaillée des canaux — Mai 2026</h3>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                       <div>
                          <p className="text-xs font-semibold text-emerald-600 mb-1">Direct : +5% ↗️</p>
                          <p className="text-xs font-semibold text-rose-500">Booking : -2% ↘️</p>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                      { 
                        name: 'Booking.com', 
                        vol: '38%', 
                        count: '211 résas', 
                        adr: '118 €', 
                        comm: '15%', 
                        commVal: '3 724 €',
                        cancel: '8.2%',
                        score: '72/100',
                        color: 'text-[#003580]',
                        bg: 'bg-[#003580]/5',
                        icon: Globe,
                        recommendation: 'Surveiller les commissions'
                      },
                      { 
                        name: 'Site Direct', 
                        vol: '22%', 
                        count: '122 résas', 
                        adr: '135 €', 
                        comm: '0%', 
                        commVal: '0 €',
                        cancel: '3.1%',
                        score: '95/100',
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-50',
                        icon: Target,
                        isBest: true,
                        recommendation: 'Canal le plus rentable'
                      },
                      { 
                        name: 'Expedia', 
                        vol: '12%', 
                        count: '67 résas', 
                        adr: '112 €', 
                        comm: '18%', 
                        commVal: '2 150 €',
                        cancel: '9.5%',
                        score: '58/100',
                        color: 'text-orange-500',
                        bg: 'bg-orange-50',
                        icon: Globe,
                        recommendation: 'Réduire dépendance'
                      },
                    ].map((ch, i) => (
                      <div key={i} className={cn("bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md group", ch.isBest && "ring-2 ring-indigo-500")}>
                         <div className={cn("p-6 flex items-center justify-between border-b border-gray-100", ch.bg)}>
                            <div className="flex items-center gap-4">
                               <div className={cn("w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0", ch.color)}>
                                  <ch.icon size={24} />
                               </div>
                               <div>
                                  <h4 className={cn("text-base font-bold", ch.color)}>{ch.name}</h4>
                                  <p className="text-xs font-medium text-gray-500 mt-0.5">{ch.count}</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-3xl font-bold text-gray-900">{ch.vol}</p>
                               <p className="text-xs font-medium text-gray-500">Volume</p>
                            </div>
                         </div>
                         <div className="p-6 space-y-6 flex-1 bg-white">
                            <div className="grid grid-cols-2 gap-y-6">
                               <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">ADR Canal</p>
                                  <p className="text-lg font-bold text-gray-800">{ch.adr}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-xs font-medium text-gray-500 mb-1">Commission</p>
                                  <p className="text-lg font-bold text-rose-500">{ch.comm}</p>
                               </div>
                               <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">Annulations</p>
                                  <p className="text-lg font-bold text-gray-800">{ch.cancel}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-xs font-medium text-gray-500 mb-1">Score Contrib.</p>
                                  <p className="text-lg font-bold text-indigo-600">{ch.score}</p>
                               </div>
                            </div>
                            
                            <div className="pt-6 border-t border-gray-50">
                               <div className="p-4 rounded-xl bg-gray-50 flex items-center gap-3">
                                  <Zap size={16} className="text-indigo-500 shrink-0" />
                                  <p className="text-sm font-semibold text-gray-600">{ch.recommendation}</p>
                               </div>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </motion.div>
            )}

            {activeTab === 'alerts' && (
              <motion.div 
                key="tab-alerts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                    <h3 className="text-lg font-semibold text-gray-800">Jours critiques identifiés</h3>
                 </div>

                 <div className="space-y-6">
                    {[
                      { 
                        date: 'LUNDI 12 MAI', 
                        type: 'Sous-performance', 
                        diff: '-18% vs forecast', 
                        real: 'TO réel : 58% / Prévision : 71%', 
                        cause: 'absence événement local majeur', 
                        action: 'Activer offre Last-Minute Flash (24h)',
                        icon: TrendingDown,
                        color: 'bg-rose-50 text-rose-600',
                        border: 'border-rose-100'
                      },
                      { 
                        date: 'MERCREDI 28 MAI', 
                        type: 'ADR trop bas', 
                        diff: '-22€ vs moyenne', 
                        real: 'ADR réel : 98€ / Cible : 120€', 
                        cause: 'overbooking excessif sur classes basses', 
                        action: 'Ajustement Pricing D-7 (fermeture promo)',
                        icon: ArrowDownRight,
                        color: 'bg-orange-50 text-orange-600',
                        border: 'border-orange-100'
                      },
                      { 
                        date: 'DIMANCHE 18 MAI', 
                        type: 'Annulations massives', 
                        diff: '12 annulations enregistrées', 
                        real: 'Perte estimée : 1 850 €', 
                        cause: 'changement politique concurrentielle locale', 
                        action: 'Appliquer politique d\'annulation renforcée',
                        icon: ZapOff,
                        color: 'bg-indigo-50 text-indigo-600',
                        border: 'border-indigo-100'
                      },
                    ].map((alert, i) => (
                      <div key={i} className={cn("bg-white p-6 rounded-3xl border shadow-sm flex flex-col lg:flex-row lg:items-center gap-8 transition-all", alert.border)}>
                         <div className="flex items-center gap-5 min-w-[280px]">
                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", alert.color)}>
                               <alert.icon size={24} />
                            </div>
                            <div>
                               <h4 className="text-base font-bold text-gray-800">{alert.date}</h4>
                               <p className={cn("text-xs font-semibold mt-1", alert.color.split(' ')[1])}>{alert.type}</p>
                            </div>
                         </div>

                         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 border-l border-gray-100 pl-8">
                            <div>
                               <p className="text-xs font-medium text-gray-500 mb-2">Diagnostic</p>
                               <p className="text-sm font-bold text-gray-800 mb-1">{alert.diff}</p>
                               <p className="text-sm font-medium text-gray-600 mb-1">{alert.real}</p>
                               <p className="text-xs font-medium text-gray-500">Cause : {alert.cause}</p>
                            </div>
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                               <p className="text-xs font-medium text-gray-500 mb-3">Action Corrective</p>
                               <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                                     <ArrowUpRight size={18} />
                                  </div>
                                  <p className="text-sm font-semibold text-gray-800 leading-tight">{alert.action}</p>
                               </div>
                            </div>
                         </div>
                         
                         <div className="shrink-0 flex gap-3">
                            <Button variant="ghost" className="text-gray-500 text-sm font-medium">Ignorer</Button>
                            <Button className="bg-indigo-600 text-white rounded-xl px-5 h-10 font-semibold text-sm shadow-sm hover:bg-indigo-700">Appliquer</Button>
                         </div>
                      </div>
                    ))}
                 </div>
              </motion.div>
            )}

            {activeTab === 'forecast' && (
              <motion.div 
                key="tab-forecast"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                       <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                       <h3 className="text-lg font-semibold text-gray-800">Prévisions & Projections J+30</h3>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {[
                      { 
                        title: 'Semaine 1 (01-07 Mai)', 
                        to: '82%', 
                        adr: '128 €', 
                        revpar: '105 €', 
                        risk: 'Overbooking potentiel', 
                        action: 'Monitorer les dispos',
                        status: 'up',
                        isCritical: false
                      },
                      { 
                        title: 'Semaine 2 (08-14 Mai)', 
                        to: '94%', 
                        adr: '145 €', 
                        revpar: '136 €', 
                        risk: 'Dernière chance de vendre', 
                        action: 'Augmenter prix S2',
                        status: 'up-peak',
                        isCritical: true
                      },
                      { 
                        title: 'Semaine 3 (15-21 Mai)', 
                        to: '71%', 
                        adr: '112 €', 
                        revpar: '80 €', 
                        risk: 'Risque de vacance localisé', 
                        action: 'Lancer promotion flash',
                        status: 'down',
                        isCritical: false
                      },
                      { 
                        title: 'Semaine 4 (22-31 Mai)', 
                        to: '68%', 
                        adr: '105 €', 
                        revpar: '71 €', 
                        risk: 'Faible visibilité', 
                        action: 'Campagne marketing',
                        status: 'neutral',
                        isCritical: false
                      },
                    ].map((s, i) => (
                      <div key={i} className={cn("bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-md", s.isCritical && "ring-2 ring-rose-500 shadow-rose-100")}>
                         <div className={cn("p-6", s.isCritical ? "bg-rose-50" : "bg-gray-50/50")}>
                            <h4 className="text-sm font-bold text-gray-800 flex items-center justify-between">
                               {s.title}
                               {s.isCritical && <AlertCircle size={18} className="text-rose-500" />}
                            </h4>
                         </div>
                         <div className="p-6 space-y-6 flex-1">
                            <div className="grid grid-cols-3 gap-2">
                               <div className="text-center">
                                  <p className="text-xs font-medium text-gray-500 mb-1">TO Prévu</p>
                                  <p className="text-xl font-bold text-gray-900">{s.to}</p>
                                  <div className="flex justify-center mt-1">
                                     {s.status === 'up-peak' ? <ArrowUpRight className="text-rose-500" size={14} /> : 
                                      s.status === 'up' ? <ArrowUpRight className="text-emerald-500" size={14} /> :
                                      s.status === 'down' ? <ArrowDownRight className="text-rose-500" size={14} /> : <div className="h-[14px]"/>}
                                  </div>
                               </div>
                               <div className="text-center">
                                  <p className="text-xs font-medium text-gray-500 mb-1">ADR Prévu</p>
                                  <p className="text-xl font-bold text-gray-900">{s.adr}</p>
                               </div>
                               <div className="text-center">
                                  <p className="text-xs font-medium text-gray-500 mb-1">RevPAR</p>
                                  <p className="text-xl font-bold text-indigo-600">{s.revpar}</p>
                               </div>
                            </div>

                            <div className="space-y-4">
                               <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                  <p className="text-xs font-medium text-gray-500 mb-1">Alerte/Risque</p>
                                  <p className="text-sm font-semibold text-gray-700 leading-tight">{s.risk}</p>
                               </div>
                               <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center gap-3">
                                  <Zap size={16} className="text-indigo-600 shrink-0" />
                                  <p className="text-sm font-semibold text-indigo-700">{s.action}</p>
                               </div>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>

                 <div className="bg-slate-800 p-8 rounded-3xl text-white flex flex-col md:flex-row md:items-center justify-between shadow-md gap-6 mt-8">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                          <Target size={32} className="text-indigo-400" />
                       </div>
                       <div>
                          <h4 className="text-sm font-medium text-slate-300 mb-3">Recommandation Stratégique Globale</h4>
                          <div className="space-y-2">
                             <p className="text-lg font-bold text-white flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Activer le yield management agressif sur S2 (Peak Demand)
                             </p>
                             <p className="text-base font-semibold text-slate-300 flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-rose-400" /> Baisser les prix sur S3 à J-14 pour stimuler le volume
                             </p>
                          </div>
                       </div>
                    </div>
                    <Button className="h-14 px-8 bg-white text-slate-900 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 transition-all shrink-0">
                       Appliquer Stratégie
                    </Button>
                 </div>
              </motion.div>
            )}

            {activeTab === 'score' && (
              <motion.div 
                key="tab-score"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                       <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                       <h3 className="text-lg font-semibold text-gray-800">Détail du scoring mensuel : 78/100</h3>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
                       <h4 className="text-sm font-semibold text-gray-800">Détail par critère (Pondéré)</h4>
                       <div className="space-y-6">
                          {[
                            { label: 'Taux d\'occupation', pond: '30%', score: 72, color: 'bg-emerald-500' },
                            { label: 'ADR (Prix moyen)', pond: '25%', score: 68, color: 'bg-indigo-500' },
                            { label: 'RevPAR', pond: '20%', score: 82, color: 'bg-violet-500' },
                            { label: 'Profitabilité', pond: '15%', score: 85, color: 'bg-blue-500' },
                            { label: 'Satisfaction client', pond: '10%', score: 90, color: 'bg-rose-500' },
                          ].map((c, i) => (
                            <div key={i} className="space-y-3">
                               <div className="flex items-center justify-between px-1">
                                  <div className="flex flex-col">
                                     <span className="text-sm font-bold text-gray-800">{c.label}</span>
                                     <span className="text-xs font-medium text-gray-500">Poids : {c.pond}</span>
                                  </div>
                                  <span className="text-xl font-bold text-gray-900">{c.score}<span className="text-sm text-gray-400">/100</span></span>
                               </div>
                               <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div className={cn("h-full rounded-full transition-all duration-1000", c.color)} style={{ width: `${c.score}%` }} />
                                </div>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-8">
                       <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                          <h4 className="text-sm font-semibold text-gray-800 mb-6 text-center">Comparatifs</h4>
                          <div className="grid grid-cols-3 gap-4">
                             {[
                               { label: 'vs Mois dernier', val: '+4 pts', trend: 'up', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                               { label: 'vs Année dern.', val: '+11 pts', trend: 'up', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                               { label: 'vs Objectif', val: '-2 pts', trend: 'down', color: 'text-rose-600', bg: 'bg-rose-50' },
                             ].map((comp, i) => (
                               <div key={i} className="flex flex-col items-center text-center p-5 rounded-2xl bg-gray-50">
                                  <p className="text-xs font-medium text-gray-500 mb-2">{comp.label}</p>
                                  <p className={cn("text-xl font-bold", comp.color)}>{comp.val}</p>
                                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center mt-3", comp.bg)}>
                                     {comp.trend === 'up' ? <ArrowUpRight size={16} className={comp.color} /> : <ArrowDownRight size={16} className={comp.color} />}
                                  </div>
                               </div>
                             ))}
                          </div>
                          <p className="text-xs font-medium text-gray-500 text-center mt-6">Objectif mensuel fixé à 80/100</p>
                       </div>

                       <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex-1">
                          <h4 className="text-sm font-semibold text-gray-800 mb-6">Points d'amélioration prioritaires</h4>
                          <div className="space-y-4">
                             {[
                               { text: "Travailler l'ADR le weekend (Actuellement -12% vs semaine)", icon: TrendingUp },
                               { text: "Réduire la dépendance OTA (Objectif Direct : 30%)", icon: Target },
                               { text: "Optimiser le RevPAR des suites en basse saison", icon: DollarSign }
                             ].map((pt, i) => (
                               <div key={i} className="p-4 rounded-xl bg-gray-50 flex items-center gap-4 group transition-all hover:bg-gray-100/50">
                                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-indigo-500 shadow-sm shrink-0 transition-transform group-hover:scale-105">
                                     <pt.icon size={18} />
                                  </div>
                                  <p className="text-sm font-semibold text-gray-800">{pt.text}</p>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-8 py-6 border-t border-gray-100 bg-white shrink-0 flex items-center justify-between">
           <div className="flex items-center gap-3 text-gray-500">
              <ShieldCheck size={18} className="text-indigo-500" />
              <p className="text-xs font-medium">Analyse générée par Flowtym AI — Dernière mise à jour il y a 12 min</p>
           </div>
           <div className="flex items-center gap-3">
              <Button variant="ghost" className="text-sm font-semibold px-6 h-10 text-gray-600 hover:text-gray-900" onClick={onClose}>Fermer</Button>
              <Button className="bg-indigo-600 text-white rounded-xl px-6 h-10 font-semibold text-sm shadow-sm hover:bg-indigo-700 transition-all gap-2">
                 <RefreshCw size={16} /> Actualiser l'analyse
              </Button>
           </div>
        </div>
      </motion.div>
    </div>
  );
};
