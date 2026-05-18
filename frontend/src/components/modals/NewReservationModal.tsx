/**
 * FLOWTYM — NewReservationModal v3
 * 100% fidèle à la maquette + toutes les fonctionnalités demandées
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, User, Mail, Phone, Users, ChevronDown, Hash, Search,
  Check, Loader2, Upload, FileText, Link2, Lock, Send,
  Clock, Circle, CheckCircle2, Baby,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { WORLD_COUNTRIES, OTA_SOURCES } from '@/src/data/reservationData';
import { useRateCalendarStore } from '../rms/store/rateCalendarStore';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROOM_TYPES   = ['Single', 'Double', 'Twin', 'Suite', 'Familiale', 'Junior Suite', 'Duplex'];
const ARRANGEMENTS = ['Room Only', 'Petit-déjeuner', 'Demi-pension', 'Pension complète', 'All Inclusive'];
const RATE_PLANS   = ['Flexible (72h)', 'Rack', 'Non remboursable', 'Corporate', 'Promo', 'Longue durée'];
const SEGMENTS     = ['Loisir', 'Affaires', 'Groupe', 'VIP', 'Corporate', 'OTA', 'Famille', 'Événement'];
const TAXE_SEJOUR  = 5.0;
const TVA          = 0.10;
const SAVE_TIMEOUT_MS = 15_000;

// Icônes de garantie identiques à la maquette
const GUARANTEE_ICONS = [
  { id: 'cash',     icon: '⊘',   title: 'Espèces' },
  { id: 'card',     icon: '▭',   title: 'Carte bancaire' },
  { id: 'check',    icon: '⊟',   title: 'Chèque' },
  { id: 'transfer', icon: '⊡',   title: 'Virement' },
  { id: 'invoice',  icon: '📄',  title: 'Facture' },
  { id: 'paypal',   icon: 'P',   title: 'PayPal' },
  { id: 'amex',     icon: 'AX',  title: 'Amex' },
  { id: 'diners',   icon: 'DC',  title: 'Diners' },
  { id: 'jcb',      icon: 'JCB', title: 'JCB' },
  { id: 'account',  icon: '👤',  title: 'Compte débiteur' },
];

// ─── Helper input ─────────────────────────────────────────────────────────────
const FInput = ({ icon: Icon, className = '', ...props }: any) => (
  <div className={cn('relative', className)}>
    {Icon && <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none z-10" />}
    <input {...props} className={cn(
      'w-full h-9 bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[12.5px] text-gray-700 placeholder:text-gray-400',
      'focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all',
      Icon ? 'pl-8 pr-3' : 'px-3',
    )} />
  </div>
);

// ─── Helper select ────────────────────────────────────────────────────────────
const FSelect = ({ leftIcon, children, className = '', ...props }: any) => (
  <div className={cn('relative', className)}>
    {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-[12px] text-violet-400 leading-none">{leftIcon}</span>}
    <select {...props} className={cn(
      'w-full h-9 bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[12.5px] text-gray-600 appearance-none',
      'focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all',
      leftIcon ? 'pl-8 pr-7' : 'px-3 pr-7',
    )}>
      {children}
    </select>
    <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none" />
  </div>
);

// ─── Room selection type ──────────────────────────────────────────────────────
interface RoomSel { type: string; qty: number; numbers: string[] }

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  prefill?: { roomId?: string; roomNumber?: string; checkIn?: string; checkOut?: string };
  onSave: (data: any) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function NewReservationModal({ isOpen, onClose, prefill, onSave }: Props) {

  const [status,        setStatus]       = useState<'option'|'pending'|'confirmed'>('confirmed');
  const [guestName,     setGuestName]    = useState('');
  const [email,         setEmail]        = useState('');
  const [phone,         setPhone]        = useState('');
  const [country,       setCountry]      = useState(WORLD_COUNTRIES.find(c => c.code === 'FR')!);
  const [adults,        setAdults]       = useState(2);
  const [children,      setChildren]     = useState(0);
  const [source,        setSource]       = useState('DIRECT');
  // Date par défaut = aujourd'hui (ou hier si 0h-6h = réservation dernière minute)
  const getDefaultCheckIn = () => {
    const now = new Date();
    const h = now.getHours();
    const d = h < 6 ? new Date(now.getTime() - 86_400_000) : now;
    return d.toISOString().split('T')[0];
  };
  const [checkIn,       setCheckIn]      = useState(getDefaultCheckIn);
  const getDefaultCheckOut = () => {
    const now = new Date();
    const h = now.getHours();
    const base = h < 6 ? new Date(now.getTime() - 86_400_000) : now;
    const next = new Date(base.getTime() + 86_400_000);
    return next.toISOString().split('T')[0];
  };
  const [checkOut,      setCheckOut]     = useState(getDefaultCheckOut);
  const [roomSels,      setRoomSels]     = useState<RoomSel[]>([]);
  const [arrangement,   setArrangement]  = useState('Room Only');
  const [ratePlan,      setRatePlan]     = useState('Flexible (72h)');
  const [planTarifaire, setPlanTarifaire]= useState('');
  const [segment,       setSegment]      = useState('Loisir');
  const [refType,       setRefType]      = useState<'flowtym'|'partner'>('flowtym');
  const [partnerRef,    setPartnerRef]   = useState('');
  const [deposit,       setDeposit]      = useState<'30'|'50'|'100'>('30');
  const [payMethod,     setPayMethod]    = useState<'stripe'|'paypal'>('stripe');
  const [guarantees,    setGuarantees]   = useState<string[]>(['card']);
  const [preauth,       setPreauth]      = useState(false);
  const [notes,         setNotes]        = useState('');
  const [files,         setFiles]        = useState<File[]>([]);
  const [dragging,      setDragging]     = useState(false);
  const [sendConfirm,   setSendConfirm]  = useState(true);
  const [saving,        setSaving]       = useState(false);
  const [saveError,     setSaveError]    = useState<string | null>(null);
  const [saveTimedOut,  setSaveTimedOut] = useState(false);
  const [linkDone,      setLinkDone]     = useState(false);

  const [suggestions,   setSuggestions]  = useState<any[]>([]);
  const [showSugg,      setShowSugg]     = useState(false);
  const [showCountry,   setShowCountry]  = useState(false);
  const [countryQ,      setCountryQ]     = useState('');
  const [rooms,         setRooms]        = useState<any[]>([]);

  const flowtymRef  = useRef(`RES-${Math.floor(1000 + Math.random() * 9000)}`);
  const countryRef  = useRef<HTMLInputElement>(null);
  const saveAttemptRef = useRef(0);
  const totalRooms  = roomSels.reduce((s, r) => s + r.qty, 0);

  // Sync prefill
  useEffect(() => {
    saveAttemptRef.current += 1;
    if (!isOpen) return;
    setSaving(false);
    setSaveError(null);
    setSaveTimedOut(false);
    if (prefill?.checkIn)    setCheckIn(prefill.checkIn);
    if (prefill?.checkOut)   setCheckOut(prefill.checkOut);
    if (prefill?.roomNumber) setRoomSels([{ type: '', qty: 1, numbers: [prefill.roomNumber] }]);
  }, [isOpen, prefill]);

  // Load rooms
  useEffect(() => {
    if (!checkIn || !checkOut) return;
    supabase.from('rooms').select('id,number,type,base_price,floor').eq('active', true).order('number')
      .then(({ data }) => setRooms(data ?? []));
  }, [checkIn, checkOut]);

  // Guest autocomplete
  useEffect(() => {
    if (guestName.length < 3) { setSuggestions([]); setShowSugg(false); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('guests')
        .select('id,first_name,last_name,email,phone,nationality')
        .or(`first_name.ilike.%${guestName}%,last_name.ilike.%${guestName}%`)
        .limit(6);
      setSuggestions(data ?? []);
      setShowSugg((data?.length ?? 0) > 0);
    }, 300);
    return () => clearTimeout(t);
  }, [guestName]);

  const pickGuest = (g: any) => {
    setGuestName(`${g.first_name} ${g.last_name}`);
    setEmail(g.email ?? ''); setPhone(g.phone ?? '');
    const c = WORLD_COUNTRIES.find(c => c.code === g.nationality);
    if (c) setCountry(c);
    setShowSugg(false);
  };

  const countryKeyDown = (e: React.KeyboardEvent) => {
    const list = WORLD_COUNTRIES.filter(c => c.name.toLowerCase().includes(countryQ.toLowerCase()));
    if (e.key === 'Enter' && list.length) { setCountry(list[0]); setShowCountry(false); setCountryQ(''); }
    if (e.key === 'Escape') { setShowCountry(false); setCountryQ(''); }
  };

  const filteredC = WORLD_COUNTRIES.filter(c =>
    countryQ === '' || c.name.toLowerCase().includes(countryQ.toLowerCase())
  );

  // Room selection helpers
  const addType = (type: string) => {
    setRoomSels(prev => {
      const ex = prev.find(r => r.type === type);
      if (ex) return prev.map(r => r.type === type ? { ...r, qty: r.qty + 1 } : r);
      return [...prev, { type, qty: 1, numbers: [] }];
    });
  };
  const removeType = (type: string) => {
    setRoomSels(prev => {
      const ex = prev.find(r => r.type === type);
      if (!ex) return prev;
      if (ex.qty <= 1) return prev.filter(r => r.type !== type);
      return prev.map(r => r.type === type ? { ...r, qty: r.qty - 1 } : r);
    });
  };
  const assignNum = (type: string, num: string, idx: number) => {
    setRoomSels(prev => prev.map(r => {
      if (r.type !== type) return r;
      const ns = [...r.numbers]; ns[idx] = num; return { ...r, numbers: ns };
    }));
  };

  // ─── Tarifs depuis le calendrier RMS ─────────────────────────────────────
  const { roomTypes, loadData: loadCalendar } = useRateCalendarStore();

  // Charger le calendrier si besoin
  useEffect(() => {
    if (roomTypes.length === 0) loadCalendar();
  }, []);

  // Récupérer le prix depuis le calendrier tarifaire pour une chambre et une date
  const getPriceFromCalendar = useCallback((roomTypeCode: string, date: string, planCode?: string): number => {
    const roomType = roomTypes.find(r =>
      r.roomTypeCode === roomTypeCode ||
      r.roomTypeName?.toLowerCase().includes(roomTypeCode.toLowerCase())
    );
    if (!roomType) return 0;

    const plan = planCode
      ? roomType.ratePlans.find(p => p.planCode === planCode || p.planName === planCode)
      : roomType.ratePlans.find(p => p.isReference) ?? roomType.ratePlans[0];

    if (!plan) return 0;
    const cell = plan.prices.find(p => p.date === date);
    return cell?.price ?? 0;
  }, [roomTypes]);

  // Calcul prix total depuis le calendrier tarifaire, nuit par nuit
  const computeTotalFromCalendar = useCallback((): number => {
    if (!checkIn || !checkOut || roomSels.length === 0) return 0;

    let total = 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const currentDate = new Date(start);

    while (currentDate < end) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      for (const sel of roomSels) {
        const price = getPriceFromCalendar(sel.type, dateStr, ratePlan !== '' ? ratePlan : undefined);
        // Si pas de prix dans calendrier, fallback sur base_price de la room
        if (price > 0) {
          total += price * sel.qty;
        } else {
          // Fallback: chercher dans rooms
          const roomForType = rooms.find(r => r.type === sel.type);
          total += (roomForType?.base_price ?? 0) * sel.qty;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return total;
  }, [checkIn, checkOut, roomSels, ratePlan, getPriceFromCalendar, rooms]);

  // Pricing
  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)) : 1;
  const firstNum = roomSels[0]?.numbers[0];
  const firstRoom = rooms.find(r => r.number === firstNum);

  // ✅ Priorité 1: Prix depuis calendrier tarifaire RMS
  // ✅ Priorité 2: base_price de la chambre (fallback)
  const calendarTotal = computeTotalFromCalendar();
  const prixNuit = calendarTotal > 0
    ? calendarTotal / Math.max(nights, 1)
    : (firstRoom?.base_price ?? 0) * Math.max(totalRooms, 1);
  const ht   = parseFloat((prixNuit * nights).toFixed(2));
  const tva  = parseFloat((ht * TVA).toFixed(2));
  const taxe = parseFloat((TAXE_SEJOUR * adults * nights).toFixed(2));
  const ttc  = parseFloat((ht + tva + taxe).toFixed(2));
  const guaranteeAmt = ratePlan === 'Non remboursable' ? ttc : prixNuit;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveTimedOut(false);
    let timedOut = false;
    const attemptId = ++saveAttemptRef.current;
    const timeoutId = setTimeout(() => {
      if (saveAttemptRef.current !== attemptId) return;
      timedOut = true;
      setSaving(false);
      setSaveTimedOut(true);
      setSaveError(
        'Enregistrement toujours en cours côté serveur. Patientez : le bouton est bloqué pour éviter un doublon.',
      );
    }, SAVE_TIMEOUT_MS);

    try {
      const allNums = roomSels.flatMap(r => r.numbers).filter(Boolean);
      const allIds  = allNums.map(n => rooms.find(r => r.number === n)?.id).filter(Boolean);
      await onSave({
        status, guestName, email, phone, nationality: country.code,
        adults, children, source, checkIn, checkOut, nights,
        roomSelections: roomSels, roomNumbers: allNums, roomIds: allIds,
        arrangement, ratePlan, segment, planTarifaire,
        reference: refType === 'flowtym' ? flowtymRef.current : partnerRef,
        partnerRef: partnerRef || null,
        notes, totalTTC: ttc, sendConfirm,
        guarantee: { types: guarantees, amount: guaranteeAmt, preauth },
      });
      clearTimeout(timeoutId);
      if (saveAttemptRef.current !== attemptId) return;
      onClose();
    } catch (err) {
      clearTimeout(timeoutId);
      if (saveAttemptRef.current !== attemptId) return;
      setSaveTimedOut(false);
      setSaveError(err instanceof Error ? err.message : 'Impossible d’enregistrer la réservation.');
    } finally {
      if (!timedOut && saveAttemptRef.current === attemptId) setSaving(false);
    }
  };

  const genLink = () => { setLinkDone(true); setTimeout(() => setLinkDone(false), 3000); };

  if (!isOpen) return null;

  // Min date pour les calendriers (hier si 0h-6h, sinon aujourd'hui)
  const _now = new Date();
  const minDate = (_now.getHours() < 6
    ? new Date(_now.getTime() - 86_400_000)
    : _now
  ).toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white w-full max-w-[860px] rounded-[20px] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-violet-600 px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-[16px] font-bold text-white">Nouvelle réservation</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all">
            <X size={14} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* STATUT */}
          <div>
            <p className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-widest mb-2">STATUT DE LA RÉSERVATION</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'option', label: 'Option (Hold)', I: Clock },
                { id: 'pending', label: 'Pending', I: Circle },
                { id: 'confirmed', label: 'Confirmée', I: CheckCircle2 },
              ] as const).map(({ id, label, I }) => (
                <button key={id} type="button" onClick={() => setStatus(id)}
                  className={cn('h-9 rounded-xl border text-[12.5px] font-medium flex items-center justify-center gap-1.5 transition-all',
                    status === id && id === 'confirmed' ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
                      : status === id ? 'border-violet-400 bg-violet-50 text-violet-600'
                      : 'border-[#EDE9FE] bg-[#F5F3FF] text-gray-400 hover:border-violet-300')}>
                  <I size={13} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* NOM + NATIONALITÉ */}
          <div className="grid grid-cols-[1fr_200px] gap-2">
            <div className="relative">
              <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300 z-10 pointer-events-none" />
              <input value={guestName} onChange={e => setGuestName(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                placeholder="Nom Complet *" tabIndex={1}
                className="w-full h-9 bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[12.5px] text-gray-700 pl-8 pr-3 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
              <AnimatePresence>
                {showSugg && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute top-10 left-0 right-0 bg-white border border-[#EDE9FE] rounded-xl shadow-xl z-50 overflow-hidden">
                    {suggestions.map(g => (
                      <button key={g.id} type="button" onMouseDown={() => pickGuest(g)}
                        className="w-full text-left px-3 py-2 hover:bg-violet-50 flex items-center gap-2.5 border-b border-gray-50 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-[11px] font-bold text-violet-600 shrink-0">
                          {g.first_name?.[0]}{g.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-[12.5px] font-semibold text-gray-800">{g.first_name} {g.last_name}</p>
                          <p className="text-[11px] text-gray-400">{g.email}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative">
              <button type="button" tabIndex={2}
                onClick={() => { setShowCountry(!showCountry); setTimeout(() => countryRef.current?.focus(), 50); }}
                className="w-full h-9 bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[12.5px] px-3 flex items-center gap-2 hover:border-violet-300 transition-all">
                <img src={`https://flagcdn.com/24x18/${country.code.toLowerCase()}.png`} alt={country.name} className="w-6 h-4 object-cover rounded-sm shrink-0" />
                <span className="flex-1 text-left text-gray-600 truncate">{country.name}</span>
                <ChevronDown size={11} className="text-violet-300 shrink-0" />
              </button>
              <AnimatePresence>
                {showCountry && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute top-10 right-0 w-64 bg-white border border-[#EDE9FE] rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-gray-50">
                      <div className="relative">
                        <Search size={11} className="absolute left-2.5 top-2.5 text-gray-400" />
                        <input ref={countryRef} value={countryQ} onChange={e => setCountryQ(e.target.value)}
                          onKeyDown={countryKeyDown} placeholder="Chercher un pays..."
                          className="w-full h-8 pl-7 pr-3 text-[12px] bg-[#F5F3FF] border border-[#EDE9FE] rounded-lg focus:outline-none" />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredC.map(c => (
                        <button key={c.code} type="button"
                          onMouseDown={() => { setCountry(c); setShowCountry(false); setCountryQ(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-violet-50 flex items-center gap-2 text-[12.5px]">
                          <img src={`https://flagcdn.com/24x18/${c.code.toLowerCase()}.png`} alt={c.name} className="w-6 h-4 object-cover rounded-sm shrink-0" />
                          <span className="text-gray-700">{c.name}</span>
                          {country.code === c.code && <Check size={11} className="ml-auto text-violet-500" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* EMAIL + TÉLÉPHONE */}
          <div className="grid grid-cols-2 gap-2">
            <FInput icon={Mail} value={email} onChange={(e:any)=>setEmail(e.target.value)} placeholder="Email" type="email" tabIndex={3} />
            <FInput icon={Phone} value={phone} onChange={(e:any)=>setPhone(e.target.value)} placeholder="Téléphone" tabIndex={4} />
          </div>

          {/* ADULTES + ENFANTS + SOURCE */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Adultes', val: adults, set: setAdults, min: 1, I: Users, t: 5 },
              { label: 'Enfants', val: children, set: setChildren, min: 0, I: Baby, t: 7 },
            ].map(({ label, val, set, min, I, t }) => (
              <div key={label} className="h-9 bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl flex items-center px-3 gap-2">
                <I size={13} className="text-violet-300 shrink-0" />
                <span className="text-[13px] font-bold text-violet-500 w-4">{val}</span>
                <span className="text-[12px] text-gray-400 flex-1">{label}</span>
                <div className="flex gap-1">
                  <button type="button" tabIndex={t} onClick={() => set(Math.max(min, val - 1))}
                    className="w-6 h-6 rounded-lg bg-white border border-[#EDE9FE] flex items-center justify-center text-violet-400 hover:border-violet-400 text-sm font-bold transition-all">−</button>
                  <button type="button" tabIndex={t+1} onClick={() => set(val + 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-[#EDE9FE] flex items-center justify-center text-violet-400 hover:border-violet-400 text-sm font-bold transition-all">+</button>
                </div>
              </div>
            ))}
            <FSelect leftIcon="🌐" value={source} onChange={(e:any)=>setSource(e.target.value)} tabIndex={9}>
              {OTA_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </FSelect>
          </div>

          {/* DATES */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { lbl: 'ARRIVÉE', val: checkIn,  set: setCheckIn,  min: minDate, t: 10 },
              { lbl: 'DÉPART',  val: checkOut, set: setCheckOut, min: checkIn || minDate, t: 11 },
            ].map(({ lbl, val, set, min, t }) => (
              <div key={lbl} className="relative">
                <span className="absolute -top-2 left-3 z-10 bg-white px-1 text-[9px] font-bold text-violet-500 uppercase tracking-widest leading-none">{lbl}</span>
                <input type="date" value={val} min={min} onChange={e => set(e.target.value)} tabIndex={t}
                  className="w-full h-9 bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[12.5px] text-gray-600 px-3 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
              </div>
            ))}
          </div>

          {/* RÉF + TYPE CHAMBRE + NUMÉROS */}
          <div className="grid grid-cols-3 gap-2">
            {/* Référence */}
            <div>
              <div className="flex items-center gap-1 mb-1 h-5">
                {(['flowtym', 'partner'] as const).map((t, i) => (
                  <React.Fragment key={t}>
                    <button type="button" onClick={() => setRefType(t)}
                      className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-all',
                        refType === t ? 'bg-violet-100 text-violet-600' : 'text-gray-400 hover:text-gray-600')}>
                      {t === 'flowtym' ? 'Flowtym' : 'Partenaire'}
                    </button>
                    {i === 0 && <span className="text-gray-300 text-[10px]">|</span>}
                  </React.Fragment>
                ))}
              </div>
              {refType === 'flowtym' ? (
                <div className="h-9 bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl flex items-center gap-2 px-3">
                  <span className="text-[11px]">🏷</span>
                  <span className="text-[12.5px] font-semibold text-violet-600 truncate">{flowtymRef.current}</span>
                </div>
              ) : (
                <FInput value={partnerRef} onChange={(e:any)=>setPartnerRef(e.target.value)} placeholder="Réf. partenaire" tabIndex={12} />
              )}
            </div>

            {/* Type chambre */}
            <div>
              <div className="flex items-center gap-1 mb-1 h-5">
                <span className="text-[10px] text-gray-400">Type chambre</span>
                {totalRooms > 0 && (
                  <span className="bg-violet-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{totalRooms}</span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-violet-400 z-10 pointer-events-none">≋</span>
                <select onChange={e => { if (e.target.value) { addType(e.target.value); e.target.value = ''; } }} tabIndex={13}
                  className="w-full h-9 bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[12.5px] text-gray-500 pl-7 pr-7 appearance-none focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all">
                  <option value="">Ajouter type…</option>
                  {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none" />
              </div>
              {roomSels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {roomSels.map(r => (
                    <div key={r.type} className="flex items-center gap-1 bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                      {r.type} ×{r.qty}
                      <button type="button" onClick={() => removeType(r.type)} className="hover:text-red-500 transition-colors"><X size={9} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Numéros */}
            <div>
              <p className="text-[10px] text-gray-400 mb-1 h-5 flex items-center">Numéros</p>
              {roomSels.length === 0 ? (
                <div className="h-9 bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl flex items-center px-3 gap-2">
                  <Hash size={13} className="text-violet-300" />
                  <span className="text-[12px] text-gray-400">Numéro</span>
                  <ChevronDown size={11} className="ml-auto text-violet-300" />
                </div>
              ) : (
                <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                  {roomSels.flatMap((sel, si) =>
                    Array.from({ length: sel.qty }, (_, qi) => (
                      <div key={`${si}-${qi}`} className="relative">
                        <Hash size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none z-10" />
                        <select value={sel.numbers[qi] ?? ''} onChange={e => assignNum(sel.type, e.target.value, qi)}
                          className="w-full h-8 bg-[#F5F3FF] border border-[#EDE9FE] rounded-lg text-[11.5px] text-gray-600 pl-7 pr-6 appearance-none focus:outline-none focus:border-violet-400 transition-all">
                          <option value="">Ch. ({sel.type})</option>
                          {rooms.filter(r => !sel.type || r.type === sel.type).map(r =>
                            <option key={r.id} value={r.number}>Ch. {r.number} · Ét.{r.floor}</option>
                          )}
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-violet-300 pointer-events-none" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ARRANGEMENT + PLAN TARIFAIRE */}
          <div className="grid grid-cols-3 gap-2">
            <FSelect leftIcon="☕" value={arrangement} onChange={(e:any)=>setArrangement(e.target.value)} tabIndex={14}>
              {ARRANGEMENTS.map(a => <option key={a}>{a}</option>)}
            </FSelect>
            <FSelect leftIcon="🛡" value={ratePlan} onChange={(e:any)=>setRatePlan(e.target.value)} tabIndex={15}>
              {RATE_PLANS.map(p => <option key={p}>{p}</option>)}
            </FSelect>
            <FSelect leftIcon="🏷" value={planTarifaire} onChange={(e:any)=>setPlanTarifaire(e.target.value)} tabIndex={16}>
              <option value="">Plan tarifaire</option>
              <option>Standard</option><option>Promotionnel</option><option>Contrat agence</option>
            </FSelect>
          </div>

          {/* BLOC PRIX */}
          <div className="bg-white border border-[#EDE9FE] rounded-2xl px-5 py-3.5">
            <div className="flex items-center gap-3 mb-2.5 flex-wrap">
              <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] text-violet-500">€</span>
              </div>
              <span className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-widest">PRIX / NUIT</span>
              <span className="text-[20px] font-bold text-violet-600 leading-none">{prixNuit.toFixed(2).replace('.', ',')}€</span>
              <span className="text-[11.5px] text-emerald-500 font-semibold">✓ {nights} nuit{nights > 1 ? 's' : ''} · {adults} pers.</span>
              {totalRooms > 1 && <span className="text-[11px] text-violet-500 font-bold bg-violet-50 px-2 py-0.5 rounded-lg">{totalRooms} chambres</span>}
            </div>
            <div className="space-y-1 text-[12.5px] border-t border-[#EDE9FE] pt-2.5">
              <div className="flex items-center justify-between text-gray-500">
                <span>HT</span>
                <div className="flex items-center gap-5">
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
                <span className="font-bold text-gray-800">Total TTC</span>
                <span className="text-[18px] font-bold text-violet-600">{ttc.toFixed(2).replace('.', ',')}€</span>
              </div>
            </div>
          </div>

          {/* PAIEMENT + NOTES */}
          <div className="grid grid-cols-2 gap-4">

            {/* Gauche */}
            <div className="space-y-2.5">
              {/* Acompte */}
              <div className="grid grid-cols-3 gap-1.5">
                {(['30','50','100'] as const).map(d => (
                  <button key={d} type="button" onClick={() => setDeposit(d)}
                    className={cn('h-8 rounded-xl border-2 text-[11.5px] font-semibold transition-all',
                      deposit === d ? 'border-violet-500 bg-white text-violet-600' : 'border-[#EDE9FE] bg-[#F5F3FF] text-gray-400 hover:border-violet-300')}>
                    {d === '100' ? 'Totalité 100%' : `Acompte ${d}%`}
                  </button>
                ))}
              </div>
              {/* Stripe + PayPal */}
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setPayMethod('stripe')}
                  className={cn('h-9 rounded-xl border-2 text-[12.5px] font-bold flex items-center justify-center gap-1.5 transition-all',
                    payMethod === 'stripe' ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' : 'border-[#EDE9FE] bg-[#F5F3FF] text-gray-500 hover:border-violet-400')}>
                  <span className="text-[15px] font-black">S</span>Stripe
                </button>
                <button type="button" onClick={() => setPayMethod('paypal')}
                  className={cn('h-9 rounded-xl border-2 text-[12.5px] font-bold flex items-center justify-center gap-1.5 transition-all',
                    payMethod === 'paypal' ? 'bg-[#003087] border-[#003087] text-white' : 'border-[#EDE9FE] bg-[#F5F3FF] text-gray-500 hover:border-blue-400')}>
                  <span className="italic font-black">P</span>PayPal
                </button>
              </div>
              {/* Générer lien */}
              <button type="button" onClick={genLink}
                className={cn('w-full h-10 rounded-xl font-semibold text-[12.5px] flex items-center justify-center gap-2 transition-all',
                  linkDone ? 'bg-emerald-500 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200')}>
                {linkDone ? <Check size={14} /> : <Link2 size={14} />}
                {linkDone ? 'Lien généré !' : 'Générer le lien de paiement'}
                <span className="ml-auto text-[11px] opacity-70">{guaranteeAmt.toFixed(0)}€</span>
              </button>
              {/* Icônes garantie */}
              <div className="flex items-center gap-1 flex-wrap">
                {GUARANTEE_ICONS.map(g => (
                  <button key={g.id} type="button" title={g.title} onClick={() => setGuarantees(prev => prev.includes(g.id) ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                    className={cn('h-7 min-w-[28px] px-1.5 rounded-lg border flex items-center justify-center text-[11px] font-bold transition-all',
                      guarantees.includes(g.id) ? 'border-violet-400 bg-violet-100 text-violet-600' : 'border-[#EDE9FE] bg-[#F5F3FF] text-gray-500 hover:border-violet-300')}>
                    {g.icon}
                  </button>
                ))}
              </div>
              {/* Status + montant */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-500 text-[11px] font-semibold rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />En attente
                </span>
                <span className="text-[10.5px] text-gray-400">
                  {ratePlan === 'Non remboursable' ? 'Totalité à débiter' : '1ère nuitée à préautoriser'}
                </span>
              </div>
              {/* Préautorisation */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setPreauth(!preauth)}
                  className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0',
                    preauth ? 'bg-violet-600 border-violet-600' : 'border-[#EDE9FE] bg-[#F5F3FF]')}>
                  {preauth && <Check size={9} className="text-white" />}
                </div>
                <Lock size={11} className="text-gray-400" />
                <span className="text-[12px] text-gray-500 flex-1">Préautorisation : 1ère nuitée</span>
                <div className="w-5 h-5 rounded border border-[#EDE9FE] bg-[#F5F3FF] flex items-center justify-center cursor-pointer">
                  <span className="text-[9px] text-gray-400">✎</span>
                </div>
              </label>
            </div>

            {/* Droite */}
            <div className="flex flex-col gap-2">
              <div className="relative flex-1">
                <FileText size={12} className="absolute left-3 top-3 text-violet-300 pointer-events-none z-10" />
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Notes, demandes spéciales..." rows={5} tabIndex={17}
                  className="w-full bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl text-[12.5px] text-gray-600 pl-8 pr-3 pt-2.5 pb-2.5 resize-none placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
              </div>
              <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
                onDrop={e=>{e.preventDefault();setDragging(false);setFiles(prev=>[...prev,...Array.from(e.dataTransfer.files)]);}}
                onClick={() => document.getElementById('res-files')?.click()}
                className={cn('border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all',
                  dragging ? 'border-violet-400 bg-violet-50' : 'border-[#EDE9FE] bg-[#F5F3FF] hover:border-violet-300')}>
                <input id="res-files" type="file" multiple hidden onChange={e=>setFiles(prev=>[...prev,...Array.from(e.target.files??[])])} />
                <Upload size={16} className="text-violet-300 mx-auto mb-1" />
                <p className="text-[12px] text-violet-400 font-medium">Glissez vos fichiers ici</p>
                <p className="text-[10.5px] text-gray-400">PDF · Image · HTML</p>
                <button type="button" className="mt-1.5 px-3 py-1 bg-white border border-[#EDE9FE] rounded-lg text-[11.5px] text-gray-500 hover:border-violet-400 transition-all">
                  Parcourir
                </button>
              </div>
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11.5px] text-gray-600 bg-[#F5F3FF] rounded-lg px-3 py-1">
                      <FileText size={10} className="text-violet-400 shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}><X size={10} className="text-gray-300 hover:text-red-400" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SEGMENT */}
          <FSelect leftIcon="◎" value={segment} onChange={(e:any)=>setSegment(e.target.value)} tabIndex={18}>
            {SEGMENTS.map(s => <option key={s}>{s}</option>)}
          </FSelect>

          {saveError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-600">
              {saveError}
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 border-t border-[#EDE9FE] flex items-center gap-3 bg-white shrink-0">
          <button type="button" title="Générer PDF"
            className="w-8 h-8 rounded-xl border border-[#EDE9FE] bg-[#F5F3FF] flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-all">
            <FileText size={14} className="text-red-400" />
          </button>
          <button type="button" title="Envoyer email"
            className="w-8 h-8 rounded-xl border border-[#EDE9FE] bg-[#F5F3FF] flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-all">
            <Send size={14} className="text-emerald-400" />
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setSendConfirm(!sendConfirm)}
              className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0',
                sendConfirm ? 'bg-violet-600 border-violet-600' : 'border-[#EDE9FE] bg-[#F5F3FF]')}>
              {sendConfirm && <Check size={9} className="text-white" />}
            </div>
            <span className="text-[12.5px] text-gray-500">Envoyer confirmation</span>
          </label>
          <div className="flex-1" />
          <button type="button" onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] text-gray-500 hover:text-gray-700 font-medium transition-colors">
            <X size={12} />Annuler
          </button>
          <button type="button" onClick={handleSave} tabIndex={19}
            disabled={saving || saveTimedOut || !guestName || !checkIn || !checkOut}
            className="flex items-center gap-2 px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-semibold text-[12.5px] transition-all shadow-lg shadow-violet-200">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <span>💾</span>}
            {saveTimedOut ? 'En cours...' : 'Enregistrer'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

