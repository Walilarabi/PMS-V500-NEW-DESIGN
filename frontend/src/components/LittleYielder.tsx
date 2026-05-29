import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ────────────────────────────────────────────────────────────────────
type RuleType = 'volume' | 'cancellation' | 'leadtime' | 'occupancy' | 'channel' | 'ai';

interface Threshold {
  id: string;
  range: string;
  action: string;
  actionsCount: number;
  editing?: boolean;
}

interface YieldRule {
  id: number;
  name: string;
  type: RuleType;
  active: boolean;
  trigger: string;
  desc: string;
  thresholds: Threshold[];
  icon: string;
}

// ─── Icônes SVG par type ─────────────────────────────────────────────────────
const TYPE_ICONS: Record<RuleType, React.ReactNode> = {
  volume:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  cancellation: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  leadtime:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  occupancy:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  channel:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  ai:           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>,
};

const TYPE_LABELS: Record<RuleType, string> = {
  volume: 'Volume', cancellation: 'Annulations', leadtime: 'Lead time',
  occupancy: 'Occupation', channel: 'Canal', ai: 'IA',
};

const TYPE_COLORS: Record<RuleType, { color: string; bg: string }> = {
  volume:       { color: '#8B5CF6', bg: '#EDE9FE' },
  cancellation: { color: '#EF4444', bg: '#FEF2F2' },
  leadtime:     { color: '#F59E0B', bg: '#FFF7ED' },
  occupancy:    { color: '#10B981', bg: '#ECFDF5' },
  channel:      { color: '#3B82F6', bg: '#EFF6FF' },
  ai:           { color: '#EC4899', bg: '#FDF2F8' },
};

// ─── 13 règles identiques au HTML de référence ─────────────────────────────
const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('');

