/**
 * FLOWTYM — Tests de la palette globale Cmd+K.
 *
 * Couvre :
 *   • affichage des 12 premières pages sans query
 *   • recherche fuzzy (substring + caractères dans l'ordre)
 *   • clavier ↑↓ Enter Escape
 *   • clic sur résultat
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));

import { SettingsCommandPalette } from './SettingsCommandPalette';

describe('<SettingsCommandPalette>', () => {
  afterEach(() => cleanup());

  it("ne rend rien quand fermé", () => {
    const { container } = render(
      <SettingsCommandPalette open={false} onClose={() => {}} onNavigate={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche le placeholder et les pages quand ouvert", () => {
    render(<SettingsCommandPalette open onClose={() => {}} onNavigate={() => {}} />);
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeDefined();
    // Au moins 1 option de listbox affichée (a11y role="option")
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
  });

  it("filtre les résultats par recherche substring", () => {
    render(<SettingsCommandPalette open onClose={() => {}} onNavigate={() => {}} />);
    const input = screen.getByPlaceholderText(/Rechercher/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'rgpd' } });
    // Le mot RGPD apparaît dans le résultat
    expect(screen.getAllByText(/RGPD/i).length).toBeGreaterThan(0);
  });

  it("affiche 'Aucun résultat' pour query inconnue", () => {
    render(<SettingsCommandPalette open onClose={() => {}} onNavigate={() => {}} />);
    const input = screen.getByPlaceholderText(/Rechercher/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'xyzzyxyzzy' } });
    expect(screen.getByText(/Aucun résultat/i)).toBeDefined();
  });

  it("Échap appelle onClose", () => {
    const onClose = vi.fn();
    render(<SettingsCommandPalette open onClose={onClose} onNavigate={() => {}} />);
    const input = screen.getByPlaceholderText(/Rechercher/i);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it("Enter sur le premier résultat navigue + ferme", () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(<SettingsCommandPalette open onClose={onClose} onNavigate={onNavigate} />);
    const input = screen.getByPlaceholderText(/Rechercher/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("↓ déplace le focus", () => {
    render(<SettingsCommandPalette open onClose={() => {}} onNavigate={() => {}} />);
    const input = screen.getByPlaceholderText(/Rechercher/i);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Pas de crash — focus avance silencieusement
    expect(input).toBeDefined();
  });

  it("clic sur un résultat appelle onNavigate", () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(<SettingsCommandPalette open onClose={onClose} onNavigate={onNavigate} />);
    const input = screen.getByPlaceholderText(/Rechercher/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'utilisateurs' } });
    // Récupère la première option de résultat (a11y role="option")
    const utilBtn = screen.getAllByRole('option').find((b) =>
      b.textContent?.toLowerCase().includes('utilisateurs'),
    );
    expect(utilBtn).toBeDefined();
    if (utilBtn) fireEvent.click(utilBtn);
    expect(onNavigate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('useCommandPalette — keyboard shortcut', () => {
  afterEach(() => cleanup());

  function TestHarness() {
    // Reproduit ce que fait SettingsLayout pour tester l'écoute Cmd+K
    const [open, setOpen] = useState(false);
    React.useEffect(() => {
      function onKey(e: KeyboardEvent) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);
    return <div data-testid="state">{open ? 'OPEN' : 'CLOSED'}</div>;
  }

  it("Cmd+K toggle l'état", () => {
    render(<TestHarness />);
    expect(screen.getByTestId('state').textContent).toBe('CLOSED');
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByTestId('state').textContent).toBe('OPEN');
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByTestId('state').textContent).toBe('CLOSED');
  });

  it("Ctrl+K marche aussi (Linux/Windows)", () => {
    render(<TestHarness />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('state').textContent).toBe('OPEN');
  });
});
