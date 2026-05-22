import React from 'react';
import {
  LayoutDashboard, Calendar, Bed, Wrench, Shield, RefreshCw,
  ShieldAlert, AlertCircle, GitMerge, History, Settings2,
  CalendarDays, CheckCircle2, Clock, HelpCircle, Users,
  Building2, Target, GitMerge as Merge, FileText, Ban,
  UserCheck, TrendingUp, Grid, BarChart2, Share2,
  Layers, Zap, CreditCard, Receipt, Wallet,
  AlertTriangle, Lock, Banknote, Percent, Plug, Package,
  PieChart, Activity, BookOpen, Database,
  ChevronRight, PanelLeftClose, PanelLeftOpen, Sparkles,
  Cpu, Bell, ShieldCheck, Upload, ClipboardList, HardDrive,
  Hotel, Globe, Tag, Coffee, KeyRound, Star, FolderOpen, FileCode2, Send,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { PageId } from '@/src/types';

interface SidebarProps {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}

type NavItem = { id: PageId; label: string; icon: any; badge?: string };
type NavGroup = { label: string; items: NavItem[] };

// ── Arborescence officielle ────────────────────────────────────────────────────
const SIDEBAR_CONFIG: Record<string, NavGroup[]> = {

  flowday: [
    {
      label: 'Pilotage opérationnel',
      items: [
        { id: 'flowboard',   label: 'Flowboard',    icon: LayoutDashboard },
        { id: 'planning',    label: 'Planning',     icon: CalendarDays },
        { id: 'today',       label: 'Flowday',      icon: Bed },
        { id: 'housekeeping',label: 'Housekeeping', icon: Sparkles },
        { id: 'maintenance', label: 'Maintenance',  icon: Wrench },
      ],
    },
  ],

  sas: [
    {
      label: 'SAS — Revenue Integrity',
      items: [
        { id: 'sas_incoming',      label: 'Réservations entrantes', icon: RefreshCw },
        { id: 'sas_rie',           label: 'Revenue Integrity (RIE)', icon: Shield },
        { id: 'sas_anomalies',     label: 'Anomalies détectées',    icon: ShieldAlert },
        { id: 'sas_quarantine',    label: 'File quarantaine',       icon: AlertCircle },
        { id: 'sas_odms',          label: 'OTA Dispute Center',     icon: GitMerge },
        { id: 'sas_reconciliation',label: 'Rapprochement',          icon: RefreshCw },
        { id: 'sas_audit',         label: 'Journal Audit',          icon: History },
        { id: 'sas_partners',      label: 'Config. partenaires OTA',icon: Settings2 },
      ],
    },
  ],

  reservations: [
    {
      label: 'Réservations',
      items: [
        { id: 'reservations', label: 'Dashboard',       icon: LayoutDashboard },
        { id: 'res_confirmed',label: 'Confirmées',      icon: CheckCircle2 },
        { id: 'res_hold',     label: 'En option (Hold)',icon: Clock },
        { id: 'res_pending',  label: 'Pending',         icon: HelpCircle },
        { id: 'groupes',      label: 'Groupes',         icon: Users },
      ],
    },
    {
      label: 'Suivi des paiements',
      items: [
        { id: 'res_payments',  label: 'Paiements',          icon: CreditCard },
        { id: 'res_anomalies', label: 'Anomalies financières',icon: AlertTriangle },
        { id: 'res_relances',  label: 'Relances',           icon: Bell },
      ],
    },
  ],

  clients: [
    {
      label: 'Clients',
      items: [
        { id: 'clients',           label: 'Dashboard',            icon: LayoutDashboard },
        { id: 'clients_cardex',    label: 'Particuliers (Cardex)',icon: UserCheck },
        { id: 'clients_companies', label: 'Sociétés / Agences',  icon: Building2 },
        { id: 'clients_segments',  label: 'Segments marketing',  icon: Target },
        { id: 'clients_merge',     label: 'Fusion / Dédoublonnage',icon: Merge },
        { id: 'clients_documents', label: 'Documents & signatures',icon: FileText },
        { id: 'clients_blacklist', label: 'Blacklist / Watchlist',icon: Ban },
        { id: 'clients_tiers',     label: 'Tiers / Prescripteurs',icon: Globe },
      ],
    },
  ],

  revenue: [
    {
      label: 'Pilotage',
      items: [
        { id: 'revenue',      label: 'Dashboard',           icon: LayoutDashboard },
        { id: 'rev_pricing',  label: 'Calendrier tarifaire',icon: CalendarDays },
      ],
    },
    {
      label: 'Distribution',
      items: [
        { id: 'rev_channels', label: 'Canaux & OTAs',       icon: Share2 },
        { id: 'rev_compset',  label: 'Veille concurrentielle', icon: Target },
      ],
    },
    {
      label: 'Automatisation',
      items: [
        { id: 'rms',             label: 'Tableau RMS',            icon: Activity },
        { id: 'rms_history',     label: 'Historique décisions',   icon: History },
        { id: 'rev_rules',       label: 'Yield & Règles auto',    icon: Zap },
        { id: 'rev_promotions',  label: 'Promotions',             icon: Tag },
      ],
    },
  ],

  finance: [
    {
      label: 'Finance',
      items: [
        { id: 'finance',           label: "Vue d'ensemble",       icon: Wallet },
        { id: 'facturation',       label: 'Facturation',          icon: FileText },
        { id: 'fin_folios',        label: 'Multi-folios',         icon: FolderOpen },
        { id: 'proforma',          label: 'Proforma / Devis',     icon: Receipt },
        { id: 'caisse',            label: 'Caisse',               icon: Wallet },
        { id: 'impayes',           label: 'Impayés / Débiteurs',  icon: AlertTriangle },
        { id: 'fin_dunning',       label: 'Relances automatiques',icon: Send },
        { id: 'cloture',           label: 'Clôture journalière',  icon: Lock },
        { id: 'fin_reconciliation',label: 'Rapprochement bancaire',icon: RefreshCw },
        { id: 'fin_einvoice',      label: 'E-facture & PPF',      icon: FileCode2 },
        { id: 'tva2026',           label: 'TVA 2026 & e-facture', icon: Percent },
        { id: 'paiements_securises',label: 'Paiements sécurisés', icon: ShieldCheck },
        { id: 'comptabilite',      label: 'Comptabilité',         icon: BookOpen },
        { id: 'cash_management',   label: 'Cash Management',      icon: Banknote },
      ],
    },
  ],

  analysis: [
    {
      label: 'Analyse & Rapports',
      items: [
        { id: 'analysis',           label: "Vue d'ensemble",     icon: LayoutDashboard },
        { id: 'analysis_library',   label: 'Bibliothèque',       icon: BookOpen },
        { id: 'analysis_favorites', label: 'Mes favoris',        icon: Star },
        { id: 'analysis_recent',    label: 'Récents',            icon: Clock },
        { id: 'analysis_saved',     label: 'Vues sauvegardées',  icon: FileText },
        { id: 'analysis_alerts',    label: "Centre d'alertes",   icon: Activity },
      ],
    },
  ],

  settings: [
    {
      label: 'Vue générale',
      items: [
        { id: 'settings',        label: 'Vue d\'ensemble', icon: LayoutDashboard },
        { id: 'settings_hotel',  label: 'Établissement',   icon: Hotel },
        { id: 'settings_multihotel', label: 'Multi-hôtels',icon: Globe },
      ],
    },
    {
      label: 'Chambres & Inventaire',
      items: [
        { id: 'settings_room_types', label: 'Types de chambres', icon: Tag },
        { id: 'settings_rooms',      label: 'Chambres',          icon: Bed },
        { id: 'settings_floors',     label: 'Étages',            icon: Layers },
        { id: 'settings_room_status',label: 'Statuts',           icon: CheckCircle2 },
        { id: 'settings_preferences',label: 'Préférences',       icon: Star },
      ],
    },
    {
      label: 'Tarifs & Prestations',
      items: [
        { id: 'settings_products',       label: 'Prestations',       icon: Package },
        { id: 'settings_rate_plans',     label: 'Plans tarifaires',  icon: Grid },
        { id: 'settings_conditions',     label: 'Conditions',        icon: FileText },
        { id: 'settings_seasons',        label: 'Saisons',           icon: Calendar },
        { id: 'settings_age_categories', label: 'Catégories d\'âge', icon: Users },
      ],
    },
    {
      label: 'Finance & Facturation',
      items: [
        { id: 'settings_invoice',       label: 'Paramètres facture', icon: Receipt },
        { id: 'settings_numbering',     label: 'Numérotation',       icon: Hash },
        { id: 'settings_payment_modes', label: 'Modes de règlement', icon: CreditCard },
        { id: 'settings_accounting',    label: 'Comptabilité',       icon: BookOpen },
        { id: 'settings_debtors',       label: 'Débiteurs',          icon: AlertTriangle },
        { id: 'settings_fiscal',        label: 'Fiscalité France 2026', icon: Percent },
      ],
    },
    {
      label: 'Housekeeping',
      items: [
        { id: 'settings_hk_status',      label: 'Statuts chambres', icon: CheckCircle2 },
        { id: 'settings_hk_checklists',  label: 'Checklists',       icon: ClipboardList },
        { id: 'settings_hk_staff',       label: 'Personnel',        icon: Users },
        { id: 'settings_hk_distribution',label: 'Répartition',      icon: Share2 },
        { id: 'settings_maintenance',    label: 'Maintenance',      icon: Wrench },
        { id: 'settings_lost_found',     label: 'Objets trouvés',   icon: Package },
        { id: 'settings_breakfast',      label: 'Petit-déjeuner',   icon: Coffee },
      ],
    },
    {
      label: 'Technique & Sécurité',
      items: [
        { id: 'settings_pms_sync',       label: 'PMS / Synchronisation', icon: Plug },
        { id: 'settings_api',            label: 'API & Webhooks',     icon: Cpu },
        { id: 'settings_connectors',     label: 'Connecteurs',        icon: Share2 },
        { id: 'settings_users',          label: 'Utilisateurs & Droits', icon: KeyRound },
        { id: 'settings_automations',    label: 'Automatisations',    icon: Zap },
        { id: 'settings_notifications',  label: 'Notifications & Modèles', icon: Bell },
        { id: 'settings_rgpd',           label: 'RGPD & Sécurité',   icon: ShieldCheck },
        { id: 'settings_import_export',  label: 'Import / Export',    icon: Upload },
        { id: 'settings_audit',          label: 'Audit / Logs',       icon: History },
        { id: 'settings_backups',        label: 'Sauvegardes',        icon: HardDrive },
      ],
    },
  ],
};

// Map page → catégorie sidebar
const PAGE_TO_CATEGORY: Record<string, string> = {
  flowboard: 'flowday', planning: 'flowday', today: 'flowday',
  housekeeping: 'flowday', maintenance: 'flowday',
  sas: 'sas', sas_incoming: 'sas', sas_rie: 'sas',
  sas_anomalies: 'sas', sas_quarantine: 'sas', sas_odms: 'sas',
  sas_reconciliation: 'sas', sas_audit: 'sas', sas_partners: 'sas',
  reservations: 'reservations', res_confirmed: 'reservations', res_hold: 'reservations',
  res_pending: 'reservations', groupes: 'reservations', res_payments: 'reservations',
  res_anomalies: 'reservations', res_relances: 'reservations',
  clients: 'clients', clients_cardex: 'clients', clients_companies: 'clients',
  clients_segments: 'clients', clients_merge: 'clients', clients_documents: 'clients',
  clients_blacklist: 'clients', clients_tiers: 'clients',
  revenue: 'revenue', rev_pricing: 'revenue', rev_channels: 'revenue',
  rev_compset: 'revenue', rev_market: 'revenue', rev_rules: 'revenue', rev_yield: 'revenue',
  rev_promotions: 'revenue', rms: 'revenue', rms_history: 'revenue',
  finance: 'finance', facturation: 'finance', fin_folios: 'finance', proforma: 'finance',
  caisse: 'finance', impayes: 'finance', fin_dunning: 'finance', cloture: 'finance',
  fin_reconciliation: 'finance', fin_einvoice: 'finance', tva2026: 'finance',
  paiements_securises: 'finance', comptabilite: 'finance', cash_management: 'finance',
  analysis: 'analysis', kpi: 'analysis', performance: 'analysis',
  forecast: 'analysis', rapports: 'analysis', rapports_exploitation: 'analysis',
  rapports_reservations: 'analysis', rapports_backoffice: 'analysis',
  rapports_comptabilite: 'analysis', rapports_tva: 'analysis',
  rapports_stats: 'analysis', rapports_revenue: 'analysis', rapports_housekeeping: 'analysis',
  analysis_library: 'analysis', analysis_favorites: 'analysis',
  analysis_recent: 'analysis', analysis_saved: 'analysis', analysis_alerts: 'analysis',
  settings: 'settings', settings_hotel: 'settings', settings_multihotel: 'settings',
  settings_room_types: 'settings', settings_rooms: 'settings', settings_floors: 'settings',
  settings_room_status: 'settings', settings_preferences: 'settings',
  settings_products: 'settings', settings_rate_plans: 'settings',
  settings_conditions: 'settings', settings_seasons: 'settings', settings_age_categories: 'settings',
  settings_invoice: 'settings', settings_numbering: 'settings', settings_payment_modes: 'settings',
  settings_accounting: 'settings', settings_debtors: 'settings', settings_fiscal: 'settings',
  settings_hk_status: 'settings', settings_hk_checklists: 'settings', settings_hk_staff: 'settings',
  settings_hk_distribution: 'settings', settings_maintenance: 'settings',
  settings_lost_found: 'settings', settings_breakfast: 'settings',
  settings_pms_sync: 'settings', settings_api: 'settings', settings_connectors: 'settings',
  settings_users: 'settings', settings_automations: 'settings', settings_notifications: 'settings',
  settings_rgpd: 'settings', settings_import_export: 'settings',
  settings_audit: 'settings', settings_backups: 'settings',
};

// Hash icon manquant
function Hash({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  );
}

export const Sidebar = ({ activePage, setActivePage, isCollapsed, setIsCollapsed }: SidebarProps) => {
  const category = PAGE_TO_CATEGORY[activePage] ?? 'flowday';
  const groups = SIDEBAR_CONFIG[category] ?? [];

  return (
    <aside className={cn(
      'h-full bg-white border-r border-gray-100 flex flex-col transition-all duration-300 shrink-0',
      isCollapsed ? 'w-14' : 'w-52',
    )}>
      {/* Toggle */}
      <div className="h-10 flex items-center justify-end px-2 border-b border-gray-50 shrink-0">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all"
        >
          {isCollapsed
            ? <PanelLeftOpen size={14} />
            : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
        {groups.map((group) => (
          <div key={group.label}>
            {!isCollapsed && (
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-semibold transition-all text-left',
                      isActive
                        ? 'bg-[#8B5CF6]/8 text-[#8B5CF6]'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <item.icon size={16} className={cn('shrink-0', isActive && 'text-[#8B5CF6]')} />
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                    {!isCollapsed && isActive && (
                      <ChevronRight size={10} className="ml-auto shrink-0 text-[#8B5CF6]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
