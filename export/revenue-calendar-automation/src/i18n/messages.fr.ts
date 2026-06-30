/**
 * FLOWTYM — Catalogue de traductions FR (locale par défaut)
 *
 * Organisé par namespace : rules / guardrails / conflicts / common.
 * Les clés correspondent à des libellés UI ou métier.
 */
export const fr = {
  // ─── Communs ────────────────────────────────────────────────────────────
  common: {
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    duplicate: 'Dupliquer',
    close: 'Fermer',
    search: 'Rechercher',
    filters: 'Filtres',
    columns: 'Colonnes',
    actions: 'Actions',
    status: 'Statut',
    yes: 'Oui',
    no: 'Non',
    none: '—',
    learnMore: 'En savoir plus',
    seeAll: 'Voir tout',
    seeDetail: 'Voir le détail',
    seeReport: 'Voir le rapport complet',
    seeHistory: "Voir l'historique complet",
    active: 'Active',
    paused: 'En pause',
    simulation: 'Simulation',
    locked: 'Verrouillé',
    apply: 'Appliquer',
    reset: 'Réinitialiser',
    confirm: 'Confirmer',
    deleteConfirm: 'Confirmer la suppression de « {name} » ?',
    perPage: 'Par page',
    pageOf: '{page} / {total}',
    pageRange: '{start}–{end} sur {total}',
    noResults: 'Aucun résultat',
  },

  // ─── Page Règles tactiques ──────────────────────────────────────────────
  rules: {
    title: 'Règles tactiques',
    subtitleAutomatic: 'Règles automatiques complémentaires à la stratégie pour optimiser votre RevPAR',
    subtitleGuardrails: 'Définissez les garde-fous qui protègent votre stratégie et sécurisent vos revenus',
    subtitlePriorities: 'Gestion de la hiérarchie des priorités et résolution des conflits entre règles',

    tabAutomatic: 'Règles Automatiques',
    tabGuardrails: 'Garde-fous RMS',
    tabPriorities: 'Priorités & Conflits',

    newRule: 'Nouvelle règle',
    newGuardrail: 'Nouveau garde-fou',
    configurePriorities: 'Configurer les priorités',

    // KPI cards
    kpiActiveRules: 'Règles actives',
    kpiAllActive: 'Toutes les règles sont actives',
    kpiRevenue30d: 'Impact revenu (30j)',
    kpiAutomatedActions: 'Actions automatiques (30j)',
    kpiConflictsDetected: 'Conflits détectés',
    kpiAutoResolved: 'Règles automatiquement',
    kpiIaConfidence: 'IA — Confiance moyenne',
    kpiHigh: 'Élevée',
    kpiMedium: 'Modérée',
    kpiLow: 'Faible',

    // Table
    colPriority: 'Priorité',
    colRule: 'Règle',
    colType: 'Type',
    colTriggers: 'Déclencheurs principaux',
    colActions: 'Actions principales',
    colImpact: 'Impact (30j)',
    colFreq: 'Fréq.',
    colConfidence: 'Confiance IA',

    // Catégories
    categoryAll: 'Toutes les règles',
    categoryDemand: 'Demande',
    categoryPricing: 'Tarification',
    categoryDistribution: 'Distribution',
    categoryEvent: 'Événements',
    categoryProtection: 'Protection',

    // Menu kebab
    menuSeeDetail: 'Voir le détail',
    menuSimulate: 'Simuler avant activation',
    menuDuplicate: 'Dupliquer',
    menuExportCsv: 'Exporter historique CSV',
    menuDelete: 'Supprimer',

    // Bandeau
    explainPriority:
      'Les règles sont appliquées par ordre de priorité (1 = plus haute). En cas de conflit, ' +
      "la règle de priorité la plus élevée prévaut, sauf si une règle de niveau « Protection » est activée.",

    // Search placeholders
    searchPlaceholder: 'Rechercher dans les règles (nom, déclencheur, action…)',
    countRules: '{n} règle(s)',
  },

  // ─── Garde-fous ─────────────────────────────────────────────────────────
  guardrails: {
    kpiActive: 'Garde-fous actifs',
    kpiAllActive: 'Tous les garde-fous sont actifs',
    kpiBlocking30d: 'Règles bloquantes (30j)',
    kpiBlockedAdjustments: 'Ajustements bloqués',
    kpiGlobalRisk: 'Risque global',
    kpiRiskMastered: 'Niveau de risque maîtrisé',
    kpiProtectedEvents: 'Événements protégés',
    kpiPeriodsCovered: 'Périodes couvertes',
    kpiAverageDelta: 'Écart moyen limité',
    kpiVsThresholds: 'Vs seuils définis',

    categoryAll: 'Tous les garde-fous',
    categoryPricing: 'Tarification',
    categoryAvailability: 'Disponibilité',
    categoryRestriction: 'Restrictions',
    categoryDistribution: 'Distribution',
    categoryQuality: 'Qualité & Réputation',

    severityBlocking: 'Bloquant',
    severityWarning: 'Avertissement',
    severityAutoAdjust: 'Ajustement auto',

    colName: 'Garde-fou',
    colCategory: 'Catégorie',
    colType: 'Type',
    colCondition: 'Condition',
    colThreshold: 'Seuil / Valeur',
    colAction: 'Action',
    colCoverage: 'Couverture',

    hierarchyTitle: 'Hiérarchie & Priorité des garde-fous',
    coverageTitle: 'Couverture globale',
    coverageHint: 'Toutes les dates critiques sont protégées par au moins un garde-fou bloquant.',
    coverageTotalDates: "Total dates de l'année",
    coverageCovered: 'Dates couvertes par au moins un garde-fou',
    coverageUncovered: 'Dates sans garde-fou',
    coverageOf: 'des dates couvertes',
    lastBlocks: 'Derniers blocages',
    blocked: 'Bloqué',
    adjusted: 'Ajusté',

    bannerSecurity:
      'Les garde-fous protègent votre stratégie et s\'appliquent avant les règles automatiques et l\'autopilote RMS.',

    searchPlaceholder: 'Rechercher dans les garde-fous (nom, condition, seuil…)',
    countGuardrails: '{n} garde-fou(s)',
  },

  // ─── Conflits & priorités ───────────────────────────────────────────────
  conflicts: {
    kpiActiveHierarchy: 'Hiérarchie active',
    kpiLevels: 'Niveaux de priorité',
    kpiDetected: 'Conflits détectés',
    kpiRequireAction: 'Nécessitent une action',
    kpiAutoResolved: 'Conflits résolus auto.',
    kpiThisMonth: 'Ce mois-ci',
    kpiTopRule: 'Règle prioritaire actuelle',
    kpiPriority: 'Priorité {n}',
    kpiRevenue30d: 'Impact revenu (30j)',
    kpiThanksHierarchy: 'Grâce à la hiérarchie',

    hierarchyTitle: 'Hiérarchie des priorités',
    hierarchyHint: "Ordre d'exécution des règles (1 = plus haute priorité)",
    hierarchyNote:
      "Les règles sont évaluées dans cet ordre. Une règle de niveau supérieur peut écraser ou " +
      "bloquer une règle de niveau inférieur.",

    detectedTitle: 'Conflits détectés ({n})',
    impactPotential: 'Impact potentiel',
    actionRecommended: 'Action recommandée',
    seeAll: 'Voir tout les conflits',

    impactByRule: 'Impact par règle (30 derniers jours)',
    simulationTitle: 'Simulation de priorité',
    simulationHint: "Testez l'impact d'un changement de priorité",
    moveRule: 'Déplacer la règle',
    fromPosition: 'De la position',
    toPosition: 'Vers la position',
    estimatedImpact: 'Impact estimé',
    runSimulation: 'Simuler le changement',

    journalTitle: 'Journal des résolutions',
    journalAutoResolved: 'Résolu automatiquement',
    journalPendingAction: "En attente d'action",
    journalPriorityApplied: 'Priorité appliquée',
    journalActionRequired: 'Action requise',

    typeOpposition: "Opposition d'objectifs",
    typeOverlap: 'Chevauchement',
    typeGuardrailBlocking: 'Blocage par garde-fou',
    typeIncompatiblePromo: 'Promo incompatible',
    typeOtaParity: 'Parité OTA',
    typeEventVsLastminute: 'Événement vs Last minute',
    typeCompressionVsFilling: 'Compression vs Remplissage',
    typeEarlybirdVsDemandgap: 'Early bird vs Trou de demande',
    typeStrategyVsTactical: 'Stratégie vs Règle tactique',
    typeAutopilotVsHuman: 'Autopilote vs Validation humaine',

    riskHigh: 'élevé',
    riskMedium: 'modéré',
    riskLow: 'faible',

    explainerBottom:
      "La hiérarchie garantit une exécution cohérente et prévisible des règles. " +
      "En cas de conflit, la règle avec la priorité la plus élevée l'emporte.",
  },

  // ─── Locale switcher ────────────────────────────────────────────────────
  locale: {
    fr: 'Français',
    en: 'English',
  },
};

export type Messages = typeof fr;
