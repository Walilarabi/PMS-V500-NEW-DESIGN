import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, AlertTriangle, TrendingUp, Clock, CheckCircle2, XCircle, Loader2, Search, Moon, Banknote } from 'lucide-react';
import { CHANNELS } from '@/src/constants/channels';
import { useRevenueEngine } from '@/src/hooks/useRevenueEngine';
import type { ReservationStatus } from '@/src/contexts/ReservationContext';
import { getStayBreakdown } from '@/src/services/calendar-pricing.service';

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
  partnerRef: string;      // Référence partenaire / OTA (ex: BKG-123456789)
  partnerName: string;     // Nom du partenaire (Booking.com, Expedia…)
  segment: string;
  checkIn: string;
  checkOut: string;
  category: string;
  roomNumber: string;
  roomSelections: { roomNumber: string; roomType: string; adults: number; children: number; }[]; // Multi-chambres
  roomNumbers: string[];   // Liste de tous les numéros sélectionnés
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
  linkType: string;
  processor: string;
  sendConfirmation: boolean;
  nights: number;
  totalTTC: number;
}

export interface AvailableRoom {
  number: string;
  type: string;
  price?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ReservationFormData) => void;
  initialData?: Partial<ReservationFormData>;
  availableRooms?: AvailableRoom[];
  allReservations?: { id: string; room: string; arrival: string; departure: string }[];
  editId?: string | null;
  source?: 'planning' | 'today' | 'reservations';
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const ROOMS_DEFAULT: AvailableRoom[] = [
  { number: '101', type: 'Double Classique', price: 99 },
  { number: '102', type: 'Double Classique', price: 99 },
  { number: '103', type: 'Suite Deluxe', price: 189 },
  { number: '104', type: 'Simple', price: 69 },
  { number: '201', type: 'Double Supérieure', price: 129 },
  { number: '202', type: 'Twin', price: 115 },
  { number: '203', type: 'Suite Panoramique', price: 249 },
  { number: '301', type: 'Familiale', price: 185 },
  { number: '302', type: 'Junior Suite', price: 165 },
];

// Indicatifs téléphoniques par pays (ISO 2 lettres)
const COUNTRY_DIAL: Record<string, string> = {
  FR: '+33', BE: '+32', CH: '+41', CA: '+1', US: '+1',
  GB: '+44', DE: '+49', ES: '+34', IT: '+39', PT: '+351',
  NL: '+31', LU: '+352', MA: '+212', DZ: '+213', TN: '+216',
  SA: '+966', AE: '+971', QA: '+974', CN: '+86', JP: '+81',
  IN: '+91', BR: '+55', MX: '+52', AU: '+61', RU: '+7',
};

