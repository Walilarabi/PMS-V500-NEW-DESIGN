/**
 * FLOWTYM — Settings Diagnostic Engine
 *
 * Cœur du Control Center : analyse l'état réel du PMS en lisant les
 * stores existants et produit un DiagnosticReport.
 *
 * Sources lues :
 *   • useConfigStore        — hôtel, taxes, chambres, utilisateurs,
 *                             channels, règles tarifaires, multiplicateurs
 *                             événement, options d'expiration
 *   • useEventsStore        — événements, sources, logs de sync
 *   • useRateCalendarStore  — types de chambres, plans tarifaires,
 *                             cellules de prix (calendrier)
 *   • centralPricingEngine  — décisions tarifaires (accept/reject/maintain)
 *
 * Tous les scores 0-100 sont calculés à partir de signaux réels ;
 * chaque alerte référence une cible PageId actionnable.
 *
 * Le moteur est volontairement pur (pas de side-effects) — il est
 * appelé via le hook useSettingsDiagnostic qui s'abonne aux stores.
 */

import type {
  ChecklistDomain,
  ChecklistDomainId,
  ChecklistTask,
  ConfigAlert,
  DiagnosticReport,
  GuidedStep,
  HealthTier,
  ModuleKey,
  ModuleStatus,
  ScoreCard,
  ScoreCardId,
  SyncConnector,
  SystemLogEntry,
} from '@/src/types/settings/diagnostic';
import {
  MODULE_LABEL,
} from '@/src/types/settings/diagnostic';
import type { PageId } from '@/src/types';
import { useConfigStore } from '@/src/store/configStore';
import { useEventsStore } from '@/src/store/eventsStore';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';
import { centralPricingEngine } from '@/src/services/revenue/centralPricingEngine.service';

// ─── Snapshot ────────────────────────────────────────────────────────────

interface Snapshot {
  hotel: ReturnType<typeof useConfigStore.getState>['hotel'];
  taxes: ReturnType<typeof useConfigStore.getState>['taxes'];
  rooms: ReturnType<typeof useConfigStore.getState>['rooms'];
  users: ReturnType<typeof useConfigStore.getState>['users'];
  channels: ReturnType<typeof useConfigStore.getState>['channels'];
  pricingRules: ReturnType<typeof useConfigStore.getState>['pricingRules'];
  events: ReturnType<typeof useEventsStore.getState>['events'];
  eventSources: ReturnType<typeof useEventsStore.getState>['sources'];
  syncLogs: ReturnType<typeof useEventsStore.getState>['syncLogs'];
  roomTypes: ReturnType<typeof useRateCalendarStore.getState>['roomTypes'];
  pricingRecords: ReturnType<typeof centralPricingEngine.all>;
}

function snapshot(): Snapshot {
  const cfg = useConfigStore.getState();
  const events = useEventsStore.getState();
  const cal = useRateCalendarStore.getState();
  return {
    hotel: cfg.hotel,
    taxes: cfg.taxes,
    rooms: cfg.rooms,
    users: cfg.users,
    channels: cfg.channels,
    pricingRules: cfg.pricingRules,
    events: events.events,
    eventSources: events.sources,
    syncLogs: events.syncLogs,
    roomTypes: cal.roomTypes,
    pricingRecords: centralPricingEngine.all(),
  };
}

// ─── Tier conversion ─────────────────────────────────────────────────────

function tierOf(score: number): HealthTier {
  if (score >= 85) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 40) return 'attention';
  return 'critical';
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Scoring ─────────────────────────────────────────────────────────────

