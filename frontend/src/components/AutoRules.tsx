import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, TrendingDown, TrendingUp, Shield, AlertTriangle,
  BarChart2, Clock, Target, Users, Lock,
  Play, Pause, Info, CheckCircle2,
  ArrowUp, ArrowDown, ChevronRight, Save, RotateCcw,
  ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type RuleStatus = 'active' | 'paused';

interface Threshold {
  label: string;       // ex : "J ≤ 2 + Occ < 50%"
  pct: number;         // valeur en %
  direction: '+' | '-'; // hausse ou baisse
  editable: boolean;
}

interface Condition {
  label: string;
  operator: string;
  value: string;
  locked?: boolean;    // figé = true → cadenas
  editable?: boolean;
}

interface RuleAction {
  label: string;
  color: string;
  icon: React.ReactNode;
}

interface Rule {
  id: string;
  order: number;
  name: string;
  shortName: string;
  description: string;
  trigger: string;       // source du déclencheur
  added_value: string;   // valeur ajoutée
  category: 'securite' | 'marche' | 'pickup' | 'occupancy' | 'lead_time' | 'restrictions';
  icon: React.ReactNode;
  color: string;
  bg: string;
  status: RuleStatus;
  priority: 'critique' | 'haute' | 'normale';
  conditions: Condition[];
  thresholds: Threshold[];  // steppers modifiables
  actions: RuleAction[];
  triggered: number;
  lastTriggered?: string;
  impact: string;
  warning?: string;
}

// ─── Catégories ───────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  securite:     { label: '1. Sécurité',        color: '#DC2626', bg: '#FEF2F2', icon: <Shield className="w-3 h-3" /> },
  marche:       { label: '2. Marché / Compset', color: '#7C3AED', bg: '#EDE9FE', icon: <BarChart2 className="w-3 h-3" /> },
  pickup:       { label: '3. Pickup',           color: '#2563EB', bg: '#EFF6FF', icon: <Target className="w-3 h-3" /> },
  occupancy:    { label: '4. Occupation',       color: '#D97706', bg: '#FFF7ED', icon: <Users className="w-3 h-3" /> },
  lead_time:    { label: '5. Lead Time',        color: '#059669', bg: '#ECFDF5', icon: <Clock className="w-3 h-3" /> },
  restrictions: { label: '6. Restrictions',     color: '#64748B', bg: '#F8FAFC', icon: <Lock className="w-3 h-3" /> },
};

const priorityConfig = {
  critique: { label: 'Critique', color: '#DC2626', bg: '#FEF2F2' },
  haute:    { label: 'Haute',    color: '#D97706', bg: '#FFF7ED' },
  normale:  { label: 'Normale',  color: '#64748B', bg: '#F8FAFC' },
};

const statusConfig = {
  active: { label: 'Active',  color: '#059669', bg: '#ECFDF5', dot: '#10B981' },
  paused: { label: 'Pausée',  color: '#D97706', bg: '#FFF7ED', dot: '#F59E0B' },
};

