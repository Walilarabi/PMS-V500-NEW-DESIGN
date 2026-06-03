/**
 * FLOWTYM RMS — Smoke test du module « Pricing & Recommandations » (RMSTableauPro).
 *
 * Objectif : garantir que la page se monte sans planter (crash blanc signalé).
 * On isole la page de l'I/O réseau (Supabase / auth / données opérationnelles)
 * et on vérifie qu'aucune exception n'est levée au rendu initial.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: null, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));
vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({ session: { hotelId: 'hotel-1', role: 'admin' }, status: 'authenticated' }),
}));
// Données opérationnelles : aucune ligne, aucune erreur (chemin nominal).
// IMPORTANT : référence STABLE (comme le vrai hook qui mémoïse byDate), sinon
// l'effet d'enrichissement (dépend de operationalByDate) boucle artificiellement.
const STABLE_OPS = { byDate: new Map(), totalCapacity: 0, error: null, hasData: false };
vi.mock('../../hooks/useOperationalData', () => ({
  useOperationalData: () => STABLE_OPS,
}));

import { RMSTableauPro } from './RMSTableauPro';

afterEach(() => cleanup());

describe('RMSTableauPro (Pricing & Recommandations)', () => {
  it('se monte sans lever d\'exception', () => {
    expect(() => render(<RMSTableauPro />)).not.toThrow();
  });

  it('bascule entre les 4 vues (Tableau / Kanban / Analyse RM / Recommandation) sans planter', () => {
    render(<RMSTableauPro />);
    for (const label of [/^Kanban$/, /Analyse RM/, /Recommandation/, /^Tableau$/]) {
      const btn = screen.getAllByText(label).find((el) => el.tagName === 'BUTTON' || el.closest('button'));
      expect(btn, `bouton de vue ${label} introuvable`).toBeTruthy();
      expect(() => fireEvent.click(btn!.closest('button') ?? btn!)).not.toThrow();
    }
  });
});
