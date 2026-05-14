/**
 * FLOWTYM — NewReservationModal
 * Formulaire de réservation complet : design fidèle à la maquette
 * Auto-complétion client, sélection multi-chambres, calcul tarifaire temps réel
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, User, Mail, Phone, Users, Baby, Calendar, Hash, Tag, CreditCard,
  Upload, ChevronDown, ChevronUp, Search, Check, AlertTriangle, Loader2,
  Bed, FileText, Zap, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';

// ─── Countries list ───────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'JP', name: 'Japon', flag: '🇯🇵' },
  { code: 'CN', name: 'Chine', flag: '🇨🇳' },
  { code: 'AE', name: 'Émirats Arabes', flag: '🇦🇪' },
  { code: 'MA', name: 'Maroc', flag: '🇲🇦' },
  { code: 'TN', name: 'Tunisie', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algérie', flag: '🇩🇿' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'RU', name: 'Russie', flag: '🇷🇺' },
  { code: 'BR', name: 'Brésil', flag: '🇧🇷' },
  { code: 'AU', name: 'Australie', flag: '🇦🇺' },
].sort((a, b) => a.name.localeCompare(b.name));

const RATE_PLANS = [
  { id: 'rack', label: 'Rack', icon: '🏷️' },
  { id: 'flexible', label: 'Flexible (72h)', icon: '🔄' },
  { id: 'non_refundable', label: 'Non remboursable', icon: '🔒' },
  { id: 'corporate', label: 'Corporate', icon: '🏢' },
  { id: 'promo', label: 'Promo', icon: '🎯' },
];

const SEGMENTS = ['Loisir', 'Affaires', 'Groupe', 'VIP', 'Corporate', 'OTA'];

const SOURCES = [
  { id: 'DIRECT', label: 'Direct', color: 'bg-emerald-500' },
  { id: 'BOOKING', label: 'Booking.com', color: 'bg-blue-500' },
  { id: 'EXPEDIA', label: 'Expedia', color: 'bg-yellow-500' },
  { id: 'AIRBNB', label: 'Airbnb', color: 'bg-rose-500' },
  { id: 'AGODA', label: 'Agoda', color: 'bg-purple-500' },
  { id: 'HOTELBEDS', label: 'Hotelbeds', color: 'bg-orange-500' },
];

const PAYMENT_ICONS = ['💳', '🏦', '💵', '📧', '💰', 'P', 'AX', 'DC', 'JCB', '👤'];

const TVA_RATE = 0.10;
const TAXE_SEJOUR = 5.00; // par nuit par personne

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefill?: {
    roomId?: string;
    roomNumber?: string;
    checkIn?: string;
    checkOut?: string;
  };
  onSave: (data: any) => Promise<void>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Input field
const Field = ({ label, icon: Icon, error, ...props }: any) => (
  <div className="relative">
    {Icon && <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />}
    <input
      {...props}
      className={cn(
        'w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder:text-gray-400 transition-all',
        'focus:outline-none focus:border-[#7C9D8E] focus:bg-white focus:ring-2 focus:ring-[#7C9D8E]/20',
        Icon ? 'pl-9 pr-4' : 'px-4',
        error && 'border-red-300 focus:border-red-400',
      )}
    />
    {error && <p className="text-[10px] text-red-500 mt-1 ml-1">{error}</p>}
  </div>
);

// Counter
const Counter = ({ value, onChange, min = 0, max = 20, icon: Icon, label }: any) => (
  <div className="h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl flex items-center px-3 gap-3">
    {Icon && <Icon size={14} className="text-gray-400 shrink-0" />}
    <span className="text-xs text-gray-400 flex-1">{label}</span>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#7C9D8E] hover:text-[#7C9D8E] transition-all"
      >
        <ChevronDown size={12} />
      </button>
      <span className="w-5 text-center text-sm font-black text-[#1E3A5F]">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#7C9D8E] hover:text-[#7C9D8E] transition-all"
      >
        <ChevronUp size={12} />
      </button>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewReservationModal({ isOpen, onClose, prefill, onSave }: NewReservationModalProps) {
  // Form state
  const [status, setStatus] = useState<'option' | 'pending' | 'confirmed'>('confirmed');
  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nationality, setNationality] = useState({ code: 'FR', name: 'France', flag: '🇫🇷' });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [checkIn, setCheckIn] = useState(prefill?.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(prefill?.checkOut ?? '');
  const [roomNumber, setRoomNumber] = useState(prefill?.roomNumber ?? '');
  const [roomId, setRoomId] = useState(prefill?.roomId ?? '');
  const [roomType, setRoomType] = useState('');
  const [ratePlan, setRatePlan] = useState('flexible');
  const [segment, setSegment] = useState('Loisir');
  const [source, setSource] = useState('DIRECT');
  const [notes, setNotes] = useState('');
  const [depositType, setDepositType] = useState<'30' | '50' | '100'>('30');
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [preauthorization, setPreauthorization] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Autocomplete state
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNationality, setShowNationality] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);

  // Drag & drop
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Sync prefill
  useEffect(() => {
    if (prefill) {
      if (prefill.checkIn) setCheckIn(prefill.checkIn);
      if (prefill.checkOut) setCheckOut(prefill.checkOut);
      if (prefill.roomNumber) setRoomNumber(prefill.roomNumber);
      if (prefill.roomId) setRoomId(prefill.roomId);
    }
  }, [prefill]);

  // Auto-complete client
  useEffect(() => {
    if (guestName.length < 3) { setClientSuggestions([]); setShowSuggestions(false); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('guests')
        .select('id, first_name, last_name, email, phone, nationality')
        .ilike('last_name', `%${guestName}%`)
        .limit(5);
      const results = data ?? [];
      setClientSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [guestName]);

  // Load available rooms when dates change
  useEffect(() => {
    if (!checkIn || !checkOut) return;
    supabase.from('rooms').select('id, number, type, category, floor, base_price, status').eq('active', true)
      .then(({ data }) => setAvailableRooms(data ?? []));
  }, [checkIn, checkOut]);

  // Price calculation
  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))
    : 1;
  const baseRoom = availableRooms.find(r => r.number === roomNumber);
  const pricePerNight = baseRoom?.base_price ?? 0;
  const subtotalHT = pricePerNight * nights;
  const tva = subtotalHT * TVA_RATE;
  const taxeSejour = TAXE_SEJOUR * adults * nights;
  const totalTTC = subtotalHT + tva + taxeSejour;
  const depositAmount = totalTTC * (parseInt(depositType) / 100);

  // Reference
  const reference = `RES-${Math.floor(1000 + Math.random() * 9000)}`;

  const selectClient = (guest: any) => {
    setGuestName(`${guest.first_name} ${guest.last_name}`);
    setEmail(guest.email ?? '');
    setPhone(guest.phone ?? '');
    const country = COUNTRIES.find(c => c.code === guest.nationality);
    if (country) setNationality(country);
    setShowSuggestions(false);
  };

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleFilesDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        status, guestName, email, phone,
        nationality: nationality.code,
        adults, children, checkIn, checkOut, nights,
        roomId, roomNumber, roomType, ratePlan,
        segment, source, notes, totalTTC,
        sendConfirmation, reference,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="bg-white w-full max-w-[860px] rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2d5a8e] px-7 py-5 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-black text-white">Nouvelle réservation</h2>
              <p className="text-xs text-indigo-200 font-medium mt-0.5">Flowtym PMS · {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-7 space-y-6">

              {/* Status */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">STATUT DE LA RÉSERVATION</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'option', label: 'Option (Hold)', icon: '⏸️' },
                    { id: 'pending', label: 'Pending', icon: '⏳' },
                    { id: 'confirmed', label: 'Confirmée', icon: '✅' },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStatus(s.id as any)}
                      className={cn(
                        'h-11 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2',
                        status === s.id
                          ? s.id === 'confirmed'
                            ? 'border-[#7C9D8E] bg-[#7C9D8E]/10 text-[#7C9D8E]'
                            : 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                          : 'border-[#E2E8F0] bg-[#F8F9FC] text-gray-400 hover:border-gray-300',
                      )}
                    >
                      <span>{s.icon}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2 columns */}
              <div className="grid grid-cols-2 gap-6">
                {/* LEFT */}
                <div className="space-y-4">
                  {/* Guest name + nationality */}
                  <div className="grid grid-cols-[1fr_160px] gap-3">
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-3.5 text-gray-400 z-10" />
                      <input
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        onFocus={() => clientSuggestions.length > 0 && setShowSuggestions(true)}
                        placeholder="Nom Complet *"
                        className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm pl-9 pr-4 focus:outline-none focus:border-[#7C9D8E] focus:ring-2 focus:ring-[#7C9D8E]/20 focus:bg-white"
                      />
                      {/* Autocomplete dropdown */}
                      <AnimatePresence>
                        {showSuggestions && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute top-12 left-0 right-0 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 overflow-hidden"
                          >
                            {clientSuggestions.map(g => (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => selectClient(g)}
                                className="w-full text-left px-4 py-3 hover:bg-[#F8F9FC] flex items-center gap-3 border-b border-gray-50 last:border-0"
                              >
                                <div className="w-8 h-8 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center text-xs font-black text-[#1E3A5F]">
                                  {g.first_name?.[0]}{g.last_name?.[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{g.first_name} {g.last_name}</p>
                                  <p className="text-xs text-gray-400">{g.email}</p>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Nationality picker */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowNationality(!showNationality)}
                        className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-3 flex items-center gap-2 hover:border-[#7C9D8E] transition-all"
                      >
                        <span className="text-base">{nationality.flag}</span>
                        <span className="flex-1 text-left text-sm font-medium text-gray-700 truncate">{nationality.name}</span>
                        <ChevronDown size={12} className="text-gray-400 shrink-0" />
                      </button>
                      <AnimatePresence>
                        {showNationality && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute top-12 right-0 w-56 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 overflow-hidden"
                          >
                            <div className="p-2 border-b border-gray-50">
                              <div className="relative">
                                <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                                <input
                                  value={countrySearch}
                                  onChange={e => setCountrySearch(e.target.value)}
                                  placeholder="Chercher un pays..."
                                  className="w-full h-8 pl-7 pr-3 text-xs bg-[#F8F9FC] border border-[#E2E8F0] rounded-lg focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {filteredCountries.map(c => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => { setNationality(c); setShowNationality(false); setCountrySearch(''); }}
                                  className="w-full text-left px-3 py-2 hover:bg-[#F8F9FC] flex items-center gap-2.5 text-sm"
                                >
                                  <span className="text-base">{c.flag}</span>
                                  <span className="text-gray-700">{c.name}</span>
                                  {nationality.code === c.code && <Check size={12} className="ml-auto text-[#7C9D8E]" />}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Email + Phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field icon={Mail} value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="Email" type="email" />
                    <Field icon={Phone} value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="Téléphone" />
                  </div>

                  {/* Adults + Children */}
                  <div className="grid grid-cols-2 gap-3">
                    <Counter value={adults} onChange={setAdults} min={1} icon={Users} label="Adultes" />
                    <Counter value={children} onChange={setChildren} min={0} icon={Baby} label="Enfants" />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <label className="absolute -top-2 left-3 text-[9px] font-black text-[#1E3A5F] uppercase tracking-widest bg-white px-1 z-10">ARRIVÉE</label>
                      <input
                        type="date"
                        value={checkIn}
                        onChange={e => setCheckIn(e.target.value)}
                        className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-4 focus:outline-none focus:border-[#7C9D8E] focus:ring-2 focus:ring-[#7C9D8E]/20 focus:bg-white"
                      />
                    </div>
                    <div className="relative">
                      <label className="absolute -top-2 left-3 text-[9px] font-black text-[#1E3A5F] uppercase tracking-widest bg-white px-1 z-10">DÉPART</label>
                      <input
                        type="date"
                        value={checkOut}
                        min={checkIn}
                        onChange={e => setCheckOut(e.target.value)}
                        className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-4 focus:outline-none focus:border-[#7C9D8E] focus:ring-2 focus:ring-[#7C9D8E]/20 focus:bg-white"
                      />
                    </div>
                  </div>
                  {nights > 0 && (
                    <p className="text-xs text-[#7C9D8E] font-bold -mt-1 ml-1">✓ {nights} nuit{nights > 1 ? 's' : ''}</p>
                  )}

                  {/* Ref + Type + Numéro */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl flex items-center gap-2 px-3">
                      <Hash size={13} className="text-gray-400 shrink-0" />
                      <span className="text-sm font-mono text-[#1E3A5F] font-bold truncate">{reference}</span>
                    </div>
                    <div className="relative">
                      <select
                        value={roomType}
                        onChange={e => setRoomType(e.target.value)}
                        className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-3 appearance-none focus:outline-none focus:border-[#7C9D8E] text-gray-600"
                      >
                        <option value="">Type Chambre</option>
                        {['SGL', 'DBL', 'TWN', 'STE', 'FAM'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-4 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={roomNumber}
                        onChange={e => {
                          setRoomNumber(e.target.value);
                          const r = availableRooms.find(r => r.number === e.target.value);
                          if (r) setRoomId(r.id);
                        }}
                        className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-3 appearance-none focus:outline-none focus:border-[#7C9D8E] text-gray-600"
                      >
                        <option value="">Numéro</option>
                        {availableRooms
                          .filter(r => !roomType || r.type === roomType)
                          .map(r => <option key={r.id} value={r.number}>Ch. {r.number} ({r.type})</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Arrangement + Plan tarifaire */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <select className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-3 appearance-none focus:outline-none focus:border-[#7C9D8E] text-gray-600">
                        <option>Room Only</option>
                        <option>Petit-déjeuner</option>
                        <option>Demi-pension</option>
                        <option>Pension complète</option>
                        <option>All Inclusive</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-4 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={ratePlan}
                        onChange={e => setRatePlan(e.target.value)}
                        className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-3 appearance-none focus:outline-none focus:border-[#7C9D8E] text-gray-600"
                      >
                        {RATE_PLANS.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-4 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={source}
                        onChange={e => setSource(e.target.value)}
                        className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-3 appearance-none focus:outline-none focus:border-[#7C9D8E] text-gray-600"
                      >
                        {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-4 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={segment}
                        onChange={e => setSegment(e.target.value)}
                        className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-3 appearance-none focus:outline-none focus:border-[#7C9D8E] text-gray-600"
                      >
                        {SEGMENTS.map(s => <option key={s}>{s}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="space-y-4">
                  {/* Price summary */}
                  <div className="bg-[#F8F9FC] border border-[#E2E8F0] rounded-2xl p-5 space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-[#1E3A5F]">{pricePerNight.toFixed(2).replace('.', ',')}€</span>
                      <span className="text-xs text-[#7C9D8E] font-bold">PRIX / NUIT</span>
                      <span className="ml-auto text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                        ✓ {nights} nuit{nights > 1 ? 's' : ''} · {adults + children} pers.
                      </span>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">HT</span>
                        <span className="text-gray-700">{subtotalHT.toFixed(2)}€</span>
                        <span className="text-gray-400">TVA 10%</span>
                        <span className="text-gray-700">{tva.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Taxe séjour</span>
                        <span className="text-gray-700">{taxeSejour.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-[#E2E8F0]">
                        <span className="font-black text-[#1E3A5F]">Total TTC</span>
                        <span className="text-xl font-black text-[#1E3A5F]">{totalTTC.toFixed(2).replace('.', ',')}€</span>
                      </div>
                    </div>
                  </div>

                  {/* Deposit type */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '30', label: 'Acompte 30%' },
                      { id: '50', label: 'Acompte 50%' },
                      { id: '100', label: 'Totalité 100%' },
                    ].map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDepositType(d.id as any)}
                        className={cn(
                          'h-9 rounded-xl text-xs font-bold border-2 transition-all',
                          depositType === d.id
                            ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                            : 'border-[#E2E8F0] bg-white text-gray-500 hover:border-gray-300',
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  {/* Payment method icons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {['💳', '🏦', '💵', '📧', '💰'].map((icon, i) => (
                      <div key={i} className="w-9 h-9 rounded-xl bg-[#F8F9FC] border border-[#E2E8F0] flex items-center justify-center text-sm cursor-pointer hover:border-[#7C9D8E] transition-all">
                        {icon}
                      </div>
                    ))}
                    {['P', 'AX', 'DC', 'JCB'].map((label, i) => (
                      <div key={i} className="h-9 px-2 rounded-xl bg-[#F8F9FC] border border-[#E2E8F0] flex items-center justify-center text-[10px] font-black text-gray-500 cursor-pointer hover:border-[#7C9D8E] transition-all">
                        {label}
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-amber-600">En attente</span>
                    </div>
                  </div>

                  {/* Stripe button */}
                  <button
                    type="button"
                    className="w-full h-11 bg-[#635BFF] hover:bg-[#5750e8] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-[#635BFF]/20"
                  >
                    <span className="text-lg">S</span>
                    Générer le lien de paiement
                    <span className="ml-auto text-xs opacity-70">{depositAmount.toFixed(0)}€</span>
                  </button>

                  {/* Preauthorization */}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      onClick={() => setPreauthorization(!preauthorization)}
                      className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all', preauthorization ? 'bg-[#1E3A5F] border-[#1E3A5F]' : 'border-gray-300')}
                    >
                      {preauthorization && <Check size={10} className="text-white" />}
                    </div>
                    <Shield size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-500 font-medium">Préautorisation : 1ère nuitée</span>
                  </label>

                  {/* Notes */}
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notes, demandes spéciales..."
                    rows={3}
                    className="w-full bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-4 py-3 resize-none focus:outline-none focus:border-[#7C9D8E] focus:ring-2 focus:ring-[#7C9D8E]/20 focus:bg-white placeholder:text-gray-400"
                  />

                  {/* File drop zone */}
                  <div
                    ref={dropRef}
                    onDragOver={e => { e.preventDefault(); setIsDraggingFile(true); }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={handleFilesDrop}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer',
                      isDraggingFile ? 'border-[#7C9D8E] bg-[#7C9D8E]/5' : 'border-[#E2E8F0] hover:border-[#7C9D8E]/50',
                    )}
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    <input id="file-input" type="file" multiple hidden onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                    <Upload size={18} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 font-medium">Glissez vos fichiers ici</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">PDF · Image · HTML</p>
                    <button type="button" className="mt-2 px-3 py-1 bg-white border border-[#E2E8F0] rounded-lg text-xs text-gray-500 hover:border-[#7C9D8E] transition-all">
                      Parcourir
                    </button>
                  </div>
                  {files.length > 0 && (
                    <div className="space-y-1">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-[#F8F9FC] rounded-lg px-3 py-2">
                          <FileText size={12} className="text-[#7C9D8E]" />
                          <span className="flex-1 truncate">{f.name}</span>
                          <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                            <X size={12} className="text-gray-400 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Segment selector */}
              <div className="relative">
                <select
                  value={segment}
                  onChange={e => setSegment(e.target.value)}
                  className="w-full h-11 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-sm px-4 appearance-none focus:outline-none focus:border-[#7C9D8E] text-gray-600"
                >
                  {SEGMENTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-4 top-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-7 py-4 border-t border-[#E2E8F0] flex items-center gap-4 bg-white shrink-0">
            {/* Left icons */}
            <div className="flex items-center gap-3">
              <button type="button" className="w-9 h-9 rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] flex items-center justify-center text-red-400 hover:border-red-200 hover:bg-red-50 transition-all">
                <FileText size={15} />
              </button>
              <button type="button" className="w-9 h-9 rounded-xl border border-[#E2E8F0] bg-[#F8F9FC] flex items-center justify-center text-[#7C9D8E] hover:border-[#7C9D8E] hover:bg-[#7C9D8E]/5 transition-all">
                <Zap size={15} />
              </button>
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setSendConfirmation(!sendConfirmation)}
                  className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all', sendConfirmation ? 'bg-[#1E3A5F] border-[#1E3A5F]' : 'border-gray-300')}
                >
                  {sendConfirmation && <Check size={10} className="text-white" />}
                </div>
                <span className="text-xs text-gray-500 font-medium">Envoyer confirmation</span>
              </label>
            </div>

            <div className="flex-1" />

            <button type="button" onClick={onClose} className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 font-bold transition-colors">
              <X size={14} /> Annuler
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !guestName || !checkIn || !checkOut}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#1E3A5F] hover:bg-[#2d5a8e] disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#1E3A5F]/20"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Enregistrer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
