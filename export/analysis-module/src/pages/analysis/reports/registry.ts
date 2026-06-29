/**
 * FLOWTYM — Analysis Reports Registry
 *
 * Catalogue officiel des 119 rapports Flowtym organisés en 11 catégories
 * conformes au plan métier (codes 11xxx → 61xxx).
 *
 * Chaque entrée porte :
 *   - id (code court : "11001", "41004A"…) — unique, sert d'ID API
 *   - category — une des 11 catégories définies ci-dessous
 *   - title, description, icon — affichage
 *   - period : "today" (snapshot) ou "range" (sélecteur dates)
 *   - flags :
 *       chart        — produit un graphique 📊
 *       table        — produit un tableau détaillé 📄
 *       realtime     — temps réel ⏱️
 *       fiscalLock   — verrouillé après clôture 🔒
 *       multiTenant  — filtrable par hôtel 🏨
 *   - sources — tables Supabase principales
 *   - comparisons — N-1 / budget / forecast (Revenue mgmt principalement)
 */

import type { LucideIcon } from 'lucide-react';
import {
  Users, BedDouble, Calendar, Coffee, ClipboardList, ClipboardCheck,
  CreditCard, Receipt, BookOpen, Percent, BarChart3, TrendingUp,
  Sparkles, Globe, MapPin, Tag, PieChart, Activity, Phone, Bell,
  Lock, FileText, Building2, Wallet, RefreshCw, AlertTriangle,
  Layers, Briefcase, FileSpreadsheet, Plane, ArrowUpRight, Mail,
  KeyRound, Wrench, Star, Hash, Archive, Banknote, Calculator,
  TrendingDown, Target, Truck,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// CATÉGORIES (11)
// ═══════════════════════════════════════════════════════════════════════════

export type ReportCategory =
  | 'exploitation_fo'
  | 'exploitation_cloture'
  | 'reservations'
  | 'backoffice_arrhes'
  | 'backoffice_cb'
  | 'backoffice_debiteurs'
  | 'comptabilite'
  | 'tva_efacture'
  | 'statistiques'
  | 'revenue_mgmt'
  | 'housekeeping';

export interface ReportCategoryConfig {
  id: ReportCategory;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

export const REPORT_CATEGORIES: ReportCategoryConfig[] = [
  { id: 'exploitation_fo',     label: 'Exploitation — Front Office', shortLabel: 'Front Office',  icon: BedDouble,       color: 'blue',    description: 'Présents, arrivées, départs, gouvernante, petits-déjeuners' },
  { id: 'exploitation_cloture',label: 'Exploitation — Clôture',      shortLabel: 'Clôture',       icon: ClipboardCheck,  color: 'slate',   description: 'MC Prestations, règlements, régularisations, contrôle' },
  { id: 'reservations',        label: 'Réservations',                                              icon: Calendar,        color: 'amber',   description: 'Arrivées, départs, planification, annulations, allotements' },
  { id: 'backoffice_arrhes',   label: 'Back office — Arrhes & Paytells', shortLabel: 'Arrhes',    icon: Wallet,          color: 'emerald', description: 'Encours arrhes, paytells, allocations, remboursements' },
  { id: 'backoffice_cb',       label: 'Back office — Cartes crédit',  shortLabel: 'Cartes',        icon: CreditCard,      color: 'cyan',    description: 'CB traitées, frais, encours, balance âgée, transferts' },
  { id: 'backoffice_debiteurs',label: 'Back office — Débiteurs',      shortLabel: 'Débiteurs',     icon: Receipt,         color: 'rose',    description: 'Encours, balance âgée, relances, transferts comptables' },
  { id: 'comptabilite',        label: 'Comptabilité mensuelle',       shortLabel: 'Comptabilité',  icon: BookOpen,        color: 'violet',  description: 'Prestations mensuelles, recouchants, balance globale, petite caisse' },
  { id: 'tva_efacture',        label: 'TVA 2026 & e-facture',         shortLabel: 'TVA & e-fact',  icon: Percent,         color: 'orange',  description: 'TVA encaissements, exports FEC, Sage/EBP, UBL 2.1' },
  { id: 'statistiques',        label: 'Statistiques',                                              icon: BarChart3,       color: 'purple',  description: 'Segmentation, nationalités, INSEE, sources, allotements' },
  { id: 'revenue_mgmt',        label: 'Revenue Management',           shortLabel: 'Revenue Mgmt',  icon: TrendingUp,      color: 'pink',    description: 'RevPAR, ADR, pickup, prévision, cross-selling, acquisition' },
  { id: 'housekeeping',        label: 'Housekeeping & Maintenance',   shortLabel: 'Housekeeping',  icon: Sparkles,        color: 'teal',    description: 'État chambres, productivité, blocages, maintenance, objets trouvés' },
];

// ═══════════════════════════════════════════════════════════════════════════
// FLAGS RAPPORT
// ═══════════════════════════════════════════════════════════════════════════

export interface ReportFlags {
  chart?: boolean;         // 📊
  table?: boolean;         // 📄
  realtime?: boolean;      // ⏱️
  fiscalLock?: boolean;    // 🔒
  multiTenant?: boolean;   // 🏨 (toujours true en pratique)
}

export interface ReportDefinition {
  id: string;
  category: ReportCategory;
  title: string;
  description: string;
  icon: LucideIcon;
  period: 'today' | 'range';
  flags?: ReportFlags;
  sources?: string[];
  comparisons?: ('N-1' | 'budget' | 'forecast')[];
  tags?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CATALOGUE — 119 rapports
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_REPORTS: ReportDefinition[] = [
  // ─── 1. EXPLOITATION — FRONT OFFICE (11xxx) ──────────────────────────
  { id: '11001', category: 'exploitation_fo', title: 'Clients / Chambres',           description: "Clients présents ou prévus, tri par chambre. Indicateurs A (arrivée) / D (départ).", icon: BedDouble,    period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['rooms', 'reservations', 'customers'] },
  { id: '11002', category: 'exploitation_fo', title: 'Clients / Noms',               description: "Tri alphabétique des clients présents et prévus. Chambre, dates, statut.",         icon: Users,        period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['customers', 'reservations'] },
  { id: '11003', category: 'exploitation_fo', title: 'Petits-déj & consignes',       description: "PDJ commandés + commentaires client. Pour cafétéria / room service.",            icon: Coffee,       period: 'today', flags: { table: true, multiTenant: true }, sources: ['reservations', 'folio_items'] },
  { id: '11004', category: 'exploitation_fo', title: 'Petits-déjeuners pré-facturés',description: "Clients ayant déjà payé le PDJ via arrangement (B&B, DP, PC).",                   icon: Coffee,       period: 'today', flags: { table: true, multiTenant: true }, sources: ['reservations'] },
  { id: '11005', category: 'exploitation_fo', title: 'Planning du jour',             description: "Rack papier avec statuts couleur. Chambre, client, arrivée/départ.",             icon: ClipboardList,period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['rooms', 'reservations'] },
  { id: '11006', category: 'exploitation_fo', title: 'Gouvernante',                  description: "Statut ménage par chambre (propre / sale / en cours). 2 formats.",                icon: Sparkles,     period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['rooms', 'housekeeping'] },
  { id: '11007', category: 'exploitation_fo', title: 'Attributions chambres',        description: "Pré-attribution des chambres aux arrivées du jour. Utilisée le matin.",          icon: KeyRound,     period: 'today', flags: { table: true, multiTenant: true }, sources: ['rooms', 'reservations'] },
  { id: '11008', category: 'exploitation_fo', title: 'Groupes — rooming list jour',  description: "Membres d'un groupe avec chambres et prestations.",                                icon: Users,        period: 'today', flags: { table: true, multiTenant: true }, sources: ['reservations', 'rooming_list'] },
  { id: '11009', category: 'exploitation_fo', title: 'Clients non arrivés',          description: "No-show et retards. Réservations dont l'heure d'arrivée est dépassée.",          icon: AlertTriangle,period: 'today', flags: { table: true, multiTenant: true }, sources: ['reservations'] },
  { id: '11010', category: 'exploitation_fo', title: 'Départs restants',             description: "Départs du jour non encore libérés. Affiche solde facture.",                       icon: Plane,        period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['reservations'] },
  { id: '11011', category: 'exploitation_fo', title: 'Prévisions repas',             description: "Nombre de petits-déj, déjeuners, dîners pré-facturés par jour.",                  icon: Coffee,       period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations'] },

  // ─── 2. EXPLOITATION — BROUILLON / CLÔTURE (12xxx) ───────────────────
  { id: '12001', category: 'exploitation_cloture', title: 'MC Prestations brouillon',     description: "CA détaillé par client. Obligatoire pour clôture journalière.",       icon: FileText,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_lines', 'invoices'] },
  { id: '12002', category: 'exploitation_cloture', title: 'MC Prestations détaillées',    description: "Quantités et montants par code prestation. Détail complet.",         icon: FileText,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_lines'] },
  { id: '12003', category: 'exploitation_cloture', title: 'MC Règlements',                description: "Front + Arrhes + Back + petite caisse. Tous les encaissements.",     icon: Banknote,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments', 'deposits'] },
  { id: '12004', category: 'exploitation_cloture', title: 'MC Règlements détaillés',      description: "Par mode de règlement et par client.",                                icon: Banknote,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments', 'customers'] },
  { id: '12005', category: 'exploitation_cloture', title: 'Détail des devises',           description: "Encaissements en devises étrangères avec taux de change.",            icon: RefreshCw,    period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '12006', category: 'exploitation_cloture', title: 'Position encours (PDG)',       description: "Clients présents + débiteurs − arrhes = position financière globale.",icon: Calculator,   period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['invoices', 'deposits'] },
  { id: '12007', category: 'exploitation_cloture', title: 'Régularisations',              description: "Corrections, annulations, avoirs. Traçabilité.",                       icon: RefreshCw,    period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['audit_logs'] },
  { id: '12008', category: 'exploitation_cloture', title: 'Détail des transferts',        description: "Transferts de prestations entre chambres.",                            icon: ArrowUpRight, period: 'range', flags: { table: true, multiTenant: true }, sources: ['transfer_logs'] },
  { id: '12010', category: 'exploitation_cloture', title: 'MC Téléphone',                 description: "Appels facturés par chambre (durée, coût, destination).",              icon: Phone,        period: 'range', flags: { table: true, multiTenant: true }, sources: ['telephone_logs'] },
  { id: '12011', category: 'exploitation_cloture', title: 'MC Litige téléphone',          description: "Appels annulés / contestés.",                                          icon: Phone,        period: 'range', flags: { table: true, multiTenant: true }, sources: ['telephone_logs'] },
  { id: '12012', category: 'exploitation_cloture', title: 'MC par département',           description: "Transversal : bar, restaurant, hébergement. Graphique barres.",       icon: BarChart3,    period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['invoice_lines', 'families', 'departments'] },
  { id: '12013', category: 'exploitation_cloture', title: 'MC par serveur / utilisateur', description: "Performance par réceptionniste (CA, nombre d'opérations).",            icon: Users,        period: 'range', flags: { table: true, multiTenant: true }, sources: ['invoice_payments', 'users'] },
  { id: '12014', category: 'exploitation_cloture', title: 'Statut des chambres',          description: "Occupation + statut ménage (propre / sale / en nettoyage).",           icon: BedDouble,    period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['rooms', 'housekeeping'] },
  { id: '12015', category: 'exploitation_cloture', title: 'Soldes clients',               description: "Détection risque grivèlerie. Indicateurs ! (solde >50% du CA) et *.",  icon: AlertTriangle,period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['invoices', 'reservations'] },

  // ─── 3. RÉSERVATIONS (21xxx) ──────────────────────────────────────────
  { id: '21001', category: 'reservations', title: "Arrivées d'une journée",        description: "Toutes infos réservation. Tri nom ou chambre.",                          icon: Plane,        period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'customers'] },
  { id: '21002', category: 'reservations', title: 'Départs prévus',                description: "Départs attendus avec solde facture.",                                    icon: Plane,        period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'invoices'] },
  { id: '21003', category: 'reservations', title: 'Présents',                      description: "Clients dans l'hôtel avec durée restante.",                               icon: Users,        period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['reservations', 'rooms'] },
  { id: '21004', category: 'reservations', title: 'Résas pour période',            description: "Sécurité papier. Tri date arrivée + nom.",                                icon: Calendar,     period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations'] },
  { id: '21005', category: 'reservations', title: 'Rooming list',                  description: "Liste nominative des groupes (événements, séminaires).",                  icon: Users,        period: 'range', flags: { table: true, multiTenant: true }, sources: ['rooming_list', 'reservations'] },
  { id: '21006', category: 'reservations', title: 'Planification (F5)',            description: "Disponibilités par type de chambre sur 5 semaines.",                      icon: Layers,       period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['room_types', 'reservations'] },
  { id: '21007', category: 'reservations', title: 'Numéros (F6)',                  description: "Occupation par chambre sur 4 semaines (rack numérique).",                 icon: Hash,         period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['rooms', 'reservations'] },
  { id: '21008', category: 'reservations', title: 'Activité journalière',          description: "Arrivées / départs / occupation (chambres + personnes). Courbe.",         icon: Activity,     period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['daily_occupancy_stats'] },
  { id: '21009', category: 'reservations', title: 'Annulations',                   description: "Réservations annulées avec motifs et pénalités.",                         icon: AlertTriangle,period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations'] },
  { id: '21010', category: 'reservations', title: 'Options',                       description: "Options en attente de confirmation.",                                     icon: Tag,          period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations'] },
  { id: '21011', category: 'reservations', title: 'Repas prévus',                  description: "Nombre de repas par service.",                                            icon: Coffee,       period: 'range', flags: { table: true, multiTenant: true }, sources: ['meal_plannings'] },
  { id: '21012', category: 'reservations', title: 'Détail par société',            description: "Pour sociétés débitrices.",                                                icon: Building2,    period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'companies'] },
  { id: '21013', category: 'reservations', title: 'Détail par canal (CA3)',        description: "Performance par OTA, direct, GDS.",                                       icon: Globe,        period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations', 'invoices'] },
  { id: '21014', category: 'reservations', title: 'Détail par tarif',              description: "Réservations par code contrat.",                                          icon: Tag,          period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'rate_contracts'] },
  { id: '21015', category: 'reservations', title: 'Détail par allotement',         description: "Suivi consommation par partenaire.",                                      icon: Layers,       period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'allotments'] },
  { id: '21016', category: 'reservations', title: 'Détail cardex client',          description: "Historique complet d'un client (séjours, montants, chambres).",           icon: Star,         period: 'range', flags: { table: true, multiTenant: true }, sources: ['customers', 'reservations', 'invoices'] },

  // ─── 4. BACK OFFICE — ARRHES & PAYTELLS (31xxx) ──────────────────────
  { id: '31001', category: 'backoffice_arrhes', title: 'Arrhes en compte',         description: "Encours global des arrhes (solde non affecté).",                          icon: Wallet,       period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['deposits'] },
  { id: '31002', category: 'backoffice_arrhes', title: 'Arrhes détaillées',        description: "Détail par dossier : encaissement, affectation, remboursement.",         icon: Wallet,       period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['deposits', 'deposit_allocations', 'deposit_refunds'] },
  { id: '31003', category: 'backoffice_arrhes', title: 'Paytells en compte',       description: "Garanties sans encaissement (liens émis non capturés).",                  icon: Lock,         period: 'range', flags: { table: true, multiTenant: true }, sources: ['deposits'] },
  { id: '31004', category: 'backoffice_arrhes', title: 'Paytells détaillés',       description: "Mouvements payable — historique complet par lien émis.",                  icon: Lock,         period: 'range', flags: { table: true, multiTenant: true }, sources: ['deposits', 'deposit_allocations'] },

  // ─── 5. BACK OFFICE — CARTES DE CRÉDIT (32xxx) ───────────────────────
  { id: '32001', category: 'backoffice_cb', title: 'CB traitées',                  description: "Règlements CB par mode et commission.",                                   icon: CreditCard,   period: 'range', flags: { table: true, multiTenant: true }, sources: ['invoice_payments', 'payment_modes'] },
  { id: '32002', category: 'backoffice_cb', title: 'CB frais divers',              description: "Commissions et rétro-facturations.",                                      icon: Percent,      period: 'range', flags: { table: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '32003', category: 'backoffice_cb', title: 'Encours CB',                   description: "Pré-autorisations et empreintes actives.",                                icon: CreditCard,   period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['card_authorizations'] },
  { id: '32004', category: 'backoffice_cb', title: 'Balance âgée CB',              description: "Encours par mois (5 mois + au-delà). Barres empilées.",                   icon: BarChart3,    period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['card_authorizations'] },
  { id: '32005', category: 'backoffice_cb', title: 'Transferts CB',                description: "Corrections d'affectation (Visa → Amex…).",                               icon: RefreshCw,    period: 'range', flags: { table: true, multiTenant: true }, sources: ['card_transfer_logs'] },

  // ─── 6. BACK OFFICE — DÉBITEURS (33xxx) ──────────────────────────────
  { id: '33001', category: 'backoffice_debiteurs', title: 'Débiteurs traités',     description: "Encaissements débiteurs (payment_mode=9).",                               icon: Receipt,      period: 'range', flags: { table: true, multiTenant: true }, sources: ['invoice_payments', 'companies'] },
  { id: '33002', category: 'backoffice_debiteurs', title: 'Débiteurs frais divers',description: "Pertes de créance, frais bancaires.",                                     icon: TrendingDown, period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['debtor_write_offs'] },
  { id: '33003', category: 'backoffice_debiteurs', title: 'Encours débiteurs',     description: "Factures impayées par société.",                                          icon: Receipt,      period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['invoices'] },
  { id: '33004', category: 'backoffice_debiteurs', title: 'Balance âgée débiteurs',description: "Créances par tranches : <30j, 30-60j, >60j. Barres empilées.",            icon: BarChart3,    period: 'today', flags: { chart: true, table: true, realtime: true, multiTenant: true }, sources: ['invoices', 'companies'] },
  { id: '33005', category: 'backoffice_debiteurs', title: 'Transferts débiteurs',  description: "Transferts entre comptes débiteurs.",                                     icon: RefreshCw,    period: 'range', flags: { table: true, multiTenant: true }, sources: ['debtor_transfer_logs'] },
  { id: '33006', category: 'backoffice_debiteurs', title: 'Relances impayés',      description: "Lettres types : 1ère relance, 2ème, mise en demeure.",                    icon: Mail,         period: 'today', flags: { table: true, multiTenant: true }, sources: ['invoices', 'companies'] },

  // ─── 7. COMPTABILITÉ MENSUELLE (41xxx) ───────────────────────────────
  { id: '41001', category: 'comptabilite', title: 'MC Prestations mensuelle',          description: "CA par famille + TVA. Synthèse mensuelle.",                          icon: BookOpen,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_lines', 'families'] },
  { id: '41002', category: 'comptabilite', title: 'MC Prestations détaillée mensuelle',description: "Par code prestation.",                                                icon: BookOpen,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_lines'] },
  { id: '41003', category: 'comptabilite', title: 'MC Règlements cumulés',             description: "Total encaissements (Front + Arrhes + Back).",                       icon: Banknote,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments', 'deposits'] },
  { id: '41004A',category: 'comptabilite', title: 'MC Règlements — Arrhes',            description: "Sous-total arrhes.",                                                  icon: Wallet,       period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['deposits'] },
  { id: '41004B',category: 'comptabilite', title: 'MC Règlements — Back',              description: "Sous-total débiteurs + CB.",                                          icon: CreditCard,   period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '41004F',category: 'comptabilite', title: 'MC Règlements — Front',             description: "Sous-total encaissements clients présents.",                          icon: Banknote,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '41005', category: 'comptabilite', title: 'Détail encaissements',              description: "Espèces, chèques, virements — gestion passive.",                      icon: Banknote,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '41007', category: 'comptabilite', title: 'Rapport comptable',                 description: "Écritures : ventes, encaissements, arrhes, débiteurs. Export Sage/EBP.",icon: FileSpreadsheet,period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['accounting_lines'] },
  { id: '41008', category: 'comptabilite', title: 'Recouchants',                       description: "Report à nouveau encours clients multi-nuits.",                       icon: BedDouble,    period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['reservations', 'invoices'] },
  { id: '41010', category: 'comptabilite', title: 'Balance âgée globale',              description: "Clients + débiteurs + CB — vue consolidée.",                          icon: BarChart3,    period: 'today', flags: { chart: true, table: true, realtime: true, multiTenant: true }, sources: ['invoices', 'card_authorizations'] },
  { id: '41011', category: 'comptabilite', title: 'Contrôle des soldes',               description: "Vérification comptable interne. Différence doit être = 0.",           icon: ClipboardCheck,period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['accounting_lines'] },
  { id: '41012', category: 'comptabilite', title: 'Petite caisse',                     description: "Dépenses par fournisseur et taux TVA.",                               icon: Wallet,       period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['petty_cash', 'suppliers'] },
  { id: '41013', category: 'comptabilite', title: 'Statistiques par code prestation',  description: "Quantités et montants par service. Barres.",                          icon: BarChart3,    period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['invoice_lines'] },
  { id: '41014', category: 'comptabilite', title: 'MC Arrangements détaillés',         description: "Contenu des forfaits B&B, DP, PC.",                                   icon: ClipboardList,period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'rate_contracts'] },

  // ─── 8. TVA 2026 & ÉLECTRONIQUE (42xxx-47xxx) ─────────────────────────
  { id: '42001', category: 'tva_efacture', title: 'Arrhes encaissées',                 description: "Entrées arrhes pour comptabilité.",                                   icon: Wallet,       period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['deposits'] },
  { id: '42002', category: 'tva_efacture', title: 'Arrhes sorties',                    description: "Transferts vers factures + remboursements.",                          icon: Wallet,       period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['deposit_allocations', 'deposit_refunds'] },
  { id: '42003', category: 'tva_efacture', title: 'Arrhes non transférées',            description: "Encours arrhes restant.",                                             icon: Wallet,       period: 'today', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['deposits'] },
  { id: '43001', category: 'tva_efacture', title: 'CB traitées (mensuel)',             description: "Session back CB mensuelle.",                                          icon: CreditCard,   period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '44001', category: 'tva_efacture', title: 'Débiteurs traités (mensuel)',       description: "Session débiteurs mensuelle.",                                        icon: Receipt,      period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '45001', category: 'tva_efacture', title: 'MC Prestations annuelle',           description: "Synthèse 12 mois — cumul annuel.",                                    icon: BookOpen,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_lines'] },
  { id: '45002', category: 'tva_efacture', title: 'Factures émises / MC',              description: "Liste factures + soldes initiaux/finaux.",                            icon: FileText,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoices'] },
  { id: '45004C',category: 'tva_efacture', title: 'MC Règlements annuelle cumulée',    description: "Cumul 12 mois des règlements.",                                       icon: Banknote,     period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '45006', category: 'tva_efacture', title: 'Mouvements arrhes (comptabilité)',  description: "Débit / Crédit arrhes — écritures comptables.",                       icon: Wallet,       period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['deposits', 'deposit_allocations', 'deposit_refunds'] },
  { id: '45007', category: 'tva_efacture', title: 'Mouvements CB',                     description: "Débit / Crédit CB.",                                                  icon: CreditCard,   period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '45008', category: 'tva_efacture', title: 'Mouvements débiteurs',              description: "Débit / Crédit débiteurs.",                                           icon: Receipt,      period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoices', 'invoice_payments'] },
  { id: '45009', category: 'tva_efacture', title: 'Commissions',                       description: "Pour déclaration DAS2.",                                              icon: Percent,      period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_payments'] },
  { id: '46001', category: 'tva_efacture', title: 'TVA sur encaissements',             description: "Conforme réforme 2026. Variation encours, base taxable, ventilation par taux. Barres.", icon: Percent, period: 'range', flags: { chart: true, table: true, fiscalLock: true, multiTenant: true }, sources: ['invoice_lines', 'encours_calcul'] },
  { id: '46002', category: 'tva_efacture', title: 'Recouchants (TVA encaissements)',   description: "Détail TVA par taux sur les clients multi-nuits.",                    icon: BedDouble,    period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['reservations', 'invoice_lines'] },
  { id: '46003', category: 'tva_efacture', title: 'Arrhes (TVA encaissements)',        description: "Encours arrhes pour calcul TVA.",                                     icon: Wallet,       period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['deposits'] },
  { id: '47001', category: 'tva_efacture', title: 'Export FEC',                        description: "Fichier des Écritures Comptables DGFiP — UTF-8, pipe.",               icon: Archive,      period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['accounting_lines', 'journals'] },
  { id: '47002', category: 'tva_efacture', title: 'Export Sage / EBP',                 description: "Export écritures format Sage 100 / EBP.",                             icon: Archive,      period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['accounting_lines'] },
  { id: '47003', category: 'tva_efacture', title: 'Export UBL 2.1',                    description: "Facture électronique — obligation e-facture France 2026.",            icon: Archive,      period: 'range', flags: { table: true, fiscalLock: true, multiTenant: true }, sources: ['invoices', 'companies'] },

  // ─── 9. STATISTIQUES (51xxx-53xxx) ────────────────────────────────────
  { id: '51010', category: 'statistiques', title: 'Segmentation',                      description: "CA, nuitées, ADR par segment de marché (niveau 1). Camembert.",        icon: PieChart,     period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['customers', 'reservations', 'invoices'], comparisons: ['N-1'] },
  { id: '51020', category: 'statistiques', title: 'Tarifs contrats',                   description: "Performance par code contrat. Barres.",                               icon: BarChart3,    period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations', 'rate_contracts'], comparisons: ['N-1'] },
  { id: '51030', category: 'statistiques', title: 'Allotements',                       description: "Suivi consommation, taux de transformation, CA.",                     icon: Layers,       period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations', 'allotments'] },
  { id: '51040', category: 'statistiques', title: 'Cardex clients',                    description: "Fréquence, CA total, fidélité. Barres.",                              icon: Star,         period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['customers', 'reservations', 'invoices'] },
  { id: '51050', category: 'statistiques', title: 'Sources (AP2)',                     description: "Répartition par apporteur (agences, prescripteurs). Camembert.",      icon: Briefcase,    period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations', 'companies'] },
  { id: '51060', category: 'statistiques', title: 'Nationalités',                      description: "Nuitées, CA par pays. Camembert.",                                    icon: MapPin,       period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['customers', 'reservations'] },
  { id: '51070', category: 'statistiques', title: 'INSEE',                             description: "Nuitées par nationalité — format officiel INSEE. Barres.",            icon: FileSpreadsheet,period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations', 'customers'] },
  { id: '52010', category: 'statistiques', title: 'Segmentation détaillée',            description: "Avec détail sous-segment et compte.",                                 icon: Layers,       period: 'range', flags: { table: true, multiTenant: true }, sources: ['customers'] },
  { id: '52011', category: 'statistiques', title: 'AP2 détaillé',                      description: "Par apporteur — détail séjour par séjour.",                           icon: Briefcase,    period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'companies'] },
  { id: '52020', category: 'statistiques', title: 'Tarifs contrats détaillés',         description: "Détail par séjour — tous détails.",                                   icon: Tag,          period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'rate_contracts'] },
  { id: '52030', category: 'statistiques', title: 'Allotements détaillés',             description: "Par allotement — détail des réservations consommées.",                icon: Layers,       period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'allotments'] },
  { id: '52040', category: 'statistiques', title: 'Cardex clients détaillé',           description: "Détail par client — tous ses séjours.",                               icon: Star,         period: 'range', flags: { table: true, multiTenant: true }, sources: ['customers', 'reservations'] },
  { id: '52050', category: 'statistiques', title: 'Sources détaillées (AP2)',          description: "Par apporteur avec détail des séjours.",                              icon: Briefcase,    period: 'range', flags: { table: true, multiTenant: true }, sources: ['reservations', 'companies'] },
  { id: '53001', category: 'statistiques', title: 'Consommations téléphoniques',       description: "Détail des appels par chambre (durée, coût, destination).",           icon: Phone,        period: 'range', flags: { table: true, multiTenant: true }, sources: ['telephone_logs'] },
  { id: '53003', category: 'statistiques', title: 'Réveils programmés',                description: "Liste des réveils par chambre et heure.",                             icon: Bell,         period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['alarm_wakeup'] },
  { id: '53004', category: 'statistiques', title: 'Problèmes réveils',                 description: "Réveils non aboutis — incidents à traiter.",                          icon: AlertTriangle,period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['alarm_wakeup'] },
  { id: '53005', category: 'statistiques', title: 'État des postes téléphoniques',     description: "Statut de chaque poste PABX.",                                        icon: Phone,        period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['telephone_posts', 'reservations'] },

  // ─── 10. REVENUE MANAGEMENT (54xxx) ──────────────────────────────────
  { id: '54001', category: 'revenue_mgmt', title: 'RevPAR journalier',                  description: "Courbe RevPAR sur 30/90 jours. Comparaison N-1.",                     icon: TrendingUp,   period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['daily_performance_stats'], comparisons: ['N-1', 'forecast'] },
  { id: '54002', category: 'revenue_mgmt', title: 'ADR par type de chambre',            description: "ADR comparatif par catégorie de chambre. Barres.",                    icon: BarChart3,    period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations', 'room_types'], comparisons: ['N-1'] },
  { id: '54003', category: 'revenue_mgmt', title: "Taux d'occupation par canal",        description: "Part de marché par canal (Direct, Booking, Expedia, Agoda). Camembert.",icon: Globe,        period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations'], comparisons: ['N-1'] },
  { id: '54004', category: 'revenue_mgmt', title: 'Pickup curve',                       description: "Réservations à J-30, J-60, J-90. Courbe de montée en charge.",         icon: TrendingUp,   period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['pickup_curves'], comparisons: ['N-1'] },
  { id: '54005', category: 'revenue_mgmt', title: 'Prévision de demande',               description: "Forecast basé sur historique + IA.",                                  icon: Target,       period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['demand_forecast'], comparisons: ['forecast'] },
  { id: '54006', category: 'revenue_mgmt', title: 'Performance allotement',             description: "Taux de transformation par alloteur (réalisé vs contractuel).",       icon: Layers,       period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations', 'allotments'] },
  { id: '54007', category: 'revenue_mgmt', title: "Coût d'acquisition par canal",       description: "Commissions + CPA par canal. Barres.",                                 icon: Wallet,       period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations', 'invoice_payments'], comparisons: ['N-1'] },
  { id: '54008', category: 'revenue_mgmt', title: 'Cross-selling (chambres sup.)',      description: "Taux d'upgrade par réceptionniste. Barres.",                          icon: ArrowUpRight, period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['reservations'] },

  // ─── 11. HOUSEKEEPING & MAINTENANCE (61xxx) ──────────────────────────
  { id: '61001', category: 'housekeeping', title: 'État quotidien des chambres',        description: "Propre / sale / en cours / inspectée — statut temps réel.",           icon: Sparkles,     period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['rooms', 'housekeeping'] },
  { id: '61002', category: 'housekeeping', title: 'Temps moyen de ménage par employée', description: "Performance par gouvernante (temps moyen, nombre de chambres).",      icon: BarChart3,    period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['housekeeping'] },
  { id: '61003', category: 'housekeeping', title: 'Liste des chambres bloquées',        description: "Chambres hors service avec motif et durée prévue.",                   icon: Lock,         period: 'today', flags: { table: true, realtime: true, multiTenant: true }, sources: ['rooms', 'room_blockings'] },
  { id: '61004', category: 'housekeeping', title: 'Rapport incidents maintenance',      description: "Signalements ouverts, résolus, en cours — suivi maintenance.",        icon: Wrench,       period: 'range', flags: { table: true, multiTenant: true }, sources: ['maintenance'] },
  { id: '61005', category: 'housekeeping', title: 'Objets trouvés',                     description: "Par date et statut (en attente / restitué). Registre légal.",         icon: Archive,      period: 'range', flags: { table: true, multiTenant: true }, sources: ['lost_found'] },
  { id: '61006', category: 'housekeeping', title: 'Productivité housekeeping',          description: "Chambres / heure / employée. Barres.",                                icon: BarChart3,    period: 'range', flags: { chart: true, table: true, multiTenant: true }, sources: ['housekeeping'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getReportById(id: string): ReportDefinition | undefined {
  return ALL_REPORTS.find(r => r.id === id);
}

export function getReportsByCategory(category: ReportCategory): ReportDefinition[] {
  return ALL_REPORTS.filter(r => r.category === category);
}

export function getCategoryConfig(category: ReportCategory): ReportCategoryConfig | undefined {
  return REPORT_CATEGORIES.find(c => c.id === category);
}

export function searchReports(query: string): ReportDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_REPORTS;
  return ALL_REPORTS.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q) ||
    r.id.toLowerCase().includes(q) ||
    (r.tags ?? []).some(t => t.toLowerCase().includes(q)) ||
    (r.sources ?? []).some(s => s.toLowerCase().includes(q))
  );
}

// Compteurs globaux
export const REPORT_STATS = {
  total: ALL_REPORTS.length,
  withChart: ALL_REPORTS.filter(r => r.flags?.chart).length,
  withTable: ALL_REPORTS.filter(r => r.flags?.table).length,
  fiscalLocked: ALL_REPORTS.filter(r => r.flags?.fiscalLock).length,
  realtime: ALL_REPORTS.filter(r => r.flags?.realtime).length,
};
