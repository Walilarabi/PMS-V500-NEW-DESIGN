// ═══════════════════════════════════════════════════════════════════════════
// ReservationFormModal.tsx — Formulaire UNIFIÉ Flowtym PMS v2.0 (Satin Design)
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  X, User, Mail, Phone, Users, Building2, Calendar, 
  Globe, Bed, Hash, Coffee, ShieldCheck, Tag, CreditCard, 
  Zap, Upload, FileText, Check, 
  ChevronDown, ArrowRight, Wallet, Info, FilePlus
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface ReservationFormData {
  guestName: string;
  email: string;
  phone: string;
  nationality: string;
  nationalityLabel: string;
  adults: number;
  children: number;
  company: string;
  reference: string;
  segment: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  roomNumber: string;
  board: string;
  cancelPolicy: string;
  ratePlanId: string;
  channel: string;
  vatRate: number;
  paymentMode: string;
  paymentStatus: string;
  guaranteeType: string;
  guaranteeStatus: string;
  preauthRule: string;
  preauthAmount: number;
  notes: string;
  sendConfirmation: boolean;
  nights: number;
  totalTTC: number;
  stayTax: number;
}

export interface AvailableRoom {
  number: string;
  type: string;
  price: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ReservationFormData) => void;
  initialData?: Partial<ReservationFormData>;
  availableRooms?: AvailableRoom[];
  editId?: string | null;
}

// ─── CONSTANTES DE DONNÉES ───────────────────────────────────────────────────

const ROOM_TYPES = [
  { value: 'Double Classique', label: 'Double Classique' },
  { value: 'Double Supérieure', label: 'Double Supérieure' },
  { value: 'Junior Suite', label: 'Junior Suite' },
  { value: 'Suite Deluxe', label: 'Suite Deluxe' },
  { value: 'Suite Panoramique', label: 'Suite Panoramique' },
];

const ROOMS_DEFAULT: AvailableRoom[] = [
  { number: '101', type: 'Double Classique', price: 99 },
  { number: '102', type: 'Double Classique', price: 99 },
  { number: '103', type: 'Suite Deluxe', price: 189 },
  { number: '105', type: 'Double Classique', price: 99 },
  { number: '201', type: 'Double Supérieure', price: 129 },
  { number: '202', type: 'Double Supérieure', price: 129 },
  { number: '301', type: 'Junior Suite', price: 165 },
  { number: '302', type: 'Suite Panoramique', price: 249 },
];

const CHANNELS = [
  { value: 'Direct', label: 'Direct', policies: ['flexible', 'nanr', 'early'] },
  { value: 'Booking.com', label: 'Booking.com', policies: ['flexible', 'nanr'] },
  { value: 'Airbnb', label: 'Airbnb', policies: ['nanr'] },
  { value: 'Expedia', label: 'Expedia', policies: ['flexible'] },
];

const BOARDS = [
  { value: 'Room Only', label: 'Hébergement seul', icon: Hash },
  { value: 'Petit-déjeuner', label: 'Petit-déjeuner', icon: Coffee },
  { value: 'Demi-pension', label: 'Demi-pension', icon: Coffee },
];

const CANCEL_POLICIES = [
  { value: 'flexible', label: 'Flexible (72h)' },
  { value: 'nanr', label: 'Non-remboursable' },
  { value: 'early', label: 'Early Bird' },
];

const RATE_PLANS = [
  { id: 'RACK-RO', label: 'Rack Rate RO', channel: 'Direct', board: 'Room Only', policy: 'flexible', mult: 1 },
  { id: 'RACK-BB', label: 'Rack Rate BB', channel: 'Direct', board: 'Petit-déjeuner', policy: 'flexible', mult: 1.15 },
  { id: 'BKG-STD', label: 'Booking Standard', channel: 'Booking.com', board: 'Room Only', policy: 'flexible', mult: 1.12 },
  { id: 'BKG-NR', label: 'Booking Non-Ref', channel: 'Booking.com', board: 'Room Only', policy: 'nanr', mult: 0.95 },
  { id: 'AIR-NR', label: 'Airbnb Stricte', channel: 'Airbnb', board: 'Room Only', policy: 'nanr', mult: 1.05 },
];

