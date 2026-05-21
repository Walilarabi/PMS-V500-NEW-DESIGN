/**
 * FLOWTYM — Analysis Reports Registry
 *
 * Catalogue central des rapports disponibles. Chaque rapport est défini
 * une seule fois ici. Le ReportViewer s'en sert pour le rendu, l'export,
 * les favoris et les vues sauvegardées.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Activity, TrendingUp, BarChart3, PieChart, Globe, Tags,
  Bed, Users, Calendar, DollarSign, Percent, FileText,
  Target, Sparkles, Building2, Trophy, Receipt, ShoppingCart,
  CreditCard, Briefcase,
} from 'lucide-react';

export type ReportCategory =
  | 'revenue'
  | 'occupation'
  | 'finance'
  | 'pickup'
  | 'segments'
  | 'channels'
  | 'compset'
  | 'direction'
  | 'audit'
  | 'commercial';

export interface ReportCategoryConfig {
  id: ReportCategory;
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

export const REPORT_CATEGORIES: ReportCategoryConfig[] = [
  { id: 'revenue', label: 'Revenue', icon: TrendingUp, color: 'violet', description: 'CA, RevPAR, ADR, performance tarifaire' },
  { id: 'occupation', label: 'Occupation', icon: Bed, color: 'blue', description: 'Pace, pickup, heatmap, prévisions' },
  { id: 'finance', label: 'Finance', icon: Receipt, color: 'emerald', description: 'Encaissements, TVA, commissions OTA, soldes' },
  { id: 'pickup', label: 'Pick-up', icon: Calendar, color: 'amber', description: 'Vélocité réservations 7j / 30j / 90j' },
  { id: 'segments', label: 'Segments', icon: Users, color: 'orange', description: 'Loisir, Business, Corpo, Groupes, VIP' },
  { id: 'channels', label: 'Canaux', icon: Globe, color: 'cyan', description: 'OTA, Direct, Mobile, Corporate, Tour Opérator' },
  { id: 'compset', label: 'Veille concurrentielle', icon: Target, color: 'rose', description: 'Compset, médiane, positionnement' },
  { id: 'direction', label: 'KPI Direction', icon: Trophy, color: 'purple', description: 'Tableau de bord stratégique direction' },
  { id: 'audit', label: 'Audit', icon: FileText, color: 'slate', description: 'Journaux, traçabilité, conformité' },
  { id: 'commercial', label: 'Performance commerciale', icon: Briefcase, color: 'pink', description: 'Conversion, lead time, sources de réservation' },
];

export interface ReportDefinition {
  id: string;                          // 'revenue.by_channel'
  category: ReportCategory;
  title: string;
  description: string;
  icon: LucideIcon;
  tags?: string[];                      // 'kpi' | 'direction' | 'opérationnel'
  comparisons?: ('N-1' | 'budget' | 'forecast')[];
  // Renderer chargé en lazy ailleurs
}

export const ALL_REPORTS: ReportDefinition[] = [
  // ─── REVENUE ─────────────────────────────────────────────────────────
  { id: 'revenue.summary',        category: 'revenue', title: 'Synthèse Revenue',         description: "CA Total, CA Net, ADR, RevPAR sur la période",       icon: TrendingUp,  comparisons: ['N-1', 'budget'] },
  { id: 'revenue.by_channel',     category: 'revenue', title: 'CA par canal',             description: "Répartition revenus par OTA / Direct / TO",         icon: Globe,       comparisons: ['N-1'] },
  { id: 'revenue.by_segment',     category: 'revenue', title: 'CA par segment',           description: "Loisir / Business / Corpo / Groupes / VIP",         icon: Users,       comparisons: ['N-1'] },
  { id: 'revenue.adr_trend',      category: 'revenue', title: 'Évolution ADR',            description: "ADR jour par jour avec moyenne mobile",             icon: BarChart3,   comparisons: ['N-1', 'forecast'] },
  { id: 'revenue.revpar_trend',   category: 'revenue', title: 'Évolution RevPAR',         description: "RevPAR quotidien et tendances",                     icon: Activity,    comparisons: ['N-1', 'forecast'] },
  { id: 'revenue.by_rate_plan',   category: 'revenue', title: 'Performance Rate Plans',   description: "CA, nuitées et conversion par plan tarifaire",      icon: Tags,        comparisons: ['N-1'] },

  // ─── OCCUPATION ──────────────────────────────────────────────────────
  { id: 'occupation.daily',       category: 'occupation', title: 'Occupation journalière',   description: "Taux d'occupation par jour, weekends mis en évidence", icon: Calendar,    comparisons: ['N-1', 'forecast'] },
  { id: 'occupation.heatmap',     category: 'occupation', title: 'Heatmap occupation',       description: "Carte de chaleur mensuelle de l'occupation",         icon: Activity },
  { id: 'occupation.forecast',    category: 'occupation', title: 'Prévision occupation',     description: "Projection 30/60/90 jours basée sur pickup + pace",  icon: TrendingUp,  comparisons: ['forecast'] },
  { id: 'occupation.by_room_type',category: 'occupation', title: 'Par type de chambre',      description: "Taux par catégorie : standard / deluxe / suite",     icon: Bed },

  // ─── FINANCE ─────────────────────────────────────────────────────────
  { id: 'finance.encaissements',  category: 'finance', title: 'Journal des encaissements',description: "Tous les paiements par moyen et par caissier",      icon: CreditCard },
  { id: 'finance.tva',            category: 'finance', title: 'Déclaration TVA',          description: "Ventilation par taux (2.1%, 5.5%, 10%, 20%)",       icon: Percent },
  { id: 'finance.commissions',    category: 'finance', title: 'Commissions OTA',          description: "Montants à reverser à Booking, Expedia, Airbnb",    icon: ShoppingCart },
  { id: 'finance.impayes',        category: 'finance', title: 'Impayés & créances',       description: "Balance âgée 0-30j / 60j / 90j",                    icon: DollarSign },
  { id: 'finance.taxe_sejour',    category: 'finance', title: 'Taxe de séjour',           description: "Calcul municipal (adultes × nuitées)",              icon: Receipt },

  // ─── PICK-UP ─────────────────────────────────────────────────────────
  { id: 'pickup.7d',              category: 'pickup', title: 'Pickup 7 jours',           description: "Velocité réservations sur les 7 derniers jours",    icon: Activity },
  { id: 'pickup.30d',             category: 'pickup', title: 'Pickup 30 jours',          description: "Velocité réservations sur les 30 derniers jours",   icon: Activity },
  { id: 'pickup.pace',            category: 'pickup', title: 'Pace booking curve',       description: "Courbe de réservation comparée à N-1",              icon: TrendingUp,  comparisons: ['N-1'] },

  // ─── SEGMENTS ────────────────────────────────────────────────────────
  { id: 'segments.distribution',  category: 'segments', title: 'Distribution segments',    description: "Donut de répartition CA / nuitées par segment",     icon: PieChart,    comparisons: ['N-1'] },
  { id: 'segments.adr_segment',   category: 'segments', title: 'ADR par segment',          description: "Comparaison ADR Loisir vs Business vs Groupes",     icon: BarChart3 },

  // ─── CANAUX ──────────────────────────────────────────────────────────
  { id: 'channels.performance',   category: 'channels', title: 'Performance canaux',       description: "Volume, ADR, RevPAR contribution par canal",        icon: Globe,       comparisons: ['N-1'] },
  { id: 'channels.commissions',   category: 'channels', title: 'Coût par canal',           description: "Net effective commission rate (NECR) par OTA",      icon: Percent },

  // ─── VEILLE ──────────────────────────────────────────────────────────
  { id: 'compset.positionnement', category: 'compset', title: 'Positionnement compset',    description: "Notre rang vs médiane du compset",                  icon: Target },
  { id: 'compset.heatmap',        category: 'compset', title: 'Heatmap tarifs compset',    description: "Carte chaleur prix concurrents",                    icon: Activity },

  // ─── DIRECTION ───────────────────────────────────────────────────────
  { id: 'direction.cockpit',      category: 'direction', title: 'Cockpit Direction',       description: "Tableau stratégique : CA, occupation, RevPAR, GOP", icon: Trophy,      comparisons: ['N-1', 'budget'] },
  { id: 'direction.kpi_strategy', category: 'direction', title: 'KPIs stratégiques',       description: "GOPPAR, TRevPAR, ALOS, conversion par canal",       icon: BarChart3,   comparisons: ['N-1', 'budget'] },

  // ─── AUDIT ───────────────────────────────────────────────────────────
  { id: 'audit.decisions_rms',    category: 'audit', title: 'Décisions RMS',             description: "Historique acceptations / refus / maintien tarifs", icon: FileText },
  { id: 'audit.modifications',    category: 'audit', title: 'Journal modifications',     description: "Trace de chaque édition prix / réservation",         icon: FileText },

  // ─── COMMERCIAL ──────────────────────────────────────────────────────
  { id: 'commercial.conversion',  category: 'commercial', title: 'Taux de conversion',       description: "Visite → réservation par source de trafic",          icon: Activity },
  { id: 'commercial.lead_time',   category: 'commercial', title: 'Lead time',                description: "Distribution du délai réservation → arrivée",        icon: Calendar },
  { id: 'commercial.sources',     category: 'commercial', title: 'Sources de réservation',   description: "Site direct, OTA, agence, repeat, walk-in",          icon: Building2 },
];

export function getReportById(id: string): ReportDefinition | undefined {
  return ALL_REPORTS.find(r => r.id === id);
}

export function getReportsByCategory(category: ReportCategory): ReportDefinition[] {
  return ALL_REPORTS.filter(r => r.category === category);
}

export function searchReports(query: string): ReportDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_REPORTS;
  return ALL_REPORTS.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q) ||
    r.id.toLowerCase().includes(q) ||
    (r.tags ?? []).some(t => t.toLowerCase().includes(q))
  );
}
