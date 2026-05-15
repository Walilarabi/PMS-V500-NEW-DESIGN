import React, { useState, useMemo } from 'react';
import { RefreshCw, Settings, TrendingUp, TrendingDown, Zap, Lock, Info, ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayData {
  date: string;
  event: string;
  currentPrice: number;
  minCompset: number;
  medianCompset: number;
  maxCompset: number;
  pickupPct: number;
  leadTime: number;
  occupancy: number;
  marketPressure: number;
}

interface RuleResult {
  finalPrice: number;
  triggeredRules: string[];
  mlos: number;
  ctaOn: boolean;
  dps: number;
  pickupNormalized: number;
}

// ─── Données mock 14 jours ─────────────────────────────────────────────────────
const buildMockData = (): DayData[] => {
  const today = new Date();
  const events = [
    'Salon du Livre', '—', 'Concert Jazz', '—', '—', 'Week-end', 'Week-end',
    'Vivatech', 'Vivatech', '—', 'Fête Nationale', 'Week-end', 'Week-end', '—',
  ];
  const currentPrices   = [185,185,190,175,170,210,220,250,245,165,230,215,205,175];
  const minCompsets     = [165,162,168,155,150,190,195,215,210,148,200,185,178,155];
  const medianCompsets  = [180,178,182,170,168,205,210,235,228,162,218,202,195,170];
  const maxCompsets     = [195,192,198,188,185,225,230,258,252,182,242,225,218,188];
  const pickupPcts      = [12,-5,18,-25,-10,35,28,55,48,-30,42,22,15,-8];
  const leadTimes       = [0,1,2,3,5,10,15,21,22,0,8,12,18,4];
  const occupancies     = [45,55,70,85,92,65,60,88,82,38,75,68,62,50];
  const marketPressures = [35,40,55,72,85,45,42,82,78,28,65,55,48,40];

  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      event: events[i] ?? '—',
      currentPrice: currentPrices[i],
      minCompset: minCompsets[i],
      medianCompset: medianCompsets[i],
      maxCompset: maxCompsets[i],
      pickupPct: pickupPcts[i],
      leadTime: leadTimes[i],
      occupancy: occupancies[i],
      marketPressure: marketPressures[i],
    };
  });
};

// ─── Moteur DPS ───────────────────────────────────────────────────────────────
const normalizePickup = (pct: number): number => {
  const n = (pct + 100) / 200;
  return Math.min(1, Math.max(0, n)) * 100;
};

const calcDPS = (occ: number, pickupNorm: number, market: number): number =>
  occ * 0.4 + pickupNorm * 0.3 + market * 0.3;

// ─── Moteur de règles (cumulatif, ordre strict) ───────────────────────────────
const applyRules = (day: DayData): RuleResult => {
  const pickupNorm = normalizePickup(day.pickupPct);
  const dps = calcDPS(day.occupancy, pickupNorm, day.marketPressure);

  // 1. Filet sécurité
  let price = day.medianCompset;
  const priceMin = day.minCompset * 0.9;
  const priceMax = day.maxCompset * 1.1;
  const triggered: string[] = [];

  // 2. Pickup
  if (day.pickupPct < -20) {
    price *= 0.90;
    triggered.push('Pickup < -20% → -10%');
  } else if (day.pickupPct > 20) {
    price *= 1.10;
    triggered.push('Pickup > +20% → +10%');
  }

  // 3. Last Minute
  if (day.leadTime <= 2 && day.occupancy < 50) {
    price *= 0.85;
    triggered.push('Last Minute (J≤2, Occ<50%) → -15%');
  }

  // 4. Haute demande
  if (day.occupancy >= 85) {
    price *= 1.15;
    triggered.push('Haute demande (Occ≥85%) → +15%');
  }

  // 5. Lead Time
  if (day.leadTime > 20) {
    price *= 1.10;
    triggered.push('Lead time > 20j → +10%');
  } else if (day.leadTime < 5 && day.leadTime > 2) {
    price *= 0.90;
    triggered.push('Lead time < 5j → -10%');
  }

  // 6. Compression marché
  if (day.marketPressure > 70) {
    price *= 1.20;
    triggered.push('Compression marché >70% → +20%');
  }

  // Bornage final
  const finalPrice = Math.round(Math.min(priceMax, Math.max(priceMin, price)));

  // 7. Restrictions
  const mlos = dps > 70 ? 2 : 1;
  const ctaOn = day.occupancy > 90;

  return { finalPrice, triggeredRules: triggered, mlos, ctaOn, dps, pickupNormalized: pickupNorm };
};

