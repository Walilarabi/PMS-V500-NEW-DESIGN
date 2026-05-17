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
  occ >= 85 ? '#DC2626' : occ >= 70 ? '#D97706' : occ >= 50 ? '#CA8A04' : '#2563EB';

const priceVariation = (newP: number, oldP: number) => {
  const diff = newP - oldP;
  const pct = oldP > 0 ? Math.round((diff / oldP) * 100) : 0;
  return { diff, pct, up: diff >= 0 };
};

// ─── Composant principal ──────────────────────────────────────────────────────
export const RMSTableau: React.FC = () => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [rulesApplied, setRulesApplied] = useState(false);

  const rawData = useMemo(() => buildMockData(), []);
  const results = useMemo(() => rawData.map(applyRules), [rawData]);

  const toggle = (sec: string) => setCollapsed(c => ({ ...c, [sec]: !c[sec] }));

  // Sections
  const SECTIONS = [
    { id: 'compset', label: 'Compétition (Compset)', bg: 'linear-gradient(135deg,#E0E7FF,#C7D2FE)' },
    { id: 'signaux', label: 'Signaux Marché', bg: 'linear-gradient(135deg,#FEF3C7,#FDE68A)' },
    { id: 'moteur', label: 'Moteur RMS', bg: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)' },
    { id: 'recommandation', label: 'Tarif Recommandé', bg: 'linear-gradient(135deg,#D1FAE5,#A7F3D0)' },
    { id: 'restrictions', label: 'Restrictions', bg: 'linear-gradient(135deg,#FCE7F3,#FBCFE8)' },
  ];

  // Composants
  const Cell: React.FC<{ i: number; bg?: string; children: React.ReactNode }> = ({ i, bg, children }) => (
    <td style={{ width: 100, minWidth: 100, maxWidth: 100, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.5)', padding: '7px 4px', background: bg || 'white', position: 'relative' }}>
      {children}
    </td>
  );

  const RowLabel: React.FC<{ icon: string; label: string; sub?: string }> = ({ icon, label, sub }) => (
    <td style={{ position: 'sticky', left: 0, width: 180, minWidth: 180, background: '#F8FAFC', borderRight: '2px solid #CBD5E1', padding: '7px 10px', zIndex: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div dangerouslySetInnerHTML={{ __html: icon }} style={{ width: 14, height: 14, flexShrink: 0, color: '#64748B' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
          {sub && <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
    </td>
  );

  const SectionRow: React.FC<{ sec: typeof SECTIONS[number] }> = ({ sec }) => (
    <tr onClick={() => toggle(sec.id)} style={{ cursor: 'pointer', background: sec.bg, borderTop: '2px solid white', borderBottom: '1px solid rgba(255,255,255,0.7)' }}>
      <td style={{ position: 'sticky', left: 0, padding: '9px 12px', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6, zIndex: 2, background: sec.bg }}>
        <span>{sec.label}</span>
        <ChevronDown size={13} style={{ transform: collapsed[sec.id] ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }} />
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
            onClick={() => setRulesApplied(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(139,92,246,0.3)' }}
          >
            <Zap size={13} />
            Appliquer les règles
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <Settings size={13} />
            Config
          </button>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 14, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <tbody>
            {/* ══ HEADER DATES ══ */}
            <tr style={{ background: 'linear-gradient(135deg,#F1F5F9,#E2E8F0)', borderBottom: '2px solid #CBD5E1' }}>
              <td style={{ position: 'sticky', left: 0, width: 180, minWidth: 180, background: 'linear-gradient(135deg,#F1F5F9,#E2E8F0)', zIndex: 3, padding: '10px', fontWeight: 900, fontSize: 10, textTransform: 'uppercase', color: '#64748B', borderRight: '2px solid #CBD5E1' }}>
                Date / Métrique
              </td>
              {rawData.map((d, i) => {
                const dt = fmtDate(d.date);
                return (
                  <td key={i} style={{ width: 100, minWidth: 100, maxWidth: 100, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.5)', padding: '6px 4px' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#94A3B8', marginBottom: 2 }}>{dt.day}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#1E293B' }}>{dt.num}</div>
                    {d.event !== '—' && (
                      <div style={{ fontSize: 9, marginTop: 3, background: '#FEF3C7', color: '#92400E', padding: '1px 4px', borderRadius: 4, fontWeight: 600 }}>{d.event}</div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* ══ SECTION COMPSET ══ */}
            <SectionRow sec={SECTIONS[0]} />
            {!collapsed['compset'] && (
              <>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`} label="Min Compset" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>{d.minCompset} €</span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`} label="Médiane Compset" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>{d.medianCompset} €</span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`} label="Max Compset" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>{d.maxCompset} €</span>
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
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>`} label="Pickup %" sub="Variation demande vs N-1" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        {d.pickupPct > 0 ? <TrendingUp size={10} color="#059669" /> : <TrendingDown size={10} color="#DC2626" />}
                        <span style={{ fontSize: 13, fontWeight: 700, color: pctColor(d.pickupPct) }}>
                          {d.pickupPct > 0 ? '+' : ''}{d.pickupPct}%
                        </span>
                      </div>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`} label="Lead Time" sub="Jours avant arrivée" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>J{d.leadTime === 0 ? 'J' : `-${d.leadTime}`}</span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`} label="Occupation %" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: occColor(d.occupancy) }}>{d.occupancy}%</span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>`} label="Pression Marché" />
                  {rawData.map((d, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>{d.marketPressure}%</span>
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
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`} label="DPS Score" sub="Demand Pressure Score" />
                  {results.map((r, i) => {
                    const c = dpsColor(r.dps);
                    return (
                      <Cell key={i} i={i} bg={c.bg}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 15, fontWeight: 900, color: c.color }}>{Math.round(r.dps)}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: c.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</span>
                        </div>
                      </Cell>
                    );
                  })}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m5.66-17A10 10 0 0 1 22 12h-6m6 0a10 10 0 0 1-5.34 8.66m0 0A10 10 0 0 1 12 22v-6m0 6a10 10 0 0 1-5.66-1.34m0 0A10 10 0 0 1 2 12h6m-6 0a10 10 0 0 1 5.34-8.66"/></svg>`} label="Règles déclenchées" sub="Cliquer pour détails" />
                  {results.map((r, i) => (
                    <Cell key={i} i={i}>
                      <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: r.triggeredRules.length > 0 ? '#C7D2FE' : '#F1F5F9', padding: '4px 8px', borderRadius: 8 }}>
                          <Zap size={10} color={r.triggeredRules.length > 0 ? '#6366F1' : '#94A3B8'} />
                          <span style={{ fontSize: 11, fontWeight: 800, color: r.triggeredRules.length > 0 ? '#6366F1' : '#94A3B8' }}>
                            {r.triggeredRules.length}
                          </span>
                        </div>
                        {/* Tooltip au survol */}
                        {r.triggeredRules.length > 0 && (
                          <div style={{ display: 'none', position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, background: '#1E293B', color: 'white', padding: 10, borderRadius: 8, fontSize: 10, minWidth: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100 }} className="rule-tooltip">
                            <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 6, color: '#A78BFA' }}>{r.triggeredRules.length} règle{r.triggeredRules.length > 1 ? 's' : ''} déclenchée{r.triggeredRules.length > 1 ? 's' : ''}</div>
                            {r.triggeredRules.map((rule, j) => (
                              <div key={j} style={{ fontSize: 11, color: '#E2E8F0', fontWeight: 500, padding: '4px 0', borderBottom: j < r.triggeredRules.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#A78BFA', flexShrink: 0, display: 'inline-block' }} />
                                {rule}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`} label="MLOS (Min LOS)" sub="Séjour min requis" />
                  {results.map((r, i) => (
                    <Cell key={i} i={i}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: r.mlos > 1 ? '#D97706' : '#64748B' }}>
                        {r.mlos} {r.mlos > 1 ? 'nuits' : 'nuit'}
                      </span>
                    </Cell>
                  ))}
                </tr>
                <tr>
                  <RowLabel icon={`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`} label="CTA (Close To Arrival)" sub="Arrivées fermées" />
                  {results.map((r, i) => (
                    <Cell key={i} i={i}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: r.ctaOn ? '#FEE2E2' : '#F1F5F9', padding: '4px 8px', borderRadius: 8 }}>
                        {r.ctaOn ? <Lock size={10} color="#DC2626" /> : <span style={{ fontSize: 11, color: '#94A3B8' }}>—</span>}
                        <span style={{ fontSize: 10, fontWeight: 800, color: r.ctaOn ? '#DC2626' : '#94A3B8' }}>
                          {r.ctaOn ? 'FERMÉ' : 'OUVERT'}
                        </span>
                      </div>
                    </Cell>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* CSS pour tooltip hover */}
      <style>{`
        td:hover .rule-tooltip {
          display: block !important;
        }
      `}</style>
    </div>
  );
};
