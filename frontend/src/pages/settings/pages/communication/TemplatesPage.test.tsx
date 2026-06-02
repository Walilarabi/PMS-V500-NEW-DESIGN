/**
 * FLOWTYM — Test d'intégration du module Paramètres · Communication · Templates.
 *
 * Composants RÉELS (page + éditeur slide-over + bibliothèque) ; seule la couche
 * Supabase est mockée (aucun modèle en base → état vide). Vérifie le montage,
 * l'état vide, l'ouverture de l'éditeur, le changement de canal et la
 * bibliothèque hôtelière.
 */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// Chaîne Supabase mockée : from().select().eq().order() → aucune ligne.
vi.mock('@/src/lib/supabase', () => {
  const order = vi.fn().mockResolvedValue({ data: [], error: null });
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  return { supabase: { from: vi.fn(() => ({ select })) } };
});
vi.mock('@/src/lib/hotelId', () => ({ resolveHotelId: vi.fn().mockResolvedValue('hotel-1') }));

import { TemplatesPage } from './TemplatesPage';

afterEach(() => cleanup());

describe('TemplatesPage', () => {
  it('affiche l\'état vide quand l\'hôtel n\'a aucun modèle', async () => {
    render(<TemplatesPage />);
    expect(await screen.findByText(/Aucun modèle email pour l'instant/i)).toBeTruthy();
  });

  it('ouvre l\'éditeur via « Nouveau modèle »', async () => {
    render(<TemplatesPage />);
    await screen.findByText(/Aucun modèle email/i);

    // L'état vide et la barre d'outils exposent tous deux « Nouveau modèle ».
    fireEvent.click(screen.getAllByRole('button', { name: /Nouveau modèle/i })[0]);

    // L'éditeur expose des éléments uniques (paramétrage d'envoi + bouton créer).
    expect(await screen.findByText(/Paramétrage d'envoi/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Créer le modèle/i })).toBeTruthy();
  });

  it('bascule le canal vers WhatsApp', async () => {
    render(<TemplatesPage />);
    await screen.findByText(/Aucun modèle email/i);

    fireEvent.click(screen.getByRole('button', { name: /^WhatsApp$/i }));

    expect(await screen.findByText(/Aucun modèle WhatsApp pour l'instant/i)).toBeTruthy();
  });

  it('ouvre la bibliothèque hôtelière et liste des modèles prêts à l\'emploi', async () => {
    render(<TemplatesPage />);
    await screen.findByText(/Aucun modèle email/i);

    // Bouton barre d'outils (≠ « Parcourir la bibliothèque » de l'état vide).
    fireEvent.click(screen.getByRole('button', { name: /^Bibliothèque$/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: /Bibliothèque hôtelière/i })).toBeTruthy());
    // Un modèle hôtelier connu de la bibliothèque email.
    expect(screen.getByText(/Confirmation de réservation/i)).toBeTruthy();
  });
});