const COUNTRIES = [
  { name: "France", code: "FR" },
  { name: "Belgique", code: "BE" },
  { name: "Suisse", code: "CH" },
  { name: "Canada", code: "CA" },
  { name: "États-Unis", code: "US" },
  { name: "Maroc", code: "MA" },
  { name: "Algérie", code: "DZ" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtEur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
const getDaysBetween = (d1: string, d2: string) => {
  const start = new Date(d1);
  const end = new Date(d2);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// ─── COMPOSANTS UI PERSO ─────────────────────────────────────────────────────

const InputGroup = ({ label, icon: Icon, children, className = "" }: any) => (
  <div className={`relative bg-[#F5F7FA] border border-[#E8EDF5] rounded-2xl p-2 focus-within:border-[#8B5CF6] transition-all group ${className}`}>
    {label && (
      <span className="absolute top-2 left-10 text-[9px] font-black text-gray-400 uppercase tracking-tighter z-10">
        {label}
      </span>
    )}
    <div className="flex items-center gap-3 px-2 pt-2 pb-1 relative">
      {Icon && <Icon size={16} className="text-gray-400 group-focus-within:text-[#8B5CF6] transition-colors" />}
      <div className="flex-1">
        {children}
      </div>
    </div>
  </div>
);

const CustomSelect = ({ value, onChange, options, label, icon, className }: any) => (
  <InputGroup label={label} icon={icon} className={className}>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      className="w-full bg-transparent border-none outline-none text-[13px] font-bold text-gray-900 appearance-none cursor-pointer h-8"
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
  </InputGroup>
);

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────

const ReservationFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, editId }) => {
  const [form, setForm] = useState<ReservationFormData>({
    guestName: '', email: '', phone: '',
    nationality: 'FR', nationalityLabel: 'France',
    adults: 2, children: 0, company: '',
    reference: `RES-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`,
    segment: 'Loisir',
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0],
    roomType: 'Double Classique',
    roomNumber: '101',
    board: 'Room Only',
    cancelPolicy: 'flexible',
    ratePlanId: 'RACK-RO',
    channel: 'Direct',
    vatRate: 10,
    paymentMode: 'Carte bancaire',
    paymentStatus: 'En attente',
    guaranteeType: 'cb',
    guaranteeStatus: 'pending',
    preauthRule: 'first_night',
    preauthAmount: 99.00,
    notes: '',
    sendConfirmation: true,
    nights: 8,
    totalTTC: 0,
    stayTax: 40.00,
    ...initialData
  });

  const set = (k: keyof ReservationFormData, v: any) => setForm(f => ({ ...f, [k]: v }));

  /* Sync form state when caller passes new initialData (e.g. empty-cell click in Planning) */
  useEffect(() => {
    if (isOpen && initialData) {
      setForm(prev => ({ ...prev, ...initialData }));
    }
  }, [isOpen, initialData]);

  // Filtered Lists
  const filteredRooms = useMemo(() => 
    ROOMS_DEFAULT.filter(r => r.type === form.roomType), 
  [form.roomType]);

  const filteredRatePlans = useMemo(() => 
    RATE_PLANS.filter(p => p.channel === form.channel && p.policy === form.cancelPolicy && p.board === form.board),
  [form.channel, form.cancelPolicy, form.board]);

  // Adjust Room if not in filtered list
  useEffect(() => {
    if (filteredRooms.length > 0 && !filteredRooms.find(r => r.number === form.roomNumber)) {
      set('roomNumber', filteredRooms[0].number);
    }
  }, [filteredRooms]);

  // Adjust Rate Plan if not in filtered list
  useEffect(() => {
    if (filteredRatePlans.length > 0 && !filteredRatePlans.find(p => p.id === form.ratePlanId)) {
      set('ratePlanId', filteredRatePlans[0].id);
    }
  }, [filteredRatePlans]);

  // Pricing Calculation
  const pricingBreakdown = useMemo(() => {
    const nights = getDaysBetween(form.checkIn, form.checkOut);
    const room = ROOMS_DEFAULT.find(r => r.number === form.roomNumber);
    const plan = RATE_PLANS.find(p => p.id === form.ratePlanId);
    const pricePerNight = (room?.price || 100) * (plan?.mult || 1);
    
    const rows = [];
    const startDate = new Date(form.checkIn);
    for (let i = 0; i < nights; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      rows.push({
        date: date.toLocaleDateString('fr-FR'),
        label: `Nuitée — ${form.roomType}`,
        price: pricePerNight
      });
    }

    const subtotal = pricePerNight * nights;
    const vat = subtotal * (form.vatRate / 100);
    const totalTTC = subtotal + vat + form.stayTax;

    return { nights, pricePerNight, rows, subtotal, vat, totalTTC };
  }, [form.checkIn, form.checkOut, form.roomNumber, form.ratePlanId, form.vatRate, form.stayTax, form.roomType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-[900px] max-h-[95vh] rounded-[32px] overflow-hidden shadow-2xl flex flex-col relative"
      >
        {/* Header */}
        <div className="bg-[#8B5CF6] px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-white text-xl font-bold tracking-tight">Nouvelle réservation</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {/* Section 1: Guest Base */}
          <div className="grid grid-cols-12 gap-3">
             <InputGroup label="Nom du client" icon={User} className="col-span-12 md:col-span-7">
               <input 
                 value={form.guestName} 
                 onChange={e => set('guestName', e.target.value)}
                 className="w-full bg-transparent outline-none font-bold text-[13px] h-8"
                 placeholder="Wali LARABI"
               />
             </InputGroup>
             <InputGroup label="Nationalité" icon={Globe} className="col-span-12 md:col-span-5">
               <select 
                 value={form.nationality} 
                 onChange={e => set('nationality', e.target.value)}
                 className="w-full bg-transparent outline-none font-bold text-[13px] h-8 appearance-none"
               >
                 {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
               </select>
             </InputGroup>
          </div>

          <div className="grid grid-cols-12 gap-3">
             <InputGroup label="Email" icon={Mail} className="col-span-12 md:col-span-6">
               <input 
                 type="email"
                 value={form.email} 
                 onChange={e => set('email', e.target.value)}
                 className="w-full bg-transparent outline-none font-bold text-[13px] h-8"
                 placeholder="walilarabi@gmail.com"
               />
             </InputGroup>
             <InputGroup label="Téléphone" icon={Phone} className="col-span-12 md:col-span-6">
               <input 
                 type="tel"
                 value={form.phone} 
                 onChange={e => set('phone', e.target.value)}
                 className="w-full bg-transparent outline-none font-bold text-[13px] h-8"
                 placeholder="+33667830249"
               />
             </InputGroup>
          </div>

          <div className="grid grid-cols-12 gap-3">
             <InputGroup label="Adultes" icon={Users} className="col-span-4 md:col-span-3">
               <input 
                 type="number"
                 value={form.adults} 
                 onChange={e => set('adults', parseInt(e.target.value))}
                 className="w-full bg-transparent outline-none font-bold text-[13px] h-8"
               />
             </InputGroup>
             <InputGroup label="Enfants" icon={Users} className="col-span-4 md:col-span-3">
               <input 
                 type="number"
                 value={form.children} 
                 onChange={e => set('children', parseInt(e.target.value))}
                 className="w-full bg-transparent outline-none font-bold text-[13px] h-8"
               />
             </InputGroup>
             <InputGroup label="Société" icon={Building2} className="col-span-4 md:col-span-6">
               <input 
                 value={form.company} 
                 onChange={e => set('company', e.target.value)}
                 className="w-full bg-transparent outline-none font-bold text-[13px] h-8"
                 placeholder="Flowtym"
               />
             </InputGroup>
          </div>

          {/* Section 2: Dates and Channel */}
          <div className="grid grid-cols-12 gap-3">
             <InputGroup label="Arrivée" icon={Calendar} className="col-span-12 md:col-span-4">
               <input 
                 type="date"
                 value={form.checkIn} 
                 onChange={e => set('checkIn', e.target.value)}
                 className="w-full bg-transparent outline-none font-bold text-[13px] h-8"
               />
             </InputGroup>
             <InputGroup label="Départ" icon={Calendar} className="col-span-12 md:col-span-4">
               <input 
                 type="date"
                 value={form.checkOut} 
                 onChange={e => set('checkOut', e.target.value)}
                 className="w-full bg-transparent outline-none font-bold text-[13px] h-8"
               />
             </InputGroup>
             <CustomSelect 
               label="Source" 
               icon={Globe} 
               value={form.channel} 
               onChange={(v: string) => set('channel', v)}
               options={CHANNELS}
               className="col-span-12 md:col-span-4"
             />
          </div>

          {/* Section 3: Room Selection */}
          <div className="grid grid-cols-12 gap-3">
             <CustomSelect 
               label="Type de chambre" 
               icon={Bed} 
               value={form.roomType} 
               onChange={(v: string) => set('roomType', v)}
               options={ROOM_TYPES}
               className="col-span-12 md:col-span-4"
             />
             <CustomSelect 
               label="Chambre" 
               icon={Hash} 
               value={form.roomNumber} 
               onChange={(v: string) => set('roomNumber', v)}
               options={filteredRooms.map(r => ({ value: r.number, label: `${r.number} — ${r.type}` }))}
               className="col-span-12 md:col-span-4"
             />
             <CustomSelect 
               label="Pension" 
               icon={Coffee} 
               value={form.board} 
               onChange={(v: string) => set('board', v)}
               options={BOARDS}
               className="col-span-12 md:col-span-4"
             />
          </div>

          {/* Section 4: Policy and Rate Plan */}
          <div className="grid grid-cols-12 gap-3">
             <CustomSelect 
               label="Politique d'annulation" 
               icon={ShieldCheck} 
               value={form.cancelPolicy} 
               onChange={(v: string) => set('cancelPolicy', v)}
               options={CANCEL_POLICIES}
               className="col-span-12 md:col-span-6"
             />
             <CustomSelect 
               label="Plan tarifaire" 
               icon={Tag} 
               value={form.ratePlanId} 
               onChange={(v: string) => set('ratePlanId', v)}
               options={filteredRatePlans.map(p => ({ value: p.id, label: p.label }))}
               className="col-span-12 md:col-span-6"
             />
          </div>

          {/* Pricing Summary Table */}
          <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-sm">
             <div className="bg-gray-50/50 px-6 py-4 flex items-center justify-between border-b border-gray-50">
                <div className="flex items-center gap-4">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Prix / Nuit</span>
                      <span className="text-xl font-black text-[#8B5CF6]">{fmtEur(pricingBreakdown.pricePerNight)}</span>
                   </div>
                   <div className="h-8 w-[1px] bg-gray-200" />
                   <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl font-bold text-[11px]">
                      <Zap size={14} />
                      {pricingBreakdown.nights} nuits · {form.adults + form.children} pers.
                   </div>
                </div>
             </div>

             <div className="px-6 py-4">
                <table className="w-full text-[11px]">
                   <thead>
                      <tr className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">
                         <th className="text-left pb-4">Date</th>
                         <th className="text-left pb-4">Libellé</th>
                         <th className="text-right pb-4">Montant</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {pricingBreakdown.rows.map((row, i) => (
                        <tr key={i} className="text-gray-900">
                           <td className="py-2.5 font-bold">{row.date}</td>
                           <td className="py-2.5 text-gray-400 font-medium italic">{row.label}</td>
                           <td className="py-2.5 text-right font-black">{fmtEur(row.price)}</td>
                        </tr>
                      ))}
                      <tr className="text-gray-400 font-bold border-t-2 border-gray-50">
                        <td className="pt-4 pb-1">HT</td>
                        <td className="pt-4 pb-1 text-right" colSpan={2}>
                           <span className="mr-6">{fmtEur(pricingBreakdown.subtotal)}</span>
                           <span className="text-[9px]">TVA {form.vatRate}%</span>
                           <span className="ml-2">{fmtEur(pricingBreakdown.vat)}</span>
                        </td>
                      </tr>
                      <tr className="text-gray-400 font-bold">
                        <td className="py-1">Taxe séjour</td>
                        <td className="py-1 text-right font-black" colSpan={2}>{fmtEur(form.stayTax)}</td>
                      </tr>
                   </tbody>
                </table>
             </div>

             <div className="bg-[#F5F3FF] px-8 py-4 flex items-center justify-between">
                <span className="text-sm font-black text-[#111827] uppercase tracking-tighter">Total TTC</span>
                <span className="text-2xl font-black text-[#8B5CF6] tracking-tight">{fmtEur(pricingBreakdown.totalTTC)}</span>
             </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
             {/* Payment and Guarantee Controls */}
             <div className="col-span-12 md:col-span-5 space-y-4">
                <div className="flex gap-2">
                   {['Acompte 30%', 'Acompte 50%', 'Totalité 100%'].map((lbl, i) => (
                     <button key={i} className={cn(
                       "flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all",
                       i === 0 ? "bg-[#8B5CF6]/10 text-[#8B5CF6] border-2 border-[#8B5CF6]" : "bg-gray-50 text-gray-400 border border-transparent"
                     )}>
                       {lbl}
                     </button>
                   ))}
                </div>

                <div className="flex gap-2">
                   <button className="flex-1 py-3 bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl flex items-center justify-center gap-2 text-[#8B5CF6] font-bold text-xs shadow-sm">
                     <CreditCard size={14} /> Stripe
                   </button>
                   <button className="flex-1 py-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center gap-2 text-blue-600 font-bold text-xs shadow-sm">
                     <Wallet size={14} /> PayPal
                   </button>
                </div>

                <button className="w-full py-4 bg-[#8B5CF6] text-white rounded-2xl flex items-center justify-center gap-3 font-black text-[12px] uppercase tracking-widest shadow-lg shadow-[#8B5CF6]/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
                   <Zap size={16} fill="currentColor" /> Générer le lien de paiement
                </button>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                   <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className={cn("p-1.5 rounded-lg border", i === 2 ? "bg-white border-[#8B5CF6] text-[#8B5CF6]" : "bg-gray-100 text-gray-300")}>
                           {i === 2 ? <CreditCard size={14} /> : <Info size={14} />}
                        </div>
                      ))}
                      <div className="ml-auto bg-violet-100 text-[#8B5CF6] px-2 py-1.5 rounded-full flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter">
                         <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                         Préautorisé
                      </div>
                   </div>
                   <div className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between text-[10px] font-bold text-gray-900 group cursor-pointer hover:border-[#8B5CF6] transition-colors">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        <span>Préautorisation : 1ère nuitée ({fmtEur(pricingBreakdown.pricePerNight)})</span>
                      </div>
                      <FileText size={14} className="text-gray-300 group-hover:text-[#8B5CF6]" />
                   </div>
                </div>
             </div>

             {/* Notes and Files */}
             <div className="col-span-12 md:col-span-7 space-y-4">
                <InputGroup label="Notes, demandes spéciales..." icon={FileText} className="h-32">
                   <textarea 
                     value={form.notes}
                     onChange={e => set('notes', e.target.value)}
                     className="w-full bg-transparent outline-none font-bold text-[13px] h-full resize-none pt-2"
                   />
                </InputGroup>

                <div className="border-2 border-dashed border-[#DDD6FE] bg-violet-50/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-2 group cursor-pointer hover:bg-violet-50 transition-all">
                   <div className="p-3 bg-white rounded-2xl shadow-sm text-[#8B5CF6] group-hover:scale-110 transition-transform">
                      <Upload size={24} />
                   </div>
                   <div>
                      <p className="text-[11px] font-black text-gray-900 uppercase">Glissez vos fichiers ici</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">PDF · Image · HTML</p>
                   </div>
                   <button className="mt-2 px-6 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-bold text-gray-500 hover:text-[#8B5CF6] hover:border-[#8B5CF6] transition-all shadow-sm">
                      Parcourir
                   </button>
                </div>
             </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
             <div className="flex items-center gap-4">
                <button className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors shadow-sm">
                   <FileText size={18} />
                </button>
                <button className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors shadow-sm">
                   <Mail size={18} />
                </button>
                <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => set('sendConfirmation', !form.sendConfirmation)}>
                   <div className={cn(
                     "w-10 h-6 rounded-full transition-all relative",
                     form.sendConfirmation ? "bg-[#8B5CF6]" : "bg-gray-200"
                   )}>
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        form.sendConfirmation ? "left-5" : "left-1"
                      )} />
                   </div>
                   <span className="text-[11px] font-bold text-gray-500">Envoyer confirmation</span>
                </div>
             </div>

             <div className="flex items-center gap-3">
                <button 
                  onClick={onClose}
                  className="px-8 py-3 bg-white border border-gray-100 rounded-2xl text-[12px] font-black uppercase text-gray-400 hover:text-[#8B5CF6] hover:border-[#8B5CF6] transition-all"
                >
                   Annuler
                </button>
                <button 
                  onClick={() => {
                    onSave({ ...form, totalTTC: pricingBreakdown.totalTTC, nights: pricingBreakdown.nights });
                    onClose();
                  }}
                  className="px-10 py-3 bg-[#8B5CF6] text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-xl shadow-[#8B5CF6]/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                >
                   <Check size={18} strokeWidth={3} />
                   Enregistrer
                </button>
             </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
};

export default ReservationFormModal;
