/**
 * FLOWTYM — Insight Computers
 *
 * Une fonction par rapport. Reçoit les rows + filtres, renvoie 0..N insights.
 */

import type { Insight } from './types';

// ─── 21008 — Activité journalière ─────────────────────────────────────────

interface Row21008 { date: string; arrivees: number; departs: number; presents: number; occupation_pct: number }

export function computeInsights21008(rows: Row21008[]): Insight[] {
  if (rows.length === 0) return [];
  const insights: Insight[] = [];
  const occMoy = rows.reduce((s, r) => s + Number(r.occupation_pct || 0), 0) / rows.length;

  if (occMoy < 40) {
    insights.push({
      id: 'occ_low',
      severity: 'critical',
      title: 'Occupation faible',
      message: `Occupation moyenne ${occMoy.toFixed(1)}% sur la période. Activer Yield management ou réviser la stratégie tarifaire.`,
      action: { label: 'Ouvrir le RMS', page: 'rms' },
    });
  } else if (occMoy > 85) {
    insights.push({
      id: 'occ_high',
      severity: 'positive',
      title: 'Occupation très forte',
      message: `Occupation moyenne ${occMoy.toFixed(1)}%. Opportunité de yield max : augmenter les tarifs sur les dates restantes.`,
      action: { label: 'Ouvrir le Calendrier', page: 'rev_pricing' },
    });
  }

  // Détecter weekends ou pic de demande
  const sorted = [...rows].sort((a, b) => Number(b.presents) - Number(a.presents));
  const peak = sorted[0];
  if (peak && Number(peak.presents) > 0) {
    insights.push({
      id: 'peak_day',
      severity: 'info',
      title: `Pic d'occupation`,
      message: `${new Date(peak.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${peak.presents} chambres occupées (${Number(peak.occupation_pct).toFixed(0)}%).`,
    });
  }

  // Solde net arrivées vs départs sur la période
  const totalArrivees = rows.reduce((s, r) => s + (r.arrivees || 0), 0);
  const totalDeparts = rows.reduce((s, r) => s + (r.departs || 0), 0);
  if (totalDeparts > totalArrivees * 1.2) {
    insights.push({
      id: 'departs_high',
      severity: 'warning',
      title: 'Solde négatif',
      message: `${totalDeparts} départs vs ${totalArrivees} arrivées. Vérifier le pipeline de réservations à venir.`,
      action: { label: 'Voir RMS', page: 'rms' },
    });
  }

  return insights;
}

// ─── 21013 — Détail par canal ─────────────────────────────────────────────

interface Row21013 { canal: string; reservations: number; nuitees: number; ca_total: number; adr: number; part_pct: number }

export function computeInsights21013(rows: Row21013[]): Insight[] {
  if (rows.length === 0) return [];
  const insights: Insight[] = [];
  const direct = rows.find(r => r.canal === 'Direct' || r.canal === 'Website');
  const top = rows[0];

  // Direct vs OTA dominante
  if (top && direct && top.canal !== direct.canal && top.part_pct > 35) {
    insights.push({
      id: 'ota_dominant',
      severity: 'warning',
      title: `Dépendance ${top.canal}`,
      message: `${top.canal} représente ${Number(top.part_pct).toFixed(1)}% du CA. ADR ${Math.round(Number(top.adr))}€ vs Direct ${Math.round(Number(direct.adr))}€. Renforcer le canal direct.`,
      action: { label: 'Promotions Direct', page: 'rev_promotions' },
    });
  }

  // ADR le plus bas
  const lowAdr = [...rows].filter(r => r.ca_total > 0).sort((a, b) => Number(a.adr) - Number(b.adr))[0];
  if (lowAdr && rows.length >= 3 && Number(lowAdr.part_pct) >= 10) {
    insights.push({
      id: 'low_adr',
      severity: 'info',
      title: `${lowAdr.canal} = ADR le plus bas`,
      message: `${Math.round(Number(lowAdr.adr))}€/nuit · ${Number(lowAdr.part_pct).toFixed(1)}% du CA. Évaluer la pertinence du canal vs commission.`,
      action: { label: 'Configurer canaux', page: 'rev_channels' },
    });
  }

  // CA très concentré
  if (top && Number(top.part_pct) > 50) {
    insights.push({
      id: 'concentration',
      severity: 'critical',
      title: 'Concentration excessive',
      message: `Un seul canal (${top.canal}) génère ${Number(top.part_pct).toFixed(0)}% du CA. Diversification urgente.`,
    });
  }

  return insights;
}

// ─── 54001 — RevPAR journalier ────────────────────────────────────────────

interface Row54001 { date: string; revenue: number; rooms_sold: number; rooms_available: number; adr: number; occupancy_pct: number; revpar: number; revpar_n_1: number }

