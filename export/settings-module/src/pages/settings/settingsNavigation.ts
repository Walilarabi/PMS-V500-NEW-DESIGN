/**
 * FLOWTYM RMS — Configuration de la navigation Paramètres.
 *
 * Source unique de vérité pour le module Paramètres :
 *   • 10 domaines (top horizontal tabs) ;
 *   • N sous-menus par domaine (left vertical sidebar) ;
 *   • chaque sous-menu mappé sur une PageId du PMS.
 *
 * Ce fichier alimente SettingsLayout (rendu top-tabs + sub-nav + content)
 * et la sidebar globale (qui masque ses groupes Settings au profit de
 * cette navigation interne).
 */

import type { LucideIcon } from 'lucide-react';
import {
  Activity, AlertOctagon, BarChart3, Bell, BookOpen, Building2, Calendar,
  CheckCircle2, Cog, Cpu, CreditCard, Database, FileCode2, FileText,
  Fingerprint, FolderOpen, Globe, Grid, HardDrive, Hash, Hotel, Image as ImageIcon,
  KeyRound, Languages, LayoutDashboard, Layers, Lock, Mail, MapPin, Network,
  Package, Percent, Plug, Receipt, RefreshCw, Settings2, Share2, Shield,
  ShieldCheck, Sparkles, Star, Tag, Target, Timer, Upload, UserCheck, Users,
  Wand2, Webhook, Wrench, Zap, Coffee, Bed, Plane, ClipboardList, Banknote,
  Send, Smartphone, MessageSquare, Inbox,
} from 'lucide-react';
import type { PageId } from '@/src/types';

export interface SettingsSubItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

export interface SettingsDomain {
  id: string;
  label: string;
  icon: LucideIcon;
  items: SettingsSubItem[];
}