// ─── Helpers visuels ──────────────────────────────────────────────────────────
const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return {
    day: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
    num: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
  };
};

const dpsColor = (dps: number) => {
  if (dps >= 80) return { bg: '#FEF2F2', color: '#DC2626', label: 'Pic' };
  if (dps >= 60) return { bg: '#FFF7ED', color: '#D97706', label: 'Fort' };
  if (dps >= 40) return { bg: '#FFFBEB', color: '#CA8A04', label: 'Moyen' };
  return { bg: '#EFF6FF', color: '#2563EB', label: 'Faible' };
};

const pctColor = (pct: number) =>
  pct > 10 ? '#059669' : pct < -10 ? '#DC2626' : '#64748B';

const occColor = (occ: number) =>
  occ >= 85 ? '#DC2626' : occ >= 70 ? '#D97706' : occ >= 50 ? '#059669' : '#2563EB';

const priceVariation = (rec: number, curr: number) => {
  const diff = rec - curr;
  const pct = ((diff / curr) * 100).toFixed(1);
  return { diff, pct, up: diff > 0 };
};

// ─── Indicateurs (lignes) ─────────────────────────────────────────────────────
type Section = 'compset' | 'signaux' | 'moteur' | 'recommandation' | 'restrictions';

const SECTIONS: { id: Section; label: string; color: string; bg: string }[] = [
  { id: 'compset',       label: 'Compset',            color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'signaux',       label: 'Signaux de demande',  color: '#2563EB', bg: '#EFF6FF' },
  { id: 'moteur',        label: 'Moteur RMS',          color: '#D97706', bg: '#FFF7ED' },
  { id: 'recommandation',label: 'Recommandation',      color: '#059669', bg: '#ECFDF5' },
  { id: 'restrictions',  label: 'Restrictions',        color: '#64748B', bg: '#F8FAFC' },
];

