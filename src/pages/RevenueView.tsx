import React from 'react';
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
  MinusCircle
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';

export const RevenueView = () => {
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

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F9FAFB]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <button className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors shadow-sm"><ChevronRight size={20} className="rotate-180" /></button>
           <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#8B5CF6] rounded-2xl text-white shadow-lg shadow-[#8B5CF6]/20">
                 <Zap size={24} fill="currentColor" />
              </div>
            <div>
               <h1 className="text-2xl font-bold text-gray-900 leading-tight">Yielder Rules</h1>
               <p className="text-gray-500 text-sm font-medium mt-1">13 règles configurées • 9 actives</p>
            </div>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="gap-2 px-4 shadow-sm bg-white"><ShieldCheck size={16} />Garde-fous</Button>
           <Button className="gap-2 shadow-lg shadow-[#8B5CF6]/20 py-2.5">
             <Plus size={16} /> Nouvelle règle
           </Button>
        </div>
      </div>

      {/* Global Bounds Bar */}
      <Card className="p-4 bg-white/50 backdrop-blur-sm border-dashed">
         <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
               <span className="text-[11px] font-bold text-emerald-500 uppercase">Plancher : 128 €</span>
               <div className="w-[1px] h-4 bg-gray-200" />
               <span className="text-[11px] font-bold text-red-500 uppercase">Plafond : 850 €</span>
            </div>
            <div className="flex items-center gap-3">
               <span className="text-[11px] font-bold text-[#8B5CF6] uppercase">Parité OTA : Oui</span>
               <div className="w-[1px] h-4 bg-gray-200" />
               <span className="text-[11px] font-bold text-amber-500 uppercase">Dernière ch. : x1.35</span>
            </div>
            <div className="flex-1 flex justify-end gap-3">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input className="pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-xs focus:ring-1 focus:ring-[#8B5CF6] outline-none w-64" placeholder="Rechercher une règle..." />
               </div>
               <div className="flex bg-white border border-gray-100 rounded-xl p-1 gap-1">
                  <button className="px-3 py-1.5 text-xs font-bold text-gray-400">Tous types</button>
                  <button className="px-3 py-1.5 text-xs font-bold text-gray-400">Toutes</button>
               </div>
            </div>
         </div>
      </Card>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         {rules.map((rule, i) => (
            <Card key={i} className="flex flex-col group hover:shadow-xl hover:shadow-[#8B5CF6]/5 transition-all">
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
      
      {/* Yield Overview Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <Card className="lg:col-span-3 p-6 flex flex-col md:flex-row gap-8 items-center bg-[#8B5CF6]/[0.02] border-[#8B5CF6]/10">
            <div className="flex-1">
               <h3 className="font-bold text-gray-900 mb-2">Impact estimé (ce mois)</h3>
               <p className="text-sm text-gray-500 mb-6">Basé sur l'optimisation des tarifs via Little Yielder.</p>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-transform hover:scale-[1.02]">
                     <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Gain Marginal</div>
                     <div className="text-xl font-bold text-gray-900">+4,280 €</div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-transform hover:scale-[1.02]">
                     <div className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest mb-1">Efficacité Yield</div>
                     <div className="text-xl font-bold text-gray-900">92%</div>
                  </div>
               </div>
            </div>
            <div className="w-px h-24 bg-gray-200 hidden md:block" />
            <div className="flex flex-col items-center">
               <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Yield Overview</div>
               <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                     <circle cx="48" cy="48" r="40" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                     <circle cx="48" cy="48" r="40" fill="none" stroke="#8B5CF6" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="50.24" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-xl font-bold text-gray-900">6</span>
                     <span className="text-[8px] font-bold text-gray-400">TOTAL</span>
                  </div>
               </div>
            </div>
            <div className="space-y-2">
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                  <span className="text-[11px] font-bold text-gray-500 uppercase w-16">Actifs</span>
                  <span className="text-[11px] font-bold text-gray-900 ml-4">6 (60%)</span>
               </div>
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-[11px] font-bold text-gray-500 uppercase w-16">En test</span>
                  <span className="text-[11px] font-bold text-gray-900 ml-4">2 (20%)</span>
               </div>
               <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-[11px] font-bold text-gray-500 uppercase w-16">Inactifs</span>
                  <span className="text-[11px] font-bold text-gray-900 ml-4">2 (20%)</span>
               </div>
            </div>
         </Card>
         
         <div className="flex flex-col gap-4">
            <button className="h-full bg-gray-900 text-white rounded-3xl p-6 flex flex-col justify-between group hover:bg-gray-800 transition-all text-left">
               <Globe size={24} className="opacity-40 group-hover:opacity-100 transition-opacity" />
               <div>
                  <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">Parité GDS</h4>
                  <p className="text-[10px] text-gray-400 font-medium">Connectez vos flux GDS pour synchroniser les prix.</p>
               </div>
               <div className="mt-4 flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold text-[#8B5CF6]">ACTIVER</span>
                  <ChevronRight size={14} className="text-[#8B5CF6]" />
               </div>
            </button>
         </div>
      </div>
    </div>
  );
};
