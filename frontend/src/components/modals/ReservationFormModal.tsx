/**
 * FLOWTYM — ReservationFormModal
 * Formulaire complet V500 + référence partenaire + multi-chambres
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, AlertTriangle, TrendingUp, Clock, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { CHANNELS } from '@/src/constants/channels';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface RoomSelection {
  roomNumber: string;
  roomType: string;
  adults: number;
  children: number;
  price: number;         // prix/nuit de cette chambre
  ratePlanId: string;
  boardType: string;
  notes: string;
}

export interface ReservationFormData {
  // Client
  guestName: string;
  email: string;
  phone: string;
  nationality: string;
  nationalityLabel: string;
  adults: number;
  children: number;
  company: string;
  segment: string;
  // Référence & partenaire
  reference: string;
  partnerRef: string;        // ← NOUVEAU : référence partenaire / OTA / agence
  partnerName: string;       // ← NOUVEAU : nom du partenaire
  // Séjour
  checkIn: string;
  checkOut: string;
  nights: number;
  // Chambre principale (rétrocompat) + multi-chambres
  category: string;
  roomNumber: string;
  roomType: string;
  roomSelections: RoomSelection[];  // ← NOUVEAU : sélection multi-chambres
  roomIds: string[];
  roomNumbers: string[];
  // Tarification
  board: string;
  cancelPolicy: string;
  ratePlanId: string;
  vatRate: number;
  totalTTC: number;
  // Canal & paiement
  channel: string;
  paymentMode: string;
  paymentStatus: string;
  guaranteeType: string;
  guaranteeStatus: string;
  preauthRule: string;
  preauthAmount: number;
  linkType: string;
  processor: string;
  // Divers
  notes: string;
  sendConfirmation: boolean;
}

export interface AvailableRoom {
  number: string;
  type: string;
  price?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ReservationFormData) => void | Promise<void>;
  initialData?: Partial<ReservationFormData> & Record<string, unknown>;
  availableRooms?: AvailableRoom[];
  allReservations?: { id: string; room: string; arrival: string; departure: string }[];
  editId?: string | null;
  source?: 'planning' | 'today' | 'reservations';
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const ROOMS_DEFAULT: AvailableRoom[] = [
  { number: '101', type: 'Double Classique',    price: 99  },
  { number: '102', type: 'Double Classique',    price: 99  },
  { number: '103', type: 'Suite Deluxe',        price: 189 },
  { number: '104', type: 'Simple',              price: 69  },
  { number: '201', type: 'Double Supérieure',   price: 129 },
  { number: '202', type: 'Twin',                price: 115 },
  { number: '203', type: 'Suite Panoramique',   price: 249 },
  { number: '301', type: 'Familiale',           price: 185 },
  { number: '302', type: 'Junior Suite',        price: 165 },
];

const COUNTRY_DIAL: Record<string, string> = {
  FR: '+33', BE: '+32', CH: '+41', CA: '+1', US: '+1',
  GB: '+44', DE: '+49', ES: '+34', IT: '+39', PT: '+351',
  NL: '+31', LU: '+352', MA: '+212', DZ: '+213', TN: '+216',
  SA: '+966', AE: '+971', QA: '+974', CN: '+86', JP: '+81',
};

export const SEGMENTS = [
  { value: 'Loisir',   label: 'Loisir'         },
  { value: 'Business', label: 'Business'        },
  { value: 'Corpo',    label: 'Corporatif'      },
  { value: 'Groupe',   label: 'Groupe'          },
  { value: 'Agence',   label: 'Agence'          },
  { value: 'TO',       label: 'Tour Opérateur'  },
  { value: 'Famille',  label: 'Famille'         },
  { value: 'VIP',      label: 'VIP'             },
];

export const RATE_PLANS = [
  { id: 'RACK-RO', label: 'Rack — Room Only',       mult: 1.00 },
  { id: 'RACK-BB', label: 'Rack — Petit-déjeuner',  mult: 1.15 },
  { id: 'FLEX',    label: 'Flexible — Room Only',    mult: 1.00 },
  { id: 'NANR',    label: 'Non-remboursable (−10%)', mult: 0.90 },
  { id: 'EARLY',   label: 'Early Bird (−15%)',       mult: 0.85 },
  { id: 'LAST',    label: 'Last Minute (−20%)',      mult: 0.80 },
  { id: 'CORP',    label: 'Corporatif',              mult: 1.10 },
];

export const GUAR_CFG: Record<string, { color: string; bg: string; border: string; lbl: string }> = {
  pending:       { color: '#f97316', bg: '#FFF7ED', border: '#FED7AA', lbl: 'En attente'   },
  preauthorized: { color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', lbl: 'Préautorisé' },
  deposit:       { color: '#3b82f6', bg: '#EFF6FF', border: '#BFDBFE', lbl: 'Arrhes'      },
  paid:          { color: '#10b981', bg: '#ECFDF5', border: '#A7F3D0', lbl: 'Payé'        },
  refused:       { color: '#ef4444', bg: '#FEF2F2', border: '#FECACA', lbl: 'Refusé'      },
};

export interface Country { n: string; c: string; }
export const COUNTRIES: Country[] = [
  {n:'Afghanistan',c:'AF'},{n:'Afrique du Sud',c:'ZA'},{n:'Albanie',c:'AL'},
  {n:'Algérie',c:'DZ'},{n:'Allemagne',c:'DE'},{n:'Andorre',c:'AD'},
  {n:'Arabie Saoudite',c:'SA'},{n:'Argentine',c:'AR'},{n:'Australie',c:'AU'},
  {n:'Autriche',c:'AT'},{n:'Azerbaïdjan',c:'AZ'},{n:'Belgique',c:'BE'},
  {n:'Brésil',c:'BR'},{n:'Bulgarie',c:'BG'},{n:'Canada',c:'CA'},
  {n:'Chine',c:'CN'},{n:'Chypre',c:'CY'},{n:'Colombie',c:'CO'},
  {n:'Côte d\'Ivoire',c:'CI'},{n:'Croatie',c:'HR'},{n:'Danemark',c:'DK'},
  {n:'Égypte',c:'EG'},{n:'Émirats Arabes Unis',c:'AE'},{n:'Espagne',c:'ES'},
  {n:'Estonie',c:'EE'},{n:'États-Unis',c:'US'},{n:'Finlande',c:'FI'},
  {n:'France',c:'FR'},{n:'Grèce',c:'GR'},{n:'Hongrie',c:'HU'},
  {n:'Inde',c:'IN'},{n:'Indonésie',c:'ID'},{n:'Irak',c:'IQ'},
  {n:'Iran',c:'IR'},{n:'Irlande',c:'IE'},{n:'Islande',c:'IS'},
  {n:'Israël',c:'IL'},{n:'Italie',c:'IT'},{n:'Japon',c:'JP'},
  {n:'Jordanie',c:'JO'},{n:'Kazakhstan',c:'KZ'},{n:'Kenya',c:'KE'},
  {n:'Koweït',c:'KW'},{n:'Liban',c:'LB'},{n:'Luxembourg',c:'LU'},
  {n:'Malaisie',c:'MY'},{n:'Maroc',c:'MA'},{n:'Mexique',c:'MX'},
  {n:'Monaco',c:'MC'},{n:'Nigéria',c:'NG'},{n:'Norvège',c:'NO'},
  {n:'Nouvelle-Zélande',c:'NZ'},{n:'Oman',c:'OM'},{n:'Pakistan',c:'PK'},
  {n:'Pays-Bas',c:'NL'},{n:'Pérou',c:'PE'},{n:'Philippines',c:'PH'},
  {n:'Pologne',c:'PL'},{n:'Portugal',c:'PT'},{n:'Qatar',c:'QA'},
  {n:'Roumanie',c:'RO'},{n:'Royaume-Uni',c:'GB'},{n:'Russie',c:'RU'},
  {n:'Sénégal',c:'SN'},{n:'Singapour',c:'SG'},{n:'Slovaquie',c:'SK'},
  {n:'Suède',c:'SE'},{n:'Suisse',c:'CH'},{n:'Thaïlande',c:'TH'},
  {n:'Tunisie',c:'TN'},{n:'Turquie',c:'TR'},{n:'Ukraine',c:'UA'},
  {n:'Venezuela',c:'VE'},{n:'Vietnam',c:'VN'},
].sort((a, b) => a.n.localeCompare(b.n, 'fr'));

export const GUAR_ICONS: Record<string, React.ReactNode> = {
  aucune:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>,
  cb:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  virement: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="22" x2="21" y2="22"/><polygon points="12 2 20 7 4 7"/></svg>,
  especes:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>,
  cheque:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/></svg>,
  paypal:   <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/></svg>,
  debiteur: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const todayISO  = () => new Date().toISOString().split('T')[0];
const tomorrowISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; };
const fmtEur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
const uid = () => Math.random().toString(36).slice(2, 9);

// ─── SÉLECTEUR NATIONALITÉ ───────────────────────────────────────────────────
export const NatSelector: React.FC<{ code: string; label: string; onChange: (c: string, l: string) => void }> = ({ code, label, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');
  const [hl, setHl]     = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const srchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const nq = norm(q);
    return nq ? COUNTRIES.filter(c => norm(c.n).includes(nq) || c.c.toLowerCase().includes(nq)) : COUNTRIES;
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQ(''); }};
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (open) setTimeout(() => srchRef.current?.focus(), 40); }, [open]);

  const pick = (c: Country) => { onChange(c.c, c.n); setOpen(false); setQ(''); setHl(-1); };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHl(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHl(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hl >= 0 && filtered[hl]) pick(filtered[hl]); }
    else if (e.key === 'Escape') { setOpen(false); setQ(''); }
  };

  useEffect(() => { if (listRef.current && hl >= 0) (listRef.current.children[hl] as HTMLElement)?.scrollIntoView({ block: 'nearest' }); }, [hl]);

  const S: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: '#F5F3FF', border: '1.5px solid #EDE9FE', borderRadius: 16, padding: '0 16px', height: 56, cursor: 'pointer' };

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 200 }}>
      <div style={S} onClick={() => setOpen(v => !v)}>
        <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt={label} style={{ width: 26, height: 18, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: '#111827', flex: 1 }}>{label}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 9999, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.14)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input ref={srchRef} type="text" placeholder="Chercher un pays…" value={q} onChange={e => { setQ(e.target.value); setHl(-1); }} onKeyDown={onKey} style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'Inter,sans-serif', fontSize: 13, background: 'transparent', color: '#111827' }} />
          </div>
          <ul ref={listRef} style={{ maxHeight: 220, overflowY: 'auto', padding: 6, margin: 0, listStyle: 'none' }}>
            {filtered.length === 0 ? <li style={{ padding: 16, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Aucun pays trouvé</li> : filtered.map((c, i) => (
              <li key={c.c} onMouseDown={() => pick(c)} onMouseEnter={() => setHl(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, cursor: 'pointer', background: i === hl ? '#F5F3FF' : 'transparent' }}>
                <img src={`https://flagcdn.com/w40/${c.c.toLowerCase()}.png`} alt={c.n} loading="lazy" style={{ width: 28, height: 20, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: i === hl ? 600 : 500, color: i === hl ? '#7C3AED' : '#374151', flex: 1 }}>{c.n}</span>
                {c.c === code && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ─── SELECT WRAPPER ───────────────────────────────────────────────────────────
const Sel: React.FC<{ icon?: React.ReactNode; value: string; onChange: (v: string) => void; children: React.ReactNode; placeholder?: string }> = ({ icon, value, onChange, children, placeholder }) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, background: '#F5F3FF', border: '1.5px solid #EDE9FE', borderRadius: 16, padding: '0 36px 0 16px', height: 56 }}>
    {icon}
    <select value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: 500, color: value ? '#111827' : '#C4B5FD', appearance: 'none', cursor: 'pointer', minWidth: 0 }}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {children}
    </select>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2.5" style={{ position: 'absolute', right: 14, pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
  </div>
);

const Ico: React.FC<{ d: string; color?: string }> = ({ d, color = '#8B5CF6' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={{ flexShrink: 0, opacity: .75 }}><path d={d}/></svg>
);

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────
const ReservationFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, availableRooms, editId, allReservations }) => {
  const baseRooms = (availableRooms && availableRooms.length > 0) ? availableRooms : ROOMS_DEFAULT;

  const makeDefaultRoom = (): RoomSelection => ({
    roomNumber: '', roomType: '', adults: 2, children: 0,
    price: 0, ratePlanId: 'RACK-RO', boardType: 'Room Only', notes: '',
  });

  const defaultForm: ReservationFormData = {
    guestName: '', email: '', phone: '',
    nationality: 'FR', nationalityLabel: 'France',
    adults: 2, children: 0, company: '', segment: 'Loisir',
    reference: `RES-${Math.floor(Math.random() * 9000 + 1000)}`,
    partnerRef: '',    // référence partenaire / OTA
    partnerName: '',   // nom du partenaire
    checkIn: todayISO(), checkOut: tomorrowISO(), nights: 1,
    category: '', roomNumber: '', roomType: '',
    roomSelections: [makeDefaultRoom()],
    roomIds: [], roomNumbers: [],
    board: 'Room Only', cancelPolicy: 'flexible', ratePlanId: 'RACK-RO',
    vatRate: 10, totalTTC: 0,
    channel: 'Direct', paymentMode: 'Carte bancaire', paymentStatus: 'En attente',
    guaranteeType: 'cb', guaranteeStatus: 'pending',
    preauthRule: 'first_night', preauthAmount: 0,
    linkType: '30', processor: 'stripe',
    notes: '', sendConfirmation: true,
  };

  const [form, setForm]   = useState<ReservationFormData>({ ...defaultForm, ...initialData });
  const [nameErr, setNameErr] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [paOpen, setPaOpen]   = useState(false);
  const [paRuleDraft, setPaRuleDraft] = useState('first_night');
  const [reservationStatus, setReservationStatus] = useState<'option' | 'pending' | 'confirmed'>('confirmed');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof ReservationFormData>(k: K, v: ReservationFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      const sanitized: Partial<ReservationFormData> = { ...(initialData as Partial<ReservationFormData>) };
      if (sanitized.checkIn) sanitized.checkIn = String(sanitized.checkIn).split(' ')[0].split('T')[0];
      if (sanitized.checkOut) sanitized.checkOut = String(sanitized.checkOut).split(' ')[0].split('T')[0];
      if (!sanitized.roomSelections || sanitized.roomSelections.length === 0) {
        sanitized.roomSelections = [makeDefaultRoom()];
      }
      setForm({ ...defaultForm, ...sanitized });
      setNameErr(false);
      setLinkUrl('');
      setSaveError(null);
      setSaving(false);
      setReservationStatus((sanitized as any)?.reservationStatus ?? 'confirmed');
    }
  }, [isOpen]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen && !paOpen) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, paOpen, onClose]);

  // ── Chambres disponibles par dates ──
  const filteredRooms = useMemo(() => {
    if (!allReservations) return baseRooms;
    const cin = new Date(form.checkIn).getTime();
    const cout = new Date(form.checkOut).getTime();
    if (isNaN(cin) || isNaN(cout) || cin >= cout) return baseRooms;
    return baseRooms.filter(room => {
      const hasConflict = allReservations.some(res => {
        if (res.id === editId) return false;
        if (res.room !== room.number) return false;
        let rCin = new Date(res.arrival).getTime();
        let rCout = new Date(res.departure).getTime();
        const mCin = String(res.arrival).match(/^(\d{4}-\d{2}-\d{2})/);
        const mCout = String(res.departure).match(/^(\d{4}-\d{2}-\d{2})/);
        if (isNaN(rCin) && mCin) rCin = new Date(mCin[1]).getTime();
        if (isNaN(rCout) && mCout) rCout = new Date(mCout[1]).getTime();
        if (isNaN(rCin) || isNaN(rCout)) return false;
        return Math.max(cin, rCin) < Math.min(cout, rCout);
      });
      return !hasConflict;
    });
  }, [form.checkIn, form.checkOut, baseRooms, allReservations, editId]);

  // Chambres déjà sélectionnées dans d'autres lignes
  const usedRooms = (idx: number) => form.roomSelections
    .filter((_, i) => i !== idx)
    .map(r => r.roomNumber)
    .filter(Boolean);

  // ── Calculs ──
  const calc = useMemo(() => {
    const cin = new Date(form.checkIn), cout = new Date(form.checkOut);
    const nights = Math.max(0, Math.round((cout.getTime() - cin.getTime()) / 86400000));

    let totalHT = 0;
    form.roomSelections.forEach(sel => {
      const plan = RATE_PLANS.find(p => p.id === sel.ratePlanId);
      const pn = sel.price * (plan?.mult ?? 1);
      totalHT += pn * nights;
    });

    const tva  = totalHT * (form.vatRate / 100);
    const pax  = form.roomSelections.reduce((s, r) => s + r.adults + r.children, 0) || form.adults + form.children;
    const tax  = 2.5 * pax * nights;
    const ttc  = totalHT + tva + tax;

    // Prix moyen par nuit (chambre principale pour compatibilité)
    const mainRoom = baseRooms.find(r => r.number === form.roomSelections[0]?.roomNumber);
    const plan0 = RATE_PLANS.find(p => p.id === form.roomSelections[0]?.ratePlanId);
    const pn = (mainRoom?.price ?? 0) * (plan0?.mult ?? 1);

    return { nights, pn, totalHT, tva, tax, ttc };
  }, [form.checkIn, form.checkOut, form.roomSelections, form.vatRate, form.adults, form.children, baseRooms]);

  // ── Préautorisation ──
  const isNanr = form.cancelPolicy === 'non_remboursable';
  const effectivePaRule = isNanr ? 'total' : form.preauthRule;
  const paAmount = useMemo(() => {
    if (effectivePaRule === '0') return 0;
    if (effectivePaRule === 'first_night') return calc.pn;
    if (effectivePaRule === 'total') return calc.ttc;
    return 0;
  }, [effectivePaRule, calc.pn, calc.ttc]);

  const guarStatus = (form.guaranteeType === 'cb' && paAmount > 0) ? 'preauthorized' : 'pending';
  const guarCfg = GUAR_CFG[guarStatus] ?? GUAR_CFG.pending;
  const paLabel = { '0': 'Vérification carte', first_night: '1ère nuitée', total: 'Total séjour' }[effectivePaRule] ?? '—';
  const paDisplay = `Préautorisation : ${paLabel}${paAmount > 0 ? ` (${fmtEur(paAmount)})` : ''}`;

  useEffect(() => {
    if (isNanr && form.preauthRule !== 'total') set('preauthRule', 'total');
  }, [form.cancelPolicy]);

  // ── Multi-chambres helpers ──
  const addRoom = () => set('roomSelections', [...form.roomSelections, makeDefaultRoom()]);
  const removeRoom = (idx: number) => {
    if (form.roomSelections.length <= 1) return;
    set('roomSelections', form.roomSelections.filter((_, i) => i !== idx));
  };
  const updateRoom = (idx: number, key: keyof RoomSelection, val: unknown) => {
    const next = form.roomSelections.map((r, i) => i === idx ? { ...r, [key]: val } : r);
    if (key === 'roomNumber') {
      const room = baseRooms.find(r => r.number === val);
      if (room) next[idx].price = room.price ?? 0;
      next[idx].roomType = room?.type ?? '';
    }
    set('roomSelections', next);
  };

  // ── Save ──
  const handleSave = async () => {
    if (!form.guestName.trim()) { setNameErr(true); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const sel = form.roomSelections[0];
      const savedData: ReservationFormData = {
        ...form,
        guaranteeStatus: guarStatus,
        preauthAmount: paAmount,
        nights: calc.nights,
        totalTTC: calc.ttc,
        roomNumber: sel?.roomNumber ?? '',
        roomType: sel?.roomType ?? '',
        roomNumbers: form.roomSelections.map(r => r.roomNumber).filter(Boolean),
        reservationStatus,
      } as any;
      await Promise.resolve(onSave(savedData));
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Impossible d\'enregistrer');
    } finally {
      setSaving(false);
    }
  };

  // ── Styles ──
  const F:   React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 11, background: '#F5F3FF', border: '1.5px solid #EDE9FE', borderRadius: 16, padding: '0 16px', height: 56, transition: 'border-color .15s, box-shadow .15s' };
  const FF:  React.CSSProperties = { ...F, border: '1.5px solid #8B5CF6', background: '#fff', boxShadow: '0 0 0 3px rgba(139,92,246,0.18)' };
  const FE:  React.CSSProperties = { ...F, border: '1.5px solid #EF4444' };
  const inp: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: 500, color: '#111827', width: '100%' };
  const SEP = <div style={{ height: 1, background: 'linear-gradient(to right,transparent,#E5E7EB,transparent)', margin: '2px 0' }} />;
  const foc = (name: string) => ({ onFocus: () => setFocusedField(name), onBlur: () => setFocusedField(null) });
  const Fst = (name: string, hasError = false): React.CSSProperties =>
    hasError ? (focusedField === name ? { ...FE, background: '#fff', boxShadow: '0 0 0 3px rgba(139,92,246,0.18)' } : FE)
             : (focusedField === name ? FF : F);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(44,42,74,.6)', backdropFilter: 'blur(4px)' }} />

            <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }} transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              style={{ position: 'relative', width: '100%', maxWidth: 1040, background: '#fff', borderRadius: 26, boxShadow: '0 28px 80px rgba(139,92,246,.15)', overflow: 'hidden', zIndex: 1 }}>

              {/* HEADER */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px', background: 'linear-gradient(130deg,#8B5CF6,#6D28D9)' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-.4px' }}>
                  {editId ? `Modifier · ${editId}` : 'Nouvelle réservation'}
                </span>
                <button onClick={onClose} style={{ width: 36, height: 36, background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>

              {/* BODY */}
              <div style={{ padding: '24px 32px', overflowY: 'auto', maxHeight: 'calc(90vh - 80px)', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Erreur save */}
                {saveError && (
                  <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
                    {saveError}
                  </div>
                )}

                {/* STATUT */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>Statut</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([
                      { value: 'option',   label: 'Option (Hold)', icon: <Clock size={13}/>,        bg: '#FEF9C3', border: '#FDE68A', color: '#92400E' },
                      { value: 'pending',  label: 'Pending',       icon: <Loader2 size={13}/>,      bg: '#FFF7ED', border: '#FED7AA', color: '#9A3412' },
                      { value: 'confirmed',label: 'Confirmée',     icon: <CheckCircle2 size={13}/>, bg: '#ECFDF5', border: '#6EE7B7', color: '#065F46' },
                    ] as const).map(s => (
                      <button key={s.value} onClick={() => setReservationStatus(s.value)}
                        style={{ flex: 1, height: 44, borderRadius: 14, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: `1.5px solid ${reservationStatus === s.value ? s.border : '#EDE9FE'}`, background: reservationStatus === s.value ? s.bg : '#F5F3FF', color: reservationStatus === s.value ? s.color : '#C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .15s' }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CLIENT */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1.5', minWidth: 220 }}>
                    <div style={nameErr ? FE : F} onFocus={() => setNameErr(false)}>
                      <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                      <input style={inp} type="text" placeholder="Nom Complet *" value={form.guestName}
                        onChange={e => { set('guestName', e.target.value); setNameErr(false); }} autoFocus />
                    </div>
                    {nameErr && <p style={{ fontSize: 11, color: '#EF4444', fontWeight: 600, margin: '3px 0 0 4px' }}>Champ requis</p>}
                  </div>
                  <NatSelector code={form.nationality} label={form.nationalityLabel}
                    onChange={(c, l) => {
                      set('nationality', c); set('nationalityLabel', l);
                      const dial = COUNTRY_DIAL[c];
                      if (dial) {
                        const prev = COUNTRY_DIAL[form.nationality];
                        if (!form.phone.trim()) set('phone', dial + ' ');
                        else if (prev && form.phone.startsWith(prev)) set('phone', form.phone.replace(prev, dial));
                      }
                    }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={Fst('email')} {...foc('email')}><Ico d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" /><input style={inp} type="email" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                  <div style={Fst('phone')} {...foc('phone')}><Ico d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10" /><input style={inp} type="tel" placeholder="Téléphone" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={Fst('adults')} {...foc('adults')}><Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /><input style={{ ...inp, color: '#7C3AED', fontWeight: 700 }} type="number" placeholder="Adultes" min={1} value={form.adults} onChange={e => set('adults', +e.target.value || 1)} /></div>
                  <div style={Fst('children')} {...foc('children')}><Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><input style={{ ...inp, color: '#7C3AED', fontWeight: 700 }} type="number" placeholder="Enfants" min={0} value={form.children} onChange={e => set('children', +e.target.value || 0)} /></div>
                  <div style={Fst('company')} {...foc('company')}><Ico d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><input style={inp} type="text" placeholder="Société" value={form.company} onChange={e => set('company', e.target.value)} /></div>
                </div>

                {SEP}

                {/* DATES + CANAL */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={Fst('checkIn')} {...foc('checkIn')}>
                    <Ico d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: 1 }}>Arrivée</div>
                      <input style={inp} type="date" value={form.checkIn} min={todayISO()} onChange={e => {
                        const val = e.target.value;
                        set('checkIn', val);
                        if (form.checkOut && form.checkOut <= val) {
                          const next = new Date(val); next.setDate(next.getDate() + 1);
                          set('checkOut', next.toISOString().split('T')[0]);
                        }
                      }} />
                    </div>
                  </div>
                  <div style={Fst('checkOut')} {...foc('checkOut')}>
                    <Ico d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: 1 }}>Départ</div>
                      <input style={inp} type="date" value={form.checkOut} min={form.checkIn || todayISO()} onChange={e => {
                        const val = e.target.value;
                        if (val <= form.checkIn) {
                          const next = new Date(form.checkIn); next.setDate(next.getDate() + 1);
                          set('checkOut', next.toISOString().split('T')[0]);
                        } else { set('checkOut', val); }
                      }} />
                    </div>
                  </div>
                  <Sel icon={<Ico d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM2 12h20" />} value={form.channel} onChange={v => set('channel', v)} placeholder="Canal">
                    {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Sel>
                </div>

                {/* RÉFÉRENCE + RÉFÉRENCE PARTENAIRE */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={Fst('reference')} {...foc('reference')}>
                    <Ico d="M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3m-1-4H9a1 1 0 0 0-1 1v4h8V4a1 1 0 0 0-1-1z" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: 1 }}>Référence interne</div>
                      <input style={{ ...inp, color: '#7C3AED', fontWeight: 700, fontFamily: 'monospace' }} type="text" placeholder="RES-XXXX" value={form.reference} onChange={e => set('reference', e.target.value)} />
                    </div>
                  </div>
                  {/* ← NOUVEAU : Référence partenaire */}
                  <div style={Fst('partnerRef')} {...foc('partnerRef')}>
                    <Ico d="M13 10V3L4 14h7v7l9-11h-7z" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1 }}>Réf. partenaire / OTA</div>
                      <input style={{ ...inp, color: '#92400E', fontWeight: 700, fontFamily: 'monospace' }} type="text" placeholder="BKG-123456789" value={form.partnerRef} onChange={e => set('partnerRef', e.target.value)} />
                    </div>
                  </div>
                  {/* ← NOUVEAU : Nom du partenaire */}
                  <div style={Fst('partnerName')} {...foc('partnerName')}>
                    <Ico d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1 }}>Partenaire</div>
                      <input style={{ ...inp, color: '#78350F' }} type="text" placeholder="Booking.com, Expedia…" value={form.partnerName} onChange={e => set('partnerName', e.target.value)} />
                    </div>
                  </div>
                </div>

                {SEP}

                {/* ══ MULTI-CHAMBRES ══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Ico d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      Chambres ({form.roomSelections.length})
                    </div>
                    <button onClick={addRoom}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#F5F3FF', color: '#7C3AED', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      <Plus size={14} /> Ajouter une chambre
                    </button>
                  </div>

                  {form.roomSelections.map((sel, idx) => {
                    const availForThis = filteredRooms.filter(r => !usedRooms(idx).includes(r.number) || r.number === sel.roomNumber);
                    const roomObj = baseRooms.find(r => r.number === sel.roomNumber);
                    const plan = RATE_PLANS.find(p => p.id === sel.ratePlanId);
                    const pnSel = (roomObj?.price ?? 0) * (plan?.mult ?? 1);
                    const nights = Math.max(0, Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000));
                    const ttcSel = pnSel * nights * (1 + form.vatRate / 100);

                    return (
                      <div key={idx} style={{ background: '#FAFAFA', border: '1.5px solid #EDE9FE', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Header ligne chambre */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#8B5CF6' }}>
                            Chambre {idx + 1}
                            {sel.roomNumber && <span style={{ marginLeft: 8, fontFamily: 'monospace', background: '#EDE9FE', padding: '2px 8px', borderRadius: 8, fontSize: 11 }}>{sel.roomNumber}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {nights > 0 && pnSel > 0 && (
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{fmtEur(ttcSel)} TTC</span>
                            )}
                            {form.roomSelections.length > 1 && (
                              <button onClick={() => removeRoom(idx)} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Sélecteurs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 10 }}>
                          <Sel icon={<Ico d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />} value={sel.roomNumber} onChange={v => updateRoom(idx, 'roomNumber', v)} placeholder="N° chambre">
                            {availForThis.map(r => <option key={r.number} value={r.number}>{r.number} — {r.type}{r.price ? ` (${r.price}€/nuit)` : ''}</option>)}
                          </Sel>
                          <Sel value={sel.ratePlanId} onChange={v => updateRoom(idx, 'ratePlanId', v)} placeholder="Plan tarifaire">
                            {RATE_PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </Sel>
                          <Sel value={sel.boardType} onChange={v => updateRoom(idx, 'boardType', v)}>
                            {['Room Only','Petit-déjeuner','Demi-pension','Pension complète'].map(b => <option key={b}>{b}</option>)}
                          </Sel>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                          <div style={{ ...F, height: 46 }}>
                            <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                            <input style={inp} type="number" placeholder="Adultes" min={1} value={sel.adults} onChange={e => updateRoom(idx, 'adults', +e.target.value || 1)} />
                          </div>
                          <div style={{ ...F, height: 46 }}>
                            <Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                            <input style={inp} type="number" placeholder="Enfants" min={0} value={sel.children} onChange={e => updateRoom(idx, 'children', +e.target.value || 0)} />
                          </div>
                          {pnSel > 0 && (
                            <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
                              {fmtEur(pnSel)}/nuit
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* RÉCAP FINANCIER */}
                <div style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 18, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
                    <Ico d="M12 8v4l3 3M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px' }}>Récapitulatif</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#8B5CF6' }}>
                        {calc.nights > 0 ? `${calc.nights} nuit${calc.nights > 1 ? 's' : ''} · ${form.roomSelections.length} chambre${form.roomSelections.length > 1 ? 's' : ''}` : 'Sélectionnez chambre & dates'}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12, color: '#6B7280' }}>
                      <span>Total HT</span><span style={{ fontWeight: 600, color: '#374151' }}>{fmtEur(calc.totalHT)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12, color: '#6B7280' }}>
                      <span>TVA {form.vatRate}%</span><span style={{ fontWeight: 600, color: '#374151' }}>{fmtEur(calc.tva)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, color: '#6B7280' }}>
                      <span>Taxe de séjour</span><span style={{ fontWeight: 600, color: '#374151' }}>{fmtEur(calc.tax)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#F5F3FF' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Total TTC</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#8B5CF6', letterSpacing: '-.5px' }}>{fmtEur(calc.ttc)}</span>
                  </div>
                </div>

                {SEP}

                {/* CONDITIONS + PAIEMENT */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Sel value={form.cancelPolicy} onChange={v => set('cancelPolicy', v)}>
                    <option value="flexible">Flexible (72h)</option>
                    <option value="modere">Modérée (48h)</option>
                    <option value="stricte">Stricte (7j)</option>
                    <option value="non_remboursable">Non remboursable</option>
                  </Sel>
                  <Sel value={form.segment} onChange={v => set('segment', v)} placeholder="Segment client">
                    {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Sel>
                </div>

                {/* GARANTIE + NOTES */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[['30','30%'],['50','50%'],['100','100%']].map(([v,lbl]) => (
                        <div key={v} onClick={() => set('linkType', v)} style={{ flex: 1, padding: '10px 4px', borderRadius: 12, textAlign: 'center' as const, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${form.linkType === v ? '#8B5CF6' : '#EDE9FE'}`, background: form.linkType === v ? '#EDE9FE' : '#F5F3FF', color: form.linkType === v ? '#6D28D9' : '#C4B5FD' }}>Acompte {lbl}</div>
                      ))}
                    </div>
                    <button onClick={() => { if (!calc.ttc) return; setLinkUrl(`https://pay.flowtym.com/${form.processor}/FLTM-${uid().toUpperCase()}?pct=${form.linkType}`); }}
                      style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: '#fff', fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(139,92,246,.3)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      Générer lien de paiement
                    </button>
                    {linkUrl && (
                      <div style={{ padding: '9px 11px', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 9, fontSize: 11, color: '#065F46', wordBreak: 'break-all' }}>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>Lien généré</div>{linkUrl}
                      </div>
                    )}
                    <div style={{ padding: '12px 14px', background: '#F5F3FF', border: '1.5px solid #EDE9FE', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                        {(['aucune','cb','virement','especes','cheque','paypal','debiteur'] as const).map(type => (
                          <button key={type} onClick={() => set('guaranteeType', type)}
                            style={{ width: 36, height: 36, borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${form.guaranteeType===type?'#8B5CF6':'#EDE9FE'}`, background: form.guaranteeType===type?'#EDE9FE':'#fff', color: form.guaranteeType===type?'#7C3AED':'#C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {GUAR_ICONS[type]}
                          </button>
                        ))}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, color: guarCfg.color, background: guarCfg.bg, border: `1.5px solid ${guarCfg.border}` }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: guarCfg.color, flexShrink: 0, display: 'inline-block' }} />{guarCfg.lbl}
                        </span>
                      </div>
                      <div onClick={() => { setPaRuleDraft(effectivePaRule); setPaOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#fff', borderRadius: 10, border: '1.5px solid #EDE9FE', cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1 }}>{paDisplay}</span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ ...F, height: 'auto', alignItems: 'flex-start', padding: '14px 16px', borderRadius: 14 }}>
                      <Ico d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6" />
                      <textarea rows={4} placeholder="Notes, demandes spéciales…" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inp, resize: 'none', fontWeight: 400, lineHeight: 1.55, color: '#374151' }} />
                    </div>
                  </div>
                </div>

                {/* FOOTER ACTIONS */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid #F3F4F6', flexWrap: 'wrap', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#9CA3AF', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.sendConfirmation} onChange={e => set('sendConfirmation', e.target.checked)} style={{ accentColor: '#8B5CF6', width: 14, height: 14 }} />
                    Envoyer confirmation au client
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={onClose} style={{ padding: '12px 20px', borderRadius: 14, border: '1.5px solid #EDE9FE', background: '#F5F3FF', fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: '#A78BFA', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <X size={13} /> Annuler
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      style={{ padding: '12px 26px', borderRadius: 14, border: 'none', background: saving ? '#A78BFA' : 'linear-gradient(135deg,#8B5CF6,#6D28D9)', fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(139,92,246,.3)' }}>
                      {saving ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>{editId ? 'Mettre à jour' : 'Enregistrer'}</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MINI-MODALE PRÉAUTORISATION */}
      {paOpen && (
        <div onClick={() => setPaOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(17,24,39,.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: '22px 24px', width: 340, maxWidth: '95vw', boxShadow: '0 24px 60px rgba(0,0,0,.18)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Règle de préautorisation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([
                { rule: '0',           icon: '🔍', lbl: 'Vérification carte', val: '0€' },
                { rule: 'first_night', icon: '🌙', lbl: '1ère nuitée',        val: calc.pn  > 0 ? fmtEur(calc.pn)  : '—' },
                { rule: 'total',       icon: '💰', lbl: 'Total séjour',       val: calc.ttc > 0 ? fmtEur(calc.ttc) : '—' },
              ] as const).map(({ rule, icon, lbl, val }) => {
                const locked = isNanr && rule !== 'total';
                const active = paRuleDraft === rule;
                return (
                  <div key={rule} onClick={() => !locked && setPaRuleDraft(rule)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, cursor: locked ? 'not-allowed' : 'pointer', border: `1.5px solid ${active ? '#8B5CF6' : '#E5E7EB'}`, background: active ? '#EDE9FE' : '#F9FAFB', opacity: locked ? .35 : 1, transition: 'all .15s' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? '#8B5CF6' : '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{icon}</div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? '#6D28D9' : '#374151', flex: 1 }}>{lbl}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: active ? '#8B5CF6' : '#9CA3AF' }}>{val}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setPaOpen(false)} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>Annuler</button>
              <button onClick={() => { set('preauthRule', paRuleDraft); setPaOpen(false); }} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReservationFormModal;