// ─── 10 règles ────────────────────────────────────────────────────────────────
const INITIAL_RULES: Rule[] = [
  {
    id: 'r10', order: 1,
    name: 'Filet de sécurité', shortName: 'Sécurité', priority: 'critique',
    category: 'securite',
    icon: <Shield className="w-5 h-5" />, color: '#DC2626', bg: '#FEF2F2',
    status: 'active', triggered: 0,
    description: "Garde-fou permanent qui plafonne toutes les variations automatiques à ±20%/jour et impose les bornes min/max absolues.",
    trigger: 'Appliquée en permanence sur toutes les règles',
    added_value: "Protège contre tout comportement aberrant du moteur de pricing.",
    warning: "Cette règle doit toujours rester active. Ne jamais la désactiver.",
    impact: "Filet obligatoire — sans lui, les autres règles peuvent produire des prix aberrants.",
    conditions: [
      { label: 'Toujours active', operator: '=', value: 'OUI' },
    ],
    thresholds: [
      { label: 'Variation maximale / jour', pct: 20, direction: '+', editable: true },
      { label: 'Variation minimale / jour', pct: 20, direction: '-', editable: true },
    ],
    actions: [
      { label: 'MAX variation ±20% / jour', color: '#DC2626', icon: <Shield className="w-3 h-3" /> },
      { label: 'Prix ≥ Prix minimum configuré', color: '#059669', icon: <ArrowUp className="w-3 h-3" /> },
      { label: 'Prix ≤ Prix maximum configuré', color: '#2563EB', icon: <ArrowDown className="w-3 h-3" /> },
    ],
  },
  {
    id: 'r5', order: 2,
    name: 'Alignement marché (anti-dérive)', shortName: 'Compset', priority: 'haute',
    category: 'marche',
    icon: <BarChart2 className="w-5 h-5" />, color: '#7C3AED', bg: '#EDE9FE',
    status: 'active', triggered: 12, lastTriggered: 'Il y a 2h',
    description: "Compare ton prix au compset en temps réel. Évite de dériver trop haut ou trop bas par rapport au marché.",
    trigger: 'Prix compset (défini dans Configuration RMS)',
    added_value: "Maintient la compétitivité sans sacrifier le RevPAR.",
    impact: "Correction automatique de la dérive tarifaire par rapport au marché.",
    conditions: [
      { label: 'Compset source', operator: '=', value: 'Configuration RMS', locked: true },
      { label: 'Ton prix', operator: '>', value: 'Compset +X%', editable: true },
      { label: 'OU Ton prix', operator: '<', value: 'Compset -X%', editable: true },
    ],
    thresholds: [
      { label: 'Seuil dérive HAUTE → baisser', pct: 5, direction: '-', editable: true },
      { label: 'Seuil dérive BASSE → monter', pct: 5, direction: '+', editable: true },
    ],
    actions: [
      { label: 'Si trop haut → Baisser', color: '#DC2626', icon: <ArrowDown className="w-3 h-3" /> },
      { label: 'Si trop bas → Monter', color: '#059669', icon: <ArrowUp className="w-3 h-3" /> },
    ],
  },
  {
    id: 'r6', order: 3,
    name: 'Pickup lent — action', shortName: 'Pickup lent', priority: 'haute',
    category: 'pickup',
    icon: <TrendingDown className="w-5 h-5" />, color: '#2563EB', bg: '#EFF6FF',
    status: 'active', triggered: 5, lastTriggered: 'Hier',
    description: "Détecte un rythme de réservation inférieur à l'historique N-1 et réagit avant qu'il soit trop tard.",
    trigger: 'Pickup actuel vs historique N-1 (source ClickHouse)',
    added_value: "Évite de réaliser trop tard que la semaine se remplit mal.",
    impact: "Réduction des pertes sur les nuits à faible pickup.",
    conditions: [
      { label: 'Historique N-1', operator: '=', value: 'Source ClickHouse', locked: true },
      { label: 'Pickup actuel', operator: '<', value: 'Historique -X%', editable: true },
    ],
    thresholds: [
      { label: 'Seuil pickup lent → baisser', pct: 10, direction: '-', editable: true },
    ],
    actions: [
      { label: 'Baisser prix', color: '#DC2626', icon: <ArrowDown className="w-3 h-3" /> },
      { label: 'Booster visibilité OTA', color: '#7C3AED', icon: <TrendingUp className="w-3 h-3" /> },
    ],
  },
  {
    id: 'r7', order: 4,
    name: 'Pickup rapide — frein', shortName: 'Pickup rapide', priority: 'haute',
    category: 'pickup',
    icon: <TrendingUp className="w-5 h-5" />, color: '#2563EB', bg: '#EFF6FF',
    status: 'active', triggered: 3, lastTriggered: 'Il y a 3j',
    description: "Détecte un rythme de réservation anormalement rapide. Signal que tu es sous-pricé ou que la demande est forte.",
    trigger: 'Pickup actuel vs historique N-1 (source ClickHouse)',
    added_value: "Évite de vendre trop vite à prix bas = sous-pricing.",
    impact: "Capture la valeur sur les nuits à forte demande.",
    conditions: [
      { label: 'Historique N-1', operator: '=', value: 'Source ClickHouse', locked: true },
      { label: 'Pickup actuel', operator: '>', value: 'Historique +X%', editable: true },
    ],
    thresholds: [
      { label: 'Seuil pickup rapide → monter', pct: 10, direction: '+', editable: true },
    ],
    actions: [
      { label: 'Augmenter prix', color: '#059669', icon: <ArrowUp className="w-3 h-3" /> },
      { label: 'Ajouter restriction MLOS', color: '#64748B', icon: <Lock className="w-3 h-3" /> },
    ],
  },
  {
    id: 'r1', order: 5,
    name: "Stopper l'hémorragie last minute", shortName: 'Last Minute', priority: 'haute',
    category: 'occupancy',
    icon: <Zap className="w-5 h-5" />, color: '#D97706', bg: '#FFF7ED',
    status: 'active', triggered: 8, lastTriggered: 'Il y a 6h',
    description: "J-2/J-1 avec faible remplissage = danger. Mieux vaut vendre moins cher que de dormir avec des chambres vides.",
    trigger: "Jours avant arrivée + taux d'occupation du jour",
    added_value: "Élimine les pertes sèches sur les nuits à faible occupation last minute.",
    impact: "Réduit les nuits non vendues de 15-25% sur les périodes creuses.",
    conditions: [
      { label: 'Jours avant arrivée', operator: '≤', value: '2', editable: true },
      { label: 'Occupation', operator: '<', value: '50%', editable: true },
    ],
    thresholds: [
      { label: 'Baisse last minute J-2 / J-1', pct: 15, direction: '-', editable: true },
    ],
    actions: [
      { label: 'Baisser prix', color: '#DC2626', icon: <ArrowDown className="w-3 h-3" /> },
      { label: 'Ouvrir toutes les ventes', color: '#059669', icon: <CheckCircle2 className="w-3 h-3" /> },
      { label: 'Supprimer MLOS', color: '#2563EB', icon: <CheckCircle2 className="w-3 h-3" /> },
    ],
  },
  {
    id: 'r2', order: 6,
    name: 'Maximiser en haute demande', shortName: 'Haute demande', priority: 'haute',
    category: 'occupancy',
    icon: <TrendingUp className="w-5 h-5" />, color: '#D97706', bg: '#FFF7ED',
    status: 'active', triggered: 19, lastTriggered: 'Il y a 1h',
    description: "Quand tu es presque plein, c'est l'erreur classique de continuer à vendre pas cher. Monte les prix.",
    trigger: "Taux d'occupation en temps réel",
    added_value: "Hausse directe du RevPAR sur les nuits à forte pression.",
    impact: "Augmentation moyenne de +12% de RevPAR sur les nuits à +85%.",
    conditions: [
      { label: 'Occupation', operator: '≥', value: '85%', editable: true },
    ],
    thresholds: [
      { label: 'Hausse haute demande', pct: 15, direction: '+', editable: true },
    ],
    actions: [
      { label: 'Augmenter prix', color: '#059669', icon: <ArrowUp className="w-3 h-3" /> },
      { label: 'Fermer tarifs promo', color: '#DC2626', icon: <Lock className="w-3 h-3" /> },
      { label: 'Fermer OTA low-cost', color: '#64748B', icon: <Lock className="w-3 h-3" /> },
    ],
  },
  {
    id: 'r8', order: 7,
    name: 'Gestion lead time', shortName: 'Lead Time', priority: 'normale',
    category: 'lead_time',
    icon: <Clock className="w-5 h-5" />, color: '#059669', bg: '#ECFDF5',
    status: 'active', triggered: 7, lastTriggered: 'Hier',
    description: "Adapte la stratégie selon l'horizon temporel : hausse anticipée à J+20, baisse agressive à J-5.",
    trigger: 'Nombre de jours avant arrivée + niveau de pickup',
    added_value: "Optimise le timing des ajustements de prix selon l'horizon.",
    impact: "Améliore le RevPAR de J-30 à J+1 sur les nuits normales.",
    conditions: [
      { label: 'Jours avant arrivée', operator: '>', value: '20', editable: true },
      { label: 'ET Pickup', operator: '=', value: 'Fort' },
      { label: 'OU Jours avant arrivée', operator: '<', value: '5', editable: true },
      { label: 'ET Occupation', operator: '=', value: 'Faible' },
    ],
    thresholds: [
      { label: 'Si J>20 + pickup fort → monter', pct: 10, direction: '+', editable: true },
      { label: 'Si J<5 + occ faible → baisser', pct: 15, direction: '-', editable: true },
    ],
    actions: [
      { label: 'Si lointain + fort → +%', color: '#059669', icon: <ArrowUp className="w-3 h-3" /> },
      { label: 'Si proche + faible → -%', color: '#DC2626', icon: <ArrowDown className="w-3 h-3" /> },
    ],
  },
  {
    id: 'r9', order: 8,
    name: 'Compression marché (concurrence)', shortName: 'Compression', priority: 'normale',
    category: 'marche',
    icon: <Users className="w-5 h-5" />, color: '#7C3AED', bg: '#EDE9FE',
    status: 'paused', triggered: 2, lastTriggered: 'Il y a 1 sem.',
    description: "Quand >70% des hôtels du compset sont complets, c'est un signal massif souvent ignoré. Profites-en.",
    trigger: 'Taux de disponibilité du compset (source RMS / scraping)',
    added_value: "Capture la valeur lors des pics de demande marché global.",
    impact: "Signal massif souvent ignoré = perte de RevPAR en période de saturation.",
    conditions: [
      { label: 'Compset (source)', operator: '=', value: 'Scraping / RMS', locked: true },
      { label: 'Hôtels compset complets', operator: '>', value: '70%', editable: true },
    ],
    thresholds: [
      { label: 'Compression marché → monter', pct: 20, direction: '+', editable: true },
    ],
    actions: [
      { label: 'Augmenter prix', color: '#059669', icon: <ArrowUp className="w-3 h-3" /> },
      { label: 'Activer MLOS 2 nuits', color: '#64748B', icon: <Lock className="w-3 h-3" /> },
    ],
  },
  {
    id: 'r3', order: 9,
    name: 'Activer MLOS (Minimum Stay)', shortName: 'MLOS', priority: 'normale',
    category: 'restrictions',
    icon: <Lock className="w-5 h-5" />, color: '#64748B', bg: '#F8FAFC',
    status: 'active', triggered: 4, lastTriggered: 'Il y a 2j',
    description: "Le MLOS est le levier le plus sous-utilisé. Il augmente le RevPAR sans toucher aux prix affichés.",
    trigger: 'DPS (Demand Pressure Score) + événements détectés',
    added_value: "Hausse du RevPAR sans augmenter les prix affichés — clients non dissuadés par le tarif.",
    impact: "Levier le plus sous-utilisé du revenue management hôtelier.",
    conditions: [
      { label: 'DPS (score interne)', operator: '=', value: 'Calculé automatiquement', locked: true },
      { label: 'DPS actuel', operator: '>', value: '70', editable: true },
      { label: 'OU Événement', operator: '=', value: 'Détecté', editable: false },
    ],
    thresholds: [
      { label: 'MLOS (nuits min)', pct: 2, direction: '+', editable: true },
    ],
    actions: [
      { label: 'MLOS = 2 nuits minimum', color: '#64748B', icon: <Lock className="w-3 h-3" /> },
    ],
  },
  {
    id: 'r4', order: 10,
    name: 'Fermer arrivées (CTA)', shortName: 'CTA', priority: 'normale',
    category: 'restrictions',
    icon: <AlertTriangle className="w-5 h-5" />, color: '#64748B', bg: '#F8FAFC',
    status: 'paused', triggered: 1, lastTriggered: 'Il y a 5j',
    description: "Ferme les arrivées sur les dates isolées à faible occupation quand la veille est quasi-complète.",
    trigger: "Occupation veille + analyse des trous de planning",
    added_value: "Réduit les trous de planning non comblables qui coûtent du RevPAR.",
    impact: "Évite les trous de planning et optimise le remplissage en longueur de séjour.",
    conditions: [
      { label: 'Occupation veille', operator: '≥', value: '90%', editable: true },
      { label: 'Trou de planning', operator: '=', value: 'Détecté', editable: false },
    ],
    thresholds: [],
    actions: [
      { label: 'Fermer arrivées (CTA = ON)', color: '#DC2626', icon: <Lock className="w-3 h-3" /> },
    ],
  },
];