export function computeInsights54001(rows: Row54001[]): Insight[] {
  if (rows.length === 0) return [];
  const insights: Insight[] = [];
  const revparMoy = rows.reduce((s, r) => s + Number(r.revpar || 0), 0) / rows.length;
  const revparN1Moy = rows.reduce((s, r) => s + Number(r.revpar_n_1 || 0), 0) / rows.length;

  if (revparN1Moy > 0) {
    const delta = ((revparMoy - revparN1Moy) / revparN1Moy) * 100;
    if (delta > 10) {
      insights.push({
        id: 'revpar_up',
        severity: 'positive',
        title: 'RevPAR en hausse vs N-1',
        message: `+${delta.toFixed(1)}% vs même période l'année dernière. Performance exceptionnelle, capitaliser sur cette dynamique.`,
      });
    } else if (delta < -10) {
      insights.push({
        id: 'revpar_down',
        severity: 'critical',
        title: 'RevPAR en baisse vs N-1',
        message: `${delta.toFixed(1)}% vs N-1. Identifier la cause : pricing trop élevé, perte de marché, événements manqués.`,
        action: { label: 'Analyser veille', page: 'rev_compset' },
      });
    }
  }

  // Détecter jours sous-performants
  const lowDays = rows.filter(r => Number(r.occupancy_pct) < 50 && Number(r.adr) > 0);
  if (lowDays.length >= 3) {
    insights.push({
      id: 'low_days',
      severity: 'warning',
      title: `${lowDays.length} jours sous 50% d'occupation`,
      message: `Sur la période, ${lowDays.length} jours présentent une occupation < 50%. Envisager promotions ciblées ou baisses tarifaires.`,
      action: { label: 'Créer une promo', page: 'rev_promotions' },
    });
  }

  return insights;
}

// ─── 54002 — ADR par type de chambre ──────────────────────────────────────

interface Row54002 { room_type: string; reservations: number; nuitees: number; ca_total: number; adr: number; capacity: number }

export function computeInsights54002(rows: Row54002[]): Insight[] {
  if (rows.length === 0) return [];
  const insights: Insight[] = [];
  const active = rows.filter(r => Number(r.nuitees) > 0);

  if (active.length >= 2) {
    const sorted = [...active].sort((a, b) => Number(b.adr) - Number(a.adr));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (Number(best.adr) > Number(worst.adr) * 1.5 && Number(worst.capacity) >= 5) {
      insights.push({
        id: 'spread_adr',
        severity: 'info',
        title: 'Écart ADR important',
        message: `${best.room_type} (${Math.round(Number(best.adr))}€) vs ${worst.room_type} (${Math.round(Number(worst.adr))}€). Tester un upsell systématique vers ${best.room_type}.`,
      });
    }
  }

  // Type inutilisé
  const unused = rows.filter(r => Number(r.reservations) === 0 && Number(r.capacity) > 0);
  if (unused.length > 0) {
    insights.push({
      id: 'unused_types',
      severity: 'warning',
      title: `${unused.length} type${unused.length > 1 ? 's' : ''} sans vente`,
      message: `${unused.map(u => u.room_type).join(', ')} n'a pas été vendu sur la période. Vérifier le pricing et la visibilité.`,
      action: { label: 'Ouvrir le Calendrier', page: 'rev_pricing' },
    });
  }

  return insights;
}

// ─── 54004 — Pickup curve ─────────────────────────────────────────────────

interface Row54004 { bucket: string; bucket_order: number; reservations: number; nuitees: number; ca_total: number; part_pct: number }

export function computeInsights54004(rows: Row54004[]): Insight[] {
  if (rows.length === 0) return [];
  const insights: Insight[] = [];
  const lastMinute = rows.filter(r => r.bucket_order <= 2).reduce((s, r) => s + Number(r.part_pct || 0), 0);
  const longLead = rows.filter(r => r.bucket_order >= 6).reduce((s, r) => s + Number(r.part_pct || 0), 0);

  if (lastMinute > 30) {
    insights.push({
      id: 'last_minute_high',
      severity: 'warning',
      title: 'Forte dépendance last-minute',
      message: `${lastMinute.toFixed(1)}% des réservations en J-3 ou moins. Pression conversion forte : optimiser le yield last-minute.`,
      action: { label: 'Voir le RMS', page: 'rms' },
    });
  }

  if (longLead < 15 && rows.some(r => r.bucket_order >= 6 && Number(r.reservations) > 0)) {
    insights.push({
      id: 'long_lead_low',
      severity: 'info',
      title: 'Faible booking window long terme',
      message: `Seulement ${longLead.toFixed(1)}% des réservations en J-60+. Renforcer Early Booker / OTA visibilité long terme.`,
      action: { label: 'Promotions', page: 'rev_promotions' },
    });
  }

  return insights;
}

// ─── 51060 — Nationalités ─────────────────────────────────────────────────

interface Row51060 { nationalite: string; reservations: number; nuitees: number; ca_total: number; adr: number; part_pct: number }