const INITIAL_RULES: YieldRule[] = [
  {
    id: 1, name: 'R1 – Forte demande (volume)', type: 'volume', active: true,
    trigger: 'Volume de ventes – 4 paliers', icon: 'chart-line',
    desc: "Augmente les prix lorsque les ventes dépassent des seuils de capacité.",
    thresholds: [
      { id: uid(), range: '45-55%',   action: '+5%',  actionsCount: 2 },
      { id: uid(), range: '56-75%',   action: '+10%', actionsCount: 3 },
      { id: uid(), range: '76-85%',   action: '+15%', actionsCount: 3 },
    ],
  },
  {
    id: 2, name: 'R2 – Annulations tardives', type: 'cancellation', active: true,
    trigger: 'Annulations tardives – 2 paliers', icon: 'calendar-times',
    desc: "Réagit aux annulations de dernière minute pour reconquérir la demande.",
    thresholds: [
      { id: uid(), range: '≥ 3 annulations', action: '+10%', actionsCount: 2 },
      { id: uid(), range: '≥ 5 annulations', action: '+15%', actionsCount: 3 },
    ],
  },
  {
    id: 3, name: 'R3 – Creux prolongé', type: 'leadtime', active: true,
    trigger: 'Période sans réservation – 3 paliers', icon: 'arrow-trend-down',
    desc: "Réduit les prix lorsque aucune réservation n'est enregistrée sur une fenêtre.",
    thresholds: [
      { id: uid(), range: '5 jours',  action: '-5%',  actionsCount: 1 },
      { id: uid(), range: '10 jours', action: '-8%',  actionsCount: 2 },
      { id: uid(), range: '14 jours', action: '-12%', actionsCount: 2 },
    ],
  },
  {
    id: 4, name: 'R4 – Peak last minute', type: 'occupancy', active: true,
    trigger: 'Peak last minute – 2 paliers', icon: 'bolt',
    desc: "Exploite la forte demande de dernière minute (J-7 à J-1).",
    thresholds: [
      { id: uid(), range: '80-85%',   action: '+20%', actionsCount: 2 },
      { id: uid(), range: '90-100%',  action: '+30%', actionsCount: 3 },
    ],
  },
  {
    id: 5, name: 'R5 – Optimisation LOS', type: 'occupancy', active: false,
    trigger: 'Week-end / événement', icon: 'moon',
    desc: "Impose un nombre de nuits minimal (minimum length of stay).",
    thresholds: [
      { id: uid(), range: 'Week-end',  action: 'MLOS 2 nuits', actionsCount: 1 },
      { id: uid(), range: 'Événement', action: 'MLOS 3 nuits', actionsCount: 1 },
    ],
  },
  {
    id: 6, name: 'R6 – Protection parité concurrentielle', type: 'volume', active: true,
    trigger: 'Éécart de prix avec concurrents', icon: 'shield',
    desc: "Ajuste les prix en fonction de la concurrence pour maintenir la compétitivité.",
    thresholds: [
      { id: uid(), range: 'Prix >15% concurrent',  action: '-10%', actionsCount: 1 },
      { id: uid(), range: 'Prix <25% concurrent',  action: '+8%',  actionsCount: 1 },
      { id: uid(), range: 'Prix <40% concurrent',  action: '+15%', actionsCount: 2 },
    ],
  },
  {
    id: 7, name: 'R7 – Early bird', type: 'leadtime', active: true,
    trigger: 'Early bird – 2 paliers', icon: 'calendar-check',
    desc: "Remises pour réservation anticipée pour sécuriser le remplissage tôt.",
    thresholds: [
      { id: uid(), range: '30-60 jours', action: '-15%', actionsCount: 3 },
      { id: uid(), range: '15-30 jours', action: '-10%', actionsCount: 2 },
    ],
  },
  {
    id: 8, name: 'R8 – Analyseur de déplacement de groupe', type: 'volume', active: false,
    trigger: 'Demande de groupe ≥ 8 chambres', icon: 'users',
    desc: "Tarif dynamique pour les groupes selon le volume de chambres demandées.",
    thresholds: [
      { id: uid(), range: '8-15 chambres',  action: '+5%',  actionsCount: 2 },
      { id: uid(), range: '>15 chambres',   action: '+10%', actionsCount: 3 },
    ],
  },
  {
    id: 9, name: 'R9 – Ajustement saisonnier', type: 'occupancy', active: true,
    trigger: 'Occupation historique', icon: 'sun',
    desc: "Applique des règles haute/basse saison basées sur l'historique d'occupation.",
    thresholds: [
      { id: uid(), range: 'Haute saison (>80%)', action: '+15%', actionsCount: 2 },
      { id: uid(), range: 'Basse saison (<40%)', action: '-10%', actionsCount: 2 },
    ],
  },
  {
    id: 10, name: 'R10 – Canal distribution', type: 'channel', active: true,
    trigger: 'Canal de réservation – 4 paliers', icon: 'globe',
    desc: "Multiplicateurs différents selon le canal (direct, OTA, GDS, Tour Opérateur).",
    thresholds: [
      { id: uid(), range: 'Direct',         action: '×1.15', actionsCount: 1 },
      { id: uid(), range: 'OTA',            action: '×1.05', actionsCount: 1 },
      { id: uid(), range: 'GDS',            action: '×1.02', actionsCount: 1 },
      { id: uid(), range: 'Tour Opérateur', action: '×0.95', actionsCount: 1 },
    ],
  },
  {
    id: 11, name: 'R11 – Tarification géographique', type: 'channel', active: false,
    trigger: 'Pays du client', icon: 'map-pin',
    desc: "Multiplicateurs par zone géographique d'origine du client.",
    thresholds: [
      { id: uid(), range: 'GCC / USA', action: '×1.25', actionsCount: 1 },
      { id: uid(), range: 'Europe',    action: '×1.05', actionsCount: 1 },
      { id: uid(), range: 'France',    action: '×1.00', actionsCount: 1 },
    ],
  },
  {
    id: 12, name: 'R12 – Garde-fou overbooking', type: 'volume', active: true,
    trigger: 'Overbooking prévu', icon: 'triangle-exclamation',
    desc: "Limite la surréservation et protège l'intégrité du planning chambre.",
    thresholds: [
      { id: uid(), range: 'Critique (>10)',  action: 'Stop sell',    actionsCount: 1 },
      { id: uid(), range: 'Alerte (5-10)',   action: 'Réduire stock', actionsCount: 1 },
    ],
  },
  {
    id: 13, name: 'R13 – Prédiction IA', type: 'ai', active: true,
    trigger: 'Prédiction IA – modèle ML rolling 60 jours', icon: 'brain',
    desc: "Anticipe les pics de demande via un modèle de machine learning embarqué.",
    thresholds: [
      { id: uid(), range: 'Proba hausse 70-100%', action: '+22%', actionsCount: 1 },
      { id: uid(), range: 'Proba baisse 65-100%', action: '-12%', actionsCount: 1 },
    ],
  },
];

// ─── Helpers localStorage ─────────────────────────────────────────────────────
const STORAGE_KEY = 'flowtym_little_yielder';
const loadStates = (): Record<number, boolean> => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};
const saveStates = (states: Record<number, boolean>) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(states));

// ─── Composant Toggle ─────────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
    <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, width: 0, height: 0 }} />
    <span style={{
      position: 'absolute', inset: 0, borderRadius: 34, transition: '.2s',
      background: checked ? '#8B5CF6' : '#CBD5E1',
    }}>
      <span style={{
        position: 'absolute', height: 18, width: 18, left: 3, bottom: 3,
        background: 'white', borderRadius: '50%', transition: '.2s',
        transform: checked ? 'translateX(20px)' : 'translateX(0)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      }} />
    </span>
  </label>
);

// ─── RuleCard ──────────────────────────────────────────────────────────────────
const RuleCard: React.FC<{
  rule: YieldRule;
  onToggle: (id: number) => void;
  onUpdateThreshold: (ruleId: number, thresh: Threshold) => void;
  onAddTier: (ruleId: number) => void;
}> = ({ rule, onToggle, onUpdateThreshold, onAddTier }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState({ range: '', action: '' });
  const tc = TYPE_COLORS[rule.type];

  const startEdit = (t: Threshold) => {
    setEditingId(t.id);
    setEditVal({ range: t.range, action: t.action });
  };
  const confirmEdit = (t: Threshold) => {
    onUpdateThreshold(rule.id, { ...t, range: editVal.range, action: editVal.action });
    setEditingId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'white', borderRadius: 20, padding: '20px',
        border: `1px solid ${rule.active ? tc.color + '30' : '#E2E8F0'}`,
        boxShadow: rule.active ? `0 2px 12px ${tc.color}12` : '0 2px 8px rgba(0,0,0,.03)',
        transition: 'box-shadow .2s, border-color .2s',
        opacity: rule.active ? 1 : 0.75,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {/* Icône type */}
          <div style={{ width: 30, height: 30, borderRadius: 9, background: tc.bg, color: tc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {TYPE_ICONS[rule.type]}
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', lineHeight: 1.3 }}>{rule.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* Badge SYSTÈME */}
          <span style={{ background: '#F1F5F9', color: '#475569', padding: '3px 10px', borderRadius: 40, fontSize: 10, fontWeight: 700, letterSpacing: '.05em', whiteSpace: 'nowrap' }}>
            SYSTÈME
          </span>
          {/* Badge type */}
          <span style={{ background: tc.bg, color: tc.color, padding: '3px 9px', borderRadius: 40, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {TYPE_LABELS[rule.type]}
          </span>
          {/* Toggle */}
          <Toggle checked={rule.active} onChange={() => onToggle(rule.id)} />
        </div>
      </div>

      {/* Trigger */}
      <div style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', marginBottom: 6 }}>
        {rule.trigger}
      </div>

      {/* Description */}
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 14, lineHeight: 1.5 }}>
        {rule.desc}
      </div>

      {/* Paliers */}
      <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rule.thresholds.map(t => (
          <div key={t.id}>
            {editingId === t.id ? (
              /* Formulaire édition inline */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ background: '#F5F3FF', borderRadius: 12, padding: '10px 12px', border: '1.5px solid #DDD6FE', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={editVal.range}
                  onChange={e => setEditVal(v => ({ ...v, range: e.target.value }))}
                  placeholder="Plage"
                  style={{ flex: 1, minWidth: 80, padding: '5px 10px', borderRadius: 8, border: '1px solid #DDD6FE', fontSize: 11, fontFamily: 'Inter, sans-serif', outline: 'none', background: 'white' }}
                />
                <input
                  value={editVal.action}
                  onChange={e => setEditVal(v => ({ ...v, action: e.target.value }))}
                  placeholder="Action (ex: +10%)"
                  style={{ width: 90, padding: '5px 10px', borderRadius: 8, border: '1px solid #DDD6FE', fontSize: 11, fontFamily: 'Inter, sans-serif', outline: 'none', background: 'white' }}
                />
                <button onClick={() => confirmEdit(t)}
                  style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  ✓
                </button>
                <button onClick={() => setEditingId(null)}
                  style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: 11, cursor: 'pointer' }}>
                  ✕
                </button>
              </motion.div>
            ) : (
              /* Affichage palier */
              <div
                onClick={() => startEdit(t)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '8px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F8FAFC')}
                title="Cliquer pour modifier"
              >
                <span style={{ fontSize: 11, fontWeight: 500, color: '#334155' }}>{t.range}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    background: t.action.startsWith('-') ? '#FEE2E2' : t.action.startsWith('+') ? '#D1FAE5' : '#E0E7FF',
                    color:      t.action.startsWith('-') ? '#DC2626' : t.action.startsWith('+') ? '#059669' : '#3730A3',
                    padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  }}>
                    {t.action}
                  </span>
                  <span style={{ background: '#E0E7FF', color: '#3730A3', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                    {t.actionsCount} act.
                  </span>
                  {/* Crayon discret */}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Bouton Ajouter palier */}
        <button
          onClick={() => onAddTier(rule.id)}
          style={{ background: 'none', border: '1.5px dashed #CBD5E1', padding: '7px 14px', borderRadius: 40, fontSize: 11, cursor: 'pointer', width: '100%', marginTop: 4, color: '#94A3B8', fontFamily: 'Inter, sans-serif', transition: 'all .15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#8B5CF6'; (e.currentTarget as HTMLButtonElement).style.color = '#8B5CF6'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; }}
        >
          + Ajouter un palier
        </button>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 10, marginTop: 4 }}>
        <span style={{ fontSize: 9, color: '#94A3B8' }}>
          Dernière modification : {new Date().toLocaleDateString('fr-FR')}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: rule.active ? '#8B5CF6' : '#94A3B8' }}>
          {rule.active ? '● Actif' : '○ Inactif'}
        </span>
      </div>
    </motion.div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────
export const LittleYielder: React.FC = () => {
  const [rules, setRules] = useState<YieldRule[]>(() => {
    const saved = loadStates();
    return INITIAL_RULES.map(r => ({ ...r, active: saved[r.id] !== undefined ? saved[r.id] : r.active }));
  });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [floorPrice, setFloorPrice] = useState(128);
  const [ceilingPrice, setCeilingPrice] = useState(850);

  const activeCount  = rules.filter(r => r.active).length;
  const lastMultiplier = 1.35;

  // Persister les états actifs
  useEffect(() => {
    const states: Record<number, boolean> = {};
    rules.forEach(r => { states[r.id] = r.active; });
    saveStates(states);
  }, [rules]);

  // Toggle actif/inactif
  const handleToggle = (id: number) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
    const rule = rules.find(r => r.id === id);
    if (rule) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Règle ${!rule.active ? 'activée' : 'désactivée'} · ${rule.name}` }
      }));
    }
  };

  // Modifier un palier
  const handleUpdateThreshold = (ruleId: number, updated: Threshold) => {
    setRules(prev => prev.map(r => r.id === ruleId ? {
      ...r, thresholds: r.thresholds.map(t => t.id === updated.id ? updated : t)
    } : r));
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: `Palier modifié · R${ruleId}` }
    }));
  };

  // Ajouter un palier
  const handleAddTier = (ruleId: number) => {
    const newThresh: Threshold = { id: uid(), range: 'Nouveau palier', action: '+0%', actionsCount: 1 };
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, thresholds: [...r.thresholds, newThresh] } : r));
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: `Palier ajouté · R${ruleId} — cliquez dessus pour modifier` }
    }));
  };

  // Filtrage
  const filtered = useMemo(() => rules.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.desc.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === 'all' || r.type === typeFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? r.active : !r.active);
    return matchSearch && matchType && matchStatus;
  }), [rules, search, typeFilter, statusFilter]);

  const SEL = { padding: '8px 16px', borderRadius: 40, border: '1px solid #E2E8F0', background: 'white', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', cursor: 'pointer', color: '#475569' };

  return (
    <div style={{ padding: '0 0 32px', fontFamily: 'Inter, sans-serif' }}>

      {/* ── HEADER ── */}
      <div style={{ background: 'white', borderRadius: 24, padding: '20px 24px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.03)', border: '1px solid #E2E8F0' }}>

        {/* Titre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1E293B' }}>
              Little Yielder — Règles Yield
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              {rules.length} règles configurées · <span style={{ color: '#8B5CF6', fontWeight: 700 }}>{activeCount} actives</span>
            </div>
          </div>
        </div>

        {/* Stats + paramètres globaux */}
        <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
          {/* Plancher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Plancher</span>
            <input type="number" value={floorPrice} onChange={e => setFloorPrice(+e.target.value)}
              style={{ width: 72, padding: '4px 8px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 12, fontWeight: 700, color: '#8B5CF6', textAlign: 'center', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
            <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 700 }}>€</span>
          </div>
          {/* Plafond */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Plafond</span>
            <input type="number" value={ceilingPrice} onChange={e => setCeilingPrice(+e.target.value)}
              style={{ width: 80, padding: '4px 8px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 12, fontWeight: 700, color: '#8B5CF6', textAlign: 'center', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
            <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 700 }}>€</span>
          </div>
          {/* Parité OTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Parité OTA</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '3px 10px', borderRadius: 100 }}>✓ Oui</span>
          </div>
          {/* Dernière modification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Dernière ch.</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#8B5CF6' }}>×{lastMultiplier}</span>
          </div>
          {/* Barre de progression actives */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 100, height: 6, background: '#F1F5F9', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(activeCount / rules.length) * 100}%`, background: 'linear-gradient(90deg,#8B5CF6,#6D28D9)', borderRadius: 100, transition: 'width .4s' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6' }}>{activeCount}/{rules.length}</span>
          </div>
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" placeholder="Rechercher une règle..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 16px 8px 36px', borderRadius: 40, border: '1px solid #E2E8F0', background: 'white', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
          </div>
          <select style={SEL} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">Tous types</option>
            <option value="volume">Volume</option>
            <option value="cancellation">Annulations</option>
            <option value="leadtime">Lead time</option>
            <option value="occupancy">Occupation</option>
            <option value="channel">Canal</option>
            <option value="ai">IA</option>
          </select>
          <select style={SEL} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Toutes</option>
            <option value="active">Actives</option>
            <option value="inactive">Inactives</option>
          </select>
          {/* Bouton Tout activer */}
          <button
            onClick={() => { setRules(prev => prev.map(r => ({ ...r, active: true }))); window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Toutes les règles activées · Little Yielder' } })); }}
            style={{ padding: '8px 18px', borderRadius: 40, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(139,92,246,.25)', flexShrink: 0 }}>
            ▶ Tout activer
          </button>
        </div>
      </div>

      {/* ── LÉGENDE TYPES ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(TYPE_COLORS).map(([type, tc]) => (
          <button key={type} onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, border: `1px solid ${typeFilter === type ? tc.color : '#E2E8F0'}`, background: typeFilter === type ? tc.bg : 'white', color: typeFilter === type ? tc.color : '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}>
            <span style={{ color: typeFilter === type ? tc.color : '#CBD5E1' }}>{TYPE_ICONS[type as RuleType]}</span>
            {TYPE_LABELS[type as RuleType]}
            <span style={{ fontSize: 9, fontWeight: 800, marginLeft: 2 }}>
              ({rules.filter(r => r.type === type).length})
            </span>
          </button>
        ))}
      </div>

      {/* ── GRILLE DES RÈGLES ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'white', borderRadius: 20, border: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>Aucune règle trouvée</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Ajustez vos filtres ou votre recherche.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          <AnimatePresence>
            {filtered.map(rule => (
              <RuleCard key={rule.id} rule={rule} onToggle={handleToggle}
                onUpdateThreshold={handleUpdateThreshold} onAddTier={handleAddTier} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Responsive — 1 colonne sur petits écrans */}
      <style>{`@media(max-width:900px){.ly-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
};