// ─── Stepper ──────────────────────────────────────────────────────────────────
const Stepper: React.FC<{
  threshold: Threshold;
  onChange: (val: number) => void;
}> = ({ threshold, onChange }) => {
  const isNuit = threshold.label.includes('nuits');
  const min = isNuit ? 1 : 0;
  const max = isNuit ? 7 : 30;
  const unit = isNuit ? 'nuits' : '%';

  const dec = () => onChange(Math.max(min, threshold.pct - 1));
  const inc = () => onChange(Math.min(max, threshold.pct + 1));

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-white rounded-xl border border-slate-100 group">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-slate-600 font-medium leading-tight">{threshold.label}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-3">
        <button onClick={dec}
          className="w-7 h-7 rounded-xl flex items-center justify-center text-[13px] font-bold transition-all hover:scale-110 active:scale-95"
          style={{ background: `${threshold.direction === '-' ? '#FEF2F2' : '#F8FAFC'}`, color: threshold.direction === '-' ? '#DC2626' : '#94A3B8' }}>
          ▼
        </button>
        <div className="min-w-[48px] flex items-center justify-center gap-0.5 font-mono">
          <span className="text-[15px] font-black" style={{ color: threshold.direction === '+' ? '#059669' : '#DC2626' }}>
            {threshold.direction}{threshold.pct}
          </span>
          <span className="text-[12px] text-slate-400">{unit}</span>
        </div>
        <button onClick={inc}
          className="w-7 h-7 rounded-xl flex items-center justify-center text-[13px] font-bold transition-all hover:scale-110 active:scale-95"
          style={{ background: `${threshold.direction === '+' ? '#ECFDF5' : '#F8FAFC'}`, color: threshold.direction === '+' ? '#059669' : '#94A3B8' }}>
          ▲
        </button>
      </div>
    </div>
  );
};

