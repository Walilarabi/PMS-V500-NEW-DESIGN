/**
 * FLOWTYM RMS — Alerts Engine
 *
 * Génère le fil d'alertes Revenue Management à partir des données réelles
 * disponibles dans les stores (Lighthouse, Expedia, événements, calendrier
 * tarifaire). Fonction PURE : pas d'état, pas de side-effect, pas de React.
 * Testable indépendamment.
 *
 * IDs déterministes basés sur (kind, dateKey, signature) pour permettre la
 * persistance des actions utilisateur (acquitter / résoudre / rejeter) à
 * travers les recalculs.
 */

import type { LighthouseImport } from '../../services/lighthouse-parser.service';
import type { ExpediaImport } from '../../services/expedia-parser.service';
import type { SalonEvent } from '../../services/salons-parser.service';
import type { Promotion } from '../../store/promotionsStore';

export type AlertKind =
  | 'opportunity'
  | 'risk'
  | 'overheating'
  | 'compression'
  | 'underpricing'
  | 'overpricing';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface RmAlert {
  /** Identifiant stable — survit aux recalculs tant que le contexte ne change pas. */
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  message: string;
  /** Plage de dates concernée — pour navigation et affichage. */
  dateRange: { start: string; end: string };
  /** Source(s) ayant déclenché l'alerte — pour traçabilité. */
  source: AlertSource[];
  /** Métriques clés — pour affichage et débogage. */
  metrics: AlertMetric[];
  /** Action suggérée — pour le bouton "Traiter". */
  suggestedAction: SuggestedAction;
  /** Score de confiance 0-100. */
  confidence: number;
  /** Timestamp ISO de génération (recalculé à chaque run). */
  generatedAt: string;
}

export type AlertSource = 'lighthouse' | 'expedia' | 'events' | 'calendar' | 'promotions';

export interface AlertMetric {
  label: string;
  value: string;
}

export type SuggestedActionType =
  | 'open-recommendation'
  | 'open-calendar'
  | 'open-distribution'
  | 'open-strategies'
  | 'open-competitive-watch'
  | 'open-promotions';

export interface SuggestedAction {
  type: SuggestedActionType;
  label: string;
  /** Date cible si pertinente (ouvre le calendrier sur ce jour). */
  targetDate?: string;
}

export interface AlertEngineInput {
  lighthouse?: LighthouseImport | null;
  expedia?: ExpediaImport | null;
  events?: SalonEvent[];
  /** Liste de promotions (toutes statuts confondus). */
  promotions?: Promotion[];
  /** Données calendrier minimales nécessaires au calcul d'occupation. */
  calendar?: {
    days: Array<{
      date: string;
      occupancyPct: number; // 0-100
      pickupVsYesterday?: number; // points de %, négatif = chute
      adr?: number;
    }>;
  };
  /** Date courante pour filtrer le passé. ISO YYYY-MM-DD. Optionnel (défaut: today). */
  today?: string;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const todayISO = (input?: string): string =>
  input ?? new Date().toISOString().slice(0, 10);

const isFuture = (date: string, ref: string): boolean => date >= ref;

/**
 * Hash simple et stable d'une chaîne — assez bon pour générer des IDs
 * déterministes côté front. Pas crypto, c'est volontaire.
 */
function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

function buildAlertId(kind: AlertKind, dateKey: string, signature: string): string {
  return `alert_${kind}_${dateKey}_${shortHash(signature)}`;
}

function formatDateFR(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatRangeFR(start: string, end: string): string {
  return start === end
    ? formatDateFR(start)
    : `${formatDateFR(start)} → ${formatDateFR(end)}`;
}

// ─── RÈGLES MÉTIER ──────────────────────────────────────────────────────────

function detectLighthouseAlerts(
  data: LighthouseImport,
  ref: string
): RmAlert[] {
  const out: RmAlert[] = [];
  const futureDays = data.days.filter((d) => isFuture(d.date, ref));

  for (const d of futureDays) {
    // OPPORTUNITY — Sous médiane + forte demande
    if (d.ourPrice && d.compsetMedian && d.ourPrice < d.compsetMedian) {
      const gap = Math.round(d.compsetMedian - d.ourPrice);
      const demand = Math.round(d.marketDemandPercent);

      if (demand >= 80 && gap >= 5) {
        const sig = `lh-opp-${d.date}-${gap}-${demand}`;
        out.push({
          id: buildAlertId('opportunity', d.date, sig),
          kind: 'opportunity',
          severity: 'critical',
          title: 'Tarif sous la médiane sur un pic de demande',
          message: `Le ${formatDateFR(d.date)}, la demande atteint ${demand} % alors que votre tarif reste ${gap}€ sous la médiane compset. Une hausse immédiate peut être appliquée sans risque de volume.`,
          dateRange: { start: d.date, end: d.date },
          source: ['lighthouse'],
          metrics: [
            { label: 'Notre prix', value: `${d.ourPrice}€` },
            { label: 'Médiane', value: `${d.compsetMedian}€` },
            { label: 'Écart', value: `−${gap}€` },
            { label: 'Demande', value: `${demand}%` },
          ],
          suggestedAction: {
            type: 'open-recommendation',
            label: 'Voir la recommandation',
            targetDate: d.date,
          },
          confidence: 85,
          generatedAt: new Date().toISOString(),
        });
      } else if (demand >= 60 && gap >= 8) {
        const sig = `lh-under-${d.date}-${gap}`;
        out.push({
          id: buildAlertId('underpricing', d.date, sig),
          kind: 'underpricing',
          severity: 'warning',
          title: 'Sous-pricing détecté',
          message: `Le ${formatDateFR(d.date)}, votre tarif est ${gap}€ sous la médiane compset avec une demande de ${demand} %. Hausse progressive recommandée.`,
          dateRange: { start: d.date, end: d.date },
          source: ['lighthouse'],
          metrics: [
            { label: 'Écart médiane', value: `−${gap}€` },
            { label: 'Demande', value: `${demand}%` },
            { label: 'Position', value: d.ranking },
          ],
          suggestedAction: {
            type: 'open-calendar',
            label: 'Ouvrir le calendrier',
            targetDate: d.date,
          },
          confidence: 70,
          generatedAt: new Date().toISOString(),
        });
      }
    }

    // OVERPRICING — Au-dessus médiane + demande faible
    if (
      d.ourPrice &&
      d.compsetMedian &&
      d.ourPrice > d.compsetMedian * 1.08 &&
      d.marketDemandPercent < 35
    ) {
      const gap = Math.round(d.ourPrice - d.compsetMedian);
      const demand = Math.round(d.marketDemandPercent);
      const sig = `lh-over-${d.date}-${gap}`;
      out.push({
        id: buildAlertId('overpricing', d.date, sig),
        kind: 'overpricing',
        severity: 'warning',
        title: "Risque d'overpricing",
        message: `Le ${formatDateFR(d.date)}, votre tarif dépasse la médiane de ${gap}€ avec une demande faible (${demand} %). Le remplissage est exposé.`,
        dateRange: { start: d.date, end: d.date },
        source: ['lighthouse'],
        metrics: [
          { label: 'Écart médiane', value: `+${gap}€` },
          { label: 'Demande', value: `${demand}%` },
          { label: 'Position', value: d.ranking },
        ],
        suggestedAction: {
          type: 'open-calendar',
          label: 'Ajuster le tarif',
          targetDate: d.date,
        },
        confidence: 75,
        generatedAt: new Date().toISOString(),
      });
    }

    // COMPRESSION — compset majoritairement épuisé
    if (d.competitors && d.competitors.length > 0) {
      const soldOut = d.competitors.filter((c) => c.status === 'sold_out').length;
      const ratio = soldOut / d.competitors.length;
      if (ratio >= 0.6) {
        const sig = `lh-comp-${d.date}-${soldOut}`;
        out.push({
          id: buildAlertId('compression', d.date, sig),
          kind: 'compression',
          severity: ratio >= 0.8 ? 'critical' : 'warning',
          title: 'Compression de disponibilité compset',
          message: `${soldOut} hôtels sur ${d.competitors.length} du compset affichent complet le ${formatDateFR(d.date)}. La rareté justifie une stratégie de compression tarifaire.`,
          dateRange: { start: d.date, end: d.date },
          source: ['lighthouse'],
          metrics: [
            { label: 'Compset épuisé', value: `${soldOut}/${d.competitors.length}` },
            { label: 'Notre prix', value: `${d.ourPrice}€` },
            { label: 'Demande', value: `${Math.round(d.marketDemandPercent)}%` },
          ],
          suggestedAction: {
            type: 'open-strategies',
            label: 'Activer la stratégie',
            targetDate: d.date,
          },
          confidence: 80,
          generatedAt: new Date().toISOString(),
        });
      }
    }

    // RISK — Position basse (rang faible)
    if (
      d.rankPosition != null &&
      d.rankTotal != null &&
      d.rankTotal > 0 &&
      d.rankPosition / d.rankTotal >= 0.8 &&
      d.marketDemandPercent >= 50
    ) {
      const sig = `lh-rank-${d.date}-${d.rankPosition}`;
      out.push({
        id: buildAlertId('risk', d.date, sig),
        kind: 'risk',
        severity: 'warning',
        title: 'Positionnement bas sur un jour porteur',
        message: `Le ${formatDateFR(d.date)}, vous êtes classé ${d.ranking} avec une demande de ${Math.round(d.marketDemandPercent)} %. À surveiller — votre visibilité ranking est dégradée.`,
        dateRange: { start: d.date, end: d.date },
        source: ['lighthouse'],
        metrics: [
          { label: 'Ranking', value: d.ranking },
          { label: 'Demande', value: `${Math.round(d.marketDemandPercent)}%` },
        ],
        suggestedAction: {
          type: 'open-competitive-watch',
          label: 'Analyser le compset',
          targetDate: d.date,
        },
        confidence: 65,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return out;
}

function detectExpediaAlerts(data: ExpediaImport, ref: string): RmAlert[] {
  const out: RmAlert[] = [];
  const futureDays = data.days.filter((d) => isFuture(d.date, ref));

  // Détection de fenêtres de surchauffe (>=80% pression) sur >=3 jours consécutifs
  const hot: typeof futureDays = [];
  let run: typeof futureDays = [];
  for (const d of futureDays) {
    const pressure = Math.max(
      d.marketPressureBroaderPercent,
      d.marketPressureNeighborhoodPercent
    );
    if (pressure >= 80) {
      run.push(d);
    } else {
      if (run.length >= 3) hot.push(...run);
      run = [];
    }
  }
  if (run.length >= 3) hot.push(...run);

  if (hot.length >= 3) {
    const start = hot[0].date;
    const end = hot[hot.length - 1].date;
    const avgPressure = Math.round(
      hot.reduce(
        (s, d) =>
          s +
          Math.max(
            d.marketPressureBroaderPercent,
            d.marketPressureNeighborhoodPercent
          ),
        0
      ) / hot.length
    );
    const sig = `exp-overheat-${start}-${end}-${avgPressure}`;
    out.push({
      id: buildAlertId('overheating', start, sig),
      kind: 'overheating',
      severity: 'critical',
      title: 'Surchauffe marché détectée',
      message: `La pression marché Expedia dépasse 80 % sur ${hot.length} jours consécutifs (${formatRangeFR(start, end)}). Une stratégie de yield offensive est recommandée.`,
      dateRange: { start, end },
      source: ['expedia'],
      metrics: [
        { label: 'Jours en surchauffe', value: `${hot.length}` },
        { label: 'Pression moyenne', value: `${avgPressure}%` },
      ],
      suggestedAction: {
        type: 'open-strategies',
        label: 'Activer Yield offensif',
        targetDate: start,
      },
      confidence: 82,
      generatedAt: new Date().toISOString(),
    });
  }

  return out;
}

function detectEventAlerts(events: SalonEvent[], ref: string): RmAlert[] {
  const out: RmAlert[] = [];
  // Événements à venir, fenêtre J+0 → J+45
  const horizon = new Date(ref);
  horizon.setDate(horizon.getDate() + 45);
  const horizonISO = horizon.toISOString().slice(0, 10);

  const futureEvents = events.filter(
    (e) => e.endDate >= ref && e.startDate <= horizonISO
  );

  for (const e of futureEvents) {
    // On ne génère qu'une alerte par événement à fort impact
    const impactStr = (e.impact ?? '').toLowerCase();
    const isHighImpact =
      impactStr.includes('fort') ||
      impactStr.includes('high') ||
      impactStr.includes('élevé') ||
      impactStr.includes('eleve');

    const isMediumImpact =
      impactStr.includes('moyen') || impactStr.includes('medium');

    if (!isHighImpact && !isMediumImpact) continue;

    const severity: AlertSeverity = isHighImpact ? 'critical' : 'info';
    const sig = `evt-${e.startDate}-${e.endDate}-${e.name.slice(0, 12)}`;
    out.push({
      id: buildAlertId('opportunity', e.startDate, sig),
      kind: 'opportunity',
      severity,
      title: `Événement marché — ${e.name}`,
      message: `Événement ${isHighImpact ? 'à fort potentiel' : 'à impact moyen'} confirmé du ${formatRangeFR(e.startDate, e.endDate)}${e.location ? ` (${e.location})` : ''}. Anticiper une ouverture tarifaire et vérifier les restrictions MinStay.`,
      dateRange: { start: e.startDate, end: e.endDate },
      source: ['events'],
      metrics: [
        { label: 'Impact', value: e.impact ?? 'N/D' },
        ...(e.location ? [{ label: 'Lieu', value: e.location }] : []),
      ],
      suggestedAction: {
        type: 'open-calendar',
        label: 'Préparer la période',
        targetDate: e.startDate,
      },
      confidence: isHighImpact ? 80 : 60,
      generatedAt: new Date().toISOString(),
    });
  }

  return out;
}

function detectCalendarAlerts(
  calendar: NonNullable<AlertEngineInput['calendar']>,
  ref: string
): RmAlert[] {
  const out: RmAlert[] = [];
  const futureDays = calendar.days.filter((d) => isFuture(d.date, ref));

  // PICKUP — chute marquée à J+7
  for (const d of futureDays) {
    if (d.pickupVsYesterday != null && d.pickupVsYesterday <= -15) {
      const sig = `cal-pickup-${d.date}-${Math.round(d.pickupVsYesterday)}`;
      out.push({
        id: buildAlertId('risk', d.date, sig),
        kind: 'risk',
        severity: d.pickupVsYesterday <= -25 ? 'critical' : 'warning',
        title: 'Chute de pickup détectée',
        message: `Le ${formatDateFR(d.date)}, le pickup recule de ${d.pickupVsYesterday.toFixed(0)} pts vs hier. Vérifier les restrictions et la concurrence.`,
        dateRange: { start: d.date, end: d.date },
        source: ['calendar'],
        metrics: [
          { label: 'Pickup vs J-1', value: `${d.pickupVsYesterday.toFixed(1)} pts` },
          { label: 'Occupation', value: `${d.occupancyPct.toFixed(0)}%` },
        ],
        suggestedAction: {
          type: 'open-recommendation',
          label: 'Analyser le pickup',
          targetDate: d.date,
        },
        confidence: 78,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return out;
}

function detectPromotionAlerts(promotions: Promotion[], ref: string): RmAlert[] {
  const out: RmAlert[] = [];
  // Horizon court terme : 7 jours
  const soon = new Date(ref);
  soon.setDate(soon.getDate() + 7);
  const soonISO = soon.toISOString().slice(0, 10);

  for (const p of promotions) {
    // 1) Promotion HIGH priority en draft / paused / scheduled → à activer
    if (
      (p.status === 'draft' || p.status === 'paused' || p.status === 'scheduled') &&
      p.alert?.priority === 'high'
    ) {
      const sig = `promo-toactivate-${p.id}`;
      out.push({
        id: buildAlertId('opportunity', p.startDate, sig),
        kind: 'opportunity',
        severity: 'warning',
        title: `Promotion à activer — ${p.name}`,
        message: `Le moteur RMS recommande l'activation de "${p.name}" (priorité haute). ${p.alert.why}`,
        dateRange: { start: p.startDate, end: p.endDate },
        source: ['promotions'],
        metrics: [
          { label: 'Type', value: p.typeLabel },
          { label: 'Réduction', value: p.discount },
          { label: 'Canaux', value: p.channels.join(' + ') },
        ],
        suggestedAction: {
          type: 'open-promotions',
          label: 'Ouvrir la promotion',
        },
        confidence: 75,
        generatedAt: new Date().toISOString(),
      });
    }

    // 2) Promotion active qui expire dans < 7 jours (et non permanente)
    if (
      p.status === 'active' &&
      !p.permanent &&
      p.endDate >= ref &&
      p.endDate <= soonISO
    ) {
      const sig = `promo-expiring-${p.id}-${p.endDate}`;
      out.push({
        id: buildAlertId('risk', p.endDate, sig),
        kind: 'risk',
        severity: 'info',
        title: `Promotion bientôt terminée — ${p.name}`,
        message: `La promotion "${p.name}" prend fin le ${formatDateFR(p.endDate)}. Décider de prolonger, dupliquer ou laisser expirer.`,
        dateRange: { start: ref, end: p.endDate },
        source: ['promotions'],
        metrics: [
          { label: 'Réservations', value: `${p.bookings}` },
          { label: 'Revenu', value: `${Math.round(p.revenue)}€` },
          { label: 'ROI', value: p.roi > 0 ? `${p.roi.toFixed(1)}x` : '—' },
        ],
        suggestedAction: {
          type: 'open-promotions',
          label: 'Prolonger ou archiver',
        },
        confidence: 70,
        generatedAt: new Date().toISOString(),
      });
    }

    // 3) Promotion active avec sous-performance ROI (< 2x sur > 20 réservations)
    if (p.status === 'active' && p.bookings >= 20 && p.roi > 0 && p.roi < 2) {
      const sig = `promo-lowroi-${p.id}-${p.roi.toFixed(1)}`;
      out.push({
        id: buildAlertId('underpricing', p.startDate, sig),
        kind: 'underpricing',
        severity: 'warning',
        title: `Sous-performance — ${p.name}`,
        message: `La promotion "${p.name}" affiche un ROI de ${p.roi.toFixed(1)}x sur ${p.bookings} réservations. Réviser la cible, la réduction ou les canaux de diffusion.`,
        dateRange: { start: p.startDate, end: p.endDate },
        source: ['promotions'],
        metrics: [
          { label: 'ROI', value: `${p.roi.toFixed(1)}x` },
          { label: 'Conversion', value: `${p.conversion.toFixed(1)}%` },
          { label: 'Performance', value: `${p.performance}/100` },
        ],
        suggestedAction: {
          type: 'open-promotions',
          label: 'Analyser la promotion',
        },
        confidence: 72,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return out;
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

const KIND_PRIORITY: Record<AlertKind, number> = {
  overheating: 0,
  compression: 1,
  opportunity: 2,
  risk: 3,
  underpricing: 4,
  overpricing: 5,
};

const SEVERITY_PRIORITY: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Génère l'ensemble des alertes à partir des données disponibles.
 * Trie par sévérité puis par date.
 */
export function computeAlerts(input: AlertEngineInput): RmAlert[] {
  const ref = todayISO(input.today);
  const all: RmAlert[] = [];

  if (input.lighthouse) all.push(...detectLighthouseAlerts(input.lighthouse, ref));
  if (input.expedia) all.push(...detectExpediaAlerts(input.expedia, ref));
  if (input.events?.length) all.push(...detectEventAlerts(input.events, ref));
  if (input.calendar?.days?.length)
    all.push(...detectCalendarAlerts(input.calendar, ref));
  if (input.promotions?.length)
    all.push(...detectPromotionAlerts(input.promotions, ref));

  // Dédupe par id (si plusieurs sources convergent par hasard)
  const seen = new Set<string>();
  const deduped = all.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Tri : sévérité puis kind puis date
  deduped.sort((a, b) => {
    const s = SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity];
    if (s !== 0) return s;
    const k = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    if (k !== 0) return k;
    return a.dateRange.start.localeCompare(b.dateRange.start);
  });

  return deduped;
}

/**
 * Synthèse rapide pour l'en-tête de la page Alertes.
 */
export interface AlertStats {
  total: number;
  byKind: Record<AlertKind, number>;
  bySeverity: Record<AlertSeverity, number>;
}

export function summarizeAlerts(alerts: RmAlert[]): AlertStats {
  const byKind: Record<AlertKind, number> = {
    opportunity: 0,
    risk: 0,
    overheating: 0,
    compression: 0,
    underpricing: 0,
    overpricing: 0,
  };
  const bySeverity: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };
  for (const a of alerts) {
    byKind[a.kind]++;
    bySeverity[a.severity]++;
  }
  return { total: alerts.length, byKind, bySeverity };
}
