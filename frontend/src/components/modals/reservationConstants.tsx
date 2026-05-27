import React, { useState, useRef, useMemo, useEffect } from 'react';
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