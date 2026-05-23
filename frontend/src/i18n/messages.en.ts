/**
 * FLOWTYM — English translations (mirrors the FR structure)
 */
import type { Messages } from './messages.fr';

export const en: Messages = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    duplicate: 'Duplicate',
    close: 'Close',
    search: 'Search',
    filters: 'Filters',
    columns: 'Columns',
    actions: 'Actions',
    status: 'Status',
    yes: 'Yes',
    no: 'No',
    none: '—',
    learnMore: 'Learn more',
    seeAll: 'See all',
    seeDetail: 'See details',
    seeReport: 'See full report',
    seeHistory: 'See full history',
    active: 'Active',
    paused: 'Paused',
    simulation: 'Simulation',
    locked: 'Locked',
    apply: 'Apply',
    reset: 'Reset',
    confirm: 'Confirm',
    deleteConfirm: 'Confirm deletion of "{name}"?',
    perPage: 'Per page',
    pageOf: '{page} / {total}',
    pageRange: '{start}–{end} of {total}',
    noResults: 'No results',
  },

  rules: {
    title: 'Tactical Rules',
    subtitleAutomatic: 'Automated rules that complement your strategy to optimize RevPAR',
    subtitleGuardrails: 'Define guardrails that protect your strategy and secure revenue',
    subtitlePriorities: 'Manage priority hierarchy and resolve conflicts between rules',

    tabAutomatic: 'Automatic Rules',
    tabGuardrails: 'RMS Guardrails',
    tabPriorities: 'Priorities & Conflicts',

    newRule: 'New rule',
    newGuardrail: 'New guardrail',
    configurePriorities: 'Configure priorities',

    kpiActiveRules: 'Active rules',
    kpiAllActive: 'All rules are active',
    kpiRevenue30d: 'Revenue impact (30d)',
    kpiAutomatedActions: 'Automated actions (30d)',
    kpiConflictsDetected: 'Conflicts detected',
    kpiAutoResolved: 'Automatically resolved',
    kpiIaConfidence: 'AI — Average confidence',
    kpiHigh: 'High',
    kpiMedium: 'Moderate',
    kpiLow: 'Low',

    colPriority: 'Priority',
    colRule: 'Rule',
    colType: 'Type',
    colTriggers: 'Main triggers',
    colActions: 'Main actions',
    colImpact: 'Impact (30d)',
    colFreq: 'Freq.',
    colConfidence: 'AI Confidence',

    categoryAll: 'All rules',
    categoryDemand: 'Demand',
    categoryPricing: 'Pricing',
    categoryDistribution: 'Distribution',
    categoryEvent: 'Events',
    categoryProtection: 'Protection',

    menuSeeDetail: 'See details',
    menuSimulate: 'Simulate before activation',
    menuDuplicate: 'Duplicate',
    menuExportCsv: 'Export history CSV',
    menuDelete: 'Delete',

    explainPriority:
      'Rules are applied in order of priority (1 = highest). In case of conflict, ' +
      'the highest-priority rule wins, unless a "Protection" level rule is active.',

    searchPlaceholder: 'Search rules (name, trigger, action…)',
    countRules: '{n} rule(s)',
  },

  guardrails: {
    kpiActive: 'Active guardrails',
    kpiAllActive: 'All guardrails are active',
    kpiBlocking30d: 'Blocking rules (30d)',
    kpiBlockedAdjustments: 'Adjustments blocked',
    kpiGlobalRisk: 'Global risk',
    kpiRiskMastered: 'Risk level under control',
    kpiProtectedEvents: 'Protected events',
    kpiPeriodsCovered: 'Periods covered',
    kpiAverageDelta: 'Average delta limited',
    kpiVsThresholds: 'Vs defined thresholds',

    categoryAll: 'All guardrails',
    categoryPricing: 'Pricing',
    categoryAvailability: 'Availability',
    categoryRestriction: 'Restrictions',
    categoryDistribution: 'Distribution',
    categoryQuality: 'Quality & Reputation',

    severityBlocking: 'Blocking',
    severityWarning: 'Warning',
    severityAutoAdjust: 'Auto-adjust',

    colName: 'Guardrail',
    colCategory: 'Category',
    colType: 'Type',
    colCondition: 'Condition',
    colThreshold: 'Threshold',
    colAction: 'Action',
    colCoverage: 'Coverage',

    hierarchyTitle: 'Guardrail hierarchy & priority',
    coverageTitle: 'Global coverage',
    coverageHint: 'All critical dates are protected by at least one blocking guardrail.',
    coverageTotalDates: 'Total dates in the year',
    coverageCovered: 'Dates covered by at least one guardrail',
    coverageUncovered: 'Uncovered dates',
    coverageOf: 'of dates covered',
    lastBlocks: 'Latest blocks',
    blocked: 'Blocked',
    adjusted: 'Adjusted',

    bannerSecurity:
      'Guardrails protect your strategy and run before automatic rules and RMS autopilot.',

    searchPlaceholder: 'Search guardrails (name, condition, threshold…)',
    countGuardrails: '{n} guardrail(s)',
  },

  conflicts: {
    kpiActiveHierarchy: 'Active hierarchy',
    kpiLevels: 'Priority levels',
    kpiDetected: 'Conflicts detected',
    kpiRequireAction: 'Require action',
    kpiAutoResolved: 'Auto-resolved conflicts',
    kpiThisMonth: 'This month',
    kpiTopRule: 'Top-priority rule',
    kpiPriority: 'Priority {n}',
    kpiRevenue30d: 'Revenue impact (30d)',
    kpiThanksHierarchy: 'Thanks to hierarchy',

    hierarchyTitle: 'Priority hierarchy',
    hierarchyHint: 'Rule evaluation order (1 = highest priority)',
    hierarchyNote:
      'Rules are evaluated in this order. A higher-level rule can override or block a lower-level rule.',

    detectedTitle: 'Conflicts detected ({n})',
    impactPotential: 'Potential impact',
    actionRecommended: 'Recommended action',
    seeAll: 'See all conflicts',

    impactByRule: 'Impact by rule (last 30 days)',
    simulationTitle: 'Priority simulation',
    simulationHint: 'Test the impact of a priority change',
    moveRule: 'Move rule',
    fromPosition: 'From position',
    toPosition: 'To position',
    estimatedImpact: 'Estimated impact',
    runSimulation: 'Run simulation',

    journalTitle: 'Resolution log',
    journalAutoResolved: 'Automatically resolved',
    journalPendingAction: 'Pending action',
    journalPriorityApplied: 'Priority applied',
    journalActionRequired: 'Action required',

    typeOpposition: 'Objective opposition',
    typeOverlap: 'Overlap',
    typeGuardrailBlocking: 'Guardrail blocking',
    typeIncompatiblePromo: 'Incompatible promo',
    typeOtaParity: 'OTA parity',
    typeEventVsLastminute: 'Event vs Last minute',
    typeCompressionVsFilling: 'Compression vs Filling',
    typeEarlybirdVsDemandgap: 'Early bird vs Demand gap',
    typeStrategyVsTactical: 'Strategy vs Tactical rule',
    typeAutopilotVsHuman: 'Autopilot vs Human validation',

    riskHigh: 'high',
    riskMedium: 'moderate',
    riskLow: 'low',

    explainerBottom:
      'The hierarchy guarantees consistent, predictable rule execution. ' +
      'In case of conflict, the highest-priority rule wins.',
  },

  locale: {
    fr: 'Français',
    en: 'English',
  },
};
