/**
 * FLOWTYM RMS — Moteur d'alertes Revenue Management.
 *
 * Détecte les opportunités tarifaires à partir du positionnement,
 * de la demande et de la dynamique marché.
 */

export type OpportunityKind = 'increase' | 'decrease' | 'hold';
export type OpportunitySeverity = 'info' | 'warning' | 'critical';

export interface RmOpportunity {
  kind: OpportunityKind;
  severity: OpportunitySeverity;
  emoji: string;
  title: string;
  message: string;
}

export interface RmAlertInput {
  /** Notre tarif moyen. */
  ourPrice: number;
  /** Médiane compset. */
  medianCompset: number;
  /** Demande marché actuelle (0-100). */
  demand: number;
  /** Variation de demande vs période comparée (points de %). */
  demandDelta: number;
}

/**
 * Détecte l'opportunité Revenue Management dominante.
 *
 * Logique :
 *   - tarif sous la médiane + demande forte    => hausse fortement recommandée
 *   - tarif sous la médiane + demande modérée  => hausse à étudier
 *   - tarif au-dessus de la médiane + demande faible => baisse recommandée
 *   - sinon                                    => maintien
 */
export function detectRmOpportunity(input: RmAlertInput): RmOpportunity {
  const gap = Math.round(input.ourPrice - input.medianCompset);
  const underMedian = gap < 0;
  const overMedian = gap > 0;

  if (underMedian && input.demand >= 75) {
    return {
      kind: 'increase',
      severity: 'critical',
      emoji: '🔥',
      title: "Opportunité d'augmentation tarifaire",
      message:
        `Votre tarif reste sous la médiane de ${Math.abs(gap)}€ alors que la demande ` +
        `atteint ${input.demand}%. Le marché supporte une hausse immédiate.`,
    };
  }

  if (underMedian && input.demand >= 55) {
    return {
      kind: 'increase',
      severity: 'warning',
      emoji: '📈',
      title: 'Marge de progression tarifaire',
      message:
        `Tarif ${Math.abs(gap)}€ sous la médiane compset, demande soutenue à ` +
        `${input.demand}%. Une hausse progressive est à étudier.`,
    };
  }

  if (overMedian && input.demand < 45) {
    return {
      kind: 'decrease',
      severity: 'warning',
      emoji: '⚠️',
      title: 'Risque de surtarification',
      message:
        `Tarif ${gap}€ au-dessus de la médiane avec une demande faible de ` +
        `${input.demand}%. Un ajustement à la baisse sécurise le remplissage.`,
    };
  }

  return {
    kind: 'hold',
    severity: 'info',
    emoji: '✅',
    title: 'Positionnement équilibré',
    message:
      `Votre tarif est cohérent avec la médiane compset et la demande de ` +
      `${input.demand}%. Maintien recommandé, surveillance du momentum.`,
  };
}
