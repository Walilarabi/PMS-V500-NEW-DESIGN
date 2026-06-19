/**
 * FLOWTYM REVENUE — Tests RevenueScreenBoundary.
 *
 * Garantit :
 *   1. Pas d'erreur → enfant rendu normalement.
 *   2. Erreur dans l'enfant → fallback affiché, app NE QUITTE PAS.
 *   3. Nom de l'écran affiché dans le fallback (le RM sait ce qui crashe).
 *   4. Bouton « Réessayer » reset l'état et tente un nouveau render.
 *
 * Régression couverte : un crash dans n'importe quel écran Revenue ne doit
 * PAS faire remonter l'erreur à l'ErrorBoundary global de App.tsx (qui
 * éteignait l'app entière en pilote, bloquant le RM hors de tous les
 * modules).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { RevenueScreenBoundary } from './RevenueScreenBoundary';

// Stub supabase (chaîne d'imports captureError → monitoringService).
import { vi } from 'vitest';
vi.mock('@/src/lib/supabase', () => ({
  supabase: {},
  getSupabase: () => ({}),
}));
vi.mock('@/src/services/settings/monitoringService', () => ({
  captureError: vi.fn(),
}));

const Boom: React.FC<{ msg?: string }> = ({ msg = 'boom' }) => {
  throw new Error(msg);
};

let shouldThrow = true;
const FlakyChild: React.FC = () => {
  if (shouldThrow) throw new Error('flaky');
  return <div>recovered</div>;
};

beforeEach(() => {
  cleanup();
  // Silence l'erreur React lors du log volontaire pendant les tests
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('RevenueScreenBoundary', () => {
  it('rend les enfants quand pas d\'erreur', () => {
    render(
      <RevenueScreenBoundary screenName="Distribution & OTA">
        <div>hello world</div>
      </RevenueScreenBoundary>,
    );
    expect(screen.getByText('hello world')).toBeDefined();
  });

  it('catche une erreur et affiche le fallback avec le nom de l\'écran', () => {
    render(
      <RevenueScreenBoundary screenName="Distribution & OTA">
        <Boom msg="Cannot read properties of undefined (reading 'name')" />
      </RevenueScreenBoundary>,
    );
    // Nom de l'écran dans le fallback — cible le heading h2 pour éviter
    // les doublons de texte (le screenName peut aussi apparaître dans le
    // message d'erreur loggé par React en mode dev).
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Distribution & OTA',
    );
    // Message d'erreur visible (au moins un match)
    expect(
      screen.getAllByText(/Cannot read properties of undefined/).length,
    ).toBeGreaterThan(0);
    // Boutons d'action présents
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Debug/ })).toBeDefined();
  });

  it('« Réessayer » reset l\'état et permet un nouveau render', () => {
    shouldThrow = true;
    render(
      <RevenueScreenBoundary screenName="Événements">
        <FlakyChild />
      </RevenueScreenBoundary>,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Événements');

    // Simule un fix transient avant retry
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }));

    // L'enfant a pu se rendre cette fois-ci
    expect(screen.getByText('recovered')).toBeDefined();
  });

  it('« Debug » émet l\'événement window flowtym:toggle-debug', () => {
    let received = false;
    const handler = () => {
      received = true;
    };
    window.addEventListener('flowtym:toggle-debug', handler);

    render(
      <RevenueScreenBoundary screenName="Promotions">
        <Boom />
      </RevenueScreenBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Debug/ }));

    expect(received).toBe(true);
    window.removeEventListener('flowtym:toggle-debug', handler);
  });
});