export function computeInsights51060(rows: Row51060[]): Insight[] {
  if (rows.length === 0) return [];
  const insights: Insight[] = [];
  const top = rows[0];
  if (top && Number(top.part_pct) > 40) {
    insights.push({
      id: 'top_market_dominance',
      severity: 'warning',
      title: `Concentration ${top.nationalite}`,
      message: `${top.nationalite} = ${Number(top.part_pct).toFixed(0)}% des nuitées (${Math.round(Number(top.ca_total))}€). Diversifier le mix client pour réduire le risque géopolitique.`,
    });
  }

  // Pays avec ADR exceptionnel
  const sortedByAdr = [...rows].filter(r => Number(r.nuitees) >= 3).sort((a, b) => Number(b.adr) - Number(a.adr));
  if (sortedByAdr.length >= 2) {
    const premium = sortedByAdr[0];
    insights.push({
      id: 'premium_market',
      severity: 'positive',
      title: `Marché premium : ${premium.nationalite}`,
      message: `ADR ${Math.round(Number(premium.adr))}€ sur ${premium.nuitees} nuitées. Cibler ce marché en marketing direct.`,
    });
  }

  return insights;
}

// ─── 51010 — Segmentation ─────────────────────────────────────────────────

interface Row51010 { segment: string; reservations: number; nuitees: number; ca_total: number; adr: number; part_pct: number }

export function computeInsights51010(rows: Row51010[]): Insight[] {
  if (rows.length === 0) return [];
  const insights: Insight[] = [];

  const undef = rows.find(r => r.segment === 'Non segmenté');
  if (undef && Number(undef.part_pct) > 30) {
    insights.push({
      id: 'unsegmented',
      severity: 'warning',
      title: 'Données de segment manquantes',
      message: `${Number(undef.part_pct).toFixed(0)}% des réservations ne sont pas segmentées. Qualifier les guests pour améliorer le ciblage.`,
    });
  }

  const sorted = [...rows].filter(r => r.segment !== 'Non segmenté').sort((a, b) => Number(b.adr) - Number(a.adr));
  if (sorted.length >= 2) {
    const premium = sorted[0];
    insights.push({
      id: 'premium_segment',
      severity: 'positive',
      title: `Segment premium : ${premium.segment}`,
      message: `ADR ${Math.round(Number(premium.adr))}€ · ${Number(premium.part_pct).toFixed(0)}% du CA. Renforcer la stratégie vers ce segment.`,
    });
  }

  return insights;
}

// ─── 41003 — Règlements ───────────────────────────────────────────────────

interface Row41003 { payment_method: string; payment_type: string; nb_transactions: number; montant_total: number; part_pct: number }

export function computeInsights41003(rows: Row41003[]): Insight[] {
  if (rows.length === 0) return [];
  const insights: Insight[] = [];

  const cb = rows.find(r => /carte|cb|credit/i.test(r.payment_method));
  if (cb && Number(cb.part_pct) > 70) {
    insights.push({
      id: 'cb_heavy',
      severity: 'info',
      title: 'Mix paiement très CB',
      message: `${Number(cb.part_pct).toFixed(0)}% des règlements par carte. Commissions à surveiller, négocier les taux acquéreur.`,
    });
  }

  const espece = rows.find(r => /espece|cash/i.test(r.payment_method));
  if (espece && Number(espece.part_pct) > 20) {
    insights.push({
      id: 'cash_heavy',
      severity: 'warning',
      title: 'Forte part d\'espèces',
      message: `${Number(espece.part_pct).toFixed(0)}% en espèces. Vigilance fraude, contrôle caisse renforcé.`,
    });
  }

  return insights;
}

// ─── 61001 — État chambres ────────────────────────────────────────────────

interface Row61001 { housekeeping_status: string; occupation_status: string; nb_chambres: number; numeros: string[] }

export function computeInsights61001(rows: Row61001[]): Insight[] {
  if (rows.length === 0) return [];
  const insights: Insight[] = [];

  const dirty = rows.filter(r => /sale|dirty/i.test(r.housekeeping_status) && r.occupation_status === 'Libre');
  const totalDirty = dirty.reduce((s, r) => s + Number(r.nb_chambres || 0), 0);
  if (totalDirty >= 5) {
    insights.push({
      id: 'dirty_high',
      severity: 'warning',
      title: `${totalDirty} chambres sales libres`,
      message: `Mobilisation gouvernantes nécessaire avant les arrivées du soir.`,
    });
  }

  const oos = rows.filter(r => /hors|oos|out/i.test(r.housekeeping_status));
  const totalOOS = oos.reduce((s, r) => s + Number(r.nb_chambres || 0), 0);
  if (totalOOS > 0) {
    insights.push({
      id: 'oos',
      severity: 'critical',
      title: `${totalOOS} chambre${totalOOS > 1 ? 's' : ''} hors service`,
      message: `Impact direct sur l'inventaire vendable. Suivre les tickets maintenance.`,
    });
  }

  return insights;
}