function scoreConfiguration(s: Snapshot): ScoreCard {
  const drivers: ScoreCard['drivers'] = [];
  let points = 0;
  let total = 0;

  // Identité hôtel (poids 20)
  const hotelFields = [s.hotel.name, s.hotel.address, s.hotel.city, s.hotel.zip, s.hotel.country, s.hotel.phone, s.hotel.email];
  const filled = hotelFields.filter((x) => !!x && String(x).trim().length > 0).length;
  const hotelScore = Math.round((filled / hotelFields.length) * 20);
  drivers.push({ label: `Profil hôtel (${filled}/${hotelFields.length} champs)`, weight: 20, ok: filled === hotelFields.length });
  points += hotelScore; total += 20;

  // Chambres avec étage (poids 20)
  const roomsTotal = s.rooms.length;
  const roomsWithFloor = s.rooms.filter((r) => r.floor && r.floor !== '').length;
  const roomsScore = roomsTotal === 0 ? 0 : Math.round((roomsWithFloor / roomsTotal) * 20);
  drivers.push({ label: `Chambres avec étage (${roomsWithFloor}/${roomsTotal})`, weight: 20, ok: roomsTotal > 0 && roomsWithFloor === roomsTotal });
  points += roomsScore; total += 20;

  // Plans tarifaires (poids 20) — au moins 1 plan référent par chambre
  const refPlans = s.roomTypes.filter((rt) => rt.ratePlans?.some((p) => p.isReference)).length;
  const planScore = s.roomTypes.length === 0 ? 0 : Math.round((refPlans / s.roomTypes.length) * 20);
  drivers.push({ label: `Plans tarifaires de référence (${refPlans}/${s.roomTypes.length})`, weight: 20, ok: s.roomTypes.length > 0 && refPlans === s.roomTypes.length });
  points += planScore; total += 20;

  // Channels (poids 10)
  const channelsConfigured = s.channels.length > 0 ? 10 : 0;
  drivers.push({ label: `Canaux configurés (${s.channels.length})`, weight: 10, ok: s.channels.length > 0 });
  points += channelsConfigured; total += 10;

  // Règles RMS (poids 15)
  const enabledRules = s.pricingRules.filter((r) => r.enabled).length;
  const rulesScore = enabledRules >= 3 ? 15 : Math.round(enabledRules * 5);
  drivers.push({ label: `Règles RMS actives (${enabledRules})`, weight: 15, ok: enabledRules >= 3 });
  points += rulesScore; total += 15;

  // Événements marché (poids 15)
  const eventsActive = s.events.filter((e) => e.status === 'active').length;
  const eventsScore = eventsActive >= 5 ? 15 : Math.round(eventsActive * 3);
  drivers.push({ label: `Événements actifs (${eventsActive})`, weight: 15, ok: eventsActive >= 5 });
  points += eventsScore; total += 15;

  const value = clamp(Math.round((points / total) * 100));
  return {
    id: 'configuration',
    label: 'Configuration',
    value,
    tier: tierOf(value),
    drivers,
    caption: `${filled + roomsWithFloor + refPlans} éléments configurés`,
  };
}

function scoreCompliance(s: Snapshot): ScoreCard {
  const drivers: ScoreCard['drivers'] = [];
  let pts = 0; let max = 0;

  // Fiscalité — TVA hébergement renseignée
  const taxConfigured = s.taxes.hebergement > 0 && s.taxes.fb > 0;
  drivers.push({ label: 'TVA hébergement + F&B configurées', weight: 25, ok: taxConfigured });
  pts += taxConfigured ? 25 : 0; max += 25;

  // Taxe de séjour
  const sejour = s.taxes.sejour > 0;
  drivers.push({ label: 'Taxe de séjour renseignée', weight: 15, ok: sejour });
  pts += sejour ? 15 : 0; max += 15;

  // Au moins un admin
  const hasAdmin = s.users.some((u) => u.role === 'admin' && u.active);
  drivers.push({ label: 'Au moins un administrateur actif', weight: 20, ok: hasAdmin });
  pts += hasAdmin ? 20 : 0; max += 20;

  // RGPD : tous les comptes ont email
  const allEmails = s.users.every((u) => u.email && u.email.includes('@'));
  drivers.push({ label: 'Comptes utilisateurs avec email valide', weight: 15, ok: allEmails && s.users.length > 0 });
  pts += allEmails && s.users.length > 0 ? 15 : 0; max += 15;

  // Décisions tracées (audit)
  const decisions = s.pricingRecords.length;
  const audit = decisions > 0;
  drivers.push({ label: 'Audit décisions RMS opérationnel', weight: 15, ok: audit });
  pts += audit ? 15 : 0; max += 15;

  // Pays renseigné (fiscalité localisée)
  const country = !!s.hotel.country && s.hotel.country.length === 2;
  drivers.push({ label: 'Pays ISO renseigné', weight: 10, ok: country });
  pts += country ? 10 : 0; max += 10;

  const value = clamp(Math.round((pts / max) * 100));
  return { id: 'compliance', label: 'Conformité', value, tier: tierOf(value), drivers };
}

