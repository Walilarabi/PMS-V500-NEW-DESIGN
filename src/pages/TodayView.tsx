import React from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  MousePointer2,
  Calendar,
  Building2,
  FileText,
  Mail,
  Zap as SparkleIcon,
  Crown,
  Heart,
  Users,
  MessageSquare,
  Repeat,
  Download,
  Upload,
  CreditCard,
  History,
  Lock,
  ChevronDown,
  X,
  Bed,
  Phone,
  LayoutDashboard,
  MoreHorizontal,
  Wallet,
  Printer,
  ChevronRight as ChevronRightIcon,
  Smartphone,
  Trash2,
  MoreVertical as VerticalDots,
  Info,
  LogOut,
  LogIn,
  Send,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { useReservations, Reservation } from '@/src/contexts/ReservationContext';
import ReservationFormModal, { ReservationFormData } from '@/src/components/modals/ReservationFormModal';

// Mock Data for Timeline
const TIMELINE_EVENTS = {
  arriving: [
    { hour: '10:00', count: 2, pos: '20%' },
    { hour: '13:00', count: 3, pos: '40%' },
    { hour: '16:00', count: 2, pos: '65%' },
    { hour: '19:00', count: 1, pos: '85%' },
  ],
  departing: [
    { hour: '09:00', count: 3, pos: '15%' },
    { hour: '12:00', count: 2, pos: '35%' },
    { hour: '14:00', count: 1, pos: '50%' },
    { hour: '16:00', count: 2, pos: '65%' },
  ],
  cleaning: [
    { start: '08:30', end: '11:00', label: 'Charge modérée', color: 'bg-indigo-50/50 text-indigo-500', pos: '10%', width: '18%' },
    { start: '11:30', end: '14:30', label: 'Pic de charge', color: 'bg-[#8B5CF6]/5 text-[#8B5CF6]', pos: '30%', width: '25%' },
    { start: '16:00', end: '19:00', label: 'Charge modérée', color: 'bg-indigo-50/50 text-indigo-500', pos: '65%', width: '20%' },
  ]
};

