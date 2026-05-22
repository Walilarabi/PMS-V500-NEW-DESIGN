/**
 * FLOWTYM RMS — Moteur d'interprétation IA.
 *
 * Génère un texte d'analyse marché à segments (parties en gras pour
 * mise en valeur) à partir des deltas de comparaison.
 */

export interface AiSegment {
  text: string;
  bold?: boolean;
}

export interface AiInterpretation {
  segments: AiSegment[];
  emoji: string;
}

export interface AiInterpretationInput {
  /** Libellé de la période comparée : « Hier », « J-3 »… */
  compareLabel: string;
  /** Variation de demande (points de %). */
  demandDelta: number;
  /** Variation de médiane compset (€). */
  medianDelta: number;
  /** Écart notre tarif vs médiane (€, négatif = sous la médiane). */
  gap: number;
}

/**
 * Produit l'interprétation IA du marché.
 * Reproduit la tonalité de la maquette : analyse de momentum + recommandation.
 */
export function generateAiInterpretation(
  input: AiInterpretationInput,
): AiInterpretation {
  const { compareLabel, demandDelta, medianDelta, gap } = input;

  const accel =
    demandDelta >= 20
      ? 'une forte accélération'
      : demandDelta >= 8
        ? 'une nette progression'
        : demandDelta > -8
          ? 'une relative stabilité'
          : 'un ralentissement marqué';

  const demandVerb = demandDelta >= 0 ? 'progresse de' : 'recule de';
  const medianVerb = medianDelta >= 0 ? 'augmente de' : 'diminue de';
  const demandText =
    demandDelta >= 0 ? `+${demandDelta} points` : `${Math.abs(demandDelta)} points`;
  const medianText =
    medianDelta >= 0 ? `+${medianDelta}€` : `${Math.abs(medianDelta)}€`;

  const segments: AiSegment[] = [
    { text: `Le marché montre ${accel} par rapport à ${compareLabel}. ` },
    { text: 'La demande ' },
    { text: `${demandVerb} ${demandText}`, bold: true },
    { text: ' tandis que la médiane compset ' },
    { text: `${medianVerb} ${medianText}`, bold: true },
    { text: '. ' },
  ];

  if (gap < 0) {
    segments.push(
      { text: 'Votre tarif reste sous la médiane de ' },
      { text: `${Math.abs(gap)}€`, bold: true },
      { text: ', indiquant une ' },
      { text: "opportunité d'augmentation tarifaire", bold: true },
      { text: '. ' },
    );
    return { segments, emoji: '🔥' };
  }

  if (gap > 0) {
    segments.push(
      { text: 'Votre tarif dépasse la médiane de ' },
      { text: `${gap}€`, bold: true },
      { text: ', à surveiller si la demande faiblit. ' },
    );
    return { segments, emoji: '📊' };
  }

  segments.push(
    { text: 'Votre tarif est aligné sur la médiane compset, ' },
    { text: 'positionnement équilibré', bold: true },
    { text: '. ' },
  );
  return { segments, emoji: '✅' };
}
