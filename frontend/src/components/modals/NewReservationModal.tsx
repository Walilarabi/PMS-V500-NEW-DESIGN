/**
 * FLOWTYM — NewReservationModal
 * Reproduction IDENTIQUE à la maquette + fonctionnalités intelligentes
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, User, Mail, Phone, Users, ChevronDown, Hash, Search, Check,
  Loader2, Upload, FileText, Link2, Lock, Send, Clock, Circle,
  CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';

// ─── COUNTRIES ────────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'DZ', name: 'Algérie', flag: '🇩🇿' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'AD', name: 'Andorre', flag: '🇦🇩' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'SA', name: 'Arabie Saoudite', flag: '🇸🇦' },
  { code: 'AR', name: 'Argentine', flag: '🇦🇷' },
  { code: 'AU', name: 'Australie', flag: '🇦🇺' },
  { code: 'AT', name: 'Autriche', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
  { code: 'BR', name: 'Brésil', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CN', name: 'Chine', flag: '🇨🇳' },
  { code: 'DK', name: 'Danemark', flag: '🇩🇰' },
  { code: 'EG', name: 'Égypte', flag: '🇪🇬' },
  { code: 'AE', name: 'Émirats Arabes', flag: '🇦🇪' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'FI', name: 'Finlande', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'GR', name: 'Grèce', flag: '🇬🇷' },
  { code: 'IN', name: 'Inde', flag: '🇮🇳' },
  { code: 'IE', name: 'Irlande', flag: '🇮🇪' },
  { code: 'IL', name: 'Israël', flag: '🇮🇱' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹' },
  { code: 'JP', name: 'Japon', flag: '🇯🇵' },
  { code: 'KW', name: 'Koweït', flag: '🇰🇼' },
  { code: 'LB', name: 'Liban', flag: '🇱🇧' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'MA', name: 'Maroc', flag: '🇲🇦' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'NO', name: 'Norvège', flag: '🇳🇴' },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱' },
  { code: 'PL', name: 'Pologne', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'RU', name: 'Russie', flag: '🇷🇺' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'SG', name: 'Singapour', flag: '🇸🇬' },
  { code: 'SE', name: 'Suède', flag: '🇸🇪' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
  { code: 'TN', name: 'Tunisie', flag: '🇹🇳' },
  { code: 'TR', name: 'Turquie', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
];

const ROOM_TYPES = ['Single','Double','Twin','Suite','Familiale'];
const ARRANGEMENTS = ['Room Only','Petit-déjeuner','Demi-pension','Pension complète','All Inclusive'];
const RATE_PLANS = ['Flexible (72h)','Rack','Non remboursable','Corporate','Promo'];
const SEGMENTS = ['Loisir','Affaires','Groupe','VIP','Corporate','OTA','Famille'];
const TAXE_SEJOUR = 5.00;
const TVA = 0.10;

// ─── FIELD — input lilas identique maquette ───────────────────────────────────
const F = ({ icon: Icon, ...props }: any) => (
  <div className="relative">
    {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none z-10" />}
    <input
      {...props}
      className={cn(
        'w-full h-[44px] bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[13px] text-gray-700 placeholder:text-gray-400',
        'focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all',
        Icon ? 'pl-9 pr-4' : 'px-4',
      )}
    />
  </div>
);

// ─── SELECT — select lilas identique maquette ────────────────────────────────
const S = ({ leftIcon, children, className, ...props }: any) => (
  <div className={cn('relative', className)}>
    {leftIcon && (
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-[13px] text-violet-400">
        {leftIcon}
      </span>
    )}
    <select
      {...props}
      className={cn(
        'w-full h-[44px] bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[13px] text-gray-600 appearance-none',
        'focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all',
        leftIcon ? 'pl-8 pr-8' : 'px-4 pr-8',
      )}
    >
      {children}
    </select>
    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none" />
  </div>
);

// ─── PROPS ────────────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  prefill?: { roomId?: string; roomNumber?: string; checkIn?: string; checkOut?: string };
  onSave: (data: any) => Promise<void>;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export function NewReservationModal({ isOpen, onClose, prefill, onSave }: Props) {

  const [status, setStatus] = useState<'option'|'pending'|'confirmed'>('confirmed');
  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState({ code:'FR', name:'France', flag:'🇫🇷' });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [roomType, setRoomType] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomId, setRoomId] = useState('');
  const [arrangement, setArrangement] = useState('Room Only');
  const [ratePlan, setRatePlan] = useState('Flexible (72h)');
  const [planTarifaire, setPlanTarifaire] = useState('');
  const [segment, setSegment] = useState('Loisir');
  const [deposit, setDeposit] = useState<'30'|'50'|'100'>('30');
  const [payMethod, setPayMethod] = useState<'stripe'|'paypal'>('stripe');
  const [preauth, setPreauth] = useState(false);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [draggingFile, setDraggingFile] = useState(false);
  const [sendConfirm, setSendConfirm] = useState(true);
  const [saving, setSaving] = useState(false);

  // autocomplete
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [showCountry, setShowCountry] = useState(false);
  const [countryQ, setCountryQ] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);

  const ref = useRef(`RES-${Math.floor(1000+Math.random()*9000)}`);

  // Sync prefill
  useEffect(() => {
    if (!isOpen) return;
    if (prefill?.checkIn)    setCheckIn(prefill.checkIn);
    if (prefill?.checkOut)   setCheckOut(prefill.checkOut);
    if (prefill?.roomNumber) setRoomNumber(prefill.roomNumber);
    if (prefill?.roomId)     setRoomId(prefill.roomId);
  }, [isOpen, prefill]);

  // Load rooms
  useEffect(() => {
    if (!checkIn || !checkOut) return;
    supabase.from('rooms').select('id,number,type,base_price').eq('active',true)
      .then(({ data }) => setRooms(data ?? []));
  }, [checkIn, checkOut]);

  // Guest autocomplete
  useEffect(() => {
    if (guestName.length < 3) { setSuggestions([]); setShowSugg(false); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('guests')
        .select('id,first_name,last_name,email,phone,nationality')
        .or(`first_name.ilike.%${guestName}%,last_name.ilike.%${guestName}%`)
        .limit(5);
      setSuggestions(data ?? []);
      setShowSugg((data?.length ?? 0) > 0);
    }, 300);
    return () => clearTimeout(t);
  }, [guestName]);

  const pickGuest = (g: any) => {
    setGuestName(`${g.first_name} ${g.last_name}`);
    setEmail(g.email ?? ''); setPhone(g.phone ?? '');
    const c = COUNTRIES.find(c => c.code === g.nationality);
    if (c) setCountry(c);
    setShowSugg(false);
  };

  // Pricing
  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut).getTime()-new Date(checkIn).getTime())/86400000)) : 1;
  const baseRoom = rooms.find(r => r.number === roomNumber);
  const prixNuit = baseRoom?.base_price ?? 0;
  const ht   = parseFloat((prixNuit * nights).toFixed(2));
  const tva  = parseFloat((ht * TVA).toFixed(2));
  const taxe = parseFloat((TAXE_SEJOUR * adults * nights).toFixed(2));
  const ttc  = parseFloat((ht + tva + taxe).toFixed(2));
  const depAmt = parseFloat((ttc * parseInt(deposit) / 100).toFixed(2));

  const filteredC = COUNTRIES.filter(c => c.name.toLowerCase().includes(countryQ.toLowerCase()));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ status, guestName, email, phone, nationality: country.code, adults, children,
        checkIn, checkOut, nights, roomId, roomNumber, roomType, arrangement, ratePlan, segment,
        notes, totalTTC: ttc, reference: ref.current, sendConfirm });
      onClose();
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity:0, scale:0.97, y:8 }}
        animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0 }}
        transition={{ duration:0.18 }}
        className="bg-white w-full max-w-[860px] rounded-[20px] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >

        {/* ══ HEADER ══ */}
        <div className="bg-violet-600 px-6 py-5 flex items-center justify-between shrink-0">
          <h2 className="text-[17px] font-bold text-white tracking-tight">Nouvelle réservation</h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all">
            <X size={14} />
          </button>
        </div>

        {/* ══ BODY ══ */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* STATUT */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              STATUT DE LA RÉSERVATION
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id:'option',    label:'Option (Hold)', Icon:Clock },
                { id:'pending',   label:'Pending',       Icon:Circle },
                { id:'confirmed', label:'Confirmée',     Icon:CheckCircle2 },
              ] as const).map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => setStatus(id)}
                  className={cn(
                    'h-[44px] rounded-xl border text-[13px] font-medium flex items-center justify-center gap-2 transition-all',
                    status === id && id === 'confirmed'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
                      : status === id
                      ? 'border-violet-400 bg-violet-50 text-violet-600'
                      : 'border-[#EDE9FE] bg-[#F5F3FF] text-gray-400 hover:border-violet-300',
                  )}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* NOM + PAYS */}
          <div className="grid grid-cols-[1fr_220px] gap-3">
            {/* Nom avec autocomplete */}
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none z-10" />
              <input
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                placeholder="Nom Complet *"
                className="w-full h-[44px] bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[13px] text-gray-700 pl-9 pr-4 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
              />
              <AnimatePresence>
                {showSugg && (
                  <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                    className="absolute top-[48px] left-0 right-0 bg-white border border-[#EDE9FE] rounded-xl shadow-xl z-50 overflow-hidden">
                    {suggestions.map(g => (
                      <button key={g.id} type="button" onClick={() => pickGuest(g)}
                        className="w-full text-left px-4 py-2.5 hover:bg-violet-50 flex items-center gap-3 border-b border-gray-50 last:border-0 text-[13px]">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600 shrink-0">
                          {g.first_name?.[0]}{g.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{g.first_name} {g.last_name}</p>
                          <p className="text-xs text-gray-400">{g.email}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Nationalité */}
            <div className="relative">
              <button type="button" onClick={() => setShowCountry(!showCountry)}
                className="w-full h-[44px] bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[13px] px-3 flex items-center gap-2 hover:border-violet-300 transition-all">
                <span className="text-[18px] leading-none">{country.flag}</span>
                <span className="flex-1 text-left text-gray-600 truncate">{country.name}</span>
                <ChevronDown size={12} className="text-violet-300 shrink-0" />
              </button>
              <AnimatePresence>
                {showCountry && (
                  <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                    className="absolute top-[48px] right-0 w-64 bg-white border border-[#EDE9FE] rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-gray-50">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                        <input value={countryQ} onChange={e=>setCountryQ(e.target.value)}
                          placeholder="Chercher un pays..."
                          className="w-full h-8 pl-7 pr-3 text-[12px] bg-[#F5F3FF] border border-[#EDE9FE] rounded-lg focus:outline-none" autoFocus />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredC.map(c => (
                        <button key={c.code} type="button"
                          onClick={()=>{setCountry(c);setShowCountry(false);setCountryQ('');}}
                          className="w-full text-left px-3 py-2 hover:bg-violet-50 flex items-center gap-2.5 text-[13px]">
                          <span className="text-[16px]">{c.flag}</span>
                          <span className="text-gray-700">{c.name}</span>
                          {country.code===c.code && <Check size={11} className="ml-auto text-violet-500"/>}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* EMAIL + TÉLÉPHONE */}
          <div className="grid grid-cols-2 gap-3">
            <F icon={Mail} value={email} onChange={(e:any)=>setEmail(e.target.value)} placeholder="Email" type="email" />
            <F icon={Phone} value={phone} onChange={(e:any)=>setPhone(e.target.value)} placeholder="Téléphone" />
          </div>

          {/* ADULTES + ENFANTS */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Adultes', val:adults, set:setAdults, min:1 },
              { label:'Enfants', val:children, set:setChildren, min:0 },
            ].map(({ label, val, set, min }) => (
              <div key={label} className="h-[44px] bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl flex items-center px-3 gap-2">
                <Users size={14} className="text-violet-300 shrink-0" />
                <span className="text-[14px] font-bold text-violet-500 w-5">{val}</span>
                <span className="text-[13px] text-gray-400 flex-1">{label}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={()=>set(Math.max(min,val-1))}
                    className="w-6 h-6 rounded-lg bg-white border border-[#EDE9FE] flex items-center justify-center text-violet-400 hover:border-violet-400 text-sm font-bold leading-none transition-all">−</button>
                  <button type="button" onClick={()=>set(val+1)}
                    className="w-6 h-6 rounded-lg bg-white border border-[#EDE9FE] flex items-center justify-center text-violet-400 hover:border-violet-400 text-sm font-bold leading-none transition-all">+</button>
                </div>
              </div>
            ))}
          </div>

          {/* DATES */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { lbl:'ARRIVÉE', val:checkIn, set:setCheckIn, min:'' },
              { lbl:'DÉPART',  val:checkOut, set:setCheckOut, min:checkIn },
            ].map(({ lbl, val, set, min }) => (
              <div key={lbl} className="relative pt-1">
                <span className="absolute -top-0 left-3 z-10 bg-white px-1 text-[9px] font-bold text-violet-500 uppercase tracking-widest leading-none">
                  {lbl}
                </span>
                <input type="date" value={val} min={min} onChange={e=>set(e.target.value)}
                  className="w-full h-[44px] bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[13px] text-gray-600 px-4 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
              </div>
            ))}
          </div>

          {/* RÉF + TYPE CHAMBRE + NUMÉRO */}
          <div className="grid grid-cols-3 gap-3">
            {/* Réf */}
            <div className="h-[44px] bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl flex items-center gap-2 px-3">
              <div className="w-[22px] h-[22px] rounded-md bg-violet-100 flex items-center justify-center shrink-0">
                <span className="text-[10px]">🏷</span>
              </div>
              <span className="text-[13px] font-semibold text-violet-600 truncate">{ref.current}</span>
            </div>
            {/* Type chambre */}
            <S leftIcon="≋" value={roomType} onChange={(e:any)=>setRoomType(e.target.value)}>
              <option value="">Type Chambre</option>
              {ROOM_TYPES.map(t=><option key={t}>{t}</option>)}
            </S>
            {/* Numéro */}
            <S leftIcon="#" value={roomNumber} onChange={(e:any)=>{
              setRoomNumber(e.target.value);
              const r=rooms.find(r=>r.number===e.target.value);
              if(r) setRoomId(r.id);
            }}>
              <option value="">Numéro</option>
              {rooms.filter(r=>!roomType||r.type===roomType).map(r=><option key={r.id} value={r.number}>Ch. {r.number}</option>)}
            </S>
          </div>

          {/* ARRANGEMENT + PLAN TARIFAIRE */}
          <div className="grid grid-cols-3 gap-3">
            <S leftIcon="☕" value={arrangement} onChange={(e:any)=>setArrangement(e.target.value)}>
              {ARRANGEMENTS.map(a=><option key={a}>{a}</option>)}
            </S>
            <S leftIcon="🛡" value={ratePlan} onChange={(e:any)=>setRatePlan(e.target.value)}>
              {RATE_PLANS.map(p=><option key={p}>{p}</option>)}
            </S>
            <S leftIcon="🏷" value={planTarifaire} onChange={(e:any)=>setPlanTarifaire(e.target.value)}>
              <option value="">Plan tarifaire</option>
              <option>Standard</option>
              <option>Promotionnel</option>
              <option>Contrat agence</option>
            </S>
          </div>

          {/* ═══ BLOC PRIX ═══ */}
          <div className="bg-white border border-[#EDE9FE] rounded-2xl px-5 py-4">
            {/* Prix nuit + nuits */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <span className="text-[11px] text-violet-500">€</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">PRIX / NUIT</span>
                <span className="text-[22px] font-bold text-violet-600 leading-none">
                  {prixNuit.toFixed(2).replace('.',',')}€
                </span>
                <span className="text-[12px] text-emerald-500 font-semibold">
                  ✓ {nights} nuit{nights>1?'s':''} · {adults} pers.
                </span>
              </div>
            </div>
            {/* Lignes prix */}
            <div className="space-y-1.5 text-[13px] border-t border-[#EDE9FE] pt-3">
              <div className="flex items-center justify-between text-gray-500">
                <span>HT</span>
                <div className="flex items-center gap-6">
                  <span>{ht.toFixed(2)}€</span>
                  <span>TVA 10%</span>
                  <span className="font-semibold text-gray-700">{tva.toFixed(2)}€</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-gray-500">
                <span>Taxe séjour</span>
                <span className="text-gray-700">{taxe.toFixed(2)}€</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#EDE9FE]">
                <span className="font-bold text-gray-800 text-[14px]">Total TTC</span>
                <span className="text-[20px] font-bold text-violet-600">
                  {ttc.toFixed(2).replace('.',',')}€
                </span>
              </div>
            </div>
          </div>

          {/* ═══ PAIEMENT + NOTES (2 colonnes) ═══ */}
          <div className="grid grid-cols-2 gap-5">

            {/* Gauche — paiement */}
            <div className="space-y-3">
              {/* 3 boutons acompte */}
              <div className="grid grid-cols-3 gap-2">
                {(['30','50','100'] as const).map(d => (
                  <button key={d} type="button" onClick={()=>setDeposit(d)}
                    className={cn(
                      'h-9 rounded-xl border-2 text-[12px] font-semibold transition-all',
                      deposit===d
                        ? 'border-violet-500 bg-white text-violet-600'
                        : 'border-[#EDE9FE] bg-[#F5F3FF] text-gray-400 hover:border-violet-300',
                    )}>
                    {d==='100'?'Totalité 100%':`Acompte ${d}%`}
                  </button>
                ))}
              </div>
              {/* Stripe + PayPal */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={()=>setPayMethod('stripe')}
                  className={cn(
                    'h-10 rounded-xl border-2 text-[13px] font-bold flex items-center justify-center gap-2 transition-all',
                    payMethod==='stripe'
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-[#EDE9FE] bg-[#F5F3FF] text-gray-500 hover:border-violet-400',
                  )}>
                  <span className="text-[16px] font-black">S</span> Stripe
                </button>
                <button type="button" onClick={()=>setPayMethod('paypal')}
                  className={cn(
                    'h-10 rounded-xl border-2 text-[13px] font-bold flex items-center justify-center gap-2 transition-all',
                    payMethod==='paypal'
                      ? 'bg-[#003087] border-[#003087] text-white'
                      : 'border-[#EDE9FE] bg-[#F5F3FF] text-gray-500 hover:border-blue-400',
                  )}>
                  <span className="italic font-black">P</span> PayPal
                </button>
              </div>
              {/* Générer lien */}
              <button type="button"
                className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md shadow-violet-200">
                <Link2 size={14} />
                Générer le lien de paiement
              </button>
              {/* Icônes CB */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  {label:'⊘', title:'Cash'},
                  {label:'▭', title:'CB'},
                  {label:'⊟', title:'Chèque'},
                  {label:'⊡', title:'Virement'},
                  {label:'📄', title:'Facture'},
                  {label:'P', title:'PayPal'},
                  {label:'AX', title:'Amex'},
                  {label:'DC', title:'Diners'},
                  {label:'JCB', title:'JCB'},
                  {label:'👤', title:'Compte'},
                ].map((ic,i) => (
                  <div key={i} title={ic.title}
                    className="h-8 min-w-[32px] px-1.5 rounded-lg border border-[#EDE9FE] bg-[#F5F3FF] flex items-center justify-center cursor-pointer hover:border-violet-400 transition-all text-[11px] text-gray-500 font-bold">
                    {ic.label}
                  </div>
                ))}
              </div>
              {/* En attente */}
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-500 text-[12px] font-semibold rounded-full">
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>
                  En attente
                </span>
              </div>
              {/* Préautorisation */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={()=>setPreauth(!preauth)}
                  className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0',
                    preauth ? 'bg-violet-600 border-violet-600' : 'border-[#EDE9FE] bg-[#F5F3FF]',
                  )}>
                  {preauth && <Check size={9} className="text-white"/>}
                </div>
                <Lock size={12} className="text-gray-400"/>
                <span className="text-[12px] text-gray-500">Préautorisation : 1ère nuitée</span>
                <div className="ml-auto w-5 h-5 rounded border border-[#EDE9FE] flex items-center justify-center">
                  <span className="text-[9px] text-gray-400">✎</span>
                </div>
              </label>
            </div>

            {/* Droite — notes + fichiers */}
            <div className="flex flex-col gap-3">
              {/* Notes */}
              <div className="relative flex-1">
                <FileText size={13} className="absolute left-3 top-3.5 text-violet-300 pointer-events-none z-10" />
                <textarea value={notes} onChange={e=>setNotes(e.target.value)}
                  placeholder="Notes, demandes spéciales..."
                  rows={5}
                  className="w-full bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[13px] text-gray-600 pl-8 pr-4 pt-3 pb-3 resize-none placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
              </div>
              {/* Drop zone */}
              <div
                onDragOver={e=>{e.preventDefault();setDraggingFile(true);}}
                onDragLeave={()=>setDraggingFile(false)}
                onDrop={e=>{e.preventDefault();setDraggingFile(false);setFiles(prev=>[...prev,...Array.from(e.dataTransfer.files)]);}}
                onClick={()=>document.getElementById('res-files')?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all',
                  draggingFile ? 'border-violet-400 bg-violet-50' : 'border-[#EDE9FE] bg-[#F5F3FF] hover:border-violet-300',
                )}
              >
                <input id="res-files" type="file" multiple hidden
                  onChange={e=>setFiles(prev=>[...prev,...Array.from(e.target.files??[])])} />
                <div className="flex flex-col items-center gap-1">
                  <Upload size={18} className="text-violet-300 mb-1" />
                  <p className="text-[12px] text-violet-400 font-medium">Glissez vos fichiers ici</p>
                  <p className="text-[10px] text-gray-400">PDF · Image · HTML</p>
                  <button type="button"
                    className="mt-2 px-4 py-1.5 bg-white border border-[#EDE9FE] rounded-lg text-[12px] text-gray-500 hover:border-violet-400 transition-all">
                    Parcourir
                  </button>
                </div>
              </div>
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f,i)=>(
                    <div key={i} className="flex items-center gap-2 text-[12px] text-gray-600 bg-[#F5F3FF] rounded-lg px-3 py-1.5">
                      <FileText size={11} className="text-violet-400"/>
                      <span className="flex-1 truncate">{f.name}</span>
                      <button type="button" onClick={()=>setFiles(prev=>prev.filter((_,j)=>j!==i))}>
                        <X size={11} className="text-gray-300 hover:text-red-400"/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SEGMENT pleine largeur */}
          <S leftIcon="◎" value={segment} onChange={(e:any)=>setSegment(e.target.value)}>
            {SEGMENTS.map(s=><option key={s}>{s}</option>)}
          </S>

        </div>

        {/* ══ FOOTER ══ */}
        <div className="px-6 py-4 border-t border-[#EDE9FE] flex items-center gap-3 bg-white shrink-0">
          <button type="button"
            className="w-9 h-9 rounded-xl border border-[#EDE9FE] bg-[#F5F3FF] flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-all">
            <FileText size={15} className="text-red-400"/>
          </button>
          <button type="button"
            className="w-9 h-9 rounded-xl border border-[#EDE9FE] bg-[#F5F3FF] flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-all">
            <Send size={15} className="text-emerald-400"/>
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={()=>setSendConfirm(!sendConfirm)}
              className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0',
                sendConfirm?'bg-violet-600 border-violet-600':'border-[#EDE9FE] bg-[#F5F3FF]')}>
              {sendConfirm && <Check size={9} className="text-white"/>}
            </div>
            <span className="text-[13px] text-gray-500">Envoyer confirmation</span>
          </label>
          <div className="flex-1"/>
          <button type="button" onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] text-gray-500 hover:text-gray-700 font-medium transition-colors">
            <X size={13}/> Annuler
          </button>
          <button type="button" onClick={handleSave} disabled={saving||!guestName||!checkIn||!checkOut}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-semibold text-[13px] transition-all shadow-lg shadow-violet-200">
            {saving ? <Loader2 size={13} className="animate-spin"/> : <span>💾</span>}
            Enregistrer
          </button>
        </div>

      </motion.div>
    </div>
  );
}