const CommunicationModal = ({ isOpen, onClose, reservation }: { isOpen: boolean, onClose: () => void, reservation: any }) => {
  const [channel, setChannel] = React.useState<'email' | 'whatsapp'>('email');
  
  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#8B5CF6] p-6 text-white flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                 <Send size={20} />
              </div>
              <div>
                 <h2 className="text-xl font-bold">Communication Client</h2>
                 <p className="text-[10px] uppercase font-bold opacity-80 tracking-widest">Chambre {reservation.room}</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
              <X size={20} />
           </button>
        </div>

        <div className="p-6 space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client</label>
                 <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-900">{reservation.client}</div>
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Canal d'envoi</label>
                 <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setChannel('email')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all",
                        channel === 'email' ? "bg-white text-indigo-500 shadow-sm" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                       <Mail size={14} /> Email
                    </button>
                    <button 
                      onClick={() => setChannel('whatsapp')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all",
                        channel === 'whatsapp' ? "bg-white text-emerald-500 shadow-sm" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                       <MessageSquare size={14} /> WhatsApp
                    </button>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</label>
                 <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="w-full bg-white border border-gray-100 rounded-xl py-3 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20" placeholder="@" defaultValue="pierre.bernard@email.fr" />
                 </div>
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">WhatsApp / Tel</label>
                 <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="w-full bg-white border border-gray-100 rounded-xl py-3 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20" placeholder="+" defaultValue="+33 6 12 34 56 78" />
                 </div>
              </div>
           </div>

           <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Modèle de message</label>
              <div className="relative">
                 <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                 <select className="w-full appearance-none bg-white border border-gray-100 rounded-xl py-3 pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20">
                    <option>Confirmation de séjour</option>
                    <option>Rappel Arrivée</option>
                    <option>Demande de Paiement</option>
                    <option>Envoi de Facture</option>
                 </select>
                 <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
           </div>

           <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contenu du message</label>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm text-gray-600 leading-relaxed min-h-[160px]">
                 <p className="font-bold text-gray-900 mb-4 text-base">Bonjour {reservation.client},</p>
                 <p className="mb-2">Nous avons le plaisir de vous confirmer votre réservation pour les dates du <span className="font-bold">2026-04-07</span> au <span className="font-bold">2026-04-10</span>.</p>
                 <p>Chambre : <span className="font-bold">{reservation.room}</span></p>
                 <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="font-bold">Cordialement,</p>
                    <p>L'équipe de la Réception</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="p-6 bg-gray-50 flex items-center justify-between">
           <Button variant="outline" className="rounded-xl gap-2 font-bold uppercase text-[10px] tracking-widest border-gray-200">
              <Printer size={16} /> Imprimer
           </Button>
           <div className="flex items-center gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                >
                Fermer
              </button>
              {channel === 'email' ? (
                <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-xl gap-2 px-6 py-5 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-[#8B5CF6]/20">
                  <Send size={16} /> Envoyer Email
                </Button>
              ) : (
                <Button className="bg-green-400 hover:bg-green-500 rounded-xl gap-2 px-6 py-5 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-green-400/20">
                  <MessageSquare size={16} /> WhatsApp
                </Button>
              )}
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const BillingModal = ({ isOpen, onClose, reservation }: { isOpen: boolean, onClose: () => void, reservation: any }) => {
  const [activeTab, setActiveTab] = React.useState('Folios (2)');

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1E1B4B]/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-5xl bg-[#F8F9FD] rounded-3xl overflow-hidden shadow-2xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Deep Header Section */}
        <div className="bg-[#1E1B4B] p-6 text-white shrink-0">
           <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                    <FileText size={24} />
                 </div>
                 <div>
                    <h2 className="text-xl font-bold tracking-tight">FA-2026-1020</h2>
                    <p className="text-sm font-medium text-white/60">{reservation.client} · Ch. {reservation.room} · 25/04/2026 → 26/04/2026 · 1 nuit(s)</p>
                 </div>
              </div>
              <div className="flex items-center gap-6">
                 <div className="text-right">
                    <div className="flex items-center gap-3 justify-end mb-1">
                       <Badge className="bg-white/10 text-white border-transparent text-[10px] tracking-widest">Brouillon</Badge>
                       <span className="text-2xl font-bold">123,20 €</span>
                    </div>
                    <p className="text-sm font-medium text-rose-300">Solde : 123,20 €</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" className="bg-white text-gray-900 border-transparent rounded-xl gap-2 font-bold text-[11px] uppercase h-10 px-4">
                       <Printer size={16} /> Imprimer
                    </Button>
                    <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-xl gap-2 font-bold text-[11px] uppercase h-10 px-4 shadow-lg shadow-[#8B5CF6]/40">
                       <Zap size={16} /> Émettre
                    </Button>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20">
                       <X size={20} />
                    </button>
                 </div>
              </div>
           </div>
        </div>

        {/* Tabs Bar */}
        <div className="bg-white px-8 border-b border-gray-100 shrink-0">
           <div className="flex items-center gap-8">
              {['Folios (2)', 'Paiements (0)', 'Night Audit & Journal'].map((tab) => (
                <button 
                  key={tab}
                  className={cn(
                    "py-5 text-[11px] font-bold tracking-widest border-b-2 uppercase transition-all",
                    activeTab === tab ? "border-[#8B5CF6] text-[#8B5CF6]" : "border-transparent text-gray-400 hover:text-gray-600"
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
           <div className="flex items-center justify-between mb-6">
              <div className="flex gap-2">
                 <Button variant="outline" className="rounded-xl border-[#8B5CF6] text-[#8B5CF6] bg-[#8B5CF6]/5 px-6 font-bold text-[11px] uppercase tracking-widest">
                    Folio Chambre · 123,20 €
                 </Button>
                 <Button variant="ghost" className="rounded-xl text-gray-400 px-6 font-bold text-[11px] uppercase tracking-widest hover:bg-gray-50">
                    Folio Société · 0,00 €
                 </Button>
                 <Button variant="ghost" className="rounded-xl text-gray-400 px-3 hover:bg-gray-50 border border-gray-100 border-dashed">
                    <Plus size={16} /> Folio
                 </Button>
              </div>
              <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-xl gap-2 font-bold text-[11px] uppercase h-10 px-6">
                 <Plus size={16} /> Ajouter une ligne
              </Button>
           </div>

           <Card className="rounded-[24px] border-gray-100 shadow-sm overflow-hidden bg-white mb-8">
              <table className="w-full text-left">
                 <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/30">
                       <th className="px-6 py-4 text-[9px] font-bold uppercase text-gray-400 tracking-widest">Date</th>
                       <th className="px-4 py-4 text-[9px] font-bold uppercase text-gray-400 tracking-widest">Code</th>
                       <th className="px-4 py-4 text-[9px] font-bold uppercase text-gray-400 tracking-widest">Description</th>
                       <th className="px-4 py-4 text-[9px] font-bold uppercase text-gray-400 tracking-widest font-center">Qté</th>
                       <th className="px-4 py-4 text-[9px] font-bold uppercase text-gray-400 tracking-widest text-right">PU HT</th>
                       <th className="px-4 py-4 text-[9px] font-bold uppercase text-gray-400 tracking-widest text-right">TVA</th>
                       <th className="px-4 py-4 text-[9px] font-bold uppercase text-gray-400 tracking-widest text-right">Total TTC</th>
                       <th className="px-4 py-4 text-[9px] font-bold uppercase text-gray-400 tracking-widest text-right">Source</th>
                       <th className="px-6 py-4 w-12"></th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    <tr className="group h-14">
                       <td className="px-6 py-2 text-[11px] font-medium text-gray-500">24/04/2026</td>
                       <td className="px-4 py-2"><Badge className="bg-[#8B5CF6]/10 text-[#8B5CF6] text-[9px] font-bold border-transparent rounded-lg">HEB-DBL</Badge></td>
                       <td className="px-4 py-2 text-[12px] font-bold text-gray-900">Nuitée — Ch. {reservation.room} — 24/04/2026</td>
                       <td className="px-4 py-2 text-[12px] font-medium text-center text-gray-900">1</td>
                       <td className="px-4 py-2 text-[12px] font-medium text-right text-gray-500 font-mono">109,09 €</td>
                       <td className="px-4 py-2 text-[12px] font-medium text-right text-gray-400">10%</td>
                       <td className="px-4 py-2 text-[12px] font-bold text-right text-gray-900 font-mono">120,00 €</td>
                       <td className="px-4 py-2 text-right">
                          <Badge className="bg-amber-50 text-amber-500 text-[8px] font-bold uppercase gap-1 border-transparent"><Clock size={10} /> Audit</Badge>
                       </td>
                       <td className="px-6 py-2 text-right">
                          <button className="p-2 text-gray-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                       </td>
                    </tr>
                    <tr className="group h-14">
                       <td className="px-6 py-2 text-[11px] font-medium text-gray-500">25/04/2026</td>
                       <td className="px-4 py-2"><Badge className="bg-[#8B5CF6]/10 text-[#8B5CF6] text-[9px] font-bold border-transparent rounded-lg">TX-SEJ</Badge></td>
                       <td className="px-4 py-2 text-[12px] font-bold text-gray-900">Taxe de séjour — 1 nuit(s) × 2 pers.</td>
                       <td className="px-4 py-2 text-[12px] font-medium text-center text-gray-900">2</td>
                       <td className="px-4 py-2 text-[12px] font-medium text-right text-gray-500 font-mono">1,60 €</td>
                       <td className="px-4 py-2 text-[12px] font-medium text-right text-gray-400">0%</td>
                       <td className="px-4 py-2 text-[12px] font-bold text-right text-gray-900 font-mono">3,20 €</td>
                       <td className="px-4 py-2 text-right">
                          <Badge className="bg-amber-50 text-amber-500 text-[8px] font-bold uppercase gap-1 border-transparent"><Clock size={10} /> Audit</Badge>
                       </td>
                       <td className="px-6 py-2 text-right">
                          <button className="p-2 text-gray-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                       </td>
                    </tr>
                 </tbody>
                 <tfoot>
                    <tr className="bg-gray-50/50 border-t border-gray-100 h-14">
                       <td colSpan={6} className="px-6 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Sous-total folio</td>
                       <td className="px-4 py-2 text-[12px] font-bold text-right text-gray-500 font-mono">112,29 €</td>
                       <td className="px-4 py-2 text-[12px] font-bold text-right text-[#8B5CF6] font-mono">123,20 €</td>
                       <td className="px-6 py-2"></td>
                    </tr>
                 </tfoot>
              </table>
           </Card>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                 <div>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Récapitulatif TVA</h3>
                    <Card className="rounded-[24px] border-gray-100 overflow-hidden shadow-sm">
                       <table className="w-full text-left">
                          <thead>
                             <tr className="border-b border-gray-50 bg-gray-50/30">
                                <th className="px-6 py-3 text-[9px] font-bold uppercase text-gray-400">Taux</th>
                                <th className="px-4 py-3 text-[9px] font-bold uppercase text-gray-400 text-right">Base HT</th>
                                <th className="px-4 py-3 text-[9px] font-bold uppercase text-gray-400 text-right">Montant TVA</th>
                                <th className="px-6 py-3 text-[9px] font-bold uppercase text-gray-400 text-right">Total TTC</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                             <tr className="h-10">
                                <td className="px-6 py-1 text-[11px] font-bold text-gray-900">0%</td>
                                <td className="px-4 py-1 text-[11px] text-right font-medium text-gray-500">3,20 €</td>
                                <td className="px-4 py-1 text-[11px] text-right font-medium text-gray-500">0,00 €</td>
                                <td className="px-6 py-1 text-[11px] text-right font-bold text-gray-900">3,20 €</td>
                             </tr>
                             <tr className="h-10">
                                <td className="px-6 py-1 text-[11px] font-bold text-gray-900">10%</td>
                                <td className="px-4 py-1 text-[11px] text-right font-medium text-gray-500">109,09 €</td>
                                <td className="px-4 py-1 text-[11px] text-right font-medium text-gray-500">10,91 €</td>
                                <td className="px-6 py-1 text-[11px] text-right font-bold text-gray-900">120,00 €</td>
                             </tr>
                          </tbody>
                       </table>
                    </Card>
                 </div>
              </div>

              <div className="flex flex-col justify-end">
                 <Card className="rounded-[32px] bg-[#1E1B4B] p-8 text-white shadow-xl">
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-white/50">
                          <span className="text-[12px] font-bold uppercase tracking-widest">Sous-total HT</span>
                          <span className="text-lg font-mono">112,29 €</span>
                       </div>
                       <div className="flex justify-between items-center text-white/50 pb-6 border-b border-white/10">
                          <span className="text-[12px] font-bold uppercase tracking-widest">Total TVA</span>
                          <span className="text-lg font-mono">10,91 €</span>
                       </div>
                       <div className="flex justify-between items-baseline pt-4">
                          <span className="text-2xl font-bold uppercase tracking-widest">Total TTC</span>
                          <span className="text-4xl font-black text-rose-200">123,20 €</span>
                       </div>
                    </div>
                 </Card>
              </div>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const MoreActionsMenu = ({ isOpen, onClose, reservation, onSelectAction }: { isOpen: boolean, onClose: () => void, reservation: any, onSelectAction: (action: string) => void }) => {
  if (!isOpen) return null;

  const actions = [
    { label: 'Check-in', icon: LogIn, color: 'text-emerald-500', id: 'checkin' },
    { label: 'Check-out', icon: LogOut, color: 'text-rose-500', id: 'checkout' },
    { label: 'Consultation dossier', icon: FileText, color: 'text-indigo-500', id: 'details' },
    { label: 'Communiquer', icon: MessageSquare, color: 'text-amber-500', id: 'communication' },
    { label: 'Facturation', icon: CreditCard, color: 'text-[#8B5CF6]', id: 'billing' },
  ];

  return (
    <div className="absolute right-0 top-10 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
       <div className="px-4 py-2 border-b border-gray-50">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Chambre {reservation.room}</p>
          <p className="text-[11px] font-bold text-gray-900 truncate">{reservation.client}</p>
       </div>
       {actions.map((act) => (
         <button 
           key={act.id}
           onClick={() => {
              onSelectAction(act.id);
              onClose();
           }}
           className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
         >
            <div className={cn("w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center group-hover:scale-110 transition-transform", act.color.replace('text', 'bg').replace('500', '50'))}>
               <act.icon size={16} className={act.color} />
            </div>
            <span className="text-[12px] font-bold text-gray-700">{act.label}</span>
         </button>
       ))}
    </div>
  );
};

const ReservationDetails = ({ isOpen, onClose, reservation }: { isOpen: boolean, onClose: () => void, reservation: any }) => {
  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-[#F9FAFB] rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Section from Image 2 */}
        <div className="bg-[#8B5CF6] p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 pointer-events-none" />
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <Badge className="bg-white/20 text-white border-transparent text-[10px] uppercase font-bold">{reservation.id}</Badge>
              <Badge className="bg-white/20 text-white border-transparent text-[10px] uppercase font-bold">En séjour</Badge>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-4 relative z-10">
             <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                <Bed size={24} />
             </div>
             <div>
                <h2 className="text-2xl font-bold tracking-tight">Chambre {reservation.room} — {reservation.roomType}</h2>
                <p className="text-lg font-bold text-white/80">{reservation.client}</p>
             </div>
             <button className="ml-auto p-2 hover:bg-white/10 rounded-full">
                <MoreVertical size={20} />
             </button>
          </div>

          <div className="flex flex-wrap gap-3 relative z-10">
             <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold", reservation.sourceColor || 'bg-indigo-600')}>
                   {reservation.source?.[0] || 'D'}
                </div>
                <span className="text-[10px] font-bold uppercase">{reservation.source || 'Direct'}</span>
             </div>
             <div className="flex items-center gap-2 bg-amber-400 text-amber-900 px-3 py-1.5 rounded-full shadow-lg shadow-amber-400/20">
                <Crown size={14} className="fill-current" />
                <span className="text-[10px] font-bold uppercase">VIP Gold</span>
             </div>
             <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
                <span className="text-[9px] font-bold text-white/60 uppercase">CLV:</span>
                <span className="text-[10px] font-bold uppercase">4 250 €</span>
             </div>
             <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
                <span className="text-[9px] font-bold text-white/60 uppercase">Séjours:</span>
                <span className="text-[10px] font-bold uppercase">12 dossiers</span>
             </div>
             <Button size="sm" className="bg-black/20 hover:bg-black/30 text-white rounded-full h-8 gap-2 ml-auto">
                <History size={14} /> <span className="text-[10px] font-bold">Journal</span>
             </Button>
          </div>
        </div>

        {/* Content Section from Image 2 */}
        <div className="p-8">
           <div className="flex items-center gap-8 border-b border-gray-100 mb-8 overflow-x-auto scrollbar-hide">
              {['Réservation', 'Facturation', 'Cardex', 'Incidents', 'Objets oubliés', 'Avis'].map((tab, i) => (
                <button key={i} className={cn(
                  "pb-4 text-[11px] font-bold tracking-widest whitespace-nowrap border-b-2 transition-all",
                  i === 0 ? "border-[#8B5CF6] text-[#8B5CF6]" : "border-transparent text-gray-400 hover:text-gray-600"
                )}>
                  <div className="flex flex-col items-center gap-1.5">
                    {i === 0 && <FileText size={18} />}
                    {i === 1 && <CreditCard size={18} />}
                    {i === 2 && <Users size={18} />}
                    {i === 3 && <AlertCircle size={18} />}
                    {i === 4 && <Search size={18} />}
                    {i === 5 && <Crown size={18} />}
                    {tab}
                  </div>
                </button>
              ))}
           </div>


           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-[24px] border-gray-100 p-6 shadow-sm">
                 <h4 className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest mb-4">Informations Client</h4>
                 <div className="space-y-3">
                    <p className="text-sm font-bold text-gray-900">{reservation.client}</p>
                    <div className="flex items-center gap-2 text-gray-500">
                       <Mail size={14} />
                       <span className="text-[12px] font-medium">pierre.bernard@orange.fr</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                       <Phone size={14} />
                       <span className="text-[12px] font-medium">+33 6 12 34 56 78</span>
                    </div>
                 </div>
              </Card>

              <Card className="rounded-[24px] border-gray-100 p-6 shadow-sm">
                 <h4 className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest mb-4">Détails du séjour</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[9px] font-bold text-gray-400 uppercase">Arrivée</p>
                       <p className="text-[12px] font-bold text-gray-900">2026-04-07</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-bold text-gray-400 uppercase">Départ</p>
                       <p className="text-[12px] font-bold text-gray-900">2026-04-10</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-bold text-gray-400 uppercase">Durée</p>
                       <p className="text-[12px] font-bold text-gray-900">3 nuits</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-bold text-gray-400 uppercase">Personnes</p>
                       <p className="text-[12px] font-bold text-gray-900">2 adultes</p>
                    </div>
                 </div>
              </Card>

              <Card className="rounded-[24px] border-gray-100 p-6 shadow-sm col-span-2">
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">Récapitulatif Financier</h4>
                 </div>
                 <div className="space-y-2">
                    <div className="flex justify-between text-[12px] text-gray-500">
                       <span>Sous-total HT:</span>
                       <span>364.09€</span>
                    </div>
                    <div className="flex justify-between text-[12px] text-gray-500">
                       <span>TVA 10%:</span>
                       <span>36.41€</span>
                    </div>
                    <div className="flex justify-between text-[12px] text-gray-500">
                       <span>Taxe séjour:</span>
                       <span>15.00€</span>
                    </div>
                    <div className="flex justify-between p-3 bg-[#8B5CF6]/5 rounded-xl mt-4">
                       <span className="text-sm font-bold text-[#8B5CF6]">TOTAL TTC :</span>
                       <span className="text-sm font-bold text-[#8B5CF6]">400.50 €</span>
                    </div>
                 </div>
              </Card>

              <Card className="rounded-[24px] border-gray-100 p-6 shadow-sm col-span-2 relative">
                 <h4 className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest mb-4">📝 Notes internes</h4>
                 <p className="text-[12px] text-gray-600 leading-relaxed italic">
                    Client fidèle. Préfère les chambres calmes loin de l'ascenseur.
                 </p>
                 <Button size="sm" className="absolute top-4 right-4 bg-[#8B5CF6] hover:bg-[#7C3AED] h-7 text-[9px] font-bold rounded-lg gap-1.5 uppercase">
                    <FileText size={12} /> ENREGISTRER
                 </Button>
              </Card>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const TodayView = () => {
  const { reservations, addReservation } = useReservations();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('Toutes');
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [selectedRes, setSelectedRes] = React.useState<any>(null);
  const [activeModal, setActiveModal] = React.useState<'details' | 'communication' | 'billing' | 'new-reservation' | null>(null);
  const [menuOpenFor, setMenuOpenFor] = React.useState<string | null>(null);
  const [showKPIs, setShowKPIs] = React.useState(true);
  const [showTimeline, setShowTimeline] = React.useState(true);

  // Metrics calculation from spec
  const totalRooms = 42;
  const arrivalsCount = reservations.filter(r => r.status === 'Confirmé' || r.status === 'Arrivée').length;
  const departuresCount = reservations.filter(r => r.status === 'Clôturé').length; // Assuming Clôturé means checked out
  const occupancyRate = (((arrivalsCount + 5) / totalRooms) * 100).toFixed(1); // Adding 5 as existing stays
  const dirtyRooms = 12;
  const cleanPercentage = (((totalRooms - dirtyRooms) / totalRooms) * 100).toFixed(0);

  const handleAction = (type: string, res: any) => {
    if (type === 'details') {
      setSelectedRes(res);
      setActiveModal('details');
    } else if (type === 'communication') {
      setSelectedRes(res);
      setActiveModal('communication');
    } else if (type === 'billing') {
      setSelectedRes(res);
      setActiveModal('billing');
    } else if (type === 'checkin' || type === 'checkout') {
      // Just simulate state change for now
      console.log(`${type} for ${res.room}`);
    }
  };

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const calculateNowPosition = () => {
    const startHour = 7;
    const endHour = 21;
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    
    if (currentHour < startHour) return '0%';
    if (currentHour >= endHour) return '100%';
    
    const totalMinutes = (endHour - startHour) * 60;
    const elapsedMinutes = (currentHour - startHour) * 60 + currentMinutes;
    return `${(elapsedMinutes / totalMinutes) * 100}%`;
  };

  const hours = Array.from({ length: 15 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#F9FAFB] font-sans">
      {/* Header - Matching Image 1 */}
      <header className="px-8 py-6 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight text-left">Flowday</h1>
            <div className="flex items-center gap-2 text-gray-400 mt-1">
              <Calendar size={14} />
              <span className="text-[11px] font-bold tracking-wide">Dimanche 27 avril 2026</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl bg-white gap-2 text-[11px] font-bold h-9 px-4 border-gray-200">
            <RefreshCw size={14} className="text-[#8B5CF6]" /> Actualiser
          </Button>
        </div>
        <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] shadow-lg shadow-[#8B5CF6]/20 rounded-xl gap-2 text-[11px] font-bold h-10 px-6">
          <SparkleIcon size={14} /> Optimiser la journée
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-[1800px] mx-auto grid grid-cols-12 gap-8 items-start">
          
          {/* Main Column */}
          <div className={cn(
            "space-y-8 transition-all duration-500",
            showKPIs ? "col-span-10" : "col-span-12"
          )}>
            
            {/* Priorities - Matching Image 1 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Indicateurs temps réel</h2>
                {!showTimeline && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowTimeline(true)}
                    className="text-[10px] font-bold text-[#8B5CF6] gap-2 h-7 rounded-lg hover:bg-[#8B5CF6]/5"
                  >
                    <Plus size={14} /> Afficher la Timeline
                  </Button>
                )}
              </div>
              <div className={cn(
                "grid gap-4",
                showKPIs ? "grid-cols-4" : "grid-cols-4 lg:grid-cols-6"
              )}>
                {[
                  { label: `Occupation: ${occupancyRate}%`, meta: 'Capacité totale: 42', val: 'Direct/OTA', color: 'bg-[#8B5CF6]/5 text-[#8B5CF6]', icon: TrendingUp, iconColor: 'bg-[#8B5CF6]' },
                  { label: `${dirtyRooms} chambres sales`, meta: 'Ménage à faire', val: `${cleanPercentage}% clean`, color: 'bg-orange-50/50 text-orange-600', icon: Sparkles, iconColor: 'bg-orange-400' },
                  { label: `${arrivalsCount} arrivées prévues`, meta: 'Aujourd\'hui', val: '4 VIP', color: 'bg-emerald-50/50 text-emerald-600', icon: Users, iconColor: 'bg-emerald-400' },
                  { label: '4,280 € à encaisser', meta: 'Paiements attente', val: '2 litiges', color: 'bg-blue-50/50 text-blue-600', icon: CreditCard, iconColor: 'bg-blue-400' },
                ].map((p) => (
                  <Card key={`priority-${p.label.replace(/\s+/g, '-')}`} className={cn("p-6 rounded-2xl border-transparent shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-all", p.color)}>
                    <div className="flex items-start justify-between mb-5 text-left">
                      <div className={cn("w-14 h-14 rounded-[20px] flex items-center justify-center text-white shrink-0 shadow-lg shadow-black/5 transition-transform duration-500 group-hover:scale-110", p.iconColor)}>
                        <p.icon size={28} />
                      </div>
                      <button className="text-[10px] font-bold bg-white/50 px-4 py-2 rounded-xl border border-white/50 hover:bg-white transition-all tracking-tight uppercase">Détails</button>
                    </div>
                    <div className="text-left">
                      <h3 className="text-[14px] font-bold leading-tight text-gray-900 group-hover:text-black transition-colors">{p.label}</h3>
                      <div className="flex items-center gap-2 mt-2.5">
                        <span className="text-[10px] opacity-70 font-bold uppercase tracking-wider">{p.meta}</span>
                        <span className="text-[13px] font-bold">{p.val}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Timeline - Matching Image 1 */}
            <AnimatePresence>
              {showTimeline && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginBottom: 32 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[10px] font-bold text-gray-400 tracking-widest">Timeline du jour</h2>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowTimeline(false)}
                      className="text-[10px] font-bold text-gray-400 gap-2 h-7 rounded-lg hover:bg-gray-100"
                    >
                      <X size={14} /> Masquer
                    </Button>
                  </div>
                  <Card className="rounded-[24px] border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="relative">
                  {/* Hours Header */}
                  <div className="flex border-b border-gray-50 bg-gray-50/20">
                    <div className="w-48 border-r border-gray-50" />
                    <div className="flex-1 flex px-4">
                      {hours.map((h) => (
                        <div key={h} className="flex-1 min-w-[70px] py-3 text-center border-l border-gray-50/50">
                          <span className="text-[10px] font-bold text-gray-400 tracking-tighter">{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Now Line */}
                  <div className="absolute top-0 bottom-0 w-px bg-indigo-500 z-20" style={{ left: `calc(12rem + (100% - 12rem) * ${calculateNowPosition().split('%')[0]} / 100)` }}>
                    <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-500 text-white text-[8px] font-bold rounded uppercase tracking-widest shadow-lg shadow-indigo-500/20">Maintenant</div>
                  </div>

                  {/* Arrivées Row */}
                  <div className="flex h-16 border-b border-gray-50 group hover:bg-gray-50/30 transition-colors">
                    <div className="w-48 border-r border-gray-50 flex items-center gap-3 px-8 shrink-0">
                       <div className="w-7 h-7 rounded-xl bg-green-50 text-green-500 flex items-center justify-center shadow-inner"><Download size={14} className="rotate-180" /></div>
                       <span className="text-[11px] font-bold text-gray-900 tracking-widest uppercase">Arrivées</span>
                    </div>
                    <div className="flex-1 flex px-4 relative items-center">
                       {TIMELINE_EVENTS.arriving.map((ev, i) => (
                         <div key={i} className="absolute w-7 h-7 rounded-full border-2 border-green-400 bg-white flex items-center justify-center text-[11px] font-bold text-green-500 shadow-lg shadow-green-500/10 cursor-pointer hover:scale-110 transition-transform" style={{ left: ev.pos }}>{ev.count}</div>
                       ))}
                    </div>
                  </div>

                  {/* Départs Row */}
                  <div className="flex h-16 border-b border-gray-50 group hover:bg-gray-50/30 transition-colors">
                    <div className="w-48 border-r border-gray-50 flex items-center gap-3 px-8 shrink-0">
                       <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shadow-inner"><Upload size={14} className="rotate-180" /></div>
                       <span className="text-[11px] font-bold text-gray-900 tracking-widest uppercase">Départs</span>
                    </div>
                    <div className="flex-1 flex px-4 relative items-center">
                       {TIMELINE_EVENTS.departing.map((ev, i) => (
                         <div key={i} className="absolute w-7 h-7 rounded-full border-2 border-rose-400 bg-white flex items-center justify-center text-[11px] font-bold text-rose-500 shadow-lg shadow-rose-500/10 cursor-pointer hover:scale-110 transition-transform" style={{ left: ev.pos }}>{ev.count}</div>
                       ))}
                    </div>
                  </div>

                  {/* Ménage Row */}
                  <div className="flex h-16 border-b border-gray-50 group hover:bg-gray-50/30 transition-colors">
                    <div className="w-48 border-r border-gray-50 flex items-center gap-3 px-8 shrink-0">
                       <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-inner"><SparkleIcon size={14} /></div>
                       <span className="text-[11px] font-bold text-gray-900 tracking-widest uppercase">Ménage</span>
                    </div>
                    <div className="flex-1 flex px-4 relative items-center">
                       {TIMELINE_EVENTS.cleaning.map((ev, i) => (
                         <div key={i} className={cn("absolute h-8 rounded-xl flex items-center justify-center text-[9px] font-bold px-4 shadow-sm backdrop-blur-sm", ev.color)} style={{ left: ev.pos, width: ev.width }}>
                            {ev.label}
                         </div>
                       ))}
                    </div>
                    {/* Summary Overlay (Top Right in image) */}
                    <div className="absolute right-6 top-8 bottom-8 w-40 bg-white/80 backdrop-blur-md rounded-2xl border border-gray-100 p-4 shadow-xl z-20 pointer-events-none">
                       <p className="text-[9px] font-bold text-gray-300 tracking-widest mb-3">Résumé</p>
                       <div className="space-y-2">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /><span className="text-[10px] font-bold text-gray-500">Arrivées</span></div>
                             <span className="text-[10px] font-bold">8</span>
                          </div>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-[10px] font-bold text-gray-500">Départs</span></div>
                             <span className="text-[10px] font-bold">8</span>
                          </div>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400" /><span className="text-[10px] font-bold text-gray-500">Ménages prévus</span></div>
                             <span className="text-[10px] font-bold">16</span>
                          </div>
                          <div className="pt-2 mt-2 border-t border-gray-50 flex items-center justify-between">
                             <span className="text-[10px] font-bold text-gray-400">Chambres dispo</span>
                             <span className="text-[10px] font-bold text-emerald-500">42</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
            )}
          </AnimatePresence>

            {/* Main Table - Matching Image 1 */}
            <div>
              <div className="flex items-center justify-between mb-6">
                 <div className="flex-1 flex items-center gap-3 bg-white p-1.5 rounded-[22px] border border-gray-100 shadow-sm max-w-[1100px]">
                    <div className="flex items-center gap-1 bg-[#F9FAFB] px-2 py-1 rounded-xl border border-gray-100">
                      <button className="p-1 hover:bg-white rounded-lg text-gray-400 transition-colors"><ChevronLeft size={14} /></button>
                      <div className="flex items-center gap-2 px-3 py-1 border-x border-gray-100">
                        <Calendar size={14} className="text-[#8B5CF6]" />
                        <span className="text-[11px] font-bold text-gray-700 whitespace-nowrap">30 avr. 2026</span>
                      </div>
                      <button className="p-1 hover:bg-white rounded-lg text-gray-400 transition-colors"><ChevronRight size={14} /></button>
                    </div>
                    
                    <div className="h-4 w-px bg-gray-200 mx-1 shrink-0" />
                    
                    <div className="p-2 bg-[#F3E8FF] text-[#8B5CF6] rounded-xl shrink-0 cursor-pointer hover:bg-[#E9D5FF] transition-colors">
                      <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center">
                        <div className="w-1 h-1 bg-current rounded-full" />
                      </div>
                    </div>

                    <div className="relative flex-1 max-w-[180px] min-w-[120px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        className="w-full bg-[#F9FAFB] border border-transparent focus:border-[#8B5CF6]/30 focus:bg-white transition-all rounded-xl py-2.5 pl-9 pr-3 text-[11px] font-bold text-gray-700 placeholder:text-gray-400" 
                        placeholder="Nom, chambre, dates..." 
                      />
                    </div>

                    <div className="hidden lg:flex items-center gap-2">
                      <div className="relative group">
                        <select className="appearance-none bg-[#F9FAFB] border border-gray-100 rounded-xl py-2.5 pl-4 pr-9 text-[11px] font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 cursor-pointer">
                          <option>Tous les types</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      <div className="relative group">
                        <select className="appearance-none bg-[#F9FAFB] border border-gray-100 rounded-xl py-2.5 pl-4 pr-9 text-[11px] font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 cursor-pointer">
                          <option>Tous statuts</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      <div className="relative group">
                        <select className="appearance-none bg-[#F9FAFB] border border-gray-100 rounded-xl py-2.5 pl-4 pr-9 text-[11px] font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 cursor-pointer">
                          <option>Tous les canaux</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      <div className="relative group">
                        <select className="appearance-none bg-[#F9FAFB] border border-gray-100 rounded-xl py-2.5 pl-4 pr-9 text-[11px] font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 cursor-pointer">
                          <option>Sources</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <Button className="bg-green-100 hover:bg-green-200 text-green-700 rounded-xl h-10 px-4 gap-2 text-[11px] font-bold transition-all shadow-sm border border-green-200">
                        <LogIn size={14} /> <span className="hidden xl:inline">Check-in</span>
                      </Button>
                      <Button className="bg-red-100 hover:bg-red-200 text-red-700 rounded-xl h-10 px-4 gap-2 text-[11px] font-bold transition-all shadow-sm border border-red-200">
                        <LogOut size={14} /> <span className="hidden xl:inline">Check-out</span>
                      </Button>
                    </div>
                 </div>

                 <div className="flex items-center gap-3">
                   <div className="relative group">
                      <select className="appearance-none bg-white border border-gray-100 rounded-xl py-2.5 pl-10 pr-9 text-[11px] font-bold text-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 cursor-pointer shadow-sm">
                        <option>Vue: Chambre</option>
                        <option>Vue: Liste</option>
                      </select>
                      <LayoutDashboard size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B5CF6]" />
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B5CF6] pointer-events-none" />
                    </div>
                    <Button 
                      onClick={() => setActiveModal('new-reservation')}
                      className="w-10 h-10 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-xl p-0 flex items-center justify-center shadow-lg shadow-[#8B5CF6]/20 transition-all"
                    >
                       <Plus size={20} className="text-white" />
                    </Button>
                 </div>
              </div>

              <Card className={cn(
                "rounded-[24px] overflow-hidden border-gray-100 shadow-sm bg-white transition-all flex flex-col",
                showTimeline ? "min-h-[500px]" : "min-h-[700px]"
              )}>
                <div className="w-full overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 w-12"><div className="w-4 h-4 rounded border-2 border-gray-200" /></th>
                                <th className="px-4 py-4">
                                  <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help">
                                    <AlertCircle size={16} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Priorité</span>
                                  </div>
                                </th>
                                <th className="px-4 py-4">
                                  <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help">
                                    <Bed size={16} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Chambre</span>
                                  </div>
                                </th>
                                <th className="px-4 py-4">
                                  <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help">
                                    <RefreshCw size={16} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Statut</span>
                                  </div>
                                </th>
                                <th className="px-6 py-4 min-w-[250px]">
                                  <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help w-fit">
                                    <Users size={16} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Client / Titre</span>
                                  </div>
                                </th>
                                <th className="px-4 py-4">
                                  <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help">
                                    <CreditCard size={16} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Paiement</span>
                                  </div>
                                </th>
                                <th className="px-4 py-4">
                                  <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help">
                                    <LogIn size={16} className="rotate-180" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Arrivée</span>
                                  </div>
                                </th>
                                <th className="px-4 py-4">
                                  <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help">
                                    <LogOut size={16} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Départ</span>
                                  </div>
                                </th>
                                <th className="px-4 py-4">
                                  <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help">
                                    <Smartphone size={16} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Canal de réservation</span>
                                  </div>
                                </th>
                                <th className="px-4 py-4">
                                  <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help">
                                    <SparkleIcon size={16} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Action automatisée</span>
                                  </div>
                                </th>
                                <th className="px-4 py-4 text-right">
                                  <div className="flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-400 group relative cursor-help ml-auto w-fit">
                                    <Building2 size={16} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">Service étage</span>
                                  </div>
                                </th>
                                <th className="px-4 py-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {reservations.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group h-16">
                                    <td className="px-6 py-2"><div className="w-4 h-4 rounded border-2 border-gray-200 group-hover:border-[#8B5CF6]/50 transition-colors" /></td>
                                    <td className="px-4 py-2">
                                        <Badge className={cn(
                                          "px-2.5 py-1 text-[9px] font-bold rounded-lg border-transparent",
                                          item.priority === 'Critique' ? "bg-red-50/60 text-red-600" :
                                          item.priority === 'Élevée' ? "bg-orange-50/60 text-orange-600" :
                                          item.priority === 'Moyenne' ? "bg-indigo-50/60 text-indigo-500" : "bg-green-50/60 text-green-600"
                                        )}>{item.priority}</Badge>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div>
                                          <p className="text-[13px] font-bold text-gray-900 leading-none">{item.room}</p>
                                          <p className="text-[9px] font-bold text-gray-300 mt-1 tracking-tighter">{item.roomType}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center gap-2">
                                           <div className={cn("w-1.5 h-1.5 rounded-full", item.dotColor)} />
                                           <span className={cn("text-[11px] font-bold", item.statusColor)}>{item.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-2">
                                        <div className="flex flex-col gap-1">
                                          <span className="text-[13px] font-bold text-gray-900 leading-none whitespace-nowrap">{item.client}</span>
                                          {item.vip && (
                                            <div className="flex items-center gap-1 text-[8px] font-bold text-orange-500/80 tracking-widest">
                                               <Crown size={10} className="fill-current" /> VIP Gold
                                            </div>
                                          )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <Badge className={cn(
                                          "px-2 py-0.5 text-[9px] font-bold rounded-lg border-transparent",
                                          item.payment === 'Payé' ? "bg-green-50/60 text-green-600" :
                                          item.payment === 'Partiel' ? "bg-orange-50/60 text-orange-600" : "bg-red-50/60 text-red-600"
                                        )}>{item.payment}</Badge>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="text-[11px] font-bold text-gray-500">{item.arrival}</span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="text-[11px] font-bold text-gray-500">{item.departure}</span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <Badge className={cn("px-2 py-0.5 text-[8px] font-bold text-white border-transparent rounded", item.sourceColor)}>
                                           {item.source}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2">
                                        {item.action !== '—' ? (
                                           <Button 
                                             variant="outline" 
                                             size="sm" 
                                             onClick={() => handleAction('details', item)} 
                                             className="h-9 px-4 rounded-xl border-[#8B5CF6]/20 bg-[#8B5CF6]/5 text-[#8B5CF6] text-[10px] font-bold tracking-widest gap-2 hover:bg-[#8B5CF6] hover:text-white transition-all"
                                           >
                                              <SparkleIcon size={12} /> {item.action}
                                           </Button>
                                        ) : (
                                          <span className="text-gray-300 ml-6">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <Badge className={cn(
                                          "px-2.5 py-1 text-[9px] font-bold rounded-lg border-transparent",
                                          item.governess === 'Validé' ? "bg-green-50/60 text-green-600" :
                                          item.governess === 'En cours' ? "bg-orange-50/60 text-orange-600" : "bg-gray-50 text-gray-400"
                                        )}>{item.governess}</Badge>
                                    </td>
                                    <td className="px-4 py-2 relative">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuOpenFor(menuOpenFor === item.id ? null : item.id);
                                          }} 
                                          className={cn(
                                            "p-2 text-gray-300 hover:text-[#8B5CF6] transition-colors rounded-xl hover:bg-gray-100",
                                            menuOpenFor === item.id && "text-[#8B5CF6] bg-gray-100"
                                          )}
                                        >
                                           <MoreHorizontal size={18} />
                                        </button>
                                        <MoreActionsMenu 
                                          isOpen={menuOpenFor === item.id} 
                                          onClose={() => setMenuOpenFor(null)} 
                                          reservation={item}
                                          onSelectAction={(action) => handleAction(action, item)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-8 py-5 flex items-center justify-between bg-gray-50/50 border-t border-gray-50">
                    <p className="text-[11px] font-bold text-gray-400 tracking-tight">Affichage de <span className="text-gray-900">1 à 5</span> sur 67 chambres</p>
                    <div className="flex items-center gap-2">
                       <button className="w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-[#8B5CF6] shadow-sm"><ChevronLeft size={16} /></button>
                       {[1, 2, 3, '...', 14].map((n, i) => (
                         <button key={i} className={cn(
                           "w-8 h-8 rounded-xl text-[11px] font-bold transition-all",
                           n === 1 ? "bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20" : "text-gray-400 hover:bg-white hover:text-gray-600"
                         )}>{n}</button>
                       ))}
                       <button className="w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#8B5CF6] transition-colors shadow-sm"><ChevronRight size={16} /></button>
                    </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Sidebar - Matching Image 1 */}
          <AnimatePresence mode="wait">
            {showKPIs ? (
              <motion.div 
                key="sidebar-full"
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="col-span-2 space-y-8"
              >
                <div className="flex items-center justify-between px-4">
                  <h3 className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">KPIs & Stats</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowKPIs(false)}
                    className="text-[10px] font-bold text-gray-400 gap-2 h-7 rounded-lg hover:bg-gray-100"
                  >
                    <X size={14} /> Masquer
                  </Button>
                </div>

                {/* Flow Score Gauge */}
            <Card className="p-6 bg-white rounded-[24px] border-transparent shadow-sm relative overflow-hidden group">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[10px] font-bold text-gray-400 tracking-widest">Flow Score</h3>
                  <div className="p-2 bg-gray-50 text-gray-400 rounded-xl"><SparkleIcon size={16} /></div>
               </div>
               <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 shrink-0">
                     <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path className="text-gray-100" strokeDasharray="100, 100" strokeWidth="3" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-emerald-500" strokeDasharray="78, 100" strokeWidth="3" strokeLinecap="round" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900 leading-none">78</span>
                        <span className="text-[10px] font-bold text-gray-300">/100</span>
                     </div>
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-gray-900 leading-tight">Journée fluide</h4>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">Continuez comme ça !</p>
                  </div>
               </div>
               {/* Decorative Sin Wave from Image 1 */}
               <div className="mt-8 relative h-10 w-full opacity-30">
                  <svg className="w-full h-full text-indigo-500" viewBox="0 0 100 20" preserveAspectRatio="none">
                     <path d="M0,10 Q10,0 20,10 T40,10 T60,10 T80,10 T100,10" fill="none" stroke="currentColor" strokeWidth="1" />
                  </svg>
               </div>
            </Card>

            {/* Performance - Matching Image 1 */}
            <Card className="p-8 bg-white rounded-[24px] border-transparent shadow-sm">
               <h3 className="text-[10px] font-bold text-gray-400 tracking-widest mb-8">Performance du jour</h3>
               <div className="space-y-8">
                  {[
                    { label: 'Taux d\'occupation', val: '75.4%', trend: '+8.3%', color: 'bg-indigo-400', trendColor: 'text-green-500', icon: Bed },
                    { label: 'ADR', val: '189.00 €', trend: '+2.1%', color: 'bg-orange-400', trendColor: 'text-green-500', icon: Target },
                    { label: 'RevPAR', val: '142.50 €', trend: '+5.1%', color: 'bg-blue-300', trendColor: 'text-green-500', icon: Zap },
                    { label: 'Revenue total', val: '28 450 €', trend: '-1.2%', color: 'bg-red-400', trendColor: 'text-red-400', icon: Wallet, sub: 'vs même jour semaine dernière' }
                  ].map((p, i) => (
                    <div key={i} className="space-y-3">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-gray-50 text-gray-400 rounded-lg"><p.icon size={12} /></div>
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.label}</span>
                          </div>
                          <div className={cn("flex items-center gap-1 text-[10px] font-bold", p.trendColor)}>
                             {p.trend.startsWith('+') ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                             {p.trend}
                          </div>
                       </div>
                       <div className="flex items-baseline gap-2">
                          <span className="text-xl font-bold text-gray-900 leading-none">{p.val}</span>
                       </div>
                       {p.label !== 'Revenue total' ? (
                          <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: '75%' }} 
                               className={cn("h-full rounded-full transition-all", p.color)} 
                             />
                          </div>
                       ) : (
                         <p className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">{p.sub}</p>
                       )}
                    </div>
                  ))}
               </div>
               <Button variant="outline" className="w-full mt-8 rounded-2xl border-gray-100 text-[#8B5CF6] text-[10px] font-bold uppercase tracking-widest h-12 hover:bg-[#8B5CF6]/5 transition-colors">
                  Voir le rapport complet
               </Button>
            </Card>

            {/* Quick Actions - Matching Image 1 */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-gray-400 tracking-widest px-4">Actions Rapides</h3>
              <div className="space-y-2">
                {[
                  { label: 'Nouvelle réservation', icon: Plus, action: () => setActiveModal('new-reservation') },
                  { label: 'Walk-in', icon: MousePointer2 },
                  { label: 'Blocage de chambres', icon: Lock },
                  { label: 'Note interne', icon: FileText },
                  { label: 'Message équipe', icon: MessageSquare },
                ].map((act) => (
                  <button 
                    key={`quick-action-${act.label.replace(/\s+/g, '-')}`} 
                    onClick={() => act.action?.()}
                    className="w-full p-4 bg-white hover:bg-gray-50 rounded-3xl border border-transparent shadow-sm flex items-center justify-between group transition-all"
                  >
                     <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <act.icon size={16} />
                        </div>
                        <span className="text-[12px] font-bold text-gray-900">{act.label}</span>
                     </div>
                     <ArrowRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>

          </motion.div>
          ) : (
            <motion.div
              key="sidebar-collapsed"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="col-span-1 flex flex-col gap-4 items-center pt-8"
            >
              <button 
                onClick={() => setShowKPIs(true)}
                className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-[#8B5CF6] shadow-sm hover:shadow-md transition-all hover:scale-105"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="w-px h-12 bg-gray-100" />
              <div className="flex flex-col gap-4">
                <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-green-500"><TrendingUp size={18} /></div>
                <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-indigo-400"><Bed size={18} /></div>
                <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-red-400"><Wallet size={18} /></div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>

        </div>
      </div>

      <AnimatePresence>
         {selectedRes && activeModal === 'details' && (
            <ReservationDetails 
               isOpen={!!selectedRes} 
               onClose={() => { setSelectedRes(null); setActiveModal(null); }} 
               reservation={selectedRes} 
            />
         )}
         {selectedRes && activeModal === 'communication' && (
            <CommunicationModal 
               isOpen={true} 
               onClose={() => { setSelectedRes(null); setActiveModal(null); }} 
               reservation={selectedRes}
            />
         )}
         {selectedRes && activeModal === 'billing' && (
            <BillingModal 
               isOpen={true} 
               onClose={() => { setSelectedRes(null); setActiveModal(null); }} 
               reservation={selectedRes}
            />
         )}
         <ReservationFormModal 
            isOpen={activeModal === 'new-reservation'}
            onClose={() => setActiveModal(null)}
            onSave={(data: ReservationFormData) => {
              const newRes: Reservation = {
                id: data.reference,
                priority: 'Moyenne',
                room: data.roomNumber,
                roomType: 'STD/DLX', // fallback
                status: 'Confirmé',
                statusColor: 'text-violet-500',
                dotColor: 'bg-violet-400',
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
      </AnimatePresence>
    </div>
  );
};

const ArrowDownRight = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m17 7-10 10" />
    <path d="M17 17H7" />
    <path d="M17 17V7" />
  </svg>
);

const ArrowRight = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const Target = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