// Segments client — icônes SVG modernes épurées
export const SEGMENTS = [
  { value: 'Loisir',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, label: 'Loisir' },
  { value: 'Business', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>, label: 'Business' },
  { value: 'Corpo',    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, label: 'Corpo' },
  { value: 'Groupe',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, label: 'Groupe' },
  { value: 'Agence',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, label: 'Agence' },
  { value: 'TO',       icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91"/></svg>, label: 'Tour Opérator' },
  { value: 'Famille',  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>, label: 'Famille' },
  { value: 'VIP',      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, label: 'VIP' },
];

export const RATE_PLANS = [
  { id: 'RACK-RO', label: 'Rack — Room Only',        mult: 1.00 },
  { id: 'RACK-BB', label: 'Rack — Petit-déjeuner',   mult: 1.15 },
  { id: 'FLEX',    label: 'Flexible — Room Only',     mult: 1.00 },
  { id: 'NANR',    label: 'Non-remboursable (−10%)', mult: 0.90 },
  { id: 'EARLY',   label: 'Early Bird (−15%)',        mult: 0.85 },
  { id: 'LAST',    label: 'Last Minute (−20%)',       mult: 0.80 },
  { id: 'CORP',    label: 'Corporatif',               mult: 1.10 },
];

export const GUAR_CFG: Record<string, { color: string; bg: string; border: string; lbl: string }> = {
  pending:      { color: '#f97316', bg: '#FFF7ED', border: '#FED7AA', lbl: 'En attente' },
  preauthorized:{ color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', lbl: 'Préautorisé' },
  deposit:      { color: '#3b82f6', bg: '#EFF6FF', border: '#BFDBFE', lbl: 'Arrhes' },
  paid:         { color: '#10b981', bg: '#ECFDF5', border: '#A7F3D0', lbl: 'Payé' },
  refused:      { color: '#ef4444', bg: '#FEF2F2', border: '#FECACA', lbl: 'Refusé' },
  // Nouveaux modes P0
  amex:         { color: '#1A6DB5', bg: '#EFF6FF', border: '#BFDBFE', lbl: 'American Express' },
  diners:       { color: '#2B6CB0', bg: '#EBF8FF', border: '#BEE3F8', lbl: 'Diners Club' },
  jcb:          { color: '#E53E3E', bg: '#FFF5F5', border: '#FED7D7', lbl: 'JCB' },
  debiteur:     { color: '#718096', bg: '#F7FAFC', border: '#E2E8F0', lbl: 'Compte débiteur' },
};

export interface Country { n: string; c: string; }
export const COUNTRIES: Country[] = [
  {n:"Afghanistan",c:"AF"},{n:"Afrique du Sud",c:"ZA"},{n:"Albanie",c:"AL"},
  {n:"Algérie",c:"DZ"},{n:"Allemagne",c:"DE"},{n:"Andorre",c:"AD"},
  {n:"Angola",c:"AO"},{n:"Arabie Saoudite",c:"SA"},{n:"Argentine",c:"AR"},
  {n:"Arménie",c:"AM"},{n:"Australie",c:"AU"},{n:"Autriche",c:"AT"},
  {n:"Azerbaïdjan",c:"AZ"},{n:"Bahamas",c:"BS"},{n:"Bahreïn",c:"BH"},
  {n:"Bangladesh",c:"BD"},{n:"Belgique",c:"BE"},{n:"Bénin",c:"BJ"},
  {n:"Biélorussie",c:"BY"},{n:"Bolivie",c:"BO"},{n:"Bosnie-Herzégovine",c:"BA"},
  {n:"Botswana",c:"BW"},{n:"Brésil",c:"BR"},{n:"Bulgarie",c:"BG"},
  {n:"Burkina Faso",c:"BF"},{n:"Burundi",c:"BI"},{n:"Cambodge",c:"KH"},
  {n:"Cameroun",c:"CM"},{n:"Canada",c:"CA"},{n:"Cap-Vert",c:"CV"},
  {n:"Centrafrique",c:"CF"},{n:"Chili",c:"CL"},{n:"Chine",c:"CN"},
  {n:"Chypre",c:"CY"},{n:"Colombie",c:"CO"},{n:"Comores",c:"KM"},
  {n:"Congo",c:"CG"},{n:"Congo (RDC)",c:"CD"},{n:"Corée du Nord",c:"KP"},
  {n:"Corée du Sud",c:"KR"},{n:"Costa Rica",c:"CR"},{n:"Côte d'Ivoire",c:"CI"},
  {n:"Croatie",c:"HR"},{n:"Cuba",c:"CU"},{n:"Danemark",c:"DK"},
  {n:"Djibouti",c:"DJ"},{n:"Égypte",c:"EG"},{n:"Émirats Arabes Unis",c:"AE"},
  {n:"Équateur",c:"EC"},{n:"Espagne",c:"ES"},{n:"Estonie",c:"EE"},
  {n:"Eswatini",c:"SZ"},{n:"États-Unis",c:"US"},{n:"Éthiopie",c:"ET"},
  {n:"Fidji",c:"FJ"},{n:"Finlande",c:"FI"},{n:"France",c:"FR"},
  {n:"Gabon",c:"GA"},{n:"Gambie",c:"GM"},{n:"Géorgie",c:"GE"},
  {n:"Ghana",c:"GH"},{n:"Grèce",c:"GR"},{n:"Grenade",c:"GD"},
  {n:"Guatemala",c:"GT"},{n:"Guinée",c:"GN"},{n:"Guyana",c:"GY"},
  {n:"Haïti",c:"HT"},{n:"Honduras",c:"HN"},{n:"Hongrie",c:"HU"},
  {n:"Inde",c:"IN"},{n:"Indonésie",c:"ID"},{n:"Irak",c:"IQ"},
  {n:"Iran",c:"IR"},{n:"Irlande",c:"IE"},{n:"Islande",c:"IS"},
  {n:"Israël",c:"IL"},{n:"Italie",c:"IT"},{n:"Jamaïque",c:"JM"},
  {n:"Japon",c:"JP"},{n:"Jordanie",c:"JO"},{n:"Kazakhstan",c:"KZ"},
  {n:"Kenya",c:"KE"},{n:"Kirghizistan",c:"KG"},{n:"Koweït",c:"KW"},
  {n:"Laos",c:"LA"},{n:"Lettonie",c:"LV"},{n:"Liban",c:"LB"},
  {n:"Libye",c:"LY"},{n:"Liechtenstein",c:"LI"},{n:"Lituanie",c:"LT"},
  {n:"Luxembourg",c:"LU"},{n:"Macédoine du Nord",c:"MK"},{n:"Madagascar",c:"MG"},
  {n:"Malaisie",c:"MY"},{n:"Malawi",c:"MW"},{n:"Maldives",c:"MV"},
  {n:"Mali",c:"ML"},{n:"Malte",c:"MT"},{n:"Maroc",c:"MA"},
  {n:"Maurice",c:"MU"},{n:"Mauritanie",c:"MR"},{n:"Mexique",c:"MX"},
  {n:"Moldavie",c:"MD"},{n:"Monaco",c:"MC"},{n:"Mongolie",c:"MN"},
  {n:"Monténégro",c:"ME"},{n:"Mozambique",c:"MZ"},{n:"Myanmar",c:"MM"},
  {n:"Namibie",c:"NA"},{n:"Népal",c:"NP"},{n:"Nicaragua",c:"NI"},
  {n:"Niger",c:"NE"},{n:"Nigéria",c:"NG"},{n:"Norvège",c:"NO"},
  {n:"Nouvelle-Zélande",c:"NZ"},{n:"Oman",c:"OM"},{n:"Ouganda",c:"UG"},
  {n:"Ouzbékistan",c:"UZ"},{n:"Pakistan",c:"PK"},{n:"Panama",c:"PA"},
  {n:"Paraguay",c:"PY"},{n:"Pays-Bas",c:"NL"},{n:"Pérou",c:"PE"},
  {n:"Philippines",c:"PH"},{n:"Pologne",c:"PL"},{n:"Portugal",c:"PT"},
  {n:"Qatar",c:"QA"},{n:"Roumanie",c:"RO"},{n:"Royaume-Uni",c:"GB"},
  {n:"Russie",c:"RU"},{n:"Rwanda",c:"RW"},{n:"Salvador",c:"SV"},
  {n:"Sénégal",c:"SN"},{n:"Serbie",c:"RS"},{n:"Seychelles",c:"SC"},
  {n:"Sierra Leone",c:"SL"},{n:"Singapour",c:"SG"},{n:"Slovaquie",c:"SK"},
  {n:"Slovénie",c:"SI"},{n:"Somalie",c:"SO"},{n:"Soudan",c:"SD"},
  {n:"Sri Lanka",c:"LK"},{n:"Suède",c:"SE"},{n:"Suisse",c:"CH"},
  {n:"Suriname",c:"SR"},{n:"Syrie",c:"SY"},{n:"Tadjikistan",c:"TJ"},
  {n:"Tanzanie",c:"TZ"},{n:"Tchad",c:"TD"},{n:"Tchéquie",c:"CZ"},
  {n:"Thaïlande",c:"TH"},{n:"Togo",c:"TG"},{n:"Trinité-et-Tobago",c:"TT"},
  {n:"Tunisie",c:"TN"},{n:"Turquie",c:"TR"},{n:"Ukraine",c:"UA"},
  {n:"Uruguay",c:"UY"},{n:"Venezuela",c:"VE"},{n:"Vietnam",c:"VN"},
  {n:"Yémen",c:"YE"},{n:"Zambie",c:"ZM"},{n:"Zimbabwe",c:"ZW"},
].sort((a, b) => a.n.localeCompare(b.n, 'fr'));

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const todayISO = () => new Date().toISOString().split('T')[0];
const tomorrowISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; };
const fmtEur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';

// ─── SÉLECTEUR NATIONALITÉ ───────────────────────────────────────────────────

export const NatSelector: React.FC<{ code: string; label: string; onChange: (c: string, l: string) => void }> = ({ code, label, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const srchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const nq = norm(q);
    return nq ? COUNTRIES.filter(c => norm(c.n).includes(nq) || c.c.toLowerCase().includes(nq)) : COUNTRIES;
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
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

  useEffect(() => {
    if (listRef.current && hl >= 0) (listRef.current.children[hl] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
  }, [hl]);

  const S: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#F5F3FF', border: '1.5px solid #EDE9FE', borderRadius: 16,
    padding: '0 16px', height: 56, cursor: 'pointer',
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 200 }}>
      <div style={S} onClick={() => setOpen(v => !v)}>
        <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt={label}
          style={{ width: 26, height: 18, objectFit: 'cover', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,.18)', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: '#111827', flex: 1 }}>{label}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 9999, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.14)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input ref={srchRef} type="text" placeholder="Chercher un pays…" value={q}
              onChange={e => { setQ(e.target.value); setHl(-1); }} onKeyDown={onKey}
              style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'Inter,sans-serif', fontSize: 13, background: 'transparent', color: '#111827' }} />
          </div>
          <ul ref={listRef} style={{ maxHeight: 220, overflowY: 'auto', padding: 6, margin: 0, listStyle: 'none' }}>
            {filtered.length === 0
              ? <li style={{ padding: 16, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Aucun pays trouvé</li>
              : filtered.map((c, i) => (
                <li key={c.c} onMouseDown={() => pick(c)} onMouseEnter={() => setHl(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, cursor: 'pointer', background: i === hl ? '#F5F3FF' : 'transparent' }}>
                  <img src={`https://flagcdn.com/w40/${c.c.toLowerCase()}.png`} alt={c.n} loading="lazy"
                    style={{ width: 28, height: 20, objectFit: 'cover', borderRadius: 3, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,.15)' }} />
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

const Sel: React.FC<{ icon: React.ReactNode; value: string; onChange: (v: string) => void; children: React.ReactNode; placeholder?: string }> = ({ icon, value, onChange, children, placeholder }) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, background: '#F5F3FF', border: '1.5px solid #EDE9FE', borderRadius: 16, padding: '0 36px 0 16px', height: 56 }}>
    {icon}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: 500, color: value ? '#111827' : '#C4B5FD', appearance: 'none', cursor: 'pointer', minWidth: 0 }}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {children}
    </select>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2.5"
      style={{ position: 'absolute', right: 14, pointerEvents: 'none', flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
  </div>
);

// ─── ICÔNES SVG ──────────────────────────────────────────────────────────────

const Ico: React.FC<{ d: string; color?: string }> = ({ d, color = '#8B5CF6' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={{ flexShrink: 0, opacity: .75 }}><path d={d}/></svg>
);

export const GUAR_ICONS: Record<string, React.ReactNode> = {
  aucune:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>,
  cb:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  virement: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
  especes:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>,
  cheque:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  paypal:   <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/></svg>,
  // Nouveaux modes P0
  amex:     <span style={{ fontSize: 9, fontWeight: 800, color: '#1A6DB5', lineHeight: 1 }}>AX</span>,
  diners:   <span style={{ fontSize: 9, fontWeight: 800, color: '#2B6CB0', lineHeight: 1 }}>DC</span>,
  jcb:      <span style={{ fontSize: 9, fontWeight: 800, color: '#E53E3E', lineHeight: 1 }}>JCB</span>,
  debiteur: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
};

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────

const ReservationFormModal: React.FC<Props> = ({
  isOpen, onClose, onSave,
  initialData, availableRooms, editId, allReservations
}) => {
  const baseRooms = (availableRooms && availableRooms.length > 0) ? availableRooms : ROOMS_DEFAULT;

  const defaultForm: ReservationFormData = {
    guestName: '', email: '', phone: '',
    nationality: 'FR', nationalityLabel: 'France',
    adults: 2, children: 0, company: '',
    reference: `RES-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    partnerRef: '', partnerName: '',
    segment: 'Loisir',
    checkIn: todayISO(), checkOut: tomorrowISO(),
    category: '', roomNumber: '', board: 'Room Only',
    roomSelections: [{ roomNumber: '', roomType: '', adults: 2, children: 0 }],
    roomNumbers: [],
    cancelPolicy: 'flexible', ratePlanId: '', channel: 'Direct',
    vatRate: 10, paymentMode: 'Carte bancaire', paymentStatus: 'En attente',
    guaranteeType: 'cb', guaranteeStatus: 'pending',
    preauthRule: 'first_night', preauthAmount: 0,
    notes: '', linkType: '30', processor: 'stripe',
    sendConfirmation: true, nights: 0, totalTTC: 0,
  };

  const [form, setForm] = useState<ReservationFormData>({ ...defaultForm, ...initialData });
  const [nameErr, setNameErr] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [paOpen, setPaOpen] = useState(false);
  const [paRuleDraft, setPaRuleDraft] = useState('first_night');
  const [reservationStatus, setReservationStatus] = useState<ReservationStatus>('confirmed');
  const [confirmOverbooking, setConfirmOverbooking] = useState(false);
  const [showDynPricing, setShowDynPricing] = useState(false);

  // Hook Revenue Engine
  const { getPriceForStay, canOverbook } = useRevenueEngine();

  // Calcul overbooking en temps réel
  const overbookingInfo = useMemo(() => {
    if (!form.checkIn || !form.checkOut || !form.roomNumber) return null;
    return canOverbook({
      roomCategory: form.category || undefined,
      checkInDate: form.checkIn,
      checkOutDate: form.checkOut,
      currentRoom: form.roomNumber,
    });
  }, [form.checkIn, form.checkOut, form.roomNumber, form.category, canOverbook]);

  // Calcul prix dynamique
  const dynPriceResult = useMemo(() => {
    const room = baseRooms.find(r => r.number === form.roomNumber);
    if (!room?.price || !form.checkIn) return null;
    return getPriceForStay({
      basePrice: room.price,
      checkInDate: form.checkIn,
      roomCategory: form.category || undefined,
    });
  }, [form.roomNumber, form.checkIn, form.category, baseRooms, getPriceForStay]);

  // Reset status on open
  useEffect(() => {
    if (isOpen) {
      setReservationStatus((initialData as any)?.reservationStatus ?? 'confirmed');
      setConfirmOverbooking(false);
      setShowDynPricing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const sanitized = { ...initialData };
      if (sanitized.checkIn) sanitized.checkIn = sanitized.checkIn.split(' ')[0].split('T')[0];
      if (sanitized.checkOut) sanitized.checkOut = sanitized.checkOut.split(' ')[0].split('T')[0];
      setForm({ ...defaultForm, ...sanitized });
      setNameErr(false);
      setLinkUrl('');
    }
  }, [isOpen, initialData]);

  // Filtrage dynamique des chambres selon les dates (et suppression conflits)
  const filteredRooms = useMemo(() => {
    if (!allReservations) return baseRooms;
    const cin = new Date(form.checkIn).getTime();
    const cout = new Date(form.checkOut).getTime();
    if (isNaN(cin) || isNaN(cout) || cin >= cout) return baseRooms;

    return baseRooms.filter(room => {
      // Vérifier s'il y a un chevauchement avec une autre réservation pour cette chambre
      const hasConflict = allReservations.some(res => {
        if (res.id === editId) return false; // Ne pas se bloquer soi-même en mode édition
        if (res.room !== room.number) return false;
        
        // Convertir les dates de la réservation (format "DD MMM HH:mm" ou ISO) en timestamp
        // Le plus simple si "arrival" contient le format ISO ou peut être parsé
        // Dans Flowtym, l'arrival est parfois "2026-05-10 16:00" ou "27 avr. 16:00"
        // Faisons une approche robuste si possible
        let resCin = new Date(res.arrival).getTime();
        let resCout = new Date(res.departure).getTime();
        
        // Si la date ne parse pas (e.g. "27 avr. 16:00"), on ignore le filtrage pour cette res (fallback)
        // Mais idéalement, il faut le convertir. Dans PlanningView c'est géré.
        // Ici, supposons qu'elles sont parsables (ou ISO)
        if (isNaN(resCin) || isNaN(resCout)) {
           // Essai de conversion si format ISO direct est géré en amont
           const matchCin = String(res.arrival).match(/^(\d{4}-\d{2}-\d{2})/);
           const matchCout = String(res.departure).match(/^(\d{4}-\d{2}-\d{2})/);
           if (matchCin) resCin = new Date(matchCin[1]).getTime();
           if (matchCout) resCout = new Date(matchCout[1]).getTime();
        }

        if (isNaN(resCin) || isNaN(resCout)) return false; // Ignore invalid formats

        // Chevauchement : max(startA, startB) < min(endA, endB)
        return Math.max(cin, resCin) < Math.min(cout, resCout);
      });
      return !hasConflict;
    });
  }, [form.checkIn, form.checkOut, baseRooms, allReservations, editId]);

  useEffect(() => {
    // Si la chambre actuellement sélectionnée n'est plus disponible, la dé-sélectionner
    if (form.roomNumber && !filteredRooms.find(r => r.number === form.roomNumber)) {
      set('roomNumber', '');
    }
  }, [filteredRooms]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen && !paOpen) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, paOpen, onClose]);

  const set = <K extends keyof ReservationFormData>(k: K, v: ReservationFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // ── Calculs ──
  // On essaie d'abord de récupérer les tarifs exacts depuis le Calendrier
  // Tarifaire (nuit par nuit). Sinon fallback sur prix de base × multiplicateur.
  const calc = useMemo(() => {
    const cin = new Date(form.checkIn), cout = new Date(form.checkOut);
    const nights = Math.max(0, Math.round((cout.getTime() - cin.getTime()) / 86400000));
    const room = baseRooms.find(r => r.number === form.roomNumber);
    const plan = RATE_PLANS.find(p => p.id === form.ratePlanId);
    const fallbackPerNight = (room?.price ?? 0) * (plan?.mult ?? 1);

    let calendarBreakdown: ReturnType<typeof getStayBreakdown> | null = null;
    if (form.checkIn && form.checkOut && room && nights > 0) {
      calendarBreakdown = getStayBreakdown({
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        roomQuery: room.type,
        planQuery: plan?.name || form.ratePlanId,
        fallbackPrice: fallbackPerNight,
      });
    }

    const pn = fallbackPerNight; // prix de référence "1ère nuit" pour préauto
    const ht = calendarBreakdown && calendarBreakdown.nights.length > 0
      ? calendarBreakdown.total
      : pn * nights;
    const tva = ht * (form.vatRate / 100);
    const tax = 2.5 * (form.adults + form.children) * nights;
    const ttc = ht + tva + tax;
    return {
      nights,
      pn,
      ht,
      tva,
      tax,
      ttc,
      breakdown: calendarBreakdown,
      fromCalendar: !!calendarBreakdown && calendarBreakdown.allFromCalendar,
      anyClosed: !!calendarBreakdown && calendarBreakdown.anyClosed,
    };
  }, [form.checkIn, form.checkOut, form.roomNumber, form.adults, form.children, form.vatRate, form.ratePlanId, baseRooms]);

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
    else if (!isNanr && form.preauthRule === 'total' && form.cancelPolicy === 'flexible') set('preauthRule', 'first_night');
  }, [form.cancelPolicy]);

  const handleSave = () => {
    if (!form.guestName.trim()) { setNameErr(true); return; }
    // Bloquer si overbooking non confirmé et chambre pleine
    if (overbookingInfo?.isOver && !confirmOverbooking) {
      setConfirmOverbooking(true); // forcer la confirmation
      return;
    }
    const savedData = {
      ...form,
      guaranteeStatus: guarStatus,
      preauthAmount: paAmount,
      nights: calc.nights,
      totalTTC: calc.ttc,
      // Nouveaux champs
      reservationStatus,
      isOverbooking: overbookingInfo?.isOver && confirmOverbooking,
      dynamicPriceApplied: !!dynPriceResult && dynPriceResult.finalPrice !== (baseRooms.find(r => r.number === form.roomNumber)?.price ?? 0),
      appliedPricingRules: dynPriceResult?.appliedRules ?? [],
    };
    onSave(savedData);
    if (form.sendConfirmation && form.email) {
      setTimeout(() => handleSendEmail(savedData), 300);
    }
    onClose();
  };

  // Générer le lien de paiement (simulation)
  const generatePaymentLink = (data: typeof form) => {
    const ref = data.reference || `RES-${Date.now()}`;
    const amount = calc.ttc;
    return `https://pay.flowtym.com/stripe/${ref}?amount=${amount.toFixed(2)}`;
  };

  // Générer et imprimer la proforma PDF
  const handleProforma = () => {
    if (!form.guestName.trim()) { setNameErr(true); return; }
    const link = generatePaymentLink(form);
    const pfNum = `PF-${form.reference}-${new Date().getFullYear()}`;
    const htTotal = (calc.ttc / 1.1).toFixed(2);
    const tvaTotal = (calc.ttc - calc.ttc / 1.1).toFixed(2);
    const fmtD = (iso: string) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Proforma ${pfNum}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>body{font-family:Inter,sans-serif;padding:40px;color:#1e293b;max-width:800px;margin:0 auto}
      h1{color:#8B5CF6;font-size:28px;font-weight:800;margin:0}
      .badge{background:#EDE9FE;color:#6D28D9;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:12px;margin:16px 0}
      th{background:#f1f5f9;padding:10px;text-align:left;font-weight:700}td{padding:10px;border-bottom:1px solid #f1f5f9}
      .total{background:#EDE9FE;padding:10px 14px;border-radius:10px;text-align:right}
      .link-box{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px;font-size:11px;color:#166534;word-break:break-all}
      @media print{@page{margin:15mm}}</style>
      </head><body>
      <div style="display:flex;justify-content:space-between;margin-bottom:28px;align-items:flex-start">
        <div><h1>FLOWTYM PMS</h1><p style="color:#64748b;font-size:12px;margin:4px 0">Mas Provencal Aix — 13100 Aix-en-Provence</p></div>
        <div style="text-align:right"><div style="font-size:18px;font-weight:800;color:#8B5CF6">${pfNum}</div>
        <span class="badge">PROFORMA</span>
        <div style="font-size:11px;color:#64748b;margin-top:4px">Émise le ${new Date().toLocaleDateString('fr-FR')}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div style="background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0">
          <div style="font-size:9px;font-weight:700;color:#8B5CF6;text-transform:uppercase;margin-bottom:8px">CLIENT</div>
          <div style="font-size:15px;font-weight:700">${form.guestName}</div>
          ${form.email ? `<div style="font-size:11px;color:#64748b">${form.email}</div>` : ''}
          ${form.phone ? `<div style="font-size:11px;color:#64748b">${form.phone}</div>` : ''}
        </div>
        <div style="background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0">
          <div style="font-size:9px;font-weight:700;color:#8B5CF6;text-transform:uppercase;margin-bottom:8px">SÉJOUR</div>
          <table style="margin:0"><tbody>
            <tr><td style="border:none;padding:3px 0;font-size:11px;color:#64748b">Arrivée</td><td style="border:none;padding:3px 0;font-size:11px;font-weight:700">${fmtD(form.checkIn)}</td></tr>
            <tr><td style="border:none;padding:3px 0;font-size:11px;color:#64748b">Départ</td><td style="border:none;padding:3px 0;font-size:11px;font-weight:700">${fmtD(form.checkOut)}</td></tr>
            <tr><td style="border:none;padding:3px 0;font-size:11px;color:#64748b">Chambre</td><td style="border:none;padding:3px 0;font-size:11px;font-weight:700">${form.roomNumber || '—'}</td></tr>
            <tr><td style="border:none;padding:3px 0;font-size:11px;color:#64748b">Personnes</td><td style="border:none;padding:3px 0;font-size:11px;font-weight:700">${form.adults + form.children}</td></tr>
          </tbody></table>
        </div>
      </div>
      <table><thead><tr><th>Description</th><th>HT</th><th>TVA 10%</th><th>TTC</th></tr></thead>
      <tbody><tr><td>Hébergement — ${form.roomNumber || 'Ch. ?'} (${calc.nights} nuit${calc.nights > 1 ? 's' : ''})</td>
        <td>${htTotal} €</td><td>${tvaTotal} €</td><td style="font-weight:700">${calc.ttc.toFixed(2)} €</td></tr></tbody></table>
      <div class="total"><span style="font-size:11px;color:#5b21b6;margin-right:8px;font-weight:700">TOTAL TTC</span>
        <span style="color:#6d28d9;font-weight:800;font-size:18px">${calc.ttc.toFixed(2)} €</span></div>
      ${link ? `<div style="margin-top:16px"><div style="font-size:9px;font-weight:700;color:#166534;text-transform:uppercase;margin-bottom:6px">Lien de paiement</div>
        <div class="link-box">${link}</div></div>` : ''}
      <div style="margin-top:28px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px">
        Flowtym PMS · Mas Provencal Aix · SIRET 000 000 000 00000 · TVA FR00 000 000 000
      </div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  // Envoyer la confirmation (simulation — toast + log)
  const handleSendEmail = (data?: typeof form) => {
    const d = data || form;
    if (!d.guestName.trim()) { setNameErr(true); return; }
    const link = generatePaymentLink(d);
    const fmtD = (iso: string) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
    // Simulation : log dans console + toast
    console.log(`[Flowtym] Email envoyé à ${d.email || '(pas d\'email)'}`, {
      to: d.email,
      subject: `Confirmation ${d.reference}`,
      body: `Bonjour ${d.guestName},\n\nRéservation ${d.reference}\nArrivée : ${fmtD(d.checkIn)} → Départ : ${fmtD(d.checkOut)}\nChambre : ${d.roomNumber || '—'}\nMontant : ${calc.ttc.toFixed(2)} €\n\nLien de paiement : ${link}\n\nCordialement, L'équipe Flowtym`,
      paymentLink: link,
    });
    // Toast visible
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#1e293b;color:#fff;padding:12px 18px;border-radius:14px;font-family:Inter,sans-serif;font-size:12px;font-weight:600;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:fadeIn .3s ease';
    toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg> Email + lien de paiement envoyés à ${d.email || d.guestName}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  };

  // ── Styles de base ──
  const F: React.CSSProperties  = { display: 'flex', alignItems: 'center', gap: 11, background: '#F5F3FF', border: '1.5px solid #EDE9FE', borderRadius: 16, padding: '0 16px', height: 56, transition: 'border-color .15s, box-shadow .15s' };
  const FF: React.CSSProperties = { ...F, border: '1.5px solid #8B5CF6', background: '#ffffff', boxShadow: '0 0 0 3px rgba(139,92,246,0.18)' };
  const FE: React.CSSProperties = { ...F, border: '1.5px solid #EF4444' };
  const FEF: React.CSSProperties = { ...FE, background: '#ffffff', boxShadow: '0 0 0 3px rgba(139,92,246,0.18)' };
  const inp: React.CSSProperties = { background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: 500, color: '#111827', width: '100%' };
  const SEP = <div style={{ height: 1, background: 'linear-gradient(to right,transparent,#E5E7EB,transparent)', margin: '2px 0' }} />;

  // Focus state pour les conteneurs F
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const foc = (name: string) => ({ onFocus: () => setFocusedField(name), onBlur: () => setFocusedField(null) });
  const Fst = (name: string, hasError = false): React.CSSProperties =>
    hasError
      ? (focusedField === name ? FEF : FE)
      : (focusedField === name ? FF  : F);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
              style={{ position: 'fixed', inset: 0, background: 'rgba(44,42,74,.6)', backdropFilter: 'blur(4px)' }} />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              style={{ position: 'relative', width: '100%', maxWidth: 1000, background: '#fff', borderRadius: 26, boxShadow: '0 28px 80px rgba(139,92,246,.15)', overflow: 'hidden', zIndex: 1 }}
            >
              {/* HEADER */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px', background: 'linear-gradient(130deg,#8B5CF6,#6D28D9)' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-.4px' }}>
                  {editId ? `Modifier · ${editId}` : 'Nouvelle réservation'}
                </span>
                <button onClick={onClose} style={{ width: 36, height: 36, background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>

              {/* ── CONTENU DU MODAL (AVEC SCROLL) ── */}
              <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* ── STATUT DE RÉSERVATION ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>Statut de la réservation</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([
                      { value: 'option',    label: 'Option (Hold)', icon: <Clock size={13}/>,         bg: '#FEF9C3', border: '#FDE68A', color: '#92400E' },
                      { value: 'pending',  label: 'Pending',        icon: <Loader2 size={13}/>,       bg: '#FFF7ED', border: '#FED7AA', color: '#9A3412' },
                      { value: 'confirmed',label: 'Confirmée',      icon: <CheckCircle2 size={13}/>,  bg: '#ECFDF5', border: '#6EE7B7', color: '#065F46' },
                    ] as const).map(s => (
                      <button key={s.value} onClick={() => setReservationStatus(s.value as ReservationStatus)}
                        style={{
                          flex: 1, height: 44, borderRadius: 14, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          border: `1.5px solid ${reservationStatus === s.value ? s.border : '#EDE9FE'}`,
                          background: reservationStatus === s.value ? s.bg : '#F5F3FF',
                          color: reservationStatus === s.value ? s.color : '#C4B5FD',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          transition: 'all .15s',
                          boxShadow: reservationStatus === s.value ? '0 0 0 3px rgba(139,92,246,.10)' : 'none',
                        }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                  {reservationStatus === 'option' && (
                    <div style={{ fontSize: 11, color: '#92400E', background: '#FEF9C3', padding: '7px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} /> Cette option expirera automatiquement dans <strong>24h</strong>
                    </div>
                  )}
                </div>

                {/* ── ALERTE OVERBOOKING ── */}
                {overbookingInfo?.isOver && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 14,
                    background: confirmOverbooking ? '#FEF3C7' : '#FEF2F2',
                    border: `1.5px solid ${confirmOverbooking ? '#FCD34D' : '#FECACA'}`,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={16} color={confirmOverbooking ? '#D97706' : '#DC2626'} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: confirmOverbooking ? '#92400E' : '#991B1B' }}>
                        {confirmOverbooking
                          ? `Overbooking confirmé — capacité dépassée (max autorisé: ${overbookingInfo.maxAllowed} chambres)`
                          : `Chambre complète — Overbooking contrôlé possible (seuil ${overbookingInfo.maxAllowed} ch. max)`
                        }
                      </span>
                    </div>
                    {!confirmOverbooking && (
                      <button onClick={() => setConfirmOverbooking(true)}
                        style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 10, border: '1.5px solid #FECACA', background: '#fff', color: '#DC2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Confirmer l'overbooking contrôlé
                      </button>
                    )}
                  </div>
                )}

                {/* ── PRIX DYNAMIQUE ── */}
                {dynPriceResult && (
                  <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 14, overflow: 'hidden' }}>
                    <div
                      onClick={() => setShowDynPricing(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={14} color='#059669' />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#065F46' }}>Prix dynamique calculé</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>{dynPriceResult.finalPrice.toFixed(2)} €/nuit</span>
                        <span style={{ fontSize: 10, color: '#6B7280' }}>{showDynPricing ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {showDynPricing && dynPriceResult.appliedRules.length > 0 && (
                      <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {dynPriceResult.appliedRules.map((rule, i) => (
                          <div key={i} style={{ fontSize: 11, color: '#065F46', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
                            {rule}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* BODY EXISTANT — Nom + Nationalité */}
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
                      set('nationality', c);
                      set('nationalityLabel', l);
                      const dial = COUNTRY_DIAL[c];
                      if (dial) {
                        const prevDial = COUNTRY_DIAL[form.nationality];
                        const isEmpty = !form.phone.trim();
                        const startsWithPrev = prevDial && form.phone.trim().startsWith(prevDial);
                        if (isEmpty) {
                          set('phone', dial + ' ');
                        } else if (startsWithPrev) {
                          set('phone', form.phone.replace(prevDial, dial));
                        }
                      }
                    }} />
                </div>

                {/* Email + Tel */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={Fst('email')} {...foc('email')}><Ico d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" /><input style={inp} type="email" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                  <div style={Fst('phone')} {...foc('phone')}><Ico d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18l3-.01" /><input style={inp} type="tel" placeholder="Téléphone" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
                </div>

                {/* Adultes + Enfants + Société */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={Fst('adults')} {...foc('adults')}><Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /><input style={{ ...inp, color: '#7C3AED', fontWeight: 700 }} type="number" placeholder="Adultes" min={1} value={form.adults} onChange={e => set('adults', +e.target.value || 1)} /></div>
                  <div style={Fst('children')} {...foc('children')}><Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><input style={{ ...inp, color: '#7C3AED', fontWeight: 700 }} type="number" placeholder="Enfants" min={0} value={form.children} onChange={e => set('children', +e.target.value || 0)} /></div>
                  <div style={Fst('company')} {...foc('company')}><Ico d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><input style={inp} type="text" placeholder="Société" value={form.company} onChange={e => set('company', e.target.value)} /></div>
                </div>

                {SEP}

                {/* Dates + Canal */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={Fst('checkIn')} {...foc('checkIn')}>
                    <Ico d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: 1 }}>Arrivée</div>
                      <input
                        style={inp}
                        type="date"
                        value={form.checkIn}
                        min={todayISO()}
                        onChange={e => {
                          const val = e.target.value;
                          if (val < todayISO()) {
                            window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Date invalide · L'arrivée ne peut pas être dans le passé" } }));
                            set('checkIn', todayISO());
                            return;
                          }
                          set('checkIn', val);
                          if (form.checkOut && form.checkOut <= val) {
                            const next = new Date(val);
                            next.setDate(next.getDate() + 1);
                            set('checkOut', next.toISOString().split('T')[0]);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={Fst('checkOut')} {...foc('checkOut')}>
                    <Ico d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: 1 }}>Départ</div>
                      <input
                        style={inp}
                        type="date"
                        value={form.checkOut}
                        min={form.checkIn || todayISO()}
                        onChange={e => {
                          const val = e.target.value;
                          if (val <= form.checkIn) {
                            window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Date invalide · Le départ doit être après l'arrivée" } }));
                            const next = new Date(form.checkIn);
                            next.setDate(next.getDate() + 1);
                            set('checkOut', next.toISOString().split('T')[0]);
                            return;
                          }
                          set('checkOut', val);
                        }}
                      />
                    </div>
                  </div>
                  <Sel icon={<Ico d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />}
                    value={form.channel} onChange={v => set('channel', v)} placeholder="Canal">
                    {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Sel>
                </div>

                {/* Référence + Type chambre + Numéro */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={Fst('reference')} {...foc('reference')}>
                    <Ico d="M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3m-1-4H9a1 1 0 0 0-1 1v4h8V4a1 1 0 0 0-1-1z" />
                    <input style={{ ...inp, color: '#7C3AED', fontWeight: 700, fontFamily: 'monospace' }} type="text" placeholder="Référence" value={form.reference} onChange={e => set('reference', e.target.value)} />
                  </div>
                  <Sel icon={<Ico d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />}
                    value={form.category} onChange={v => set('category', v)} placeholder="Type Chambre">
                    {['Simple','Double Classique','Double Deluxe','Twin','Suite','Suite Premium','Familiale'].map(t => <option key={t}>{t}</option>)}
                  </Sel>
                  <Sel icon={<Ico d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />}
                    value={form.roomNumber} onChange={v => set('roomNumber', v)} placeholder="Numéro">
                    {filteredRooms.map(r => <option key={r.number} value={r.number}>{r.number}{r.type ? ` — ${r.type}` : ''}</option>)}
                  </Sel>
                </div>

                {/* ── RÉFÉRENCE PARTENAIRE ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={Fst('partnerRef')} {...foc('partnerRef')}>
                    <Ico d="M13 10V3L4 14h7v7l9-11h-7z" color="#F59E0B" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1 }}>Réf. Partenaire / OTA</div>
                      <input style={{ ...inp, color: '#92400E', fontWeight: 700, fontFamily: 'monospace' }} type="text" placeholder="BKG-123456789…" value={(form as any).partnerRef ?? ''} onChange={e => set('partnerRef' as any, e.target.value)} />
                    </div>
                  </div>
                  <div style={Fst('partnerName')} {...foc('partnerName')}>
                    <Ico d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" color="#F59E0B" />
                    <input style={{ ...inp, color: '#78350F' }} type="text" placeholder="Booking.com, Expedia, Agoda…" value={(form as any).partnerName ?? ''} onChange={e => set('partnerName' as any, e.target.value)} />
                  </div>
                </div>

                {/* ── CHAMBRES SUPPLÉMENTAIRES ── */}
                <div style={{ background: '#F5F3FF', border: '1.5px solid #EDE9FE', borderRadius: 18, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      Chambres liées ({((form as any).roomSelections?.length ?? 0) + 1} au total)
                    </span>
                    <button onClick={() => (set as any)('roomSelections', [...((form as any).roomSelections ?? []), { roomNumber: '', roomType: '', adults: 2, children: 0 }])}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', color: '#7C3AED', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      + Chambre
                    </button>
                  </div>
                  {((form as any).roomSelections ?? []).map((sel: any, idx: number) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                      <Sel value={sel.roomNumber} onChange={v => {
                        const room = filteredRooms.find(r => r.number === v);
                        const next = ((form as any).roomSelections ?? []).map((r: any, i: number) => i === idx ? { ...r, roomNumber: v, roomType: room?.type ?? '' } : r);
                        (set as any)('roomSelections', next);
                      }} placeholder={`Chambre ${idx + 2}`}>
                        {filteredRooms.filter(r => !((form as any).roomSelections ?? []).some((s: any, i: number) => i !== idx && s.roomNumber === r.number) || r.number === sel.roomNumber).map(r => <option key={r.number} value={r.number}>{r.number} — {r.type}</option>)}
                      </Sel>
                      <div style={{ ...F, height: 44, padding: '0 10px' }}>
                        <input style={{ ...inp, fontSize: 12 }} type="number" placeholder="Adultes" min={1} value={sel.adults}
                          onChange={e => { const next = ((form as any).roomSelections ?? []).map((r: any, i: number) => i === idx ? { ...r, adults: +e.target.value || 1 } : r); (set as any)('roomSelections', next); }} />
                      </div>
                      <div style={{ ...F, height: 44, padding: '0 10px' }}>
                        <input style={{ ...inp, fontSize: 12 }} type="number" placeholder="Enfants" min={0} value={sel.children}
                          onChange={e => { const next = ((form as any).roomSelections ?? []).map((r: any, i: number) => i === idx ? { ...r, children: +e.target.value || 0 } : r); (set as any)('roomSelections', next); }} />
                      </div>
                      <button onClick={() => (set as any)('roomSelections', ((form as any).roomSelections ?? []).filter((_: any, i: number) => i !== idx))}
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>

                {/* Pension + Annulation + Plan tarifaire */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Sel icon={<Ico d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />}
                    value={form.board} onChange={v => set('board', v)}>
                    {['Room Only','Petit-déjeuner','Demi-pension','Pension complète'].map(b => <option key={b}>{b}</option>)}
                  </Sel>
                  <Sel icon={<Ico d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
                    value={form.cancelPolicy} onChange={v => set('cancelPolicy', v)}>
                    <option value="flexible">Flexible (72h)</option>
                    <option value="modere">Modérée (48h)</option>
                    <option value="stricte">Stricte (7j)</option>
                    <option value="non_remboursable">Non remboursable</option>
                  </Sel>
                  <Sel icon={<Ico d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />}
                    value={form.ratePlanId} onChange={v => set('ratePlanId', v)} placeholder="Plan tarifaire">
                    {RATE_PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </Sel>
                </div>

                {SEP}

                {/* RECAP FINANCIER */}
                <div style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 18, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" style={{ opacity: .7 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px' }}>Prix / nuit</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#8B5CF6' }}>{fmtEur(calc.pn)}</div>
                    </div>
                    <div style={{ width: 1, height: 32, background: '#F3F4F6' }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: calc.nights > 0 ? '#10B981' : '#F59E0B', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {calc.nights > 0
                        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>{calc.nights} nuit{calc.nights > 1 ? 's' : ''} · {form.adults + form.children} pers.</>
                        : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Sélectionnez chambre & dates</>}
                    </div>
                  </div>
                  {calc.nights > 0 && calc.pn > 0 && (
                    <>
                      {(calc.fromCalendar || calc.anyClosed) && (
                        <div style={{ padding: '6px 16px', display: 'flex', gap: 8, alignItems: 'center', background: calc.anyClosed ? '#FEF2F2' : '#ECFDF5', borderBottom: '1px solid #F3F4F6' }}>
                          {calc.anyClosed ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C' }}>
                              ⚠ Au moins une nuit est fermée sur ce plan tarifaire
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#047857' }}>
                              ✓ Tarifs récupérés depuis le Calendrier Tarifaire
                            </span>
                          )}
                        </div>
                      )}
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                          {['Date','Libellé','Montant'].map((h, i) => <th key={h} style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', padding: '10px 16px 7px', textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {Array.from({ length: calc.nights }).map((_, i) => {
                            const d = new Date(form.checkIn); d.setDate(d.getDate() + i);
                            const room = baseRooms.find(r => r.number === form.roomNumber);
                            const breakdownNight = calc.breakdown?.nights[i];
                            const nightPrice = breakdownNight?.price ?? calc.pn;
                            const fromCalendar = breakdownNight?.source === 'calendar';
                            const isClosed = breakdownNight?.source === 'closed';
                            return <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                              <td style={{ fontSize: 12, color: '#6B7280', padding: '8px 16px' }}>{d.toLocaleDateString('fr-FR')}</td>
                              <td style={{ fontSize: 12, fontStyle: 'italic', color: isClosed ? '#B91C1C' : '#9CA3AF', padding: '8px 16px' }}>
                                Nuitée — {room?.type ?? 'Chambre'}
                                {fromCalendar && <span style={{ marginLeft: 6, fontStyle: 'normal', fontSize: 9, fontWeight: 700, color: '#047857', background: '#D1FAE5', padding: '1px 5px', borderRadius: 3 }}>CAL</span>}
                                {isClosed && <span style={{ marginLeft: 6, fontStyle: 'normal', fontSize: 9, fontWeight: 700, color: '#B91C1C', background: '#FEE2E2', padding: '1px 5px', borderRadius: 3 }}>FERMÉ</span>}
                              </td>
                              <td style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', padding: '8px 16px', color: isClosed ? '#B91C1C' : undefined }}>{fmtEur(nightPrice)}</td>
                            </tr>;
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                  <div style={{ padding: '10px 16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>HT</span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{fmtEur(calc.ht)}</span>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>TVA {form.vatRate}%</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{fmtEur(calc.tva)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>Taxe séjour</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{fmtEur(calc.tax)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#F5F3FF' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Total TTC</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#8B5CF6', letterSpacing: '-.5px' }}>{fmtEur(calc.ttc)}</span>
                  </div>
                </div>

                {SEP}

                {/* PAIEMENT + NOTES */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>

                  {/* Colonne gauche : paiement */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Chips */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[['30','Acompte 30%'],['50','Acompte 50%'],['100','Totalité 100%']].map(([v,lbl]) => (
                        <div key={v} onClick={() => set('linkType', v)} style={{ flex: 1, padding: '10px 4px', borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', border: `1.5px solid ${form.linkType === v ? '#8B5CF6' : '#EDE9FE'}`, background: form.linkType === v ? '#EDE9FE' : '#F5F3FF', color: form.linkType === v ? '#6D28D9' : '#C4B5FD' }}>{lbl}</div>
                      ))}
                    </div>
                    {/* Stripe / PayPal */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[['stripe','Stripe'],['paypal','PayPal']].map(([p,lbl]) => (
                        <button key={p} onClick={() => set('processor', p)} style={{ flex: 1, height: 42, borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all .15s', border: `1.5px solid ${form.processor === p ? '#8B5CF6' : '#EDE9FE'}`, background: form.processor === p ? '#EDE9FE' : '#F5F3FF', color: form.processor === p ? '#6D28D9' : '#C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {p === 'stripe'
                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#635BFF"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/></svg>
                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="#003087"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/></svg>}
                          {lbl}
                        </button>
                      ))}
                    </div>
                    {/* Générer */}
                    <button onClick={() => { if (!calc.ttc) return; const ref = 'FLTM-' + crypto.randomUUID().slice(0, 6).toUpperCase(); setLinkUrl(`https://pay.flowtym.com/${form.processor}/${ref}?pct=${form.linkType}`); }}
                      style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: '#fff', fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(139,92,246,.3)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      Générer le lien de paiement
                    </button>
                    {linkUrl && (
                      <div style={{ padding: '9px 11px', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 9, fontSize: 11, color: '#065F46', wordBreak: 'break-all', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                        <div><div style={{ fontSize: 10, fontWeight: 700, marginBottom: 2 }}>Lien généré</div>{linkUrl}</div>
                      </div>
                    )}

                    {/* ═══ GARANTIE ═══ */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: '#F5F3FF', border: '1.5px solid #EDE9FE', borderRadius: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {(['aucune','cb','virement','especes','cheque','paypal','amex','diners','jcb','debiteur'] as const).map(type => (
                          <button key={type} title={{ aucune:'Aucune garantie',cb:'Garantie par CB',virement:'Garantie par virement',especes:'Garantie en espèces',cheque:'Garantie par chèque',paypal:'Garantie PayPal',amex:'American Express',diners:'Diners Club',jcb:'JCB',debiteur:'Compte débiteur' }[type]}
                            onClick={() => set('guaranteeType', type)} style={{ width: 36, height: 36, borderRadius: 10, cursor: 'pointer', transition: 'all .15s', border: `1.5px solid ${form.guaranteeType===type?'#8B5CF6':'#EDE9FE'}`, background: form.guaranteeType===type?'#EDE9FE':'#fff', color: form.guaranteeType===type?'#7C3AED':'#C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: form.guaranteeType===type?'0 0 0 3px rgba(139,92,246,.13)':'none' }}>
                            {GUAR_ICONS[type]}
                          </button>
                        ))}
                        <div style={{ width: 1, height: 24, background: '#DDD6FE', margin: '0 2px' }} />
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', color: guarCfg.color, background: guarCfg.bg, border: `1.5px solid ${guarCfg.border}` }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: guarCfg.color, flexShrink: 0, display: 'inline-block' }} />
                          {guarCfg.lbl}
                        </span>
                      </div>
                      {/* Préautorisation */}
                      <div onClick={() => { setPaRuleDraft(effectivePaRule); setPaOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#fff', borderRadius: 10, border: '1.5px solid #EDE9FE', cursor: 'pointer', transition: 'border-color .15s' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1 }}>{paDisplay}</span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Colonne droite : notes + docs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ ...F, height: 'auto', alignItems: 'flex-start', padding: '14px 16px', borderRadius: 14 }}>
                      <Ico d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6" />
                      <textarea rows={4} placeholder="Notes, demandes spéciales…" value={form.notes}
                        onChange={e => set('notes', e.target.value)}
                        style={{ ...inp, resize: 'none', fontWeight: 400, lineHeight: 1.55, color: '#374151' }} />
                    </div>
                    <div style={{ border: '2px dashed #DDD6FE', borderRadius: 14, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#F5F3FF' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                      <span style={{ fontSize: 11.5, color: '#A78BFA', fontWeight: 500, textAlign: 'center', lineHeight: 1.4 }}>Glissez vos fichiers ici<br/><span style={{ fontSize: 10, opacity: .7 }}>PDF · Image · HTML</span></span>
                      <input
                        id="file-browse-input"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.html"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => {
                          const files = Array.from(e.target.files || []) as File[];
                          if (files.length > 0) {
                            window.dispatchEvent(new CustomEvent('app-toast', {
                              detail: { message: `${files.length} fichier(s) ajouté(s) · ${files.map((f: File) => f.name).join(', ')}` }
                            }));
                          }
                        }}
                      />
                      <button
                        onClick={() => document.getElementById('file-browse-input')?.click()}
                        style={{ padding: '5px 13px', borderRadius: 8, border: '1.5px solid #DDD6FE', background: '#fff', fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, color: '#8B5CF6', cursor: 'pointer' }}
                      >Parcourir</button>
                    </div>
                  </div>
                </div>

                {/* SEGMENT CLIENT */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
                  <Sel
                    icon={
                      SEGMENTS.find(s => s.value === form.segment)?.icon || (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                      )
                    }
                    value={form.segment}
                    onChange={v => set('segment', v)}
                    placeholder="Segment client"
                  >
                    {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Sel>
                </div>

                {/* BOTTOM ACTIONS */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid #F3F4F6', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {/* Proforma PDF */}
                    <button
                      onClick={handleProforma}
                      title="Générer la facture proforma PDF"
                      style={{ width: 42, height: 42, borderRadius: 12, border: '1.5px solid #FECDD3', background: '#FFF1F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FFE4E6'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#FFF1F2'; }}
                    >
                      {/* Icône PDF épurée */}
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <path d="M8 13h2.5a1.5 1.5 0 0 1 0 3H8v-3zm0 3v2"/>
                      </svg>
                    </button>

                    {/* Envoyer email + lien paiement */}
                    <button
                      onClick={() => handleSendEmail()}
                      title="Envoyer confirmation + lien de paiement"
                      style={{ width: 42, height: 42, borderRadius: 12, border: '1.5px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#DCFCE7'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F0FDF4'; }}
                    >
                      {/* Icône Send épurée */}
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m22 2-7 20-4-9-9-4z"/>
                        <path d="M22 2 11 13"/>
                      </svg>
                    </button>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#9CA3AF', cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={form.sendConfirmation} onChange={e => set('sendConfirmation', e.target.checked)} style={{ accentColor: '#8B5CF6', width: 14, height: 14 }} />
                      Envoyer confirmation
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={onClose} style={{ padding: '12px 20px', borderRadius: 14, border: '1.5px solid #EDE9FE', background: '#F5F3FF', fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: '#A78BFA', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <X size={13} /> Annuler
                    </button>
                    <button onClick={handleSave} style={{ padding: '12px 26px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(139,92,246,.3)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      {editId ? 'Mettre à jour' : 'Enregistrer'}
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
                { rule: '0',           icon: Search,    lbl: 'Vérification carte', val: '0€' },
                { rule: 'first_night', icon: Moon,      lbl: '1ère nuitée',        val: calc.pn  > 0 ? fmtEur(calc.pn)  : '—' },
                { rule: 'total',       icon: Banknote,  lbl: 'Total séjour',       val: calc.ttc > 0 ? fmtEur(calc.ttc) : '—' },
              ] as const).map(({ rule, icon: PaIcon, lbl, val }) => {
                const locked = isNanr && rule !== 'total';
                const active = paRuleDraft === rule;
                return (
                  <div key={rule} onClick={() => !locked && setPaRuleDraft(rule)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, cursor: locked ? 'not-allowed' : 'pointer', border: `1.5px solid ${active ? '#8B5CF6' : '#E5E7EB'}`, background: active ? '#EDE9FE' : '#F9FAFB', opacity: locked ? .35 : 1, transition: 'all .15s' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? '#8B5CF6' : '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <PaIcon size={15} strokeWidth={1.75} color={active ? '#FFFFFF' : '#8B5CF6'} />
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? '#6D28D9' : '#374151', flex: 1 }}>{lbl}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: active ? '#8B5CF6' : '#9CA3AF' }}>{val}</span>
                  </div>
                );
              })}
            </div>
            {isNanr && (
              <div style={{ marginTop: 10, padding: '8px 11px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 9, fontSize: 11, color: '#92400E', display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Politique Non remboursable — préautorisation forcée sur le total séjour.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setPaOpen(false)} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>Annuler</button>
              <button onClick={() => { set('preauthRule', paRuleDraft); setPaOpen(false); }} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(139,92,246,.3)' }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReservationFormModal;
