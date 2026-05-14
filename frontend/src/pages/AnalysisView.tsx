import React, { useMemo, useState, useRef } from "react";
import {
  TrendingUp, Users, MapPin, Calendar, ArrowLeft, Download, FileText,
  BarChart2, PieChart, Globe, ArrowRight, FileSpreadsheet, ChevronLeft,
  ChevronRight, ChevronsLeft, ChevronsRight, Search, LayoutDashboard,
  ClipboardList, Printer, History, ShieldCheck, Coffee, Trophy, Crown,
  Tags, ShoppingCart, RefreshCcw, BarChart3, PlaneLanding, PlaneTakeoff,
  Clock, Euro, Hotel, Info, Filter, Trash2, CheckCircle2, AlertCircle,
  FileBarChart, ExternalLink, Target, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Title, Tooltip, Legend, ArcElement, Filler,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import * as XLSX from "xlsx";
// @ts-ignore
import html2pdf from "html2pdf.js";
import * as pmsLogic from "../lib/pmsLogic";
import { useConfigStore } from "../store/configStore";
// mock context removed — data via Supabase hooks
import { cn } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardHeader, CardContent } from "../components/ui/Card";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler,
);

// Palette Flowtym "Satin"
const COLORS = {
  violet: { light: "#F5F3FF", border: "#DDD6FE", main: "#8B5CF6", text: "#5B21B6" },
  emerald: { light: "#ECFDF5", border: "#A7F3D0", main: "#10B981", text: "#065F46" },
  blue: { light: "#EFF6FF", border: "#BFDBFE", main: "#3B82F6", text: "#1E40AF" },
  amber: { light: "#FFFBEB", border: "#FDE68A", main: "#F59E0B", text: "#92400E" },
  rose: { light: "#FFF1F2", border: "#FECDD3", main: "#F43F5E", text: "#9F1239" },
  slate: { light: "#F8FAFC", border: "#E2E8F0", main: "#64748B", text: "#1E293B" },
};

// ─── LISTE DES 49 RAPPORTS ───────────────────────────────────────────────────

