import type { PageId } from '@/src/types';

export type SettingsTone = 'emerald' | 'violet' | 'amber' | 'blue' | 'rose' | 'slate';

export type SettingsPageId = Extract<PageId, `settings${string}`>;

export interface SettingsMetric {
  label: string;
  value: string;
  detail: string;
  tone: SettingsTone;
}

export interface SettingsTable {
  columns: string[];
  rows: string[][];
}

export interface SettingsField {
  label: string;
  value: string;
  type?: 'text' | 'number' | 'select' | 'password' | 'checkbox';
}

export interface SettingsSection {
  id: SettingsPageId;
  title: string;
  eyebrow: string;
  description: string;
  status: string;
  actions: string[];
  metrics?: SettingsMetric[];
  alerts?: string[];
  fields?: SettingsField[];
  table?: SettingsTable;
  checklist?: string[];
}

const guardedPhaseOne =
  'Phase 1 : affichage et préparation. Toute sauvegarde durable exigera RBAC, validation Zod, RLS et audit immuable.';

export const settingsOverviewMetrics: SettingsMetric[] = [
  { label: 'Établissement', value: 'Hôtel Paris Centre', detail: 'Profil complet', tone: 'emerald' },
  { label: 'Chambres', value: '58 chambres', detail: '3 types incomplets', tone: 'amber' },
  { label: 'Fiscalité 2026', value: 'Conforme', detail: 'Mode Production', tone: 'emerald' },
  { label: 'PMS externe', value: 'Connecté', detail: 'Dernière sync 2 min', tone: 'blue' },
  { label: 'Housekeeping', value: '12 employés', detail: '4 checklists', tone: 'violet' },
  { label: 'API & Webhooks', value: '8 actifs', detail: '1 erreur récente', tone: 'amber' },
];

export const settingsOverviewAlerts = [
  '3 chambres sans étage configuré',
  '1 mapping PMS manquant : room_type “DLX”',
  'La clé API Channel Manager expire dans 12 jours',
  'Nouvelle version fiscale disponible : FR-2026.09',
];

