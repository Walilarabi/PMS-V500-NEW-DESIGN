/**
 * FLOWTYM Flowday/Planning — tests régression PlanningViewLive.
 *
 * RÉGRESSION HISTORIQUE :
 *   Le bouton "Calendrier Revenu" (toggle displayMode → 'Revenue') faisait
 *   crash la page entière car la variable `kpiData` référencée 8× lignes
 *   1185-1188 n'était JAMAIS définie (ReferenceError au render).
 *
 *   Ce test garantit que :
 *     a) `kpiData` est bien défini dans le fichier
 *     b) Toutes les propriétés lues dans le JSX (to, totalRevenue, revpar,
 *        adr, roomsSold, availableRooms, reservationsCount) sont définies.
 *
 *   Si quelqu'un supprime à nouveau le `kpiData` useMemo, ce test échoue.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'PlanningViewLive.tsx'), 'utf8');

describe('PlanningViewLive — régression Calendrier Revenu crash', () => {
  it('définit la variable kpiData', () => {
    // Le crash venait de l'absence de cette déclaration.
    expect(SOURCE).toMatch(/const\s+kpiData\s*=/);
  });

  it("kpiData expose toutes les propriétés lues dans le JSX Revenue", () => {
    // Si une de ces propriétés est lue (`kpiData.X`) mais n'est pas
    // retournée par le useMemo, on retombe dans une erreur runtime.
    const required = [
      'to',
      'totalRevenue',
      'revpar',
      'adr',
      'roomsSold',
      'availableRooms',
      'reservationsCount',
    ];
    // Extraction du bloc qui suit `const kpiData = ` jusqu'à la fin de la
    // déclaration (`}, [...]);`). On compte les accolades pour ne pas
    // s'arrêter sur le `Math.max(...)` interne.
    const tail = SOURCE.split(/const\s+kpiData\s*=/)[1] ?? '';
    let depth = 0;
    let end = -1;
    for (let i = 0; i < tail.length; i++) {
      const c = tail[i];
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    expect(end, 'corps de kpiData non trouvé').toBeGreaterThan(0);
    const body = tail.slice(0, end + 1);
    required.forEach((key) => {
      // Le useMemo a la forme `return { to: ..., availableRooms, ... }` —
      // on accepte la clé suivie de `:` OU `,` OU `}` (shorthand JS).
      expect(body, `kpiData doit exposer "${key}"`).toMatch(
        new RegExp(`\\b${key}\\s*(:|,|\\})`),
      );
    });
  });

  it('le composant PlanningView est wrappé dans un ErrorBoundary', () => {
    // Défense en profondeur : si une autre régression se glisse, le crash
    // ne doit pas faire tomber l'app entière.
    expect(SOURCE).toMatch(/ErrorBoundary[\s\S]{0,200}PlanningViewInner/);
  });
});
