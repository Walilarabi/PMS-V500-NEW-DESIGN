import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Zap, Lock, ChevronDown, Activity, DollarSign, Settings } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════
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
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA (14 JOURS)
// ═══════════════════════════════════════════════════════════════════════════
const buildMockData = (): DayData[] => {
  const today = new Date();
  const events = ['Salon du Livre', '—', 'Concert Jazz', '—', '—', 'Week-end', 'Week-end', 'Vivatech', 'Vivatech', '—', 'Fête Nationale', 'Week-end', 'Week-end', '—'];
  const currentPrices = [185, 185, 190, 175, 170, 210, 220, 250, 245, 165, 230, 215, 205, 175];
  const minCompsets = [165, 162, 168, 155, 150, 190, 195, 215, 210, 148, 200, 185, 178, 155];
  const medianCompsets = [180, 178, 182, 170, 168, 205, 210, 235, 228, 162, 218, 202, 195, 170];
  const maxCompsets = [195, 192, 198, 188, 185, 225, 230, 258, 252, 182, 242, 225, 218, 188];
  const pickupPcts = [12, -5, 18, -25, -10, 35, 28, 55, 48, -30, 42, 22, 15, -8];
  const leadTimes = [0, 1, 2, 3, 5, 10, 15, 21, 22, 0, 8, 12, 18, 4];
  const occupancies = [45, 55, 70, 85, 92, 65, 60, 88, 82, 38, 75, 68, 62, 50];
  const marketPressures = [35, 40, 55, 72, 85, 45, 42, 82, 78, 28, 65, 55, 48, 40];

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

// ═══════════════════════════════════════════════════════════════════════════
// PRICING ENGINE
// ═══════════════════════════════════════════════════════════════════════════
const normalizePickup = (pct: number): number => Math.min(1, Math.max(0, (pct + 100) / 200)) * 100;
const calcDPS = (occ: number, pickupNorm: number, market: number): number => occ * 0.4 + pickupNorm * 0.3 + market * 0.3;

const applyRules = (day: DayData): RuleResult => {
  const pickupNorm = normalizePickup(day.pickupPct);
  const dps = calcDPS(day.occupancy, pickupNorm, day.marketPressure);
  let price = day.medianCompset;
  const priceMin = day.minCompset * 0.9;
  const priceMax = day.maxCompset * 1.1;
  const triggered: string[] = [];

  if (day.pickupPct < -20) { price *= 0.90; triggered.push('Pickup < -20% → -10%'); }
  else if (day.pickupPct > 20) { price *= 1.10; triggered.push('Pickup > +20% → +10%'); }
  if (day.leadTime <= 2 && day.occupancy < 50) { price *= 0.85; triggered.push('Last Minute (J≤2, Occ<50%) → -15%'); }
  if (day.occupancy >= 85) { price *= 1.15; triggered.push('Haute demande (Occ≥85%) → +15%'); }
  if (day.leadTime > 20) { price *= 1.10; triggered.push('Lead time > 20j → +10%'); }
  else if (day.leadTime < 5 && day.leadTime > 2) { price *= 0.90; triggered.push('Lead time < 5j → -10%'); }
  if (day.marketPressure > 70) { price *= 1.20; triggered.push('Compression marché >70% → +20%'); }

  const finalPrice = Math.round(Math.min(priceMax, Math.max(priceMin, price)));
  const mlos = dps > 70 ? 2 : 1;
  const ctaOn = day.occupancy > 90;
  return { finalPrice, triggeredRules: triggered, mlos, ctaOn, dps };
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return {
    day: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
    num: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
  };
};

const dpsColor = (dps: number) => {
  if (dps >= 80) return { bg: '#FEE2E2', color: '#DC2626', label: 'Pic' };
  if (dps >= 60) return { bg: '#FED7AA', color: '#D97706', label: 'Fort' };
  if (dps >= 40) return { bg: '#FEF08A', color: '#CA8A04', label: 'Moyen' };
  return { bg: '#DBEAFE', color: '#2563EB', label: 'Faible' };
};

const pctColor = (pct: number) => pct > 10 ? '#059669' : pct < -10 ? '#DC2626' : '#64748B';
const occColor = (occ: number) => occ >= 85 ? '#DC2626' : occ >= 70 ? '#D97706' : occ >= 50 ? '#CA8A04' : '#2563EB';
const priceVar = (newP: number, oldP: number) => {
  const diff = newP - oldP;
  const pct = oldP > 0 ? Math.round((diff / oldP) * 100) : 0;
  return { diff, pct, up: diff >= 0 };
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export const RMSTableau: React.FC = () => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [rulesApplied, setRulesApplied] = useState(false);
  const rawData = useMemo(() => buildMockData(), []);
  const results = useMemo(() => rawData.map(applyRules), [rawData]);
  const toggle = (sec: string) => setCollapsed(c => ({ ...c, [sec]: !c[sec] }));

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
      {/* Top Toolbar - Style Pricing Calendar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0 gap-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-800">Tableau RMS</h1>
          <span className="text-sm text-gray-500">DPS · Compset · Pricing Engine</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 px-3 py-1 bg-gray-50 rounded-md border border-gray-200">
            <span className="text-xs font-semibold text-gray-600 uppercase">DPS:</span>
            <div className="flex gap-2">
              {[{ l: 'Faible', c: '#2563EB' }, { l: 'Moyen', c: '#CA8A04' }, { l: 'Fort', c: '#D97706' }, { l: 'Pic', c: '#DC2626' }].map(x => (
                <span key={x.l} className="flex items-center gap-1.5">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.c }} />
                  <span className="text-xs text-gray-600">{x.l}</span>
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => setRulesApplied(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-sm font-semibold rounded-md hover:bg-violet-600 transition-colors shadow-sm">
            <Zap className="w-3.5 h-3.5" />
            Appliquer
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-violet-700 text-sm font-semibold rounded-md hover:bg-violet-50 transition-colors border border-violet-300">
            <Settings className="w-3.5 h-3.5" />
            Config
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="sticky left-0 z-20 bg-gray-100 px-3 py-2.5 text-left font-bold text-gray-700 text-xs uppercase tracking-wide border-r border-gray-200" style={{ width: 180 }}>Métrique / Date</th>
                {rawData.map((d, i) => {
                  const dt = fmtDate(d.date);
                  return (
                    <th key={i} className="px-2 py-2 text-center font-semibold border-r border-gray-200" style={{ minWidth: 90 }}>
                      <div className="text-xs text-gray-500 uppercase font-bold mb-0.5">{dt.day}</div>
                      <div className="text-sm text-gray-900 font-bold">{dt.num}</div>
                      {d.event !== '—' && <div className="mt-1 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">{d.event}</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Section Compétition */}
              <SectionHeader label="Compétition (Compset)" isCollapsed={collapsed['compset']} onToggle={() => toggle('compset')} bg="bg-blue-50" />
              {!collapsed['compset'] && (
                <>
                  <MetricRow label="Min Compset" icon={<TrendingDown className="w-3.5 h-3.5 text-gray-500" />} data={rawData.map(d => ({ value: `${d.minCompset} €`, color: '#64748B' }))} />
                  <MetricRow label="Médiane Compset" icon={<Activity className="w-3.5 h-3.5 text-gray-700" />} data={rawData.map(d => ({ value: `${d.medianCompset} €`, color: '#1E293B', bold: true }))} />
                  <MetricRow label="Max Compset" icon={<TrendingUp className="w-3.5 h-3.5 text-gray-500" />} data={rawData.map(d => ({ value: `${d.maxCompset} €`, color: '#64748B' }))} />
                </>
              )}

              {/* Section Signaux */}
              <SectionHeader label="Signaux Marché" isCollapsed={collapsed['signaux']} onToggle={() => toggle('signaux')} bg="bg-amber-50" />
              {!collapsed['signaux'] && (
                <>
                  <PickupRow data={rawData} />
                  <MetricRow label="Occupation %" icon={<DollarSign className="w-3.5 h-3.5 text-gray-500" />} data={rawData.map(d => ({ value: `${d.occupancy}%`, color: occColor(d.occupancy), bold: true }))} />
                </>
              )}

              {/* Section DPS */}
              <SectionHeader label="DPS & Moteur" isCollapsed={collapsed['moteur']} onToggle={() => toggle('moteur')} bg="bg-violet-50" />
              {!collapsed['moteur'] && (
                <>
                  <DPSRow results={results} />
                  <RulesRow results={results} />
                </>
              )}

              {/* Section Recommandation */}
              <SectionHeader label="Tarif Recommandé" isCollapsed={collapsed['reco']} onToggle={() => toggle('reco')} bg="bg-emerald-50" />
              {!collapsed['reco'] && <PriceRow results={results} rawData={rawData} rulesApplied={rulesApplied} />}

              {/* Section Restrictions */}
              <SectionHeader label="Restrictions" isCollapsed={collapsed['restrictions']} onToggle={() => toggle('restrictions')} bg="bg-pink-50" />
              {!collapsed['restrictions'] && (
                <>
                  <MetricRow label="MLOS (Min LOS)" icon={<Lock className="w-3.5 h-3.5 text-gray-500" />} data={results.map(r => ({ value: `${r.mlos} nuit${r.mlos > 1 ? 's' : ''}`, color: r.mlos > 1 ? '#D97706' : '#64748B' }))} />
                  <CTARow results={results} />
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════
const SectionHeader: React.FC<{ label: string; isCollapsed: boolean; onToggle: () => void; bg: string }> = ({ label, isCollapsed, onToggle, bg }) => (
  <tr className={`border-t-2 border-gray-300 ${bg} cursor-pointer hover:bg-opacity-80 transition-colors`} onClick={onToggle}>
    <td colSpan={100} className="px-3 py-2 font-bold text-gray-800 text-xs uppercase tracking-wide">
      <div className="flex items-center gap-2">
        <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
        {label}
      </div>
    </td>
  </tr>
);

const MetricRow: React.FC<{ label: string; icon: React.ReactNode; data: Array<{ value: string; color: string; bold?: boolean }> }> = ({ label, icon, data }) => (
  <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-200">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-gray-700">{label}</span>
      </div>
    </td>
    {data.map((d, i) => (
      <td key={i} className="px-2 py-2 text-center border-r border-gray-100">
        <span style={{ color: d.color, fontWeight: d.bold ? 700 : 600, fontSize: '0.8125rem' }}>{d.value}</span>
      </td>
    ))}
  </tr>
);

const PickupRow: React.FC<{ data: DayData[] }> = ({ data }) => (
  <tr className="border-b border-gray-100 hover:bg-gray-50">
    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-200">
      <div className="flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-700">Pickup %</span>
      </div>
    </td>
    {data.map((d, i) => (
      <td key={i} className="px-2 py-2 text-center border-r border-gray-100">
        <div className="flex items-center justify-center gap-1">
          {d.pickupPct > 0 ? <TrendingUp className="w-3 h-3" style={{ color: '#059669' }} /> : <TrendingDown className="w-3 h-3" style={{ color: '#DC2626' }} />}
          <span style={{ color: pctColor(d.pickupPct), fontWeight: 700, fontSize: '0.8125rem' }}>{d.pickupPct > 0 ? '+' : ''}{d.pickupPct}%</span>
        </div>
      </td>
    ))}
  </tr>
);

const DPSRow: React.FC<{ results: RuleResult[] }> = ({ results }) => (
  <tr className="border-b border-gray-100">
    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-200">
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-violet-600" />
        <span className="text-xs font-semibold text-gray-700">DPS Score</span>
      </div>
    </td>
    {results.map((r, i) => {
      const c = dpsColor(r.dps);
      return (
        <td key={i} className="px-2 py-2 text-center border-r border-gray-100" style={{ background: c.bg }}>
          <div className="flex flex-col items-center gap-0.5">
            <span style={{ fontSize: '0.9375rem', fontWeight: 900, color: c.color }}>{Math.round(r.dps)}</span>
            <span style={{ fontSize: '0.625rem', fontWeight: 800, color: c.color, textTransform: 'uppercase' }}>{c.label}</span>
          </div>
        </td>
      );
    })}
  </tr>
);

const RulesRow: React.FC<{ results: RuleResult[] }> = ({ results }) => (
  <tr className="border-b border-gray-100 hover:bg-gray-50">
    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-200">
      <div className="flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-700">Règles déclenchées</span>
      </div>
    </td>
    {results.map((r, i) => (
      <td key={i} className="px-2 py-2 text-center border-r border-gray-100">
        <div className="group relative inline-block">
          <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded ${r.triggeredRules.length > 0 ? 'bg-violet-100' : 'bg-gray-100'}`}>
            <Zap className="w-3 h-3" style={{ color: r.triggeredRules.length > 0 ? '#8B5CF6' : '#94A3B8' }} />
            <span className="text-xs font-bold" style={{ color: r.triggeredRules.length > 0 ? '#8B5CF6' : '#94A3B8' }}>{r.triggeredRules.length}</span>
          </div>
          {r.triggeredRules.length > 0 && (
            <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg min-w-[200px]">
              <div className="font-bold mb-1 text-violet-300">{r.triggeredRules.length} règle{r.triggeredRules.length > 1 ? 's' : ''}</div>
              {r.triggeredRules.map((rule, j) => (
                <div key={j} className="text-xs py-0.5 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-violet-400" />
                  {rule}
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    ))}
  </tr>
);

const PriceRow: React.FC<{ results: RuleResult[]; rawData: DayData[]; rulesApplied: boolean }> = ({ results, rawData, rulesApplied }) => (
  <tr className="bg-emerald-50 border-b border-gray-100">
    <td className="sticky left-0 z-10 bg-emerald-50 px-3 py-2 border-r border-gray-200">
      <div className="flex items-center gap-2">
        <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
        <div>
          <div className="text-xs font-semibold text-gray-700">Tarif recommandé</div>
          <div className="text-xs text-gray-500">{rulesApplied ? '✓ Règles appliquées' : '⚠ Non appliqué'}</div>
        </div>
      </div>
    </td>
    {results.map((r, i) => {
      const v = priceVar(r.finalPrice, rawData[i].currentPrice);
      return (
        <td key={i} className="px-2 py-2 text-center border-r border-gray-100">
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-extrabold text-emerald-700">{r.finalPrice} €</span>
            <span className={`text-xs font-bold flex items-center gap-1 ${v.up ? 'text-emerald-600' : 'text-red-600'}`}>
              {v.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {v.up ? '+' : ''}{v.diff}€ ({v.up ? '+' : ''}{v.pct}%)
            </span>
          </div>
        </td>
      );
    })}
  </tr>
);

const CTARow: React.FC<{ results: RuleResult[] }> = ({ results }) => (
  <tr className="border-b border-gray-100 hover:bg-gray-50">
    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-200">
      <div className="flex items-center gap-2">
        <Lock className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-700">CTA (Arrivées fermées)</span>
      </div>
    </td>
    {results.map((r, i) => (
      <td key={i} className="px-2 py-2 text-center border-r border-gray-100">
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${r.ctaOn ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
          {r.ctaOn ? <Lock className="w-3 h-3" /> : <span>—</span>}
          {r.ctaOn ? 'FERMÉ' : 'OUVERT'}
        </div>
      </td>
    ))}
  </tr>
);