function scoreSecurity(s: Snapshot): ScoreCard {
  const drivers: ScoreCard['drivers'] = [];
  let pts = 0; let max = 0;

  // Comptes actifs / inactifs
  const active = s.users.filter((u) => u.active).length;
  const ok = active > 0 && active <= 25;
  drivers.push({ label: `Comptes actifs (${active})`, weight: 20, ok });
  pts += ok ? 20 : 0; max += 20;

  // Au moins 1 admin
  const admins = s.users.filter((u) => u.role === 'admin' && u.active).length;
  drivers.push({ label: `Administrateurs actifs (${admins})`, weight: 25, ok: admins >= 1 && admins <= 3 });
  pts += admins >= 1 ? 25 : 0; max += 25;

  // RBAC : pas trop d'admins (≤ 3)
  drivers.push({ label: 'Principe de moindre privilège (≤ 3 admins)', weight: 15, ok: admins <= 3 });
  pts += admins <= 3 ? 15 : 0; max += 15;

  // 2FA (pas modélisé encore — placeholder honnête)
  drivers.push({ label: '2FA admin (à activer en Phase 2)', weight: 20, ok: false });
  max += 20;

  // Connecteurs avec API key
  const apiConnectors = s.eventSources.filter((s2) => s2.apiAvailable && s2.active).length;
  drivers.push({ label: `Connecteurs API actifs (${apiConnectors})`, weight: 20, ok: apiConnectors >= 1 });
  pts += apiConnectors >= 1 ? 20 : 0; max += 20;

  const value = clamp(Math.round((pts / max) * 100));
  return { id: 'security', label: 'Sécurité', value, tier: tierOf(value), drivers };
}

function scoreDistribution(s: Snapshot): ScoreCard {
  const drivers: ScoreCard['drivers'] = [];
  let pts = 0; let max = 0;

  const hasChannels = s.channels.length > 0;
  drivers.push({ label: `Canaux configurés (${s.channels.length})`, weight: 30, ok: hasChannels });
  pts += hasChannels ? 30 : 0; max += 30;

  // Mapping chambre × plan : approximation = chaque chambre a au moins 1 plan
  const allRoomsHavePlan = s.roomTypes.length > 0 && s.roomTypes.every((rt) => rt.ratePlans?.length > 0);
  drivers.push({ label: 'Chaque chambre a au moins 1 plan tarifaire', weight: 30, ok: allRoomsHavePlan });
  pts += allRoomsHavePlan ? 30 : 0; max += 30;

  // Sources d'événements actives (signal connectivité externe)
  const activeSrc = s.eventSources.filter((s2) => s2.active).length;
  const srcOk = activeSrc >= 5;
  drivers.push({ label: `Sources externes actives (${activeSrc})`, weight: 25, ok: srcOk });
  pts += srcOk ? 25 : Math.round((activeSrc / 5) * 25); max += 25;

  // Sync récentes sans erreur
  const recent = s.syncLogs[0];
  const syncOk = !recent || recent.errors === 0;
  drivers.push({ label: 'Dernière synchro sans erreur', weight: 15, ok: syncOk });
  pts += syncOk ? 15 : 0; max += 15;

  const value = clamp(Math.round((pts / max) * 100));
  return { id: 'distribution', label: 'Distribution', value, tier: tierOf(value), drivers };
}

function scoreRevenue(s: Snapshot): ScoreCard {
  const drivers: ScoreCard['drivers'] = [];
  let pts = 0; let max = 0;

  const enabledRules = s.pricingRules.filter((r) => r.enabled).length;
  drivers.push({ label: `Règles tarifaires actives (${enabledRules})`, weight: 25, ok: enabledRules >= 3 });
  pts += enabledRules >= 3 ? 25 : Math.round((enabledRules / 3) * 25); max += 25;

  const eventsCritical = s.events.filter((e) => e.impact.level === 'critical' || e.impact.level === 'hyper_compression').length;
  drivers.push({ label: `Événements critiques détectés (${eventsCritical})`, weight: 20, ok: eventsCritical >= 1 });
  pts += Math.min(20, eventsCritical * 4); max += 20;

  const kpis = centralPricingEngine.kpis();
  const accepted = kpis.accepted;
  drivers.push({ label: `Décisions acceptées (${accepted})`, weight: 25, ok: accepted >= 5 });
  pts += accepted >= 5 ? 25 : Math.round((accepted / 5) * 25); max += 25;

  const calendarLoaded = s.roomTypes.length > 0;
  drivers.push({ label: 'Calendrier tarifaire chargé', weight: 15, ok: calendarLoaded });
  pts += calendarLoaded ? 15 : 0; max += 15;

  const ruleNoConflict = !hasConflictingRules(s.pricingRules);
  drivers.push({ label: 'Pas de règles tarifaires contradictoires', weight: 15, ok: ruleNoConflict });
  pts += ruleNoConflict ? 15 : 0; max += 15;

  const value = clamp(Math.round((pts / max) * 100));
  return { id: 'revenue', label: 'Revenue Impact', value, tier: tierOf(value), drivers };
}