// ─── RuleCard ─────────────────────────────────────────────────────────────────
const RuleCard: React.FC<{
  rule: Rule;
  onToggle: (id: string) => void;
  onChange: (id: string, rule: Rule) => void;
}> = ({ rule, onToggle, onChange }) => {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_LABELS[rule.category];
  const st  = statusConfig[rule.status];
  const pr  = priorityConfig[rule.priority];

  const handleThresholdChange = (i: number, val: number) => {
    const updated = [...rule.thresholds];
    updated[i] = { ...updated[i], pct: val };
    onChange(rule.id, { ...rule, thresholds: updated });
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: `Seuil mis à jour · ${rule.shortName} → ${updated[i].direction}${val}%` }
    }));
  };

  const handleToggle = () => {
    if (rule.id === 'r10') {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Règle protégée · Le filet de sécurité ne peut pas être désactivé' }
      }));
      return;
    }
    onToggle(rule.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border overflow-hidden flex flex-col"
      style={{
        borderColor: rule.status === 'active' ? `${rule.color}30` : '#E2E8F0',
        boxShadow: rule.status === 'active' ? `0 2px 14px ${rule.color}14` : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Top bar couleur ── */}
      <div className="h-1 w-full" style={{ background: rule.status === 'active' ? rule.color : '#E2E8F0' }} />

      {/* ── Header carte ── */}
      <div className="px-5 pt-5 pb-4 flex items-start gap-4">
        {/* Ordre */}
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold bg-slate-100 text-slate-400 flex-shrink-0 mt-0.5">
          {rule.order}
        </div>
        {/* Icône */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: rule.bg, color: rule.color }}>
          {rule.icon}
        </div>
        {/* Titre + badges */}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-slate-900 leading-tight mb-1">{rule.name}</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: pr.bg, color: pr.color }}>
              {pr.label}
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5"
              style={{ background: cat.bg, color: cat.color }}>
              {cat.icon} {cat.label}
            </span>
          </div>
        </div>
        {/* Statut + toggle */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
            style={{ background: st.bg, color: st.color }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: st.dot }} />
            {st.label}
          </span>
          <button onClick={handleToggle}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all border"
            style={{
              background: rule.status === 'active' ? '#FFF7ED' : '#ECFDF5',
              borderColor: rule.status === 'active' ? '#FED7AA' : '#BBF7D0',
              color: rule.status === 'active' ? '#D97706' : '#059669',
            }}>
            {rule.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ── Description + infos clés ── */}
      <div className="px-5 pb-4 flex-1">
        <p className="text-[13px] text-slate-500 leading-relaxed mb-3">{rule.description}</p>

        {/* Trigger + Valeur ajoutée */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider min-w-[90px] mt-0.5">Déclencheur</span>
            <span className="text-[13px] text-slate-600 font-medium leading-tight">{rule.trigger}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider min-w-[90px] mt-0.5">Valeur ajoutée</span>
            <span className="text-[13px] font-semibold leading-tight" style={{ color: rule.color }}>{rule.added_value}</span>
          </div>
        </div>

        {/* Stats déclenchements */}
        {rule.triggered > 0 && (
          <div className="flex items-center gap-3 text-[12px] text-slate-400 mb-3">
            <span><strong className="text-slate-600">{rule.triggered}</strong> déclenchements 30j</span>
            {rule.lastTriggered && <span>· Dernier : <strong className="text-slate-600">{rule.lastTriggered}</strong></span>}
          </div>
        )}

        {/* Steppers seuils — toujours visibles */}
        {rule.thresholds.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Seuils modifiables
            </div>
            {rule.thresholds.map((t, i) => (
              <Stepper key={i} threshold={t}
                onChange={val => handleThresholdChange(i, val)} />
            ))}
          </div>
        )}
        {rule.thresholds.length === 0 && (
          <div className="text-[12px] text-slate-400 italic">Aucun seuil — restriction on/off uniquement</div>
        )}
      </div>

      {/* ── Expand — Détail conditions + actions ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-5 py-3 border-t border-slate-100 bg-slate-50/60 hover:bg-slate-100/70 transition-all text-[12px] font-semibold text-slate-500"
      >
        <span>{expanded ? 'Masquer le détail' : 'Voir conditions & actions'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 grid grid-cols-2 gap-5 bg-slate-50/50 border-t border-slate-100">
              {/* Conditions */}
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Conditions SI</div>
                <div className="space-y-1.5">
                  {rule.conditions.map((cond, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-slate-100">
                      {cond.locked && (
                        <Lock className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" title="Valeur figée — configurable dans les paramètres globaux" />
                      )}
                      <span className="text-[12px] text-slate-500 font-medium min-w-[90px] truncate">{cond.label}</span>
                      <span className="text-[11px] font-bold text-slate-300 mx-0.5">{cond.operator}</span>
                      <span className={`text-[12px] font-bold flex-1 truncate ${cond.locked ? 'text-slate-400' : ''}`}
                        style={{ color: cond.locked ? '#94A3B8' : rule.color }}>
                        {cond.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Actions */}
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Actions ALORS</div>
                <div className="space-y-1.5">
                  {rule.actions.map((action, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-slate-100">
                      <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${action.color}18`, color: action.color }}>
                        {action.icon}
                      </div>
                      <span className="text-[12px] font-semibold" style={{ color: action.color }}>{action.label}</span>
                    </div>
                  ))}
                </div>
                {/* Impact */}
                <div className="mt-2 p-2.5 rounded-xl flex items-start gap-1.5" style={{ background: rule.bg }}>
                  <Info className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: rule.color }} />
                  <span className="text-[12px] leading-relaxed" style={{ color: rule.color }}>{rule.impact}</span>
                </div>
              </div>
            </div>
            {/* Warning */}
            {rule.warning && (
              <div className="px-4 pb-4 bg-slate-50/50">
                <div className="p-3 bg-red-50 rounded-xl flex items-start gap-2 border border-red-100">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-[13px] text-red-600 font-medium leading-relaxed">{rule.warning}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────
export const AutoRules: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const activeCount   = rules.filter(r => r.status === 'active').length;
  const pausedCount   = rules.filter(r => r.status === 'paused').length;
  const totalTriggers = rules.reduce((s, r) => s + r.triggered, 0);

  const handleToggle = (id: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const next: RuleStatus = r.status === 'active' ? 'paused' : 'active';
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Règle ${next === 'active' ? 'activée' : 'mise en pause'} · ${r.shortName}` }
      }));
      return { ...r, status: next };
    }));
  };

  const handleChange = (id: string, updated: Rule) => {
    setRules(prev => prev.map(r => r.id === id ? updated : r));
  };

  const handleActivateAll = () => {
    setRules(prev => prev.map(r => ({ ...r, status: 'active' as RuleStatus })));
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: 'Toutes les règles activées · Moteur automatique opérationnel' }
    }));
  };

  const filteredRules = rules.filter(r => {
    if (filterCat !== 'all' && r.category !== filterCat) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="px-6 py-6 space-y-5 w-full">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" /> Règles automatiques
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full ml-1">Little Yielder</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Moteur de pricing automatique — 10 règles priorisées, prix et restrictions ajustés en temps réel.
          </p>
        </div>
        <button onClick={handleActivateAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 flex-shrink-0 whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }}>
          <Play className="w-4 h-4" /> Tout activer
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Règles actives',      value: activeCount,   color: '#059669', bg: '#ECFDF5', icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'En pause',            value: pausedCount,   color: '#D97706', bg: '#FFF7ED', icon: <Pause className="w-4 h-4" /> },
          { label: 'Déclenchements 30j',  value: totalTriggers, color: '#7C3AED', bg: '#EDE9FE', icon: <Zap className="w-4 h-4" /> },
          { label: 'Total règles',        value: rules.length,  color: '#2563EB', bg: '#EFF6FF', icon: <Shield className="w-4 h-4" /> },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</div>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: kpi.bg, color: kpi.color }}>
                {kpi.icon}
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── ORDRE D'APPLICATION ── */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Ordre d'application — résout les conflits entre règles
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(CATEGORY_LABELS).map(([key, cat], i) => (
            <React.Fragment key={key}>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold"
                style={{ background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}33` }}>
                {cat.icon} {cat.label}
              </div>
              {i < 5 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── FILTRES ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {[
            { id: 'all', label: 'Toutes' },
            ...Object.entries(CATEGORY_LABELS).map(([id, c]) => ({ id, label: c.label.replace(/^\d+\.\s*/, '') }))
          ].map(f => (
            <button key={f.id} onClick={() => setFilterCat(f.id)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border"
              style={filterCat === f.id
                ? { background: '#8B5CF6', color: 'white', borderColor: '#8B5CF6' }
                : { background: 'white', color: '#64748B', borderColor: '#E2E8F0' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {['all', 'active', 'paused'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border"
              style={filterStatus === s
                ? { background: '#1E293B', color: 'white', borderColor: '#1E293B' }
                : { background: 'white', color: '#64748B', borderColor: '#E2E8F0' }}>
              {s === 'all' ? 'Tous' : s === 'active' ? '🟢 Actives' : '🟡 Pausées'}
            </button>
          ))}
        </div>
      </div>

      {/* ── GRILLE 2 COLONNES ── */}
      {filteredRules.length > 0 ? (
        <div className="auto-rules-grid">
          <AnimatePresence>
            {filteredRules.map(rule => (
              <RuleCard key={rule.id} rule={rule} onToggle={handleToggle} onChange={handleChange} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">🤖</div>
          <div className="text-base font-bold text-slate-700 mb-1">Aucune règle dans ce filtre</div>
          <div className="text-sm text-slate-400">Changez les filtres pour voir les règles disponibles.</div>
        </div>
      )}

      {/* ── NOTE BOTTOM ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-[13px] text-amber-700 leading-relaxed">
          <strong>Rappel :</strong> Sans RMS automatisé, vous perdez en moyenne 8-15% de RevPAR annuel sur des erreurs de pricing évitables.
          Les éléments <Lock className="w-3 h-3 inline mx-0.5" style={{ color: '#94A3B8' }} /> sont figés — modifiables dans <strong>Paramètres → Configuration RMS</strong>.
        </div>
      </div>
    </div>
  );
};