export const SETTINGS_NAVIGATION: SettingsDomain[] = [
  {
    id: 'establishment',
    label: 'Établissement',
    icon: Building2,
    items: [
      { id: 'settings',                label: 'Vue générale',         icon: LayoutDashboard },
      { id: 'settings_hotel',          label: 'Informations hôtel',   icon: Hotel },
      { id: 'settings_multihotel',     label: 'Multi-hôtels',         icon: Globe },
      { id: 'settings_branding',       label: 'Branding',             icon: Sparkles },
      { id: 'settings_languages',      label: 'Langues & devises',    icon: Languages },
      { id: 'settings_timezone',       label: 'Fuseaux horaires',     icon: Timer },
      { id: 'settings_contact',        label: 'Coordonnées',          icon: MapPin },
      { id: 'settings_legal_docs',     label: 'Documents légaux',     icon: FileText },
      { id: 'settings_photos',         label: 'Photos & médias',      icon: ImageIcon },
      { id: 'settings_classification', label: 'Classement hôtelier',  icon: Star },
      { id: 'settings_taxes_local',    label: 'Taxes locales',        icon: Percent },
      { id: 'settings_compliance',     label: 'Conformité',           icon: ShieldCheck },
    ],
  },
  {
    id: 'inventory',
    label: 'Chambres & Inventaire',
    icon: Bed,
    items: [
      { id: 'settings_room_types',  label: 'Types de chambres',  icon: Tag },
      { id: 'settings_rooms',       label: 'Chambres',           icon: Bed },
      { id: 'settings_floors',      label: 'Étages',             icon: Layers },
      { id: 'settings_room_status', label: 'Statuts',            icon: CheckCircle2 },
      { id: 'settings_preferences', label: 'Préférences',        icon: Star },
    ],
  },
  {
    id: 'pricing',
    label: 'Tarifs & Prestations',
    icon: Receipt,
    items: [
      { id: 'settings_products',        label: 'Prestations',        icon: Package },
      { id: 'settings_rate_plans',      label: 'Plans tarifaires',   icon: Grid },
      { id: 'settings_conditions',      label: 'Conditions',         icon: FileText },
      { id: 'settings_seasons',         label: 'Saisons',            icon: Calendar },
      { id: 'settings_age_categories',  label: 'Catégories d\'âge',  icon: Users },
    ],
  },
  {
    id: 'partners',
    label: 'Partenaires',
    icon: Network,
    items: [
      { id: 'settings_partners', label: 'Partenaires de distribution', icon: Network },
    ],
  },
  {
    id: 'distribution',
    label: 'Distribution & OTA',
    icon: Share2,
    items: [
      { id: 'settings_pms_sync',          label: 'PMS / Channel Manager', icon: Plug },
      { id: 'settings_ota_mapping',       label: 'Mapping OTA',           icon: Network },
      { id: 'settings_ota_parity',        label: 'Parité des prix',       icon: Target },
      { id: 'settings_distribution_logs', label: 'Logs de distribution',  icon: ClipboardList },
      { id: 'settings_connectors',        label: 'Connecteurs',           icon: Share2 },
    ],
  },
  {
    id: 'reservations',
    label: 'Réservations',
    icon: Calendar,
    items: [
      { id: 'settings_cancellation',     label: 'Conditions d\'annulation', icon: FileText },
      { id: 'settings_guarantees',       label: 'Garanties',                icon: Shield },
      { id: 'settings_payment_modes',    label: 'Paiements & dépôts',       icon: CreditCard },
      { id: 'settings_no_show',          label: 'No-show & dépassement',    icon: AlertOctagon },
      { id: 'settings_email_templates',  label: 'Templates email / SMS',    icon: Mail },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: Send,
    items: [
      { id: 'settings_comm_email',      label: 'Email hôtel',       icon: Mail },
      { id: 'settings_comm_sms',        label: 'SMS',               icon: Smartphone },
      { id: 'settings_comm_whatsapp',   label: 'WhatsApp Business', icon: MessageSquare },
      { id: 'settings_comm_templates',  label: 'Templates',         icon: FileText },
      { id: 'settings_comm_automation', label: 'Automatisation',    icon: Zap },
      { id: 'settings_comm_journal',    label: 'Journal',           icon: Inbox },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Facturation',
    icon: Banknote,
    items: [
      { id: 'settings_invoice',     label: 'Paramètres facture', icon: Receipt },
      { id: 'settings_numbering',   label: 'Numérotation',       icon: Hash },
      { id: 'settings_accounting',  label: 'Comptabilité',       icon: BookOpen },
      { id: 'settings_debtors',     label: 'Débiteurs',          icon: AlertOctagon },
      { id: 'settings_fiscal',      label: 'Fiscalité 2026',     icon: Percent },
    ],
  },
  {
    id: 'housekeeping',
    label: 'Housekeeping & Opérations',
    icon: Wrench,
    items: [
      { id: 'settings_hk_status',       label: 'Statuts chambres',   icon: CheckCircle2 },
      { id: 'settings_hk_checklists',   label: 'Checklists',         icon: ClipboardList },
      { id: 'settings_hk_staff',        label: 'Personnel',          icon: Users },
      { id: 'settings_hk_distribution', label: 'Affectations',       icon: Share2 },
      { id: 'settings_maintenance',     label: 'Maintenance',        icon: Wrench },
      { id: 'settings_lost_found',      label: 'Objets trouvés',     icon: Package },
      { id: 'settings_breakfast',       label: 'Petit-déjeuner',     icon: Coffee },
    ],
  },
  {
    id: 'automation',
    label: 'Automatisations & IA',
    icon: Cpu,
    items: [
      { id: 'settings_automations',   label: 'Automatisations RMS', icon: Zap },
      { id: 'settings_ai_rules',      label: 'Règles IA',           icon: Wand2 },
      { id: 'settings_ai_strategies', label: 'Stratégies IA',       icon: Target },
      { id: 'settings_notifications', label: 'Notifications',       icon: Bell },
    ],
  },
  {
    id: 'security',
    label: 'Sécurité & Administration',
    icon: ShieldCheck,
    items: [
      { id: 'settings_users',         label: 'Utilisateurs',          icon: KeyRound },
      { id: 'settings_roles',         label: 'Rôles & permissions',   icon: UserCheck },
      { id: 'settings_sessions',      label: 'Sessions actives',      icon: Activity },
      { id: 'settings_rgpd',          label: 'RGPD',                  icon: ShieldCheck },
      { id: 'settings_audit',         label: 'Audit / Logs',          icon: Fingerprint },
      { id: 'settings_system_health', label: 'Santé du système',      icon: Activity },
      { id: 'settings_backups',       label: 'Sauvegardes',           icon: HardDrive },
      { id: 'settings_import_export', label: 'Import / Export',       icon: Upload },
    ],
  },
  {
    id: 'integrations',
    label: 'Intégrations',
    icon: Plug,
    items: [
      { id: 'settings_api',              label: 'API & Webhooks',           icon: Cog },
      { id: 'settings_public_api',       label: 'API publique',             icon: FileCode2 },
      { id: 'settings_webhooks',         label: 'Webhooks',                 icon: Webhook },
      { id: 'settings_pos',              label: 'POS',                      icon: Receipt },
      { id: 'settings_locks',            label: 'Serrures connectées',      icon: Lock },
      { id: 'settings_kiosk',            label: 'Bornes check-in',          icon: Plane },
      { id: 'settings_payment_integ',    label: 'Paiement',                 icon: CreditCard },
      { id: 'settings_lighthouse_integ', label: 'Lighthouse',               icon: BarChart3 },
      { id: 'settings_expedia_integ',    label: 'Expedia',                  icon: Globe },
      { id: 'settings_booking_integ',    label: 'Booking.com',              icon: Globe },
    ],
  },
];

/** Mapping inverse pour retrouver le domaine actif d'une PageId. */
export function findDomainForPage(page: PageId): SettingsDomain {
  const found = SETTINGS_NAVIGATION.find((d) => d.items.some((i) => i.id === page));
  return found ?? SETTINGS_NAVIGATION[0];
}

/** Récupère un domaine par id. */
export function getDomainById(id: string): SettingsDomain | undefined {
  return SETTINGS_NAVIGATION.find((d) => d.id === id);
}

/** Liste à plat de toutes les PageIds Paramètres (utile pour le routage). */
export const ALL_SETTINGS_PAGES: PageId[] = SETTINGS_NAVIGATION.flatMap((d) => d.items.map((i) => i.id));

/** Vérifie si une PageId appartient au module Paramètres. */
export function isSettingsPage(page: PageId): boolean {
  return typeof page === 'string' && page.startsWith('settings');
}