/**
 * Détection naïve de règles tarifaires contradictoires :
 * deux règles avec plages d'occupation qui se chevauchent et
 * appliquent des multiplicateurs opposés (>1 vs <1).
 */
function hasConflictingRules(rules: Snapshot['pricingRules']): boolean {
  const enabled = rules.filter((r) => r.enabled);
  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i]; const b = enabled[j];
      const overlap = a.occupancyMin <= b.occupancyMax && b.occupancyMin <= a.occupancyMax;
      const opposite = (a.multiplier - 1) * (b.multiplier - 1) < 0;
      if (overlap && opposite) return true;
    }
  }
  return false;
}

function scoreSystemHealth(scores: Record<ScoreCardId, ScoreCard>): ScoreCard {
  const ids: ScoreCardId[] = ['configuration', 'compliance', 'security', 'distribution', 'revenue'];
  const avg = Math.round(ids.reduce((sum, id) => sum + scores[id].value, 0) / ids.length);
  const trend = ids.map((id) => scores[id].value);
  return {
    id: 'system_health',
    label: 'Santé système',
    value: avg,
    tier: tierOf(avg),
    trend,
    drivers: ids.map((id) => ({
      label: scores[id].label,
      weight: 20,
      ok: scores[id].value >= 65,
    })),
    caption: `Moyenne pondérée de ${ids.length} dimensions`,
  };
}

// ─── Alertes ─────────────────────────────────────────────────────────────