export const settingsSections: Record<SettingsPageId, SettingsSection> = {
  settings: {
    id: 'settings',
    title: 'Vue d’ensemble Paramètres',
    eyebrow: 'Configuration générale',
    description: 'État de configuration global du PMS Flowtym et alertes à corriger.',
    status: 'Diagnostic prêt',
    actions: ['Lancer diagnostic complet', 'Exporter configuration'],
    metrics: settingsOverviewMetrics,
    alerts: settingsOverviewAlerts,
  },
  settings_hotel: {
    id: 'settings_hotel',
    title: 'Établissement',
    eyebrow: 'Identité administrative',
    description: 'Identité commerciale, coordonnées, adresse, mentions légales et devise de l’hôtel.',
    status: 'Profil complet',
    actions: ['Sauvegarder brouillon', 'Vérifier informations légales'],
    fields: [
      { label: 'Nom commercial', value: 'Hôtel Paris Centre' },
      { label: 'Raison sociale', value: 'Hôtel Paris Centre SARL' },
      { label: 'Catégorie', value: 'Hôtel 4 étoiles', type: 'select' },
      { label: 'Nombre de chambres', value: '58', type: 'number' },
      { label: 'Devise', value: 'EUR', type: 'select' },
      { label: 'Fuseau horaire', value: 'Europe/Paris', type: 'select' },
      { label: 'Email hôtel', value: 'contact@hotelparis.fr' },
      { label: 'Téléphone', value: '+33 1 23 45 67 89' },
      { label: 'SIRET', value: '12345678900012' },
      { label: 'TVA intracom', value: 'FR76123456789' },
    ],
  },
  settings_multihotel: {
    id: 'settings_multihotel',
    title: 'Multi-hôtels',
    eyebrow: 'Groupe hôtelier',
    description: 'Gestion des établissements et règles de mutualisation entre hôtels.',
    status: '3 établissements actifs',
    actions: ['Ajouter établissement', 'Importer configuration', 'Sauvegarder règles'],
    table: {
      columns: ['Code hôtel', 'Nom', 'Ville', 'Chambres', 'Statut'],
      rows: [
        ['PARIS01', 'Hôtel Paris Centre', 'Paris', '58', 'Actif'],
        ['LYON01', 'Hôtel Lyon Gare', 'Lyon', '82', 'Actif'],
        ['NICE01', 'Hôtel Nice Mer', 'Nice', '120', 'Actif'],
      ],
    },
    checklist: ['Plans tarifaires mutualisés', 'Prestations mutualisées', 'Modèles email mutualisés', 'Rôles utilisateurs mutualisés'],
  },
  settings_room_types: {
    id: 'settings_room_types',
    title: 'Types de chambres',
    eyebrow: 'Inventaire',
    description: 'Catalogue des typologies, capacités, équipements et options revenue.',
    status: '5 types configurés',
    actions: ['Nouveau type', 'Réordonner', 'Exporter'],
    table: {
      columns: ['Code', 'Nom', 'Occupation', 'Chambres', 'Rang vente'],
      rows: [
        ['SGL', 'Chambre Single', '1', '10', '1'],
        ['DBL', 'Chambre Double', '1-2', '20', '2'],
        ['TWN', 'Chambre Twin', '1-2', '8', '3'],
        ['SUI', 'Suite', '1-4', '5', '4'],
        ['FAM', 'Familiale', '1-5', '6', '5'],
      ],
    },
  },
  settings_rooms: {
    id: 'settings_rooms',
    title: 'Chambres',
    eyebrow: 'Inventaire physique',
    description: 'Liste des chambres, étages, statuts, préférences et chambres fictives.',
    status: '58 chambres',
    actions: ['Ajouter chambre', 'Import CSV', 'Plan des étages'],
    table: {
      columns: ['N°', 'Type', 'Étage', 'Statut', 'Fictive', 'Préférences'],
      rows: [
        ['101', 'DBL', '1', 'Active', 'Non', 'Calme, rue'],
        ['102', 'DBL', '1', 'Active', 'Non', 'Cour'],
        ['103', 'SUI', '1', 'Active', 'Non', 'Jardin'],
        ['900', 'PMASTER', '—', 'Active', 'Oui', 'Facturation'],
      ],
    },
    alerts: ['Impossible de supprimer une chambre avec réservations futures.'],
  },
  settings_floors: {
    id: 'settings_floors',
    title: 'Étages',
    eyebrow: 'Inventaire',
    description: 'Organisation des chambres par étage et zones opérationnelles.',
    status: '4 étages actifs',
    actions: ['Ajouter étage', 'Réordonner'],
    table: {
      columns: ['Étage', 'Nom', 'Chambres', 'Zone HK'],
      rows: [['1', 'Premier étage', '18', 'Zone A'], ['2', 'Deuxième étage', '20', 'Zone B'], ['3', 'Suites', '12', 'Zone C'], ['4', 'Technique', '8', 'Zone D']],
    },
  },
  settings_room_status: {
    id: 'settings_room_status',
    title: 'Statuts chambres',
    eyebrow: 'Inventaire',
    description: 'Statuts opérationnels utilisés par Planning, Housekeeping et Maintenance.',
    status: '7 statuts',
    actions: ['Sauvegarder statuts'],
    table: {
      columns: ['Libellé', 'Code', 'Couleur', 'Bloquant'],
      rows: [['Sale', 'dirty', 'Rouge', 'Oui'], ['En nettoyage', 'in_progress', 'Orange', 'Oui'], ['Propre', 'clean', 'Vert', 'Non'], ['Inspectée', 'inspected', 'Bleu', 'Non']],
    },
  },
  settings_preferences: {
    id: 'settings_preferences',
    title: 'Préférences chambres',
    eyebrow: 'Inventaire',
    description: 'Préférences utilisées pour attribution client et segmentation chambre.',
    status: '8 préférences',
    actions: ['Ajouter préférence'],
    checklist: ['Vue rue', 'Vue cour', 'Douche', 'Baignoire', 'Lit double', 'Communicante', 'Calme', 'Accessible PMR'],
  },
  settings_products: {
    id: 'settings_products',
    title: 'Prestations',
    eyebrow: 'Tarifs & Prestations',
    description: 'Prestations vendables, familles, TVA, prix et unités.',
    status: '5 prestations clés',
    actions: ['Nouvelle prestation', 'Importer', 'Exporter'],
    table: {
      columns: ['Code', 'Nom', 'Famille', 'Prix TTC', 'TVA', 'Unité'],
      rows: [['NUIT', 'Nuitée', 'Hébergement', 'Variable', '10%', 'Nuit'], ['PDJ', 'Petit-déjeuner', 'F&B', '15,00 €', '10%', 'Pers.'], ['PARK', 'Parking', 'Extra', '12,00 €', '20%', 'Nuit'], ['TAXE', 'Taxe de séjour', 'Taxe locale', 'Auto', '0%', 'Pers.']],
    },
  },
  settings_rate_plans: {
    id: 'settings_rate_plans',
    title: 'Plans tarifaires',
    eyebrow: 'Tarifs & Prestations',
    description: 'Plans publics, dérivés, corporate, restrictions et distribution.',
    status: '5 plans actifs',
    actions: ['Nouveau plan', 'Assistant tarif', 'Exporter'],
    table: {
      columns: ['Code', 'Nom', 'Type', 'Flexible', 'Distribution'],
      rows: [['RACK', 'Rack public', 'Base', 'Oui', 'Direct + CM'], ['FLEX', 'Flexible', 'Dérivé', 'Oui', 'Direct + CM'], ['NR', 'Non remboursable', 'Dérivé', 'Non', 'Direct + CM'], ['CORP', 'Corporate', 'Contractuel', 'Oui', 'Société']],
    },
    alerts: ['Impossible de supprimer un type utilisé par un tarif actif.'],
  },
  settings_conditions: {
    id: 'settings_conditions',
    title: 'Conditions',
    eyebrow: 'Tarifs & Prestations',
    description: 'Annulation, garantie, paiement, restrictions CTA/CTD et min stay.',
    status: '4 conditions',
    actions: ['Nouvelle condition'],
    checklist: ['Flexible 72h', 'Non remboursable', 'CB obligatoire', 'Paiement sur place'],
  },
  settings_seasons: {
    id: 'settings_seasons',
    title: 'Saisons',
    eyebrow: 'Tarifs & Prestations',
    description: 'Saisons tarifaires et périodes événementielles utilisées par le revenue.',
    status: '3 saisons',
    actions: ['Ajouter saison', 'Synchroniser événements'],
    table: {
      columns: ['Code', 'Nom', 'Début', 'Fin', 'Impact'],
      rows: [['LOW', 'Basse saison', '01/01', '31/03', '-12%'], ['MID', 'Moyenne saison', '01/04', '30/06', '0%'], ['HIGH', 'Haute saison', '01/07', '31/08', '+18%']],
    },
  },
  settings_age_categories: {
    id: 'settings_age_categories',
    title: 'Catégories d’âge',
    eyebrow: 'Tarifs & Prestations',
    description: 'Règles adultes, enfants, bébés et taxes associées.',
    status: '3 catégories',
    actions: ['Sauvegarder catégories'],
    table: {
      columns: ['Catégorie', 'Âge min', 'Âge max', 'Taxe séjour'],
      rows: [['Bébé', '0', '2', 'Non'], ['Enfant', '3', '12', 'Selon commune'], ['Adulte', '13', '120', 'Oui']],
    },
  },
  settings_invoice: {
    id: 'settings_invoice',
    title: 'Paramètres facture',
    eyebrow: 'Finance & Facturation',
    description: 'Mentions légales, format facture et règles d’émission.',
    status: 'Conforme brouillon',
    actions: ['Sauvegarder brouillon'],
    fields: [
      { label: 'Raison sociale', value: 'Hôtel Paris Centre SARL' },
      { label: 'Format e-facture', value: 'UBL 2.1', type: 'select' },
      { label: 'Transmission auto', value: 'Activée', type: 'checkbox' },
    ],
  },
  settings_numbering: {
    id: 'settings_numbering',
    title: 'Numérotation',
    eyebrow: 'Finance & Facturation',
    description: 'Modèle fiscal de numérotation non rétroactive.',
    status: 'Séquence 000184',
    actions: ['Tester modèle', 'Sauvegarder avec audit'],
    fields: [
      { label: 'Modèle de numéro', value: 'YYYYMMDD-####' },
      { label: 'Préfixe hôtel', value: 'PARIS' },
      { label: 'Réinitialisation', value: 'Année', type: 'select' },
      { label: 'Séquence actuelle', value: '000184' },
    ],
    alerts: ['Toute modification sera journalisée fiscalement.'],
  },
  settings_payment_modes: {
    id: 'settings_payment_modes',
    title: 'Modes de règlement',
    eyebrow: 'Finance & Facturation',
    description: 'Moyens de paiement et PSP principal.',
    status: 'Stripe actif',
    actions: ['Sauvegarder modes'],
    checklist: ['Espèces', 'Carte bancaire', 'Virement', 'Chèque', 'Débiteur société', 'Avoir', 'PSP en ligne', 'Préautorisation activée'],
  },
  settings_accounting: {
    id: 'settings_accounting',
    title: 'Comptabilité',
    eyebrow: 'Finance & Facturation',
    description: 'Comptes comptables, journaux, export et lettrage.',
    status: 'Plan comptable prêt',
    actions: ['Exporter plan comptable'],
    table: {
      columns: ['Compte', 'Libellé', 'Famille'],
      rows: [['706000', 'Prestations hébergement', 'Ventes'], ['445710', 'TVA collectée 10%', 'TVA'], ['411000', 'Clients débiteurs', 'Tiers']],
    },
  },
  settings_debtors: {
    id: 'settings_debtors',
    title: 'Débiteurs',
    eyebrow: 'Finance & Facturation',
    description: 'Règles sociétés débitrices, plafonds et relances.',
    status: '3 débiteurs suivis',
    actions: ['Ajouter débiteur', 'Exporter balances'],
    table: {
      columns: ['Compte', 'Société', 'Plafond', 'Solde', 'Statut'],
      rows: [['D-001', 'Agence Atlas', '5 000 €', '1 240 €', 'OK'], ['D-002', 'Corporate Lyon', '8 000 €', '6 900 €', 'À surveiller']],
    },
  },
  settings_fiscal: {
    id: 'settings_fiscal',
    title: 'Fiscalité France 2026',
    eyebrow: 'Conformité',
    description: 'Profil fiscal, TVA dynamique, taxe de séjour, PPF/PDP et archivage.',
    status: 'Conforme • Mode Production',
    actions: ['Lancer test de conformité', 'Exporter configuration fiscale'],
    metrics: [
      { label: 'TVA dynamique', value: 'Active', detail: 'FR-2026.09', tone: 'emerald' },
      { label: 'Taxe de séjour', value: 'Active', detail: 'Commune Paris', tone: 'emerald' },
      { label: 'E-facture', value: 'PPF connectée', detail: 'UBL 2.1', tone: 'emerald' },
    ],
    fields: [
      { label: 'URL PPF', value: 'https://portail-facture.gouv.fr' },
      { label: 'Clé API', value: '••••••••••••7842', type: 'password' },
      { label: 'Régime TVA', value: 'Réel normal', type: 'select' },
    ],
    alerts: [guardedPhaseOne, 'Toute modification TVA exige une justification.'],
  },
  settings_hk_status: {
    id: 'settings_hk_status',
    title: 'Statuts housekeeping',
    eyebrow: 'Housekeeping',
    description: 'Statuts chambres et règles de blocage check-in.',
    status: 'Blocage check-in actif',
    actions: ['Sauvegarder règles HK'],
    checklist: ['Bloquer check-in si statut ≠ Propre ou Inspectée', 'Inspection obligatoire pour chambres VIP', 'Inspection obligatoire après maintenance'],
  },
  settings_hk_checklists: {
    id: 'settings_hk_checklists',
    title: 'Checklists housekeeping',
    eyebrow: 'Housekeeping',
    description: 'Checklists départ, recouche et inspection finale.',
    status: '4 checklists',
    actions: ['Nouvelle checklist'],
    checklist: ['Lit fait', 'Salle de bain nettoyée', 'Serviettes remplacées', 'Sol propre', 'Minibar vérifié', 'Inspection finale'],
  },
  settings_hk_staff: {
    id: 'settings_hk_staff',
    title: 'Personnel housekeeping',
    eyebrow: 'Housekeeping',
    description: 'Employés, rôles, capacités journalières et couleurs planning.',
    status: '12 employés',
    actions: ['Ajouter employé'],
    table: {
      columns: ['Nom', 'Rôle', 'Capacité/jour', 'Actif', 'Couleur'],
      rows: [['Maria Lopez', 'Femme ch.', '12 chambres', 'Oui', 'Vert'], ['Fatima Benali', 'Femme ch.', '10 chambres', 'Oui', 'Bleu'], ['Sofia Durand', 'Gouvernante', '8 chambres', 'Oui', 'Orange']],
    },
  },
  settings_hk_distribution: {
    id: 'settings_hk_distribution',
    title: 'Répartition automatique',
    eyebrow: 'Housekeeping',
    description: 'Règles de distribution des chambres aux équipes.',
    status: 'Équilibrage charge',
    actions: ['Tester répartition', 'Sauvegarder règles'],
    checklist: ['Regrouper par étage', 'Tenir compte de la durée estimée', 'Prioriser arrivées < 2h', 'Éviter surcharge employée', 'Compétences spécifiques'],
  },
  settings_maintenance: {
    id: 'settings_maintenance',
    title: 'Maintenance',
    eyebrow: 'Housekeeping',
    description: 'Interventions, prévention, blocages et inspection après maintenance.',
    status: 'Inspection obligatoire',
    actions: ['Créer règle maintenance'],
    table: {
      columns: ['Type', 'Durée', 'Blocage', 'Inspection'],
      rows: [['Légère', '+15 min', 'Non', 'Oui'], ['Critique', 'Selon tâche', 'Oui', 'Oui']],
    },
  },
  settings_lost_found: {
    id: 'settings_lost_found',
    title: 'Objets trouvés',
    eyebrow: 'Housekeeping',
    description: 'Conservation, notifications et restitution des objets trouvés.',
    status: 'Conservation 30 jours',
    actions: ['Exporter registre'],
    fields: [{ label: 'Durée conservation', value: '30 jours', type: 'select' }, { label: 'Notification client', value: 'Activée', type: 'checkbox' }],
  },
  settings_breakfast: {
    id: 'settings_breakfast',
    title: 'Petit-déjeuner',
    eyebrow: 'Housekeeping',
    description: 'Prévisions PDJ, listes chambres et extras inclus.',
    status: 'Prévision J+1 active',
    actions: ['Exporter liste PDJ'],
    table: {
      columns: ['Règle', 'Statut', 'Détail'],
      rows: [['PDJ inclus', 'Actif', 'Depuis plan tarifaire'], ['Room service', 'Actif', 'Supplément configurable']],
    },
  },
  settings_pms_sync: {
    id: 'settings_pms_sync',
    title: 'PMS externe / Synchronisation',
    eyebrow: 'Technique',
    description: 'Connexion PMS, mapping champs, fréquences et webhooks.',
    status: 'Connecté • Webhooks + polling fallback',
    actions: ['Tester connexion', 'Forcer synchronisation', 'Voir logs'],
    fields: [
      { label: 'URL API PMS', value: 'https://api.pms-example.com' },
      { label: 'Environnement', value: 'Production', type: 'select' },
      { label: 'Token / clé', value: '••••••••••••', type: 'password' },
      { label: 'Webhook secret', value: '••••••••••••', type: 'password' },
    ],
    checklist: ['Chambres', 'Réservations', 'Arrivées', 'Départs', 'Occupation', 'Statuts ménage', 'Maintenance', 'Objets trouvés'],
    alerts: [guardedPhaseOne, 'Mapping obligatoire avant activation production.'],
  },
  settings_api: {
    id: 'settings_api',
    title: 'API & Webhooks',
    eyebrow: 'Technique',
    description: 'Clés API, droits, journaux et webhooks Flowtym.',
    status: '8 webhooks actifs',
    actions: ['Créer clé API', 'Documentation Swagger', 'Logs API'],
    table: {
      columns: ['Nom', 'Droits', 'Dernier usage', 'Statut'],
      rows: [['CM Prod', 'Rates/Avail', 'il y a 2 min', 'Active'], ['HK App', 'Housekeeping', 'il y a 1 min', 'Active'], ['BI Export', 'Read only', 'hier', 'Active']],
    },
    alerts: [guardedPhaseOne, 'Toutes les clés API doivent être révocables.'],
  },
  settings_connectors: {
    id: 'settings_connectors',
    title: 'Applications & Connecteurs',
    eyebrow: 'Technique',
    description: 'Channel Manager, Booking Engine, PSP, RMS, CRM et tablettes.',
    status: '5 connecteurs actifs',
    actions: ['Configurer connecteur'],
    table: {
      columns: ['Connecteur', 'Statut', 'Détail'],
      rows: [['Channel Manager', 'Connecté', 'Production'], ['Booking Engine', 'Connecté', 'Direct'], ['PSP Stripe', 'Connecté', 'Paiements actifs'], ['RMS', 'Non configuré', 'Phase 2'], ['CRM / Mailing', 'À vérifier', 'OAuth à renouveler']],
    },
  },
  settings_users: {
    id: 'settings_users',
    title: 'Utilisateurs & Droits',
    eyebrow: 'Sécurité',
    description: 'Utilisateurs, rôles standards et matrice de permissions.',
    status: 'RBAC brouillon',
    actions: ['Inviter utilisateur', 'Exporter matrice'],
    table: {
      columns: ['Nom', 'Email', 'Rôle', 'Statut'],
      rows: [['Laurence W.', 'laurence@hotel.fr', 'Manager', 'Actif'], ['Marie D.', 'marie@hotel.fr', 'Réception', 'Actif'], ['Sophie M.', 'sophie@hotel.fr', 'Gouvernante', 'Actif']],
    },
    alerts: [guardedPhaseOne, 'Seul Admin peut modifier fiscalité, API et sauvegardes.'],
  },
  settings_automations: {
    id: 'settings_automations',
    title: 'Automatisations',
    eyebrow: 'Opérations',
    description: 'Audit de nuit, check-in/out, housekeeping, SAS et finance automatisés.',
    status: 'Audit de nuit 02:30',
    actions: ['Sauvegarder automatisations'],
    checklist: ['Activer audit de nuit', 'Passer no-shows automatiquement', 'Créer tâche ménage après départ', 'Auto-valider OTA si score > 95%', 'Relancer factures impayées > 30j'],
  },
  settings_notifications: {
    id: 'settings_notifications',
    title: 'Notifications & Modèles',
    eyebrow: 'Communication',
    description: 'Modèles email, WhatsApp, SMS, documents et variables dynamiques.',
    status: '8 modèles',
    actions: ['Créer modèle', 'Importer', 'Tester'],
    checklist: ['Confirmation réservation FR', 'Confirmation réservation EN', 'Accusé SAS', 'Facture', 'Relance impayé', 'Bienvenue WhatsApp'],
  },
  settings_rgpd: {
    id: 'settings_rgpd',
    title: 'RGPD & Sécurité',
    eyebrow: 'Sécurité',
    description: 'Consentements, anonymisation, MFA, sessions et politique mot de passe.',
    status: 'MFA Admin/Finance requis',
    actions: ['Sauvegarder politique sécurité'],
    fields: [
      { label: 'Sessions expirent après', value: '8h', type: 'select' },
      { label: 'Longueur mot de passe min', value: '12', type: 'number' },
      { label: 'Conservation documents identité', value: '12 mois', type: 'select' },
    ],
    checklist: ['Consentement marketing obligatoire', 'Historique des consentements', 'Anonymisation client disponible', 'IP whitelist pour API', 'Audit log immuable'],
    alerts: [guardedPhaseOne, 'Anonymisation conserve les données fiscales obligatoires.'],
  },
  settings_import_export: {
    id: 'settings_import_export',
    title: 'Import / Export',
    eyebrow: 'Données',
    description: 'Imports CSV, exports configuration, archives et migration contrôlée.',
    status: 'Exports prêts',
    actions: ['Importer CSV', 'Exporter configuration', 'Télécharger archive'],
    checklist: ['Validation fichier', 'Mapping colonnes', 'Simulation avant import', 'Rapport erreurs'],
  },
  settings_audit: {
    id: 'settings_audit',
    title: 'Audit / Logs',
    eyebrow: 'Traçabilité',
    description: 'Recherche et export des logs critiques, audit fiscal et actions utilisateur.',
    status: 'Logs immuables',
    actions: ['Exporter logs', 'Télécharger audit fiscal'],
    table: {
      columns: ['Horodatage', 'Utilisateur', 'Module', 'Action', 'Objet'],
      rows: [['07/05 15:12', 'Laurence W.', 'Réservation', 'Check-in', 'R-10421'], ['07/05 15:15', 'Fatima K.', 'HK', 'Statut', 'Chambre 101'], ['07/05 15:20', 'Système', 'Fiscalité', 'E-facture', '20260507-0001']],
    },
  },
  settings_backups: {
    id: 'settings_backups',
    title: 'Sauvegardes',
    eyebrow: 'Résilience',
    description: 'Statut sauvegardes, stratégie, conservation et restauration.',
    status: 'OK • Dernière sauvegarde 07/05/2026 02:30',
    actions: ['Lancer sauvegarde maintenant', 'Restaurer', 'Télécharger archive'],
    checklist: ['Sauvegarde quotidienne', 'Sauvegarde horaire données critiques', 'Réplication multi-zone', 'Export archive mensuelle', 'Factures conservées 10 ans'],
    alerts: [guardedPhaseOne, 'Les restaurations doivent être auditées et réversibles.'],
  },
};
