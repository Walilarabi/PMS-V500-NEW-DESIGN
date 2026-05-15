import React, { useState, useMemo, useEffect } from 'react';
import { RMSTableau } from './RMSTableau';
import { LittleYielder } from './LittleYielder';
import { 
  Tags, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  LayoutGrid, 
  Lock, 
  Link as LinkIcon, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  Settings, 
  Layers, 
  ArrowRight, 
  Home, 
  Database, 
  Search, 
  Plus, 
  Trash2, 
  FileText, 
  Clock, 
  ChevronDown, 
  Calendar, 
  X, 
  Check, 
  Percent, 
  Euro, 
  Download, 
  Upload, 
  GripVertical, 
  ShieldCheck,
  Utensils
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── TYPES ───

interface RatePlan {
  code: string;
  name: string;
  type: string;
  derivedFrom: string | null;
  derivedMode: '%' | 'fixed' | null;
  derivedVal: number;
  meal: 'RO' | 'BB' | 'HB' | 'FB' | 'AI';
  cancel: 'FLEX' | 'NANR' | '48H' | '7J';
  active: boolean;
  roomTypes: string[];
  channels: string[];
  mapped: boolean;
}

interface RoomType {
  id: string;
  label: string;
  capacity: number;
  basePrice: number;
}

interface Restriction {
  rt: string;
  date: string;
  cta: boolean;
  ctd: boolean;
  minLOS: number | null;
  maxLOS: number | null;
  stopSell: boolean;
}

interface SyncLogEntry {
  type: 'ok' | 'warn' | 'err';
  msg: string;
  sub: string;
  time: string;
}

interface ActivityLogEntry {
  ts: string;
  user: string;
  type: 'price' | 'restr' | 'import' | 'config';
  action: string;
  detail: string;
}

// ─── CONSTANTS ───

const TODAY = new Date().toISOString().slice(0, 10);

const INITIAL_ROOM_TYPES: RoomType[] = [
  { id: 'DBL_CLASS', label: 'Double Classique', capacity: 2, basePrice: 257 },
  { id: 'DBL_SGL', label: 'Double Single Use', capacity: 1, basePrice: 210 },
  { id: 'FAM_4P', label: 'Deux Chambres Adjacentes 4p', capacity: 4, basePrice: 420 },
];

const INITIAL_RATE_PLANS: RatePlan[] = [
  { code: 'RACK-RO-FLEX', name: 'Rack Public Flex', type: 'RACK', derivedFrom: null, derivedMode: null, derivedVal: 0, meal: 'RO', cancel: 'FLEX', active: true, roomTypes: ['DBL_CLASS', 'DBL_SGL', 'FAM_4P'], channels: ['direct', 'ota', 'gds'], mapped: true },
  { code: 'OTA-RO-FLEX', name: 'OTA Room Only Flex', type: 'Dérivé', derivedFrom: 'RACK-RO-FLEX', derivedMode: '%', derivedVal: 0, meal: 'RO', cancel: 'FLEX', active: true, roomTypes: ['DBL_CLASS', 'DBL_SGL'], channels: ['ota'], mapped: true },
  { code: 'MOBILE-RO-FLEX', name: 'Mobile Room Only Flex', type: 'Dérivé', derivedFrom: 'RACK-RO-FLEX', derivedMode: '%', derivedVal: -10, meal: 'RO', cancel: 'FLEX', active: true, roomTypes: ['DBL_CLASS', 'DBL_SGL'], channels: ['mobile'], mapped: true },
  { code: 'RACK-RO-NANR', name: 'Rack Non Remboursable', type: 'Dérivé', derivedFrom: 'RACK-RO-FLEX', derivedMode: '%', derivedVal: -5, meal: 'RO', cancel: 'NANR', active: true, roomTypes: ['DBL_CLASS', 'DBL_SGL'], channels: ['direct'], mapped: true },
  { code: 'OTA-RO-NANR', name: 'OTA Non Remboursable', type: 'Dérivé', derivedFrom: 'RACK-RO-FLEX', derivedMode: '%', derivedVal: -5, meal: 'RO', cancel: 'NANR', active: true, roomTypes: ['DBL_CLASS'], channels: ['ota'], mapped: true },
  { code: 'PROMO-TO-RO-FLEX', name: 'Promo Tour Opérateurs', type: 'Promotion', derivedFrom: 'RACK-RO-FLEX', derivedMode: '%', derivedVal: -20, meal: 'RO', cancel: 'FLEX', active: true, roomTypes: ['DBL_CLASS', 'DBL_SGL', 'FAM_4P'], channels: ['direct', 'ota'], mapped: true },
];

const FR_DAYS = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const FR_MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

export const Tarifs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('rateplans');
  const [kpiVisible, setKpiVisible] = useState(true);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>(() => {
    const saved = localStorage.getItem('flowtym_cfg_rps');
    return saved ? JSON.parse(saved) : INITIAL_RATE_PLANS;
  });
  const [roomTypes] = useState<RoomType[]>(INITIAL_ROOM_TYPES);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([
    { type: 'ok', msg: 'Push réussi — 38 rate plans synchronisés', sub: 'DBL_CLASS · DBL_SGL · FAM_4P', time: 'Aujourd\'hui 12:04' },
    { type: 'warn', msg: 'Rate plan PROMO-BB-NANR-LAST non mappé ignoré', sub: 'Ajouter le mapping D-Edge', time: 'Aujourd\'hui 12:04' },
    { type: 'ok', msg: 'Pull réussi — grilles tarifaires mises à jour', sub: 'Données fraîches depuis D-Edge', time: 'Hier 23:00' },
  ]);
  const [pendingPush, setPendingPush] = useState<{ code: string; reason: string }[]>([
    { code: 'CORP-BB-FLEX', reason: 'Nouveau rate plan, jamais poussé' },
    { code: 'RACK-HB-FLEX', reason: 'Prix modifié récemment' },
  ]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() => {
    const saved = localStorage.getItem('flowtym_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [egRestrictions, setEgRestrictions] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem('flowtym_eg_restr');
    return saved ? JSON.parse(saved) : {};
  });

  // Filters
  const [rpSearch, setRpSearch] = useState('');
  const [rpTypeFilter, setRpTypeFilter] = useState('');

  // Grille State
  const [gridStart, setGridStart] = useState(TODAY);
  const [gridPeriod, setGridPeriod] = useState(30);
  const [gridRatePlan, setGridRatePlan] = useState('RACK-RO-FLEX');

  // Enriched Grid State
  const [egCols, setEgCols] = useState({
    avail: true,
    minlos: true,
    maxlos: true,
    cta: true,
    ctd: true,
    stop: true,
    rack: true,
    ota: true,
    mobile: true
  });
  const [egShowColsMenu, setEgShowColsMenu] = useState(false);

  useEffect(() => {
    localStorage.setItem('flowtym_cfg_rps', JSON.stringify(ratePlans));
  }, [ratePlans]);

  useEffect(() => {
    localStorage.setItem('flowtym_logs', JSON.stringify(activityLogs));
  }, [activityLogs]);

  useEffect(() => {
    localStorage.setItem('flowtym_eg_restr', JSON.stringify(egRestrictions));
  }, [egRestrictions]);

  const addLog = (type: any, action: string, detail: string) => {
    const now = new Date();
    const ts = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setActivityLogs(prev => [{ ts, user: 'admin', type, action, detail }, ...prev].slice(0, 50));
  };

  const filteredRatePlans = useMemo(() => {
    return ratePlans.filter(rp => 
      (rp.name.toLowerCase().includes(rpSearch.toLowerCase()) || rp.code.toLowerCase().includes(rpSearch.toLowerCase())) &&
      (!rpTypeFilter || rp.type === rpTypeFilter)
    );
  }, [ratePlans, rpSearch, rpTypeFilter]);

  const dates = useMemo(() => {
    const res = [];
    const start = new Date(gridStart);
    for (let i = 0; i < gridPeriod; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      res.push(d.toISOString().slice(0, 10));
    }
    return res;
  }, [gridStart, gridPeriod]);

  const handlePriceChange = (rpCode: string, rtId: string, iso: string, val: string) => {
    const key = `tr_price_${rpCode}_${rtId}_${iso}`;
    const old = localStorage.getItem(key) || '—';
    localStorage.setItem(key, val);
    addLog('price', `Prix modifié — ${rpCode}`, `${rtId} · ${iso} · ${old}€ → ${val}€`);
    
    // Add to pending if not there
    if (!pendingPush.find(p => p.code === rpCode)) {
      setPendingPush(prev => [...prev, { code: rpCode, reason: 'Prix modifié récemment' }]);
    }
  };

  const handleRestrChange = (rtId: string, iso: string, key: string, val: any) => {
    const rKey = `${rtId}_${iso}`;
    const current = egRestrictions[rKey] || { minLOS: 1, maxLOS: 0, cta: false, ctd: false, stopSell: false };
    const oldVal = current[key];
    const newRestr = { ...current, [key]: typeof val === 'boolean' ? val : parseInt(val) || 0 };
    
    setEgRestrictions(prev => ({
      ...prev,
      [rKey]: newRestr
    }));
    
    addLog('restr', `Restriction ${key} modifiée`, `${rtId} · ${iso} · ${oldVal} → ${val}`);
  };

  const handlePushAll = () => {
    setPendingPush([]);
    setSyncLog(prev => [{
      type: 'ok',
      msg: `Push complet — ${ratePlans.length} rate plans`,
      sub: 'Toutes les Room Types synchronisées',
      time: 'À l\'instant'
    }, ...prev]);
    addLog('config', 'Push complet D-Edge', 'Tous les tarifs synchronisés');
  };

  const handlePullDedge = () => {
    setSyncLog(prev => [{
      type: 'ok',
      msg: 'Pull D-Edge réussi',
      sub: 'Grilles tarifaires et disponibilités mises à jour',
      time: 'À l\'instant'
    }, ...prev]);
    addLog('config', 'Pull D-Edge', 'Données actualisées depuis le Channel Manager');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ─── HEADER supprimé (Point 4) ─── */}

      {/* ─── HUD + bouton masque ─── */}
      <div>
        {/* Barre de contrôle */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Indicateurs clés
          </span>
          <button
            onClick={() => setKpiVisible(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-[10px] font-semibold"
            style={{
              background: kpiVisible ? 'white' : '#F5F3FF',
              borderColor: kpiVisible ? '#E2E8F0' : '#DDD6FE',
              color: kpiVisible ? '#94A3B8' : '#7C3AED',
            }}
          >
            {kpiVisible ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Masquer
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                Afficher
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </>
            )}
          </button>
        </div>

        {/* Cartes KPI — masquées entièrement quand kpiVisible=false */}
        {kpiVisible && (
          <div className="grid grid-cols-5 gap-4">
            {[
              { l: 'Rate Plans actifs', v: ratePlans.length, d: 'sur 40 config.', c: '#8B5CF6' },
              { l: 'Mappés D-Edge', v: '38', d: '✓ 95% mappés', c: '#10b981' },
              { l: 'Room Types', v: roomTypes.length, d: 'DBL · SU · ADJ', c: '#3b82f6' },
              { l: 'En attente sync', v: pendingPush.length, d: '⚠ À pousser', c: '#f59e0b' },
              { l: 'Dernière sync', v: '12h04', d: '✓ Succès', c: '#10b981' },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: k.c }} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{k.l}</span>
                <div className="text-xl font-black text-slate-800 mt-1">{k.v}</div>
                <div className="text-[9px] font-bold text-slate-300 mt-1 uppercase tracking-widest">{k.d}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── TABS ─── */}
      <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit">
        {[
          { id: 'rateplans', label: 'Rate Plans',      icon: Tags },
          { id: 'grid',      label: 'Grille tarifaire', icon: LayoutGrid },
          { id: 'restr',     label: 'Restrictions',     icon: Lock },
          { id: 'yielder',   label: 'Little Yielder',   icon: Zap },
          { id: 'rms',       label: 'Tableau RMS',      icon: Zap },
          { id: 'mapping',   label: 'Mapping Rooms',    icon: LinkIcon },
          { id: 'sync',      label: 'Synchronisation',  icon: RefreshCw },
          { id: 'mass',      label: 'Masse + Logs',     icon: Zap },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${activeTab === t.id ? 'bg-white text-primary shadow-lg shadow-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* ─── TAB: RATE PLANS ─── */}
        {activeTab === 'rateplans' && (
          <motion.div 
            key="rateplans" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Rate Plans Configurés</h3>
               <div className="flex gap-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      className="bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-xs font-bold outline-none focus:border-primary transition-all w-64"
                      placeholder="Rechercher..."
                      value={rpSearch}
                      onChange={e => setRpSearch(e.target.value)}
                    />
                  </div>
                  <select 
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-primary transition-all"
                    value={rpTypeFilter}
                    onChange={e => setRpTypeFilter(e.target.value)}
                  >
                    <option value="">Tous les types</option>
                    <option value="RACK">RACK</option>
                    <option value="Dérivé">DÉRIVÉ</option>
                    <option value="Promotion">PROMOTION</option>
                  </select>
               </div>
            </div>
            <table className="w-full">
               <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">
                    <th className="px-8 py-5 text-left">Code</th>
                    <th className="px-8 py-5 text-left">Nom Commercial</th>
                    <th className="px-8 py-5">Meal</th>
                    <th className="px-8 py-5 text-left">Chambres</th>
                    <th className="px-8 py-5">Type</th>
                    <th className="px-8 py-5">Annul.</th>
                    <th className="px-8 py-5">D-Edge</th>
                    <th className="px-8 py-5"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredRatePlans.map(rp => (
                    <tr key={rp.code} className="hover:bg-slate-50/50 transition-colors group">
                       <td className="px-8 py-5">
                          <span className="font-mono text-[11px] font-black text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100">{rp.code}</span>
                       </td>
                       <td className="px-8 py-5">
                          <div className="font-black text-slate-800 text-sm">{rp.name}</div>
                          {rp.derivedFrom && (
                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
                               <RefreshCw className="w-3 h-3" /> Dérivé de {rp.derivedFrom} ({rp.derivedVal > 0 ? '+' : ''}{rp.derivedVal}{rp.derivedMode})
                            </div>
                          )}
                       </td>
                       <td className="px-8 py-5 text-center">
                          <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black">{rp.meal}</span>
                       </td>
                       <td className="px-8 py-5">
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                            {rp.roomTypes.join(' · ')}
                          </div>
                       </td>
                       <td className="px-8 py-5 text-center">
                          <span className="bg-violet-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{rp.type}</span>
                       </td>
                       <td className="px-8 py-5 text-center">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${rp.cancel === 'FLEX' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {rp.cancel}
                          </span>
                       </td>
                       <td className="px-8 py-5 text-center">
                          <div className="flex justify-center">
                            <div className={`flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest ${rp.mapped ? 'text-emerald-500' : 'text-amber-500'}`}>
                               <div className={`w-1.5 h-1.5 rounded-full ${rp.mapped ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                               {rp.mapped ? 'Mappé' : 'En attente'}
                            </div>
                          </div>
                       </td>
                       <td className="px-8 py-5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-2">
                            <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-primary hover:border-primary/30 shadow-sm transition-all"><Settings className="w-4 h-4" /></button>
                            <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-200 shadow-sm transition-all"><ArrowUp className="w-4 h-4" /></button>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
          </motion.div>
        )}

        {/* ─── TAB: GRILLE TARIFAIRE ─── */}
        {activeTab === 'grid' && (
          <motion.div 
            key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Grille Tarifaire Dynamique</h3>
               <div className="flex gap-3">
                  <select 
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-primary transition-all min-w-[240px]"
                    value={gridRatePlan}
                    onChange={e => setGridRatePlan(e.target.value)}
                  >
                    {ratePlans.map(rp => <option key={rp.code} value={rp.code}>{rp.code} — {rp.name}</option>)}
                  </select>
                  <select 
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-primary transition-all"
                    value={gridPeriod}
                    onChange={e => setGridPeriod(parseInt(e.target.value))}
                  >
                    <option value="7">7 jours</option>
                    <option value="14">14 jours</option>
                    <option value="30">30 jours</option>
                    <option value="90">90 jours</option>
                  </select>
                  <input 
                    type="date"
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-primary transition-all"
                    value={gridStart}
                    onChange={e => setGridStart(e.target.value)}
                  />
                  <button onClick={handlePushAll} className="bg-primary text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center gap-2">
                    <ArrowUp className="w-4 h-4" /> Pousser grille
                  </button>
               </div>
            </div>
            
            <div className="overflow-x-auto">
               <table className="w-full border-collapse">
                  <thead>
                     <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="sticky left-0 bg-slate-50 z-20 px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-r border-slate-200 min-w-[200px]">Room Type</th>
                        {dates.map(iso => {
                          const d = new Date(iso);
                          const dow = d.getDay();
                          const isWknd = dow === 0 || dow === 6;
                          const isTdy = iso === TODAY;
                          return (
                            <th key={iso} className={`px-4 py-5 text-center min-w-[70px] border-r border-slate-100 ${isTdy ? 'bg-amber-50' : isWknd ? 'bg-blue-50/30' : ''}`}>
                               <div className={`text-[10px] font-black uppercase tracking-widest ${isTdy ? 'text-amber-600' : isWknd ? 'text-blue-500' : 'text-slate-400'}`}>{FR_DAYS[dow]}</div>
                               <div className={`text-xs font-black mt-1 ${isTdy ? 'text-amber-700' : 'text-slate-800'}`}>{d.getDate()} {FR_MONTHS[d.getMonth()]}</div>
                            </th>
                          );
                        })}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {roomTypes.map(rt => (
                       <tr key={rt.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="sticky left-0 bg-white group-hover:bg-slate-50 z-10 px-8 py-5 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                             <div className="font-black text-slate-800 text-sm whitespace-nowrap">{rt.label}</div>
                             <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{rt.id}</div>
                          </td>
                          {dates.map(iso => {
                            const d = new Date(iso);
                            const isWknd = d.getDay() === 0 || d.getDay() === 6;
                            const isTdy = iso === TODAY;
                            const key = `tr_price_${gridRatePlan}_${rt.id}_${iso}`;
                            const baseP = isWknd ? Math.round(rt.basePrice * 1.15) : rt.basePrice;
                            const price = localStorage.getItem(key) || baseP;
                            
                            return (
                              <td key={iso} className={`px-2 py-3 border-r border-slate-100 text-center ${isTdy ? 'bg-amber-50/30' : isWknd ? 'bg-blue-50/10' : ''}`}>
                                 <input 
                                   className="w-full bg-transparent border-none text-center text-xs font-black text-slate-800 outline-none hover:bg-violet-50 focus:bg-violet-600 focus:text-white rounded py-2 transition-all cursor-pointer"
                                   defaultValue={price}
                                   onBlur={(e) => handlePriceChange(gridRatePlan, rt.id, iso, e.target.value)}
                                   onKeyDown={e => e.key === 'Enter' && (e.currentTarget as any).blur()}
                                 />
                                 <div className="text-[8px] font-black text-emerald-500 mt-1 uppercase tracking-tighter">3 dispos</div>
                              </td>
                            );
                          })}
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </motion.div>
        )}

        {/* ─── TAB: RESTRICTIONS ─── */}
        {activeTab === 'restr' && (
          <motion.div 
            key="restr" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Appliquer une restriction</h3>
                      <div className="flex gap-3">
                         <select className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none transition-all">
                            <option value="ALL">Toutes les chambres</option>
                            {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
                         </select>
                         <input type="date" className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none" defaultValue={TODAY} />
                      </div>
                   </div>

                   <div className="grid grid-cols-3 gap-4">
                      {[
                        { icon: '⛔', l: 'CTA', d: 'Arrivée interdite' },
                        { icon: '🚫', l: 'CTD', d: 'Départ interdit' },
                        { icon: '🚷', l: 'Stop Sell', d: 'Vente fermée' },
                        { icon: '📏', l: 'MinLOS', d: 'Séjour min. (nuits)', type: 'num' },
                        { icon: '🔒', l: 'MaxLOS', d: 'Séjour max. (nuits)', type: 'num' },
                        { icon: '📅', l: 'Free Sell', d: 'Dispo. forcée', type: 'bool' },
                      ].map((r, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-100 rounded-3xl p-5 hover:bg-white hover:shadow-xl transition-all group flex flex-col justify-between">
                           <div>
                              <div className="text-2xl mb-3 group-hover:scale-110 transition-transform origin-left">{r.icon}</div>
                              <div className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">{r.l}</div>
                              <div className="text-[10px] text-slate-400 font-bold leading-tight">{r.d}</div>
                           </div>
                           <div className="mt-6">
                              {r.type === 'num' ? (
                                <input type="number" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-primary" placeholder="—" />
                              ) : (
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" />
                                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                              )}
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
                   <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Restrictions Actives (Période en cours)</h3>
                   </div>
                   <table className="w-full">
                      <thead>
                         <tr className="bg-slate-50/20 border-b border-slate-100 font-black uppercase text-[9px] tracking-[0.2em] text-slate-400">
                            <th className="px-6 py-4 text-left">Room Type</th>
                            <th className="px-6 py-4 text-left">Date</th>
                            <th className="px-6 py-4">CTA</th>
                            <th className="px-6 py-4">CTD</th>
                            <th className="px-6 py-4">MinLOS</th>
                            <th className="px-6 py-4">Stop</th>
                            <th className="px-6 py-4"></th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         <tr>
                            <td className="px-6 py-4"><span className="px-2 py-1 bg-violet-50 text-violet-600 rounded-lg font-black text-[9px] uppercase tracking-widest">DBL_CLASS</span></td>
                            <td className="px-6 py-4 font-mono text-[11px] font-bold text-slate-600">2026-05-01</td>
                            <td className="px-6 py-4 text-center text-rose-500 font-black text-[10px]">⛔ OUI</td>
                            <td className="px-6 py-4 text-center text-slate-300 font-black text-[10px]">NON</td>
                            <td className="px-6 py-4 text-center font-black text-slate-700">2n</td>
                            <td className="px-6 py-4 text-center text-slate-300 font-black text-[10px]">NON</td>
                            <td className="px-6 py-4 text-right">
                               <button className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </td>
                         </tr>
                      </tbody>
                   </table>
                </div>
             </div>

             <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl space-y-10 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500 opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div>
                  <div className="w-10 h-10 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 mb-4 shadow-inner">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black tracking-tight mb-2">Sécurité & Intégrité</h3>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    Les restrictions appliquées ici outrepassent les configurations par défaut des rate plans. Elles sont transmises en temps réel aux canaux mappés.
                  </p>
                </div>

                <div className="space-y-4">
                   <div className="flex items-start gap-4 p-4 bg-white/5 rounded-3xl border border-white/5 group hover:bg-white/10 transition-all">
                      <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1">Impact Vente</div>
                        <div className="text-xs font-bold leading-relaxed">Une restriction "Stop Sell" ferme immédiatement la vente sur tous les OTA mappés.</div>
                      </div>
                   </div>
                   <div className="flex items-start gap-4 p-4 bg-white/5 rounded-3xl border border-white/5 group hover:bg-white/10 transition-all">
                      <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">Sejour Minimum</div>
                        <div className="text-xs font-bold leading-relaxed">Le MinLOS (Minimum Length of Stay) empêche les réservations plus courtes.</div>
                      </div>
                   </div>
                </div>

                <button className="w-full bg-primary hover:bg-primary-dark py-5 rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-2xl shadow-primary/40">
                   <ArrowUp className="w-4 h-4" /> Synchroniser tout
                </button>
             </div>
          </motion.div>
        )}

        {/* ─── TAB: LITTLE YIELDER ─── */}
        {activeTab === 'yielder' && (
          <motion.div
            key="yielder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          >
            <LittleYielder />
          </motion.div>
        )}

        {/* ─── TAB: TABLEAU RMS ─── */}
        {activeTab === 'rms' && (
          <motion.div
            key="rms" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          >
            <RMSTableau />
          </motion.div>
        )}

        {/* ─── TAB: MAPPING ROOMS ─── */}
        {activeTab === 'mapping' && (
          <motion.div 
            key="mapping" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm"
          >
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest leading-none">Mapping Room Types ↔ D-Edge</h3>
               <button onClick={() => addLog('config', 'Mapping sauvegardé', '3 room types mis à jour')} className="bg-primary text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center gap-2">
                 <Check className="w-4 h-4" /> Enregistrer Mapping
               </button>
             </div>
             <div className="p-8">
                <div className="grid grid-cols-1 gap-4">
                   {roomTypes.map(rt => (
                     <div key={rt.id} className="flex items-center gap-6 bg-slate-50 border border-slate-100 rounded-[32px] p-6 group hover:bg-white hover:shadow-xl transition-all">
                        <div className="flex-1">
                           <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">PMS (Interne)</div>
                           <div className="font-black text-slate-800 text-base">{rt.label}</div>
                           <div className="font-mono text-[10px] text-primary font-bold mt-1 uppercase tracking-tighter bg-primary/10 px-2 py-0.5 rounded w-fit">{rt.id}</div>
                        </div>

                        <div className="flex flex-col items-center">
                           <div className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2">
                              <CheckCircle2 className="w-3 h-3" /> Connecté
                           </div>
                           <div className="w-40 h-px bg-slate-200 relative">
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-100 rounded-full p-2 shadow-sm group-hover:rotate-12 transition-transform">
                                 <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                              </div>
                              <ArrowRight className="absolute -right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                           </div>
                        </div>

                        <div className="flex-1 text-right space-y-3">
                           <div>
                             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Code D-Edge Channel Manager</div>
                             <input className="bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 outline-none focus:border-primary w-48 text-right font-mono" defaultValue={rt.id} />
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </motion.div>
        )}

        {/* ─── TAB: SYNCHRONISATION ─── */}
        {activeTab === 'sync' && (
          <motion.div 
            key="sync" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
             <div className="space-y-6">
                <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
                   <div className="flex items-center gap-3 mb-8">
                     <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-5 h-5" />
                     </div>
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Statut Connexion</h3>
                   </div>

                   <div className="space-y-4">
                      <div className="flex justify-between items-center py-4 border-b border-slate-100 text-sm">
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Hotel ID D-Edge</span>
                        <span className="font-mono font-black text-slate-800">FLW-HOTEL-001</span>
                      </div>
                      <div className="flex justify-between items-center py-4 border-b border-slate-100 text-sm">
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Version API</span>
                        <span className="font-bold text-slate-600">v3.2.0 (Stable)</span>
                      </div>
                      <div className="flex justify-between items-center py-4 border-b border-slate-100 text-sm">
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Dernière réponse</span>
                        <span className="font-bold text-emerald-500">241ms — OK</span>
                      </div>
                      <div className="flex justify-between items-center py-4 border-b border-slate-100 text-sm">
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Prochaine sync AUTO</span>
                        <span className="font-bold text-slate-600">dans 4m 12s</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3 mt-8">
                      <button onClick={handlePushAll} className="bg-primary text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all">
                        <ArrowUp className="w-4 h-4 text-white" /> Tout Pousser
                      </button>
                      <button onClick={handlePullDedge} className="bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-95 transition-all">
                        <RefreshCw className="w-4 h-4" /> Rafraîchir
                      </button>
                   </div>
                </div>

                <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Push en attente</h3>
                      {pendingPush.length > 0 && <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">{pendingPush.length} ALERTES</span>}
                   </div>
                   <div className="divide-y divide-slate-50">
                      {pendingPush.length === 0 ? (
                        <div className="p-12 text-center text-slate-300 font-black uppercase tracking-[4px] text-[10px]">Aucun push requis</div>
                      ) : (
                        pendingPush.map((p, i) => (
                          <div key={i} className="px-6 py-4 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                             <div>
                               <div className="text-[11px] font-black text-slate-800">{p.code}</div>
                               <div className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-0.5">{p.reason}</div>
                             </div>
                             <button onClick={() => setPendingPush(prev => prev.filter(x => x.code !== p.code))} className="p-2 text-slate-300 hover:text-primary transition-colors">
                               <ArrowUp className="w-4 h-4" />
                             </button>
                          </div>
                        ))
                      )}
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Historique de Sync</h3>
                   <button onClick={() => setSyncLog([])} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Effacer</button>
                </div>
                <div className="space-y-6 flex-1 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin">
                   {syncLog.map((l, i) => (
                     <div key={i} className="flex gap-4 group">
                        <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black ${l.type === 'ok' ? 'bg-emerald-50 text-emerald-500' : l.type === 'warn' ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-rose-500'}`}>
                           {l.type === 'ok' ? '✓' : '⚠'}
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between items-start mb-1">
                              <div className="text-[11px] font-black text-slate-800 tracking-tight leading-none uppercase">{l.msg}</div>
                              <span className="text-[9px] font-bold text-slate-300">{l.time}</span>
                           </div>
                           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">{l.sub}</div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </motion.div>
        )}

        {/* ─── TAB: MASSE + LOGS ─── */}
        {activeTab === 'mass' && (
          <motion.div 
            key="mass" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
            className="space-y-6"
          >
             <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-violet-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-3">
                   <Zap className="w-5 h-5 text-violet-600 fill-violet-600" /> Actions de masse sur les restrictions
                </h3>
                
                <div className="space-y-4">
                   {[1, 2].map(row => (
                      <div key={row} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-center block leading-none">Restriction</label>
                            <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-800 outline-none focus:border-violet-600 transition-all">
                               <option value="minLOS">MinLOS</option>
                               <option value="maxLOS">MaxLOS</option>
                               <option value="cta">CTA</option>
                               <option value="ctd">CTD</option>
                               <option value="stopSell">Stop Sell</option>
                            </select>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-center block leading-none">Période du</label>
                            <input type="date" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-[11px] font-bold text-slate-800 outline-none" defaultValue={TODAY} />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-center block leading-none">Au</label>
                            <input type="date" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-[11px] font-bold text-slate-800 outline-none" defaultValue={TODAY} />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-center block leading-none">Valeur</label>
                            <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-800 outline-none">
                               <option value="1">1 nuit</option>
                               <option value="2">2 nuits</option>
                               <option value="3">3 nuits</option>
                               <option value="5">5 nuits</option>
                               <option value="true">✅ Fermé</option>
                               <option value="false">✓ Ouvert</option>
                            </select>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-center block leading-none">Chambres</label>
                            <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-800 outline-none">
                               <option value="ALL">Toutes</option>
                               {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.id}</option>)}
                            </select>
                         </div>
                         <button onClick={() => addLog('restr', 'Action de masse appliquée', 'Période selectionnée mise à jour')} className="bg-violet-600 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-violet-600/20 active:scale-95 transition-all">Appliquer</button>
                      </div>
                   ))}
                </div>
             </div>

             <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                      <History className="w-5 h-5 text-slate-300" /> Historique des modifications
                   </h3>
                   <div className="flex gap-2">
                      <button className="px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-400 hover:text-slate-800 transition-all">Export Logs</button>
                      <button onClick={() => setActivityLogs([])} className="px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-rose-300 hover:text-rose-500 transition-all">Vider</button>
                   </div>
                </div>

                <div className="space-y-1">
                   {activityLogs.length === 0 ? (
                     <div className="p-12 text-center text-slate-300 font-black uppercase tracking-[4px] text-xs">Aucune modification enregistrée</div>
                   ) : (
                     activityLogs.map((l, i) => (
                       <div key={i} className={`flex items-center gap-6 p-4 rounded-2xl hover:bg-slate-50 transition-colors group ${i === 0 ? 'bg-violet-50/30' : ''}`}>
                          <div className="text-[10px] font-bold text-slate-400 w-24 tabular-nums">{l.ts}</div>
                          <div className="flex items-center gap-3 flex-1">
                             <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                               l.type === 'price' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                               l.type === 'restr' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                               'bg-violet-50 text-violet-600 border-violet-100'
                             }`}>
                               {l.type}
                             </span>
                             <div className="text-sm font-black text-slate-800 tracking-tight">{l.action}</div>
                          </div>
                          <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">{l.detail}</div>
                       </div>
                     ))
                   )}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