const ALL_REPORTS = [
  // EXPLOITATION
  { id: 'EXP-01', cat: 'EXPLOITATION', title: 'Occupation temps réel', icon: Clock, desc: "Ratio chambres occupées / totales aujourd'hui" },
  { id: 'EXP-02', cat: 'EXPLOITATION', title: 'Cardex Client', icon: Users, desc: "Agrégation historique par client (CA, séjours)" },
  { id: 'EXP-03', cat: 'EXPLOITATION', title: 'Petit-déjeuner', icon: Coffee, desc: "Liste des clients en séjour avec PDJ" },
  { id: 'EXP-04', cat: 'EXPLOITATION', title: 'PDJ pré-facturés', icon: Coffee, desc: "Prestations PDJ sur folio non consommées" },
  { id: 'EXP-05', cat: 'EXPLOITATION', title: 'Planning du jour', icon: Calendar, desc: "Arrivées, départs et en séjour" },
  { id: 'EXP-06', cat: 'EXPLOITATION', title: 'Feuille gouvernante', icon: ClipboardList, desc: "Chambres à blanc vs recouche" },
  { id: 'EXP-07', cat: 'EXPLOITATION', title: 'Attribution chambres', icon: LayoutDashboard, desc: "Réservations sans numéro de chambre" },
  { id: 'EXP-08', cat: 'EXPLOITATION', title: 'Liste de Groupes', icon: Users, desc: "CA consolidé par groupe et canal pro" },
  { id: 'EXP-09', cat: 'EXPLOITATION', title: 'No-shows', icon: AlertCircle, desc: "Réservations confirmées non présentées" },
  { id: 'EXP-10', cat: 'EXPLOITATION', title: 'Départs du jour', icon: PlaneTakeoff, desc: "Liste de contrôle réception (solde folio)" },
  { id: 'EXP-11', cat: 'EXPLOITATION', title: 'Prévision repas', icon: Coffee, desc: "Algo prédictif sur 7 jours (adultes/enfants)" },
  { id: 'EXP-12', cat: 'EXPLOITATION', title: 'Taux de change', icon: RefreshCcw, desc: "Table de conversion internationale" },
  { id: 'EXP-13', cat: 'EXPLOITATION', title: 'F&B Détails', icon: ShoppingCart, desc: "Consos minibar/bar/restaurant par chambre" },
  { id: 'EXP-14', cat: 'EXPLOITATION', title: 'Occupation prévisionnelle', icon: BarChart3, desc: "TO% futur sur 30/60/90 jours" },
  { id: 'EXP-15', cat: 'EXPLOITATION', title: 'Productivité ménage', icon: Clock, desc: "Temps moyen de nettoyage par agent" },
  { id: 'EXP-16', cat: 'EXPLOITATION', title: 'Planning personnel', icon: Users, desc: "Shifts employés par département" },

  // STATISTIQUES
  { id: 'STA-01', cat: 'STATISTIQUES', title: 'Dashboard cumulé', icon: TrendingUp, desc: "TO%, ADR, RevPAR et CA Total" },
  { id: 'STA-02', cat: 'STATISTIQUES', title: 'Analyse tarifs', icon: Tags, desc: "Performance par Rate Plan" },
  { id: 'STA-03', cat: 'STATISTIQUES', title: 'Allotements', icon: LayoutDashboard, desc: "Stocks partenaires et remplissage bloc" },
  { id: 'STA-04', cat: 'STATISTIQUES', title: 'Analyse clients', icon: Trophy, desc: "Segmentation RFM (Top Spenders)" },
  { id: 'STA-05', cat: 'STATISTIQUES', title: 'Canaux distribution', icon: Globe, desc: "Part de marché Direct vs OTA" },
  { id: 'STA-06', cat: 'STATISTIQUES', title: 'Nationalités & Pays', icon: MapPin, desc: "Ciblage marketing par zone" },
  { id: 'STA-07', cat: 'STATISTIQUES', title: 'Déclaration INSEE', icon: FileBarChart, desc: "Données légales (français/étrangers)" },
  { id: 'STA-08', cat: 'STATISTIQUES', title: 'Rotation chambres', icon: RefreshCcw, desc: "Usure du mobilier par utilisation" },
  { id: 'STA-09', cat: 'STATISTIQUES', title: 'Turnover chambres', icon: History, desc: "Changements de chambre en cours de séjour" },
  { id: 'STA-10', cat: 'STATISTIQUES', title: 'Analyse avancée', icon: BarChart2, desc: "Croisement Pays x Canal" },
  { id: 'STA-11', cat: 'STATISTIQUES', title: 'Segmentation Marché', icon: Target, desc: "Corporate, Loisir, Groupes" },

  // FINANCIER
  { id: 'FIN-01', cat: 'FINANCIER', title: 'Journal prestations', icon: FileText, desc: "Liste chronologique des ventes" },
  { id: 'FIN-02', cat: 'FINANCIER', title: 'Journal règlements', icon: Euro, desc: "Paiements avec rapprochement caissier" },
  { id: 'FIN-03', cat: 'FINANCIER', title: 'Compte de résultat', icon: BarChart2, desc: "CA Net - Commissions OTA estimées" },
  { id: 'FIN-04', cat: 'FINANCIER', title: 'Balance âgée', icon: Clock, desc: "Analyse des impayés (0-30j, 60j, 90j)" },
  { id: 'FIN-05', cat: 'FINANCIER', title: 'Contrôle soldes', icon: ShieldCheck, desc: "Errerurs de folio (Facturé - Encaissé)" },
  { id: 'FIN-06', cat: 'FINANCIER', title: 'Petite caisse', icon: ShoppingCart, desc: "Journal micro-dépenses opérationnelles" },
  { id: 'FIN-07', cat: 'FINANCIER', title: 'Recouchant facturé', icon: Euro, desc: "Ménage inclus vs facturé en extra" },
  { id: 'FIN-08', cat: 'FINANCIER', title: 'Position globale', icon: TrendingUp, desc: "Trésorerie vs Créances" },
  { id: 'FIN-09', cat: 'FINANCIER', title: 'Déclaration TVA', icon: FileText, desc: "Ventilation par taux (2.1%, 5.5%, 10%, 20%)" },
  { id: 'FIN-10', cat: 'FINANCIER', title: 'Situation financière', icon: History, desc: "Bilan Créances / Commissions / TVA" },
  { id: 'FIN-11', cat: 'FINANCIER', title: 'Rapport de caisse', icon: Printer, desc: "Entrées/Sorties par point de vente" },
  { id: 'FIN-12', cat: 'FINANCIER', title: 'Taxe de séjour', icon: Euro, desc: "Calcul municipal (adultes * nuits)" },
  { id: 'FIN-13', cat: 'FINANCIER', title: 'Clôture de caisse', icon: ShieldCheck, desc: "Validation par shift théorique vs réel" },
  { id: 'FIN-14', cat: 'FINANCIER', title: 'Commissions OTA', icon: ExternalLink, desc: "Calcul montants à reverser (Booking/Expedia)" },
  { id: 'FIN-15', cat: 'FINANCIER', title: 'Taxe séjour déclarative', icon: CheckCircle2, desc: "Pré-remplissage Cerfa" },
  { id: 'FIN-16', cat: 'FINANCIER', title: 'Rapport de facturation', icon: Printer, desc: "Historique des factures et avoirs" },

  // CLIENTS & DIRECTION
  { id: 'CLI-01', cat: 'CLIENTS', title: 'Liste Débiteurs', icon: Users, desc: 'Solde ouvert après départ' },
  { id: 'CLI-02', cat: 'CLIENTS', title: 'Arrhes & acomptes', icon: ShieldCheck, desc: 'Suivi des garanties reçues' },
  { id: 'CLI-03', cat: 'CLIENTS', title: 'Crédits clients', icon: Euro, desc: 'Avoirs non utilisés' },
  { id: 'CLI-04', cat: 'CLIENTS', title: 'États antérieurs', icon: History, desc: 'Analyse risque dettes anciennes' },
  { id: 'CLI-05', cat: 'CLIENTS', title: 'Statistiques CLV', icon: Crown, desc: 'Customer Lifetime Value' },
  { id: 'DIR-01', cat: 'DIRECTION', title: 'Synthèse direction', icon: StarIcon, desc: 'Rapport du matin (CA, TO, ADR vs N-1)' },
  { id: 'PRO-01', cat: 'PROPRIETAIRES', title: 'Compte propriétaire', icon: Hotel, desc: 'Revenu Brut - Commission gestion = Net' },
];