// ─── Composant principal ──────────────────────────────────────────────────────
export const RMSTableau: React.FC = () => {
  const [rawData, setRawData] = useState<DayData[]>(buildMockData);
  const [rulesApplied, setRulesApplied] = useState(false);
  const [collapsed, setCollapsed] = useState<Partial<Record<Section, boolean>>>({});
  const [highlightCol, setHighlightCol] = useState<number | null>(null);

  const results: RuleResult[] = useMemo(() => rawData.map(applyRules), [rawData]);

  const handleRefresh = () => {
    setRawData(buildMockData());
    setRulesApplied(false);
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: 'Tableau RMS rafraîchi · Données recalculées' }
    }));
  };

  const handleApplyRules = () => {
    setRulesApplied(true);
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: 'Règles appliquées · Tarifs recommandés mis à jour' }
    }));
  };

  const toggleSection = (id: Section) =>
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const days = rawData.length;

  // ─── Cellule d'en-tête de colonne ─────────────────────────────────────────
  const ColHeader: React.FC<{ i: number }> = ({ i }) => {
    const d = fmtDate(rawData[i].date);
    const res = results[i];
    const dps = dpsColor(res.dps);
    const isToday = i === 0;
    const isHighlight = highlightCol === i;
    return (
      <th
        className="relative select-none cursor-pointer"
        onMouseEnter={() => setHighlightCol(i)}
        onMouseLeave={() => setHighlightCol(null)}
        style={{
          minWidth: 88, maxWidth: 110, padding: '10px 6px',
          background: isHighlight
            ? 'linear-gradient(180deg,#6D28D9,#5B21B6)'
            : isToday
            ? 'linear-gradient(180deg,#7C3AED,#6D28D9)'
            : 'linear-gradient(180deg,#8B5CF6,#7C3AED)',
          borderRight: '1px solid rgba(255,255,255,0.12)',
          textAlign: 'center', verticalAlign: 'middle',
          transition: 'background .15s',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.95)', textTransform: 'capitalize' }}>
          {d.day}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginTop: 1 }}>{d.num}</div>
        {isToday && (
          <div style={{ fontSize: 8, fontWeight: 800, background: '#FCD34D', color: '#78350F', borderRadius: 100, padding: '1px 6px', marginTop: 3, display: 'inline-block' }}>
            AUJOURD'HUI
          </div>
        )}
        <div style={{
          marginTop: 4, fontSize: 9, fontWeight: 700, padding: '2px 6px',
          borderRadius: 100, background: dps.color + '30', color: dps.color,
          border: `1px solid ${dps.color}50`,
        }}>
          DPS {Math.round(res.dps)} · {dps.label}
        </div>
      </th>
    );
  };

  // ─── Cellule générique ─────────────────────────────────────────────────────
  const Cell: React.FC<{ i: number; children: React.ReactNode; bg?: string }> = ({ i, children, bg }) => (
    <td style={{
      padding: '0', textAlign: 'center', verticalAlign: 'middle',
      borderRight: '1px solid #F1F5F9',
      background: highlightCol === i ? '#F5F3FF' : (bg ?? 'white'),
      transition: 'background .15s',
      fontSize: 12, width: 90, maxWidth: 90, minWidth: 90, height: 52,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4px 6px' }}>
        {children}
      </div>
    </td>
  );

  // ─── Row header ───────────────────────────────────────────────────────────
  const RowLabel: React.FC<{ icon: string; label: string; locked?: boolean; sub?: string }> = ({ icon, label, locked, sub }) => (
    <td style={{
      position: 'sticky', left: 0, zIndex: 2, background: 'white',
      borderRight: '2px solid #E2E8F0', padding: '9px 12px',
      minWidth: 168, maxWidth: 168, width: 168, whiteSpace: 'nowrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', color: '#94A3B8', flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: icon }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: '#94A3B8' }}>{sub}</div>}
        </div>
        {locked && <Lock style={{ width: 10, height: 10, color: '#CBD5E1', marginLeft: 'auto' }} />}
      </div>
    </td>
  );

  // ─── Section Header Row ────────────────────────────────────────────────────
  const SectionRow: React.FC<{ sec: typeof SECTIONS[number] }> = ({ sec }) => (
    <tr>
      <td
        onClick={() => toggleSection(sec.id)}
        style={{
          position: 'sticky', left: 0, zIndex: 2,
          background: sec.bg, borderRight: `3px solid ${sec.color}`,
          padding: '7px 14px', cursor: 'pointer', userSelect: 'none',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, color: sec.color, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
          {sec.label}
        </span>
        <ChevronDown size={12} color={sec.color} style={{ transform: collapsed[sec.id] ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }} />
      </td>
      {rawData.map((_, i) => (
        <td key={i} style={{ background: sec.bg, borderRight: '1px solid rgba(255,255,255,0.5)', padding: '7px 0' }} />
      ))}
    </tr>
  );

  return (
    <div style={{ padding: '20px 24px', fontFamily: 'Inter, sans-serif' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Tableau RMS — DPS & Pricing Engine
          </h2>
          <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
            Indicateurs · Compset · Moteur de règles (cumulatif) · Tarifs recommandés sur 14 jours
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Légende DPS */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, color: '#64748B', marginRight: 8 }}>
            {[
              { label: 'Faible', color: '#2563EB' },
              { label: 'Moyen', color: '#CA8A04' },
              { label: 'Fort', color: '#D97706' },
              { label: 'Pic', color: '#DC2626' },
            ].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Pull D-Edge · Données compset actualisées' } })); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, border: '1px solid #E2E8F0', background: 'white', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
            Pull D-Edge
          </button>
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Export Excel · Tableau RMS téléchargé' } })); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, border: '1px solid #BBF7D0', background: '#F0FDF4', fontSize: 12, fontWeight: 600, color: '#166534', cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13l2.5 4M13 13l-2.5 4M8 17h5"/></svg>
            Export Excel
          </button>
          <button
            onClick={handleRefresh}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, border: '1px solid #E2E8F0', background: 'white', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Recalculer
          </button>
          <button
            onClick={handleApplyRules}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 0-14.14 0M21 12a9 9 0 0 1-9 9"/></svg>
            Appliquer les règles
          </button>
        </div>
      </div>

      {/* ── TABLEAU ── */}
      <div style={{ overflowX: 'auto', borderRadius: 20, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', minWidth: 900 }}>

          {/* THEAD */}
          <thead>
            <tr>
              {/* Coin en-tête */}
              <th style={{
                position: 'sticky', left: 0, zIndex: 3,
                background: 'linear-gradient(135deg,#1E293B,#0F172A)',
                padding: '12px 12px', textAlign: 'left', minWidth: 168, width: 168,
                borderRight: '2px solid rgba(255,255,255,0.15)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Indicateur / Date</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{days} jours · Règles cumulatives</div>
              </th>
              {rawData.map((_, i) => <ColHeader key={i} i={i} />)}
            </tr>
          </thead>

          <tbody>

            {/* ══ ÉVÉNEMENT ══ */}
            {!collapsed['compset'] && (
              <tr style={{ background: '#FAFBFF' }}>
                <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`} label="Événement" sub="Calendrier local" />
                {rawData.map((d, i) => (
                  <Cell key={i} i={i} bg="#FAFBFF">
                    <span style={{
                      fontSize: 11, fontWeight: d.event !== '—' ? 700 : 400,
                      color: d.event !== '—' ? '#7C3AED' : '#CBD5E1',
                    }}>
                      {d.event !== '—' ? '🎯 ' : ''}{d.event}
                    </span>
                  </Cell>
                ))}
              </tr>
            )}

            {/* ══ SECTION COMPSET ══ */}
            <SectionRow sec={SECTIONS[0]} />
            {!collapsed['compset'] && (
              <>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`} label="Tarif actuel" locked sub="Prix hôtel ce jour" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{d.currentPrice} €</span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`} label="Min compset" locked sub="Concurrent le + bas" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{d.minCompset} €</span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`} label="Médiane compset" locked sub="Prix marché central" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i} bg="#FAFBFF">
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>{d.medianCompset} €</span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`} label="Max compset" locked sub="Concurrent le + haut" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>{d.maxCompset} €</span>
                    </Cell>
                  ))}
                </tr>
              </>
            )}

            {/* ══ SECTION SIGNAUX ══ */}
            <SectionRow sec={SECTIONS[1]} />
            {!collapsed['signaux'] && (
              <>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`} label="Pickup vs N-1" sub="Rythme de réservation" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        {d.pickupPct > 0
                          ? <TrendingUp size={11} color="#059669" />
                          : <TrendingDown size={11} color="#DC2626" />
                        }
                        <span style={{ fontSize: 12, fontWeight: 700, color: pctColor(d.pickupPct) }}>
                          {d.pickupPct > 0 ? '+' : ''}{d.pickupPct}%
                        </span>
                      </div>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`} label="Lead time" sub="Jours avant arrivée" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i} bg="#FAFBFF">
                      <span style={{ fontSize: 12, fontWeight: 600, color: d.leadTime <= 2 ? '#DC2626' : d.leadTime > 20 ? '#059669' : '#475569' }}>
                        {d.leadTime} j
                      </span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`} label="Occupation" sub="Taux de remplissage" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <div style={{ display: 'flex', align: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: occColor(d.occupancy) }}>{d.occupancy}%</span>
                        <div style={{ height: 4, borderRadius: 100, background: '#F1F5F9', margin: '0 auto', width: 48, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${d.occupancy}%`, background: occColor(d.occupancy), borderRadius: 100, transition: 'width .4s' }} />
                        </div>
                      </div>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`} label="Pression marché" locked sub="Source scraping / RMS" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i} bg="#FAFBFF">
                      <span style={{ fontSize: 12, fontWeight: 700, color: d.marketPressure > 70 ? '#DC2626' : d.marketPressure > 50 ? '#D97706' : '#64748B' }}>
                        {d.marketPressure}%
                      </span>
                    </Cell>
                  ))}
                </tr>
              </>
            )}

            {/* ══ SECTION MOTEUR ══ */}
            <SectionRow sec={SECTIONS[2]} />
            {!collapsed['moteur'] && (
              <>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>`} label="DPS (Demand Score)" sub="Score 0→100 pondéré" />
                  {results.map((r, i) => {
                    const dps = dpsColor(r.dps);
                    return (
                      <Cell key={i} i={i} bg={dps.bg}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: dps.color }}>{Math.round(r.dps)}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: dps.color, textTransform: 'uppercase' }}>{dps.label}</span>
                        </div>
                      </Cell>
                    );
                  })}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 0-14.14 0M21 12a9 9 0 0 1-9 9"/></svg>`} label="Règles déclenchées" sub="Survol → détail" />
                  {results.map((r, i) => (
                    <Cell key={i} i={i}>
                      {r.triggeredRules.length === 0 ? (
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#CBD5E1', margin: 'auto' }}>0</div>
                      ) : (
                        <div style={{ position: 'relative', display: 'inline-block' }}
                          onMouseEnter={e => { const t = e.currentTarget.querySelector('.rms-tip') as HTMLElement; if(t) t.style.display='block'; }}
                          onMouseLeave={e => { const t = e.currentTarget.querySelector('.rms-tip') as HTMLElement; if(t) t.style.display='none'; }}
                        >
                          {/* Bulle */}
                          <div style={{ width: 28, height: 28, borderRadius: '50%', cursor: 'default', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: 'white', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(139,92,246,0.35)' }}>
                            {r.triggeredRules.length}
                          </div>
                          {/* Tooltip */}
                          <div className="rms-tip" style={{ display: 'none', position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: '#1E293B', borderRadius: 12, padding: '10px 14px', minWidth: 230, maxWidth: 290, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.08)', pointerEvents: 'none' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 7 }}>{r.triggeredRules.length} règle{r.triggeredRules.length > 1 ? 's' : ''} déclenchée{r.triggeredRules.length > 1 ? 's' : ''}</div>
                            {r.triggeredRules.map((rule, j) => (
                              <div key={j} style={{ fontSize: 11, color: '#E2E8F0', fontWeight: 500, padding: '4px 0', borderBottom: j < r.triggeredRules.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#A78BFA', flexShrink: 0, display: 'inline-block' }} />
                                {rule}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Cell>
                  ))}
                </tr>
              </>
            )}

            {/* ══ SECTION RECOMMANDATION ══ */}
            <SectionRow sec={SECTIONS[3]} />
            {!collapsed['recommandation'] && (
              <tr style={{ background: '#F0FDF4' }}>
                <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`} label="Tarif recommandé" sub={rulesApplied ? '✓ Règles appliquées' : '⚠ Appuyer sur Appliquer'} />
                {results.map((r, i) => {
                  const v = priceVariation(r.finalPrice, rawData[i].currentPrice);
                  return (
                    <Cell key={i} i={i} bg="#F0FDF4">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>
                          {r.finalPrice} €
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: v.up ? '#059669' : '#DC2626',
                          display: 'flex', alignItems: 'center', gap: 2,
                        }}>
                          {v.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                          {v.up ? '+' : ''}{v.diff} € ({v.up ? '+' : ''}{v.pct}%)
                        </span>
                      </div>
                    </Cell>
                  );
                })}
              </tr>
            )}

            {/* ══ SECTION RESTRICTIONS ══ */}
            <SectionRow sec={SECTIONS[4]} />
            {!collapsed['restrictions'] && (
              <>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`} label="MLOS (min nuits)" sub="DPS > 70 → 2 nuits" />
                  {results.map((r, i) => (
                    <Cell key={i} i={i} bg={r.mlos > 1 ? '#F5F3FF' : 'white'}>
                      <span style={{ fontSize: 12, fontWeight: r.mlos > 1 ? 700 : 400, color: r.mlos > 1 ? '#7C3AED' : '#CBD5E1' }}>
                        {r.mlos > 1 ? `🔒 ${r.mlos} nuits` : '— 1 nuit'}
                      </span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><line x1="15" y1="12" x2="15.01" y2="12"/></svg>`} label="CTA (fermer arrivées)" sub="Occ veille > 90%" />
                  {results.map((r, i) => (
                    <Cell key={i} i={i} bg={r.ctaOn ? '#FEF2F2' : 'white'}>
                      <span style={{ fontSize: 12, fontWeight: r.ctaOn ? 700 : 400, color: r.ctaOn ? '#DC2626' : '#CBD5E1' }}>
                        {r.ctaOn ? '🚪 CTA ON' : '—'}
                      </span>
                    </Cell>
                  ))}
                </tr>
              </>
            )}

          </tbody>
        </table>
      </div>

      {/* ── FORMULE ── */}
      <div style={{
        marginTop: 16, padding: '14px 18px', borderRadius: 16,
        background: '#1E293B', color: 'rgba(255,255,255,0.85)',
        fontSize: 11, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.8,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#A78BFA', marginBottom: 6, fontFamily: 'Inter, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Formule finale (bornée)
        </div>
        <code style={{ color: '#34D399' }}>Prix = MIN( MAX( Médiane_Compset</code>
        <code style={{ color: '#FCD34D' }}> × IF(Pickup&lt;-20%, 0.9, IF(Pickup&gt;20%, 1.1, 1))</code>
        <code style={{ color: '#FB923C' }}> × IF(J≤2 ET Occ&lt;50%, 0.85, 1)</code>
        <code style={{ color: '#F87171' }}> × IF(Occ≥85%, 1.15, 1)</code>
        <code style={{ color: '#A78BFA' }}> × IF(J&gt;20, 1.1, IF(J&lt;5, 0.9, 1))</code>
        <code style={{ color: '#22D3EE' }}> × IF(Marché&gt;70%, 1.2, 1)</code>
        <code style={{ color: '#34D399' }}>, Min_Compset×0.9 ), Max_Compset×1.1 )</code>
      </div>

      {/* ── INFO DPS ── */}
      <div style={{ marginTop: 10, padding: '12px 16px', borderRadius: 14, background: '#EDE9FE', border: '1px solid #DDD6FE', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Info size={14} color="#7C3AED" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 11, color: '#5B21B6', lineHeight: 1.6 }}>
          <strong>DPS = </strong>Occupation × 0.4 + Pickup_normalisé × 0.3 + Pression_marché × 0.3
          &nbsp;·&nbsp; <strong>Pickup_normalisé</strong> = MIN(MAX((Pickup+100)/200, 0), 1) × 100
          &nbsp;·&nbsp; Données <Lock size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> figées — source externe (scraping / ClickHouse)
        </div>
      </div>
    </div>
  );
};
