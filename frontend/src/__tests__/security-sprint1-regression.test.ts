/**
 * Tests régression SECURITY SPRINT 1 — V6 & V7
 *
 * Garantissent que les variables fantômes corrigées ne ré-apparaissent pas :
 *   V6 : `reservation` (n'existait pas dans le scope) → remplacé par `res`
 *   V7 : `CHANNELS` (jamais importé) → remplacé par `[]`
 *
 * Si quelqu'un retire le fix par inadvertance, ces tests échouent avant le
 * merge → blocage du PR.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('V6 — ReservationDetailsModal: pas de variable `reservation` undefined', () => {
  const src = readFileSync(
    resolve(HERE, '../components/modals/ReservationDetailsModal.tsx'),
    'utf8',
  );

  it('generatePaymentLink utilise `res?.reference` (prop du scope) et non `reservation?.reference`', () => {
    // La chaîne `reservation?.reference` ne doit apparaître que dans des
    // commentaires de traçabilité — jamais dans du code exécuté.
    const lines = src.split('\n');
    const codeOccurrences = lines.filter((l) => {
      const trimmed = l.trim();
      const inComment = trimmed.startsWith('//') || trimmed.startsWith('*')
        || trimmed.startsWith('/*');
      return !inComment && /reservation\?\.reference/.test(l);
    });
    expect(codeOccurrences).toHaveLength(0);
  });

  it('contient bien le fix `res?.reference`', () => {
    expect(src).toMatch(/res\?\.reference/);
  });

  it('commentaire V6 fix présent (traceabilité)', () => {
    expect(src).toMatch(/V6 fix/);
  });
});

describe('V7 — DistributionAnalytics: pas de variable `CHANNELS` undefined', () => {
  const src = readFileSync(
    resolve(HERE, '../pages/revenue/DistributionAnalytics.tsx'),
    'utf8',
  );

  it("ne renvoie plus `CHANNELS` dans le fallback du useMemo channelData", () => {
    // Cherche le pattern `return CHANNELS;` qui crashait.
    expect(src).not.toMatch(/return\s+CHANNELS\s*;/);
  });

  it('contient le commentaire V7 fix', () => {
    expect(src).toMatch(/V7 fix/);
  });

  it('le fallback final est bien un tableau vide', () => {
    // La chaîne `return [];` est le nouveau fallback.
    expect(src).toMatch(/V7 fix[\s\S]{0,200}return\s+\[\]\s*;/);
  });
});