function StarIcon(props: any) {
  return <Crown {...props} />;
}

// ─── COMPOSANTS UI ───────────────────────────────────────────────────────────

const KpiCard = ({ title, value, sub, icon: Icon, color }: any) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm relative overflow-hidden group"
  >
    <div className="relative z-10">
      <div className={cn("p-2 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform", color.light)}>
        <Icon size={18} className={color.main} />
      </div>
      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</h4>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-gray-900">{value}</span>
        {sub && <span className="text-[10px] font-bold text-emerald-500">{sub}</span>}
      </div>
    </div>
    <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 opacity-5", color.light)} />
  </motion.div>
);

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────

export const AnalysisView = () => {
  const [selectedReportId, setSelectedReportId] = useState<string>('STA-01');
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<string[]>(['STATISTIQUES', 'EXPLOITATION']);
  const [period, setPeriod] = useState({ start: '2026-05-01', end: '2026-05-31' });
  const [granularity, setGranularity] = useState<'day' | 'month' | 'year'>('month');
  const [comparison, setComparison] = useState('N-1');
  
  const reservations = [];
  const hotel = useConfigStore(s => s.hotel);
  const rooms = useConfigStore(s => s.rooms);

  const stats = useMemo(() => pmsLogic.getComparisonData(reservations, rooms.length, period), [reservations, rooms.length, period]);
  const occupancyByDay = useMemo(() => pmsLogic.getOccupancyByDay(reservations, 14), [reservations]);
  const revenueByChannel = useMemo(() => pmsLogic.getRevenueByChannel(reservations), [reservations]);

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(reservations);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reservations");
    XLSX.writeFile(wb, `Report_${selectedReportId}_${period.start}.xlsx`);
  };

  const selectedReport = ALL_REPORTS.find(r => r.id === selectedReportId) || ALL_REPORTS[0];

  const categories = ['EXPLOITATION', 'STATISTIQUES', 'FINANCIER', 'CLIENTS', 'DIRECTION', 'PROPRIETAIRES'];

  return (
    <div className="flex h-full bg-[#f8f9fc] overflow-hidden">
      {/* ─── SIDEBAR: LISTE DES RAPPORTS (Accordéon) ───────────────────────────────── */}
      <div className="w-[380px] bg-white border-r border-gray-100 flex flex-col shrink-0 overflow-hidden">
        <div className="p-6 border-b border-gray-50 space-y-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-violet-600 rounded-xl text-white shadow-lg shadow-violet-200">
                <BarChart2 size={20} />
             </div>
             <h2 className="text-lg font-black text-gray-900 tracking-tight italic">Flowtym Stats</h2>
          </div>
          <div className="relative">
             <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input 
               value={search}
               onChange={e => setSearch(e.target.value)}
               placeholder="Rechercher un rapport..."
               className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 ring-violet-100 transition-all outline-none"
             />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-hide">
          {categories.map(cat => {
            const catReports = ALL_REPORTS.filter(r => r.cat === cat);
            const isExpanded = expandedCats.includes(cat);
            return (
              <div key={cat} className="space-y-1">
                <button 
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-1 h-4 rounded-full transition-all",
                      isExpanded ? "bg-violet-600 scale-y-100" : "bg-gray-200 scale-y-50 group-hover:scale-y-100"
                    )} />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{cat}</span>
                  </div>
                  <Badge variant="neutral" className="bg-gray-50 text-gray-400 text-[9px] font-black border-none px-2">{catReports.length}</Badge>
                </button>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-0.5 mt-1 ml-2"
                    >
                      {catReports.map(report => (
                        <button
                          key={report.id}
                          onClick={() => setSelectedReportId(report.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left group",
                            selectedReportId === report.id 
                              ? "bg-violet-50 text-violet-700" 
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                          )}
                        >
                          <div className="flex items-center gap-3">
                             <report.icon size={14} className={cn(selectedReportId === report.id ? "text-violet-600" : "text-gray-300 group-hover:text-gray-600")} />
                             <span className="text-[12px] font-bold tracking-tight">{report.title}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Download size={12} className="text-gray-300 hover:text-violet-500" />
                             <Printer size={12} className="text-gray-300 hover:text-violet-500" />
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── MAIN CONTENT: HEADER & LANDSCAPE PREVIEW ─────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header de Contrôle */}
        <div className="h-20 bg-white border-b border-gray-100 shrink-0 flex items-center px-8 gap-8">
           <div className="flex items-center gap-4 bg-gray-50 p-1 rounded-2xl border border-gray-100 shadow-inner">
              <input 
                type="date"
                value={period.start}
                onChange={e => setPeriod(p => ({ ...p, start: e.target.value }))}
                className="bg-transparent border-none text-[11px] font-black uppercase text-gray-600 p-2 focus:ring-0 outline-none"
              />
              <ArrowRight size={14} className="text-gray-300" />
              <input 
                type="date"
                value={period.end}
                onChange={e => setPeriod(p => ({ ...p, end: e.target.value }))}
                className="bg-transparent border-none text-[11px] font-black uppercase text-gray-600 p-2 focus:ring-0 outline-none"
              />
           </div>

           <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
              {['day', 'month', 'year'].map(g => (
                <button 
                  key={g}
                  onClick={() => setGranularity(g as any)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                    granularity === g ? "bg-white text-violet-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {g === 'day' ? 'Jour' : g === 'month' ? 'Mois' : 'Année'}
                </button>
              ))}
           </div>

           <div className="h-6 w-[1px] bg-gray-100" />

           <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comparer</span>
              <select 
                value={comparison}
                onChange={e => setComparison(e.target.value)}
                className="bg-white border border-gray-100 rounded-xl px-4 py-2 text-[11px] font-bold text-gray-700 focus:ring-2 ring-violet-100 outline-none appearance-none cursor-pointer"
              >
                <option value="N-1">N-1 (Année dernière)</option>
                <option value="N-2">N-2</option>
                <option value="GLISSANT">Mois glissant</option>
              </select>
           </div>
           
           <div className="ml-auto flex items-center gap-3">
              <Button variant="outline" className="h-10 px-4 rounded-xl gap-2 border-dashed border-gray-300">
                 <RefreshCcw size={14} /> 
                 <span className="text-[10px] font-bold">Synchroniser</span>
              </Button>
              <Button variant="primary" className="h-10 px-4 rounded-xl gap-2 bg-violet-600 shadow-lg shadow-violet-200">
                 <Zap size={14} fill="currentColor" />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Export Groupé</span>
              </Button>
           </div>
        </div>

        {/* Zone de Visualisation du Rapport (Format Paysage) */}
        <div className="flex-1 p-8 overflow-y-auto scrollbar-hide">
           <div className="w-full max-w-[1400px] mx-auto space-y-6">
              
              {/* Report Control Bar */}
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm">
                       <selectedReport.icon size={24} className="text-violet-600" />
                    </div>
                    <div>
                       <h1 className="text-2xl font-black text-gray-900 tracking-tight">{selectedReport.title}</h1>
                       <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{selectedReport.id} · {selectedReport.cat}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <button className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 hover:text-violet-600 hover:shadow-lg transition-all shadow-sm">
                       <FileText size={20} />
                    </button>
                    <button 
                      onClick={exportExcel}
                      className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:shadow-lg transition-all shadow-sm"
                    >
                       <BarChart2 size={20} />
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 hover:text-blue-600 hover:shadow-lg transition-all shadow-sm"
                    >
                       <Printer size={20} />
                    </button>
                 </div>
              </div>

              {/* LANDSCAPE REPORT CONTAINER */}
              <motion.div 
                key={selectedReportId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-gray-100 rounded-[40px] shadow-sm p-10 min-h-[700px] relative overflow-hidden"
                style={{ aspectRatio: '1.414 / 1' }}
              >
                  {/* Watermark Decor */}
                  <div className="absolute top-10 right-10 flex items-center gap-3 grayscale opacity-30">
                     <span className="text-4xl font-black italic tracking-tighter text-violet-200">F</span>
                     <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Flowtym PMS v2.0</span>
                  </div>

                  <div className="relative z-10 space-y-12">
                     {/* KPIs Highlight */}
                     <div className="grid grid-cols-4 gap-8">
                        <div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Revenu Total</p>
                           <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-black text-gray-900 tracking-tighter">{stats.current.totalRevenue.toLocaleString()}€</span>
                              <span className={cn("text-[11px] font-bold p-1 rounded-lg", stats.diff.totalRevenue >= 0 ? "text-emerald-500 bg-emerald-50" : "text-rose-500 bg-rose-50")}>
                                 {stats.diff.totalRevenue >= 0 ? '+' : ''}{stats.diff.totalRevenue.toFixed(1)}%
                              </span>
                           </div>
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Occupation (TO)</p>
                           <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-black text-gray-900 tracking-tighter">{stats.current.occupancyRate.toFixed(1)}%</span>
                              <span className={cn("text-[11px] font-bold p-1 rounded-lg", stats.diff.occupancyRate >= 0 ? "text-emerald-500 bg-emerald-50" : "text-rose-500 bg-rose-50")}>
                                 {stats.diff.occupancyRate >= 0 ? '+' : ''}{stats.diff.occupancyRate.toFixed(1)}%
                              </span>
                           </div>
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Prix Moyen (ADR)</p>
                           <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-black text-gray-900 tracking-tighter">{stats.current.adr.toFixed(2)}€</span>
                              <span className={cn("text-[11px] font-bold p-1 rounded-lg", stats.diff.adr >= 0 ? "text-emerald-500 bg-emerald-50" : "text-rose-500 bg-rose-50")}>
                                 {stats.diff.adr >= 0 ? '+' : ''}{stats.diff.adr.toFixed(1)}%
                              </span>
                           </div>
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">RevPar</p>
                           <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-black text-gray-900 tracking-tighter">{stats.current.revPar.toFixed(2)}€</span>
                              <span className={cn("text-[11px] font-bold p-1 rounded-lg", stats.diff.revPar >= 0 ? "text-emerald-500 bg-emerald-50" : "text-rose-500 bg-rose-50")}>
                                 {stats.diff.revPar >= 0 ? '+' : ''}{stats.diff.revPar.toFixed(1)}%
                              </span>
                           </div>
                        </div>
                     </div>

                     {/* Visual Data Section */}
                     <div className="grid grid-cols-12 gap-12 pt-8">
                        <div className="col-span-8 space-y-6">
                           <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-3">
                              <TrendingUp size={16} className="text-violet-600" />
                              Tendances d'Occupation & Revenu
                           </h3>
                           <div className="h-80 w-full">
                              <Line 
                                data={{
                                  labels: occupancyByDay.map(d => d.date.split('-')[2]),
                                  datasets: [
                                    {
                                      label: 'Année Naturelle (N)',
                                      data: occupancyByDay.map(d => (d.count / (rooms.length || 10)) * 100),
                                      borderColor: '#8B5CF6',
                                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                      fill: true,
                                      tension: 0.4,
                                      borderWidth: 4,
                                      pointRadius: 0,
                                      pointHoverRadius: 6
                                    },
                                    {
                                      label: 'Année N-1',
                                      data: occupancyByDay.map(d => ((d.count / (rooms.length || 10)) * 100) * 0.85),
                                      borderColor: '#E2E8F0',
                                      borderDash: [5, 5],
                                      fill: false,
                                      tension: 0.4,
                                      pointRadius: 0
                                    }
                                  ]
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, font: { weight: 'bold', size: 10 } } } },
                                  scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
                                }}
                              />
                           </div>
                        </div>

                        <div className="col-span-4 space-y-6">
                           <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-3">
                              <PieChart size={16} className="text-violet-600" />
                              Segmentation Distribution
                           </h3>
                           <div className="h-64 flex items-center justify-center relative">
                              <Doughnut 
                                data={{
                                  labels: revenueByChannel.map(c => c.name),
                                  datasets: [{
                                    data: revenueByChannel.map(c => c.value),
                                    backgroundColor: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E'],
                                    borderWidth: 0,
                                    hoverOffset: 20
                                  }]
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  cutout: '75%',
                                  plugins: { legend: { display: false } }
                                }}
                              />
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Net CA</span>
                                 <span className="text-xl font-black text-gray-900">{stats.current.totalRevenue.toLocaleString()}€</span>
                              </div>
                           </div>
                           <div className="space-y-2">
                             {revenueByChannel.map((c, i) => (
                               <div key={i} className="flex items-center justify-between text-[11px] font-bold">
                                 <div className="flex items-center gap-2">
                                   <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E'][i] }} />
                                   <span className="text-gray-500">{c.name}</span>
                                 </div>
                                 <span className="text-gray-900">{((c.value / stats.current.totalRevenue) * 100).toFixed(1)}%</span>
                               </div>
                             ))}
                           </div>
                        </div>
                     </div>

                     {/* Detailed Records Table */}
                     <div className="pt-12">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest border-b-2 border-gray-100 pb-4 mb-6 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <FileText size={16} className="text-violet-600" />
                              Registres détaillés — {selectedReport.title}
                           </div>
                           <span className="text-[10px] text-gray-400">{reservations.length} records trouvés</span>
                        </h3>
                        <div className="overflow-x-auto">
                           <table className="w-full text-left text-[11px]">
                              <thead className="text-gray-400 font-black uppercase tracking-[0.1em] border-b border-gray-50">
                                 <tr>
                                    <th className="py-4 px-2">ID</th>
                                    <th className="py-4 px-2">Client</th>
                                    <th className="py-4 px-2">Nationalité</th>
                                    <th className="py-4 px-2">Hébergement</th>
                                    <th className="py-4 px-2">Dates</th>
                                    <th className="py-4 px-2">Folio</th>
                                    <th className="py-4 px-2 text-right">Status</th>
                                    <th className="py-4 px-2 text-right">Montant</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                 {reservations.slice(0, 8).map((r, i) => (
                                   <tr key={i} className="hover:bg-gray-50 transition-colors group">
                                      <td className="py-5 px-2 font-black text-violet-600 tracking-tighter">{r.reference || `RES-${100+i}`}</td>
                                      <td className="py-5 px-2 font-bold text-gray-900">{r.guestName}</td>
                                      <td className="py-5 px-2">
                                         <div className="flex items-center gap-2">
                                            <div className="w-4 h-3 bg-gray-100 rounded-sm" />
                                            <span className="font-bold text-gray-500">{r.nationality || 'FR'}</span>
                                         </div>
                                      </td>
                                      <td className="py-5 px-2 font-bold text-gray-700">{r.roomType}</td>
                                      <td className="py-5 px-2 font-medium text-gray-400">{r.checkIn} → {r.checkOut}</td>
                                      <td className="py-5 px-2 font-bold text-gray-400 group-hover:text-emerald-600 transition-colors cursor-pointer">#FL-{5000+i}</td>
                                      <td className="py-5 px-2 text-right">
                                         <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-[9px] uppercase tracking-tighter">Payé</span>
                                      </td>
                                      <td className="py-5 px-2 text-right font-black text-gray-900">{(r.totalTTC || 0).toLocaleString()}€</td>
                                   </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>

                  {/* PDF Footer Fake */}
                  <div className="absolute bottom-8 left-10 right-10 flex items-center justify-between text-[8px] font-black text-gray-300 uppercase tracking-widest border-t border-gray-50 pt-4">
                     <span>© Flowtym PMS Cloud · Rapport généré par {hotel.name}</span>
                     <span>Page 1 / 1 · {new Date().toLocaleString()}</span>
                  </div>
              </motion.div>
           </div>
        </div>
      </div>
    </div>
  );
};
