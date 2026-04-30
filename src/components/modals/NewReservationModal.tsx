import React, { useRef, useEffect, useState } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Users, 
  Building2, 
  Calendar, 
  Clock, 
  Search, 
  ChevronDown, 
  ChevronRight,
  Printer,
  Send,
  Save,
  MessageSquare,
  CreditCard,
  History,
  Info,
  Crown,
  Bed,
  CreditCard as CardIcon,
  Globe,
  Plus,
  Trash2,
  Check,
  LayoutDashboard,
  FileText,
  Smartphone,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { useReservations, Reservation } from '@/src/contexts/ReservationContext';

const COUNTRIES = [
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
];

export const NewReservationModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { addReservation } = useReservations();
  const [formData, setFormData] = useState({
    client: '',
    nationality: 'FR',
    email: '',
    phone: '',
    adults: 2,
    children: 0,
    company: '',
    arrival: '2026-04-30',
    departure: '2026-05-01',
    channel: 'Direct',
    reference: 'RES-2446',
    roomType: 'STD/DLX',
    roomNumber: '101',
    mealPlan: 'Room Only',
    policy: 'Flexible (72h)',
    ratePlan: 'Plan tarifaire',
    pricePerNight: 0,
    deposit: '30%',
    paymentProvider: 'Stripe',
    notes: '',
    sendConfirmation: true,
  });

  const [nationalitySearch, setNationalitySearch] = useState('');
  const [showNationalityList, setShowNationalityList] = useState(false);
  const [activeInputIndex, setActiveInputIndex] = useState(0);
  
  const formRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLTextAreaElement)[]>([]);

  const filteredCountries = nationalitySearch.length >= 2 
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(nationalitySearch.toLowerCase()) || c.code.toLowerCase().includes(nationalitySearch.toLowerCase()))
    : [];

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = index + 1;
      if (inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex].focus();
      }
    }
  };

  const handleSave = () => {
    const newRes: Reservation = {
      id: formData.reference || `RES-${Math.floor(Math.random() * 10000)}`,
      priority: 'Moyenne',
      room: formData.roomNumber,
      roomType: formData.roomType,
      status: 'Arrivée < 1h',
      statusColor: 'text-orange-500/80',
      dotColor: 'bg-orange-400',
      client: formData.client,
      arrival: formData.arrival,
      departure: formData.departure,
      source: formData.channel.toUpperCase(),
      sourceColor: formData.channel === 'Direct' ? 'bg-green-400' : 'bg-indigo-400',
      action: 'Check-in',
      governess: 'À faire',
      vip: false,
      payment: 'Partiel',
      email: formData.email,
      phone: formData.phone,
      nationality: formData.nationality,
      guests: { adults: formData.adults, children: formData.children },
      company: formData.company,
      mealPlan: formData.mealPlan,
      policy: formData.policy,
      ratePlan: formData.ratePlan,
      pricePerNight: formData.pricePerNight,
      notes: formData.notes
    };
    
    addReservation(newRes);
    onClose();
  };

  if (!isOpen) return null;

  const currentCountry = COUNTRIES.find(c => c.code === formData.nationality) || COUNTRIES[0];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1E1B4B]/80 backdrop-blur-md overflow-y-auto"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-[800px] bg-[#F8F9FD] rounded-[32px] shadow-2xl overflow-hidden flex flex-col mb-4 mt-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Purple */}
        <div className="bg-[#8B5CF6] p-6 text-white flex items-center justify-between">
          <h2 className="text-xl font-bold">Nouvelle réservation</h2>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-4 overflow-y-auto scrollbar-hide max-h-[85vh]">
          {/* Main Info Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input 
                ref={el => inputRefs.current[0] = el!}
                onKeyDown={e => handleKeyDown(e, 0)}
                className="w-full bg-white border border-transparent focus:border-[#8B5CF6]/30 shadow-[0_4px_12px_rgba(139,92,246,0.05)] rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 placeholder:text-gray-300 transition-all outline-none"
                placeholder="Nom Complet *"
                value={formData.client}
                onChange={e => setFormData({ ...formData, client: e.target.value })}
              />
            </div>
            
            <div className="relative">
              <div 
                className="w-full bg-white border border-transparent shadow-[0_4px_12px_rgba(139,92,246,0.05)] rounded-2xl py-4 flex items-center justify-between px-6 cursor-pointer"
                onClick={() => setShowNationalityList(!showNationalityList)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{currentCountry.flag}</span>
                  <span className="text-sm font-bold text-gray-900">{currentCountry.name}</span>
                </div>
                <ChevronDown size={16} className="text-indigo-400" />
              </div>
              
              <AnimatePresence>
                {showNationalityList && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full mt-2 w-full bg-white border border-indigo-100 rounded-2xl shadow-xl z-50 p-2 overflow-hidden"
                  >
                    <div className="relative mb-2">
                       <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                       <input 
                        autoFocus
                        className="w-full bg-gray-50 rounded-xl py-2 pl-9 pr-3 text-xs font-bold outline-none"
                        placeholder="Chercher pays (ex: FR)"
                        value={nationalitySearch}
                        onChange={e => setNationalitySearch(e.target.value)}
                       />
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-hide py-1">
                      {(nationalitySearch.length >= 2 ? filteredCountries : COUNTRIES).map((c) => (
                        <button 
                          key={c.code}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 rounded-xl transition-colors"
                          onClick={() => {
                            setFormData({ ...formData, nationality: c.code });
                            setShowNationalityList(false);
                            setNationalitySearch('');
                          }}
                        >
                          <span className="text-lg">{c.flag}</span>
                          <span className="text-xs font-bold text-gray-700">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Contacts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input 
                ref={el => inputRefs.current[1] = el!}
                onKeyDown={e => handleKeyDown(e, 1)}
                className="w-full bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 placeholder:text-gray-300 transition-all outline-none"
                placeholder="Email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input 
                ref={el => inputRefs.current[2] = el!}
                onKeyDown={e => handleKeyDown(e, 2)}
                className="w-full bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 placeholder:text-gray-300 transition-all outline-none"
                placeholder="Téléphone"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Guests & Company Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input 
                ref={el => inputRefs.current[3] = el!}
                onKeyDown={e => handleKeyDown(e, 3)}
                type="number"
                className="w-full bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 outline-none"
                value={formData.adults}
                onChange={e => setFormData({ ...formData, adults: parseInt(e.target.value) })}
              />
            </div>
            <div className="relative">
              <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input 
                ref={el => inputRefs.current[4] = el!}
                onKeyDown={e => handleKeyDown(e, 4)}
                type="number"
                className="w-full bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 outline-none"
                value={formData.children}
                onChange={e => setFormData({ ...formData, children: parseInt(e.target.value) })}
              />
            </div>
            <div className="relative">
              <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input 
                ref={el => inputRefs.current[5] = el!}
                onKeyDown={e => handleKeyDown(e, 5)}
                className="w-full bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none"
                placeholder="Société"
                value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
          </div>

          {/* Dates & Channel Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Calendar size={16} className="absolute left-4 top-1/3 -translate-y-1/2 text-indigo-400" />
              <div className="absolute left-12 top-4 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Arrivée</div>
              <input 
                ref={el => inputRefs.current[6] = el!}
                onKeyDown={e => handleKeyDown(e, 6)}
                type="date"
                className="w-full bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl pt-8 pb-4 px-12 text-sm font-bold text-gray-900 outline-none"
                value={formData.arrival}
                onChange={e => setFormData({ ...formData, arrival: e.target.value })}
              />
            </div>
            <div className="relative">
              <Calendar size={16} className="absolute left-4 top-1/3 -translate-y-1/2 text-indigo-400" />
              <div className="absolute left-12 top-4 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Départ</div>
              <input 
                ref={el => inputRefs.current[7] = el!}
                onKeyDown={e => handleKeyDown(e, 7)}
                type="date"
                className="w-full bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl pt-8 pb-4 px-12 text-sm font-bold text-gray-900 outline-none"
                value={formData.departure}
                onChange={e => setFormData({ ...formData, departure: e.target.value })}
              />
            </div>
            <div className="relative">
               <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
               <select 
                ref={el => inputRefs.current[8] = el!}
                onKeyDown={e => handleKeyDown(e, 8)}
                className="w-full appearance-none bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-10 text-sm font-bold text-gray-900 outline-none"
                value={formData.channel}
                onChange={e => setFormData({ ...formData, channel: e.target.value })}
               >
                 <option>Direct</option>
                 <option>Booking.com</option>
                 <option>Airbnb</option>
                 <option>Expedia</option>
               </select>
               <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400" />
            </div>
          </div>

          {/* Reference & Room Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="relative">
               <CardIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
               <input 
                ref={el => inputRefs.current[9] = el!}
                onKeyDown={e => handleKeyDown(e, 9)}
                className="w-full bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none"
                placeholder="Réf"
                value={formData.reference}
                onChange={e => setFormData({ ...formData, reference: e.target.value })}
               />
             </div>
             <div className="relative">
               <Bed size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
               <select 
                ref={el => inputRefs.current[10] = el!}
                onKeyDown={e => handleKeyDown(e, 10)}
                className="w-full appearance-none bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-10 text-sm font-bold text-gray-900 outline-none"
                value={formData.roomType}
                onChange={e => setFormData({ ...formData, roomType: e.target.value })}
               >
                 <option>Type Chambre</option>
                 <option>STD/DLX</option>
                 <option>SUP/SEA</option>
                 <option>SUITE</option>
               </select>
               <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400" />
             </div>
             <div className="relative">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg text-indigo-400">#</span>
               <select 
                ref={el => inputRefs.current[11] = el!}
                onKeyDown={e => handleKeyDown(e, 11)}
                className="w-full appearance-none bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-10 text-sm font-bold text-gray-900 outline-none"
                value={formData.roomNumber}
                onChange={e => setFormData({ ...formData, roomNumber: e.target.value })}
               >
                 <option>Numéro</option>
                 <option>101</option>
                 <option>102</option>
                 <option>105</option>
                 <option>201</option>
               </select>
               <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400" />
             </div>
          </div>

          {/* Plans Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="relative">
               <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
               <select 
                ref={el => inputRefs.current[12] = el!}
                onKeyDown={e => handleKeyDown(e, 12)}
                className="w-full appearance-none bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-10 text-sm font-bold text-gray-900 outline-none"
                value={formData.mealPlan}
                onChange={e => setFormData({ ...formData, mealPlan: e.target.value })}
               >
                 <option>Room Only</option>
                 <option>Bed & Breakfast</option>
                 <option>Half Board</option>
                 <option>Full Board</option>
               </select>
               <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400" />
             </div>
             <div className="relative">
               <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
               <select 
                ref={el => inputRefs.current[13] = el!}
                onKeyDown={e => handleKeyDown(e, 13)}
                className="w-full appearance-none bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-10 text-sm font-bold text-gray-900 outline-none"
                value={formData.policy}
                onChange={e => setFormData({ ...formData, policy: e.target.value })}
               >
                 <option>Flexible (72h)</option>
                 <option>Non-remboursable</option>
                 <option>Semi-Flexible</option>
               </select>
               <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400" />
             </div>
             <div className="relative">
               <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
               <select 
                ref={el => inputRefs.current[14] = el!}
                onKeyDown={e => handleKeyDown(e, 14)}
                className="w-full appearance-none bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-2xl py-4 pl-12 pr-10 text-sm font-bold text-gray-900 outline-none"
                value={formData.ratePlan}
                onChange={e => setFormData({ ...formData, ratePlan: e.target.value })}
               >
                 <option>Plan tarifaire</option>
                 <option>Standard Rate</option>
                 <option>Business Package</option>
               </select>
               <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400" />
             </div>
          </div>

          {/* Pricing Info Card */}
          <Card className="rounded-3xl border-gray-100 p-6 bg-white space-y-4 shadow-sm">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-indigo-50 text-[#8B5CF6] rounded-xl"><Clock size={16} /></div>
                   <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Prix / Nuit</div>
                      <div className="text-xl font-black text-indigo-500">0,00€</div>
                   </div>
                </div>
                <Badge className="bg-emerald-50 text-emerald-500 border-transparent rounded-lg px-3 py-1 flex items-center gap-2">
                   <Users size={12} /> 1 nuit - 2 pers.
                </Badge>
             </div>
             <div className="space-y-2 pt-2 border-t border-gray-50">
                <div className="flex justify-between text-xs font-bold text-gray-400">
                   <span>HT</span>
                   <div className="flex items-center gap-4 text-gray-900">
                      <span>0,00€</span>
                      <span className="text-[10px] text-gray-300">TVA 10%</span>
                      <span>0,00€</span>
                   </div>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-400">
                   <span>Taxe séjour</span>
                   <span className="text-gray-900">5,00€</span>
                </div>
                <div className="flex justify-between pt-2 items-baseline">
                   <span className="text-sm font-black uppercase tracking-widest text-[#8B5CF6]">Total TTC</span>
                   <span className="text-3xl font-black text-[#8B5CF6]">5,00€</span>
                </div>
             </div>
          </Card>

          {/* Payment Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <div className="flex p-1 bg-indigo-50/50 rounded-2xl gap-1">
                   {['30%', '50%', '100%'].map(p => (
                     <button 
                      key={p} 
                      className={cn(
                        "flex-1 py-3 rounded-xl text-xs font-bold transition-all",
                        formData.deposit === p ? "bg-white text-[#8B5CF6] shadow-sm shadow-[#8B5CF6]/10 border border-indigo-100" : "text-gray-400 hover:text-gray-600"
                      )}
                      onClick={() => setFormData({ ...formData, deposit: p })}
                     >
                       Acompte {p}
                     </button>
                   ))}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <button 
                    className={cn(
                      "flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all",
                      formData.paymentProvider === 'Stripe' ? "border-[#8B5CF6] bg-white shadow-lg shadow-[#8B5CF6]/10" : "border-gray-100 hover:bg-white"
                    )}
                    onClick={() => setFormData({ ...formData, paymentProvider: 'Stripe' })}
                   >
                     <span className="font-black text-indigo-500 italic text-xl">S</span>
                     <span className="font-bold text-gray-900">Stripe</span>
                   </button>
                   <button 
                    className={cn(
                      "flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all",
                      formData.paymentProvider === 'PayPal' ? "border-[#8B5CF6] bg-white shadow-lg shadow-[#8B5CF6]/10" : "border-gray-100 hover:bg-white"
                    )}
                    onClick={() => setFormData({ ...formData, paymentProvider: 'PayPal' })}
                   >
                     <span className="font-black text-blue-500 text-xl italic">P</span>
                     <span className="font-bold text-gray-900">PayPal</span>
                   </button>
                </div>

                <Button className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-2xl h-14 font-bold gap-3 shadow-lg shadow-[#8B5CF6]/20">
                   <ChevronRight size={18} className="translate-x-1" /> Générer le lien de paiement
                </Button>

                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2">
                   {[CardIcon, Building2, LayoutDashboard, Send, FileText, Smartphone, CreditCard, ChevronDown, Check, Users].map((Icon, i) => (
                     <div key={i} className="w-10 h-10 shrink-0 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-gray-300">
                        <Icon size={16} />
                     </div>
                   ))}
                </div>

                <Badge className="bg-orange-50 text-orange-500 border-transparent rounded-lg px-3 py-1 flex items-center gap-2 mb-2">
                   <div className="w-2 h-2 rounded-full bg-orange-500" /> En attente
                </Badge>

                <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                   <div className="flex items-center gap-3">
                      <Lock size={16} className="text-gray-300" />
                      <span className="text-xs font-bold text-gray-700">Préautorisation : 1ère nuitée</span>
                   </div>
                   <button className="text-gray-300 hover:text-indigo-500"><ChevronDown size={16} /></button>
                </div>
             </div>

             <div className="space-y-4">
                <div className="relative h-full flex flex-col">
                   <div className="absolute top-4 left-4 text-indigo-400"><FileText size={16} /></div>
                   <textarea 
                    className="flex-1 w-full bg-[#EEF2FF]/50 border border-transparent focus:border-[#8B5CF6]/30 rounded-3xl p-8 pl-12 text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none min-h-[160px] resize-none"
                    placeholder="Notes, demandes spéciales..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                   />
                   
                   {/* File Upload Placeholder */}
                   <div className="mt-4 p-8 border-2 border-dashed border-indigo-100 rounded-3xl flex flex-col items-center justify-center gap-3 bg-white/50 group cursor-pointer hover:bg-white hover:border-[#8B5CF6]/30 transition-all">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#8B5CF6] flex items-center justify-center group-hover:scale-110 transition-transform"><Plus size={24} /></div>
                      <div className="text-center">
                         <div className="text-xs font-bold text-gray-900">Glissez vos fichiers ici</div>
                         <div className="text-[10px] font-bold text-gray-300 uppercase mt-1 tracking-widest">PDF - Image - HTML</div>
                      </div>
                      <button className="px-6 py-2 bg-white border border-indigo-100 rounded-xl text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest shadow-sm">Parcourir</button>
                   </div>
                </div>
             </div>
          </div>

          {/* Loisir Selector */}
          <div className="relative">
             <div className="w-full bg-[#EEF2FF]/50 rounded-2xl p-4 flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                   <Bed size={16} className="text-indigo-400" />
                   <span className="text-sm font-bold text-gray-900">Loisir</span>
                </div>
                <ChevronDown size={16} className="text-indigo-400" />
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-300 hover:bg-rose-50 transition-colors">
              <Printer size={18} />
            </button>
            <div className="flex items-center gap-2">
               <button className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-500 hover:bg-emerald-100 transition-colors">
                 <Send size={18} />
               </button>
               <div className="flex items-center gap-2">
                 <input 
                  type="checkbox" 
                  id="confirm" 
                  className="w-4 h-4 rounded border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]" 
                  checked={formData.sendConfirmation}
                  onChange={e => setFormData({ ...formData, sendConfirmation: e.target.checked })}
                 />
                 <label htmlFor="confirm" className="text-[10px] font-bold text-gray-400">Envoyer confirmation</label>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
              onClick={onClose}
              className="px-8 py-3 rounded-2xl bg-gray-50 text-gray-400 font-bold text-xs hover:bg-gray-100 transition-colors"
             >
               Annuler
             </button>
             <button 
              onClick={handleSave}
              className="px-10 py-3 rounded-2xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs flex items-center gap-3 shadow-lg shadow-[#8B5CF6]/20 transition-all"
             >
               <Save size={18} /> Enregistrer
             </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