function generateAlerts(s: Snapshot): ConfigAlert[] {
  const alerts: ConfigAlert[] = [];
  const now = new Date().toISOString();

  const roomsWithoutFloor = s.rooms.filter((r) => !r.floor || r.floor === '').length;
  if (roomsWithoutFloor > 0) {
    alerts.push({
      id: 'rooms_no_floor',
      severity: 'high',
      module: 'inventory_planning',
      title: `${roomsWithoutFloor} chambre${roomsWithoutFloor > 1 ? 's' : ''} sans étage assigné`,
      description: 'Les chambres sans étage ne peuvent pas être affectées correctement par le housekeeping.',
      businessImpact: 'Affectations housekeeping incomplètes, planning inexact.',
      action: { label: 'Corriger', target: 'settings_floors' },
      status: 'open',
      detectedAt: now,
    });
  }

  // Plans sans condition (proxy : roomType avec moins de 1 plan référent)
  const orphanRooms = s.roomTypes.filter((rt) => !rt.ratePlans?.some((p) => p.isReference)).length;
  if (orphanRooms > 0) {
    alerts.push({
      id: 'plans_no_reference',
      severity: 'high',
      module: 'rms_revenue',
      title: `${orphanRooms} chambre${orphanRooms > 1 ? 's' : ''} sans plan tarifaire de référence`,
      description: 'Sans plan de référence, le RMS ne peut pas appliquer ses recommandations sur cette chambre.',
      businessImpact: 'Recommandations RMS bloquées, recommandations non descendues dans le Calendrier.',
      action: { label: 'Configurer', target: 'settings_rate_plans' },
      status: 'open',
      detectedAt: now,
    });
  }

  // Channels manquants
  if (s.channels.length === 0) {
    alerts.push({
      id: 'no_channels',
      severity: 'critical',
      module: 'channel_manager',
      title: 'Aucun canal de distribution configuré',
      description: 'Aucun OTA ni canal direct n\'est défini — la distribution est désactivée.',
      businessImpact: 'Aucune réservation OTA possible.',
      action: { label: 'Configurer', target: 'settings_connectors' },
      status: 'open',
      detectedAt: now,
    });
  }

  // Pas de règle RMS
  if (s.pricingRules.filter((r) => r.enabled).length === 0) {
    alerts.push({
      id: 'no_pricing_rules',
      severity: 'high',
      module: 'rms_revenue',
      title: 'Aucune règle tarifaire active',
      description: 'Le moteur RMS n\'a pas de garde-fou — les recommandations sont entièrement libres.',
      businessImpact: 'Risque de recommandations hors stratégie.',
      action: { label: 'Configurer', target: 'settings_automations' },
      status: 'open',
      detectedAt: now,
    });
  }

  // Règles contradictoires
  if (hasConflictingRules(s.pricingRules)) {
    alerts.push({
      id: 'conflicting_rules',
      severity: 'medium',
      module: 'rms_revenue',
      title: 'Règles tarifaires contradictoires détectées',
      description: 'Deux règles actives appliquent des multiplicateurs opposés sur la même plage d\'occupation.',
      businessImpact: 'Recommandations imprévisibles.',
      action: { label: 'Corriger', target: 'settings_automations' },
      status: 'open',
      detectedAt: now,
    });
  }

  // Taxe séjour absente
  if (!s.taxes.sejour) {
    alerts.push({
      id: 'no_city_tax',
      severity: 'high',
      module: 'finance_billing',
      title: 'Taxe de séjour non configurée',
      description: 'La taxe de séjour n\'est pas paramétrée — impact direct sur la facturation.',
      businessImpact: 'Factures non conformes, risque de redressement.',
      action: { label: 'Configurer', target: 'settings_fiscal' },
      status: 'open',
      detectedAt: now,
    });
  }

  // Admin sans 2FA (Phase 1 = non encore modélisé → alerte d'attention)
  const admins = s.users.filter((u) => u.role === 'admin' && u.active);
  if (admins.length > 0) {
    alerts.push({
      id: 'admin_no_2fa',
      severity: 'medium',
      module: 'security_backups',
      title: `${admins.length} compte${admins.length > 1 ? 's' : ''} administrateur sans 2FA`,
      description: 'Le 2FA n\'est pas encore activé pour les comptes administrateur.',
      businessImpact: 'Risque de compromission de compte privilégié.',
      action: { label: 'Configurer', target: 'settings_users' },
      status: 'open',
      detectedAt: now,
    });
  } else {
    alerts.push({
      id: 'no_admin',
      severity: 'critical',
      module: 'security_backups',
      title: 'Aucun administrateur actif',
      description: 'Aucun compte avec rôle administrateur n\'est actuellement actif.',
      businessImpact: 'Impossible de gérer la sécurité de l\'établissement.',
      action: { label: 'Corriger', target: 'settings_users' },
      status: 'open',
      detectedAt: now,
    });
  }

  // Connecteurs API en erreur
  const erroredSrc = s.eventSources.filter((src) => src.status === 'error');
  for (const src of erroredSrc.slice(0, 2)) {
    alerts.push({
      id: `src_error_${src.id}`,
      severity: 'medium',
      module: 'integrations',
      title: `Source en erreur — ${src.name}`,
      description: 'La dernière synchronisation a échoué pour cette source.',
      businessImpact: 'Événements marché non actualisés depuis cette source.',
      action: { label: 'Voir', target: 'rev_events' as PageId },
      status: 'open',
      detectedAt: now,
    });
  }

  // Erreurs récentes de sync
  if (s.syncLogs.length > 0 && s.syncLogs[0].errors > 0) {
    alerts.push({
      id: 'recent_sync_errors',
      severity: 'low',
      module: 'integrations',
      title: `${s.syncLogs[0].errors} erreur${s.syncLogs[0].errors > 1 ? 's' : ''} lors de la dernière synchronisation`,
      description: 'Certaines sources n\'ont pas répondu correctement lors de la dernière recherche d\'événements.',
      businessImpact: 'Vue partielle des événements marché.',
      action: { label: 'Voir', target: 'rev_events' as PageId },
      status: 'open',
      detectedAt: now,
    });
  }

  // Pas d'événement détecté
  if (s.events.length === 0) {
    alerts.push({
      id: 'no_events',
      severity: 'low',
      module: 'rms_revenue',
      title: 'Aucun événement marché chargé',
      description: 'La bibliothèque d\'événements est vide — le RMS ne peut pas anticiper les pics.',
      businessImpact: 'Pression marché non détectée, recommandations sans contexte.',
      action: { label: 'Ouvrir', target: 'rev_events' as PageId },
      status: 'open',
      detectedAt: now,
    });
  }

  // Hôtel sans email
  if (!s.hotel.email) {
    alerts.push({
      id: 'hotel_no_email',
      severity: 'low',
      module: 'pms_reservations',
      title: 'Adresse email hôtel manquante',
      description: 'Les communications transactionnelles ne pourront pas avoir d\'expéditeur fiable.',
      action: { label: 'Corriger', target: 'settings_hotel' },
      status: 'open',
      detectedAt: now,
    });
  }

  // Tri par sévérité
  const order: Record<ConfigAlert['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  return alerts;
}

// ─── État des modules ────────────────────────────────────────────────────

function buildModules(s: Snapshot, alerts: ConfigAlert[]): ModuleStatus[] {
  const now = new Date().toISOString();
  const byModule = new Map<ModuleKey, ConfigAlert[]>();
  for (const a of alerts) {
    const arr = byModule.get(a.module) ?? [];
    arr.push(a);
    byModule.set(a.module, arr);
  }

  const statusFor = (key: ModuleKey, base: 'operational' | 'pending_configuration' | 'disabled'): ModuleStatus['status'] => {
    const own = byModule.get(key) ?? [];
    if (own.some((a) => a.severity === 'critical')) return 'critical';
    if (own.some((a) => a.severity === 'high')) return 'attention';
    if (own.length > 0) return 'attention';
    return base;
  };

  const issuesOf = (key: ModuleKey): string[] =>
    (byModule.get(key) ?? []).slice(0, 3).map((a) => a.title);

  const modules: ModuleStatus[] = [
    {
      key: 'pms_reservations',
      name: MODULE_LABEL.pms_reservations,
      status: s.rooms.length === 0 ? 'pending_configuration' : statusFor('pms_reservations', 'operational'),
      lastCheckedAt: now,
      issues: issuesOf('pms_reservations'),
      homePage: 'reservations',
    },
    {
      key: 'inventory_planning',
      name: MODULE_LABEL.inventory_planning,
      status: s.rooms.length === 0 ? 'pending_configuration' : statusFor('inventory_planning', 'operational'),
      lastCheckedAt: now,
      issues: issuesOf('inventory_planning'),
      homePage: 'planning',
      recommendedAction: s.rooms.length === 0
        ? { label: 'Créer les chambres', target: 'settings_rooms' }
        : undefined,
    },
    {
      key: 'rms_revenue',
      name: MODULE_LABEL.rms_revenue,
      status: s.pricingRules.length === 0 ? 'pending_configuration' : statusFor('rms_revenue', 'operational'),
      lastCheckedAt: now,
      issues: issuesOf('rms_revenue'),
      homePage: 'rev_dashboard' as PageId,
      recommendedAction: s.pricingRules.length === 0
        ? { label: 'Configurer les règles', target: 'settings_automations' }
        : undefined,
    },
    {
      key: 'channel_manager',
      name: MODULE_LABEL.channel_manager,
      status: s.channels.length === 0 ? 'pending_configuration' : statusFor('channel_manager', 'operational'),
      lastCheckedAt: now,
      issues: issuesOf('channel_manager'),
      homePage: 'rev_distribution' as PageId,
    },
    {
      key: 'finance_billing',
      name: MODULE_LABEL.finance_billing,
      status: s.taxes.hebergement === 0 ? 'pending_configuration' : statusFor('finance_billing', 'operational'),
      lastCheckedAt: now,
      issues: issuesOf('finance_billing'),
      homePage: 'finance',
    },
    {
      key: 'housekeeping',
      name: MODULE_LABEL.housekeeping,
      status: s.rooms.length === 0 ? 'pending_configuration' : statusFor('housekeeping', 'operational'),
      lastCheckedAt: now,
      issues: issuesOf('housekeeping'),
      homePage: 'housekeeping',
    },
    {
      key: 'automation_ai',
      name: MODULE_LABEL.automation_ai,
      status: s.pricingRules.filter((r) => r.enabled).length === 0
        ? 'disabled'
        : statusFor('automation_ai', 'operational'),
      lastCheckedAt: now,
      issues: issuesOf('automation_ai'),
      homePage: 'rev_autopilot' as PageId,
    },
    {
      key: 'security_backups',
      name: MODULE_LABEL.security_backups,
      status: statusFor('security_backups', 'operational'),
      lastCheckedAt: now,
      issues: issuesOf('security_backups'),
      homePage: 'settings_audit' as PageId,
    },
  ];
  return modules;
}

// ─── Checklist & Configuration guidée ────────────────────────────────────

function buildChecklist(s: Snapshot): ChecklistDomain[] {
  const domains: { id: ChecklistDomainId; label: string; tasks: ChecklistTask[] }[] = [
    {
      id: 'establishment', label: 'Informations établissement', tasks: [
        { id: 'hotel_name', label: 'Nom et raison sociale', done: !!s.hotel.name, target: 'settings_hotel' },
        { id: 'hotel_address', label: 'Adresse + code postal + ville + pays', done: !!s.hotel.address && !!s.hotel.zip && !!s.hotel.city && !!s.hotel.country, target: 'settings_hotel' },
        { id: 'hotel_contact', label: 'Email + téléphone', done: !!s.hotel.email && !!s.hotel.phone, target: 'settings_hotel' },
        { id: 'hotel_stars', label: 'Classement hôtelier', done: s.hotel.stars > 0, target: 'settings_hotel' },
      ],
    },
    {
      id: 'inventory', label: 'Inventaire & chambres', tasks: [
        { id: 'rooms_created', label: 'Au moins une chambre créée', done: s.rooms.length > 0, target: 'settings_rooms' },
        { id: 'rooms_floor', label: 'Toutes les chambres ont un étage', done: s.rooms.length > 0 && s.rooms.every((r) => !!r.floor), target: 'settings_floors' },
        { id: 'room_types', label: 'Types de chambres définis dans le Calendrier', done: s.roomTypes.length > 0, target: 'settings_room_types' },
      ],
    },
    {
      id: 'pricing', label: 'Tarifs & conditions', tasks: [
        { id: 'rate_plans', label: 'Plans tarifaires créés', done: s.roomTypes.some((rt) => rt.ratePlans?.length > 0), target: 'settings_rate_plans' },
        { id: 'reference_plan', label: 'Plan tarifaire de référence par chambre', done: s.roomTypes.length > 0 && s.roomTypes.every((rt) => rt.ratePlans?.some((p) => p.isReference)), target: 'settings_rate_plans' },
        { id: 'pricing_rules', label: 'Au moins une règle tarifaire active', done: s.pricingRules.some((r) => r.enabled), target: 'settings_automations' },
      ],
    },
    {
      id: 'distribution', label: 'Distribution & OTA', tasks: [
        { id: 'channels', label: 'Canaux de distribution configurés', done: s.channels.length > 0, target: 'settings_connectors' },
        { id: 'event_sources', label: 'Sources d\'événements actives', done: s.eventSources.filter((x) => x.active).length >= 5, target: 'rev_events' as PageId },
      ],
    },
    {
      id: 'finance', label: 'Finance & facturation', tasks: [
        { id: 'tax_heb', label: 'TVA hébergement renseignée', done: s.taxes.hebergement > 0, target: 'settings_fiscal' },
        { id: 'tax_fb', label: 'TVA restauration renseignée', done: s.taxes.fb > 0, target: 'settings_fiscal' },
        { id: 'tax_sej', label: 'Taxe de séjour renseignée', done: s.taxes.sejour > 0, target: 'settings_fiscal' },
      ],
    },
    {
      id: 'housekeeping', label: 'Housekeeping', tasks: [
        { id: 'hk_status', label: 'Statuts ménage opérationnels', done: true, target: 'settings_hk_status' },
        { id: 'hk_staff', label: 'Personnel housekeeping rattaché', done: s.users.some((u) => u.role === 'housekeeping'), target: 'settings_hk_staff' },
      ],
    },
    {
      id: 'security', label: 'Sécurité', tasks: [
        { id: 'admin', label: 'Au moins un administrateur actif', done: s.users.some((u) => u.role === 'admin' && u.active), target: 'settings_users' },
        { id: 'two_fa', label: '2FA activé pour les administrateurs', done: false, target: 'settings_users', blockedBy: 'Phase 2' },
        { id: 'backups', label: 'Sauvegardes quotidiennes opérationnelles', done: false, target: 'settings_backups', blockedBy: 'Phase 2' },
      ],
    },
    {
      id: 'integrations', label: 'Intégrations', tasks: [
        { id: 'api_keys', label: 'Connecteurs API actifs', done: s.eventSources.some((x) => x.active && x.apiAvailable), target: 'settings_api' },
        { id: 'pms_sync', label: 'PMS / Channel Manager connectés', done: s.channels.length > 0, target: 'settings_pms_sync' },
      ],
    },
  ];

  return domains.map((d) => {
    const done = d.tasks.filter((t) => t.done).length;
    const progress = d.tasks.length === 0 ? 0 : Math.round((done / d.tasks.length) * 100);
    return { id: d.id, label: d.label, tasks: d.tasks, progress };
  });
}

function buildGuided(checklist: ChecklistDomain[]): GuidedStep[] {
  const map: { id: ChecklistDomainId; label: string; target: PageId }[] = [
    { id: 'establishment', label: 'Informations de base', target: 'settings_hotel' },
    { id: 'inventory', label: 'Inventaire & chambres', target: 'settings_rooms' },
    { id: 'pricing', label: 'Tarification & conditions', target: 'settings_rate_plans' },
    { id: 'distribution', label: 'Distribution & OTA', target: 'settings_connectors' },
    { id: 'finance', label: 'Finances & paiements', target: 'settings_fiscal' },
    { id: 'housekeeping', label: 'Housekeeping', target: 'settings_hk_status' },
    { id: 'security', label: 'Sécurité', target: 'settings_users' },
    { id: 'integrations', label: 'Intégrations', target: 'settings_api' },
  ];
  const byId = new Map(checklist.map((d) => [d.id, d]));
  return map.map((m, i) => {
    const dom = byId.get(m.id);
    let status: GuidedStep['status'] = 'todo';
    let blockedBy: string | undefined;
    if (dom) {
      const blocked = dom.tasks.find((t) => t.blockedBy);
      if (dom.progress === 100) status = 'completed';
      else if (dom.progress > 0) status = 'in_progress';
      else if (blocked) { status = 'blocked'; blockedBy = blocked.blockedBy; }
    }
    return { index: i + 1, label: m.label, status, domain: m.id, target: m.target, blockedBy };
  });
}

// ─── Logs système ────────────────────────────────────────────────────────

function buildLogs(s: Snapshot): SystemLogEntry[] {
  const out: SystemLogEntry[] = [];

  // Événements : logs de sync récents
  for (const log of s.syncLogs.slice(0, 4)) {
    out.push({
      id: `evt_sync_${log.at}`,
      at: log.at,
      module: 'integrations',
      level: log.errors > 0 ? 'warn' : 'success',
      status: log.errors > 0 ? 'failed' : 'success',
      title: `Recherche événements — ${log.city}`,
      detail: `${log.sourcesQueried} sources · ${log.added + log.updated + log.pending} événements · ${log.errors} erreur(s)`,
      auditTarget: 'rev_events' as PageId,
    });
  }

  // Décisions tarifaires récentes
  const decisions = [...s.pricingRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  for (const d of decisions) {
    out.push({
      id: `dec_${d.date}_${d.updatedAt}`,
      at: d.updatedAt,
      module: 'rms_revenue',
      level: 'success',
      status: 'success',
      title: `Décision tarifaire ${d.date} — ${d.status}`,
      detail: d.finalPrice != null ? `Prix final ${d.finalPrice} € (source ${d.source})` : `Statut ${d.status}`,
      auditTarget: 'rev_audit' as PageId,
    });
  }

  // Tri chrono décroissant
  out.sort((a, b) => b.at.localeCompare(a.at));
  return out.slice(0, 10);
}

// ─── Connecteurs ────────────────────────────────────────────────────────

function buildConnectors(s: Snapshot): SyncConnector[] {
  return s.eventSources.filter((src) => src.priority === 'recommended').slice(0, 8).map((src) => ({
    id: src.id,
    name: src.name,
    module: 'integrations',
    status: src.status === 'ok' ? 'ok' : src.status === 'error' ? 'error' : src.active ? 'pending' : 'disabled',
    lastSyncAt: src.lastSyncAt,
  }));
}

// ─── Point d'entrée ──────────────────────────────────────────────────────

export function runDiagnostic(): DiagnosticReport {
  const s = snapshot();

  const config = scoreConfiguration(s);
  const compliance = scoreCompliance(s);
  const security = scoreSecurity(s);
  const distribution = scoreDistribution(s);
  const revenue = scoreRevenue(s);

  const scores: Record<ScoreCardId, ScoreCard> = {
    configuration: config,
    compliance,
    security,
    distribution,
    revenue,
    system_health: { id: 'system_health', label: 'Santé système', value: 0, tier: 'good', drivers: [] },
  };
  scores.system_health = scoreSystemHealth(scores);

  const alerts = generateAlerts(s);
  const modules = buildModules(s, alerts);
  const checklist = buildChecklist(s);
  const guided = buildGuided(checklist);
  const logs = buildLogs(s);
  const connectors = buildConnectors(s);

  return {
    generatedAt: new Date().toISOString(),
    scores,
    modules,
    alerts,
    checklist,
    guided,
    logs,
    connectors,
    overallTier: scores.system_health.tier,
  };
}
