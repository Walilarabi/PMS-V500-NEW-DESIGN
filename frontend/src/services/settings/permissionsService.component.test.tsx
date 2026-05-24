/**
 * FLOWTYM — Tests composants RBAC (smoke level).
 *
 * Vérifie que les composants <RequirePermission>, <PermissionDeniedBanner>
 * et le hook usePagePermission rendent correctement selon la session
 * d'auth et la matrice de permissions.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));

// Mock useAuth pour contrôler la session courante dans chaque test
const sessionRef: { current: { role: string | null } | null } = { current: null };
vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({ session: sessionRef.current, status: 'authenticated' }),
}));

import {
  RequirePermission,
  PermissionDeniedBanner,
  usePagePermission,
} from './permissionsService';

function setSession(role: string | null) {
  sessionRef.current = role === null ? null : { role };
}

describe('<RequirePermission>', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
    sessionRef.current = null;
  });
  afterEach(() => {
    cleanup();
  });

  it("affiche les enfants quand la permission est accordée", () => {
    setSession('admin');
    render(
      <RequirePermission capability="set_users" level="admin">
        <button>Créer utilisateur</button>
      </RequirePermission>,
    );
    expect(screen.getByText('Créer utilisateur')).toBeDefined();
  });

  it("masque les enfants quand la permission est refusée", () => {
    setSession('receptionist');
    render(
      <RequirePermission capability="set_users" level="write">
        <button>Créer utilisateur</button>
      </RequirePermission>,
    );
    expect(screen.queryByText('Créer utilisateur')).toBeNull();
  });

  it("affiche le fallback quand la permission est refusée", () => {
    setSession('reader');
    render(
      <RequirePermission
        capability="set_users"
        level="admin"
        fallback={<span>Accès restreint</span>}
      >
        <button>Action sensible</button>
      </RequirePermission>,
    );
    expect(screen.getByText('Accès restreint')).toBeDefined();
    expect(screen.queryByText('Action sensible')).toBeNull();
  });

  it("autorise tout en mode dev (pas de session)", () => {
    setSession(null);
    render(
      <RequirePermission capability="set_users" level="admin">
        <button>Action dev</button>
      </RequirePermission>,
    );
    expect(screen.getByText('Action dev')).toBeDefined();
  });
});

describe('<PermissionDeniedBanner>', () => {
  afterEach(() => cleanup());
  it("affiche la capability et le niveau requis", () => {
    const { container } = render(<PermissionDeniedBanner capability="set_users" required="admin" />);
    expect(screen.getByText(/Accès restreint/i)).toBeDefined();
    // L'élément <code> contient la capability
    const codeEl = container.querySelector('code');
    expect(codeEl?.textContent).toBe('set_users');
    // Le niveau requis est dans la prose
    expect(container.textContent).toMatch(/admin/);
  });
});

describe('usePagePermission — DeniedBanner integration', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
    sessionRef.current = null;
  });
  afterEach(() => {
    cleanup();
  });

  function TestPage({ capability }: { capability: string }) {
    const { canRead, DeniedBanner } = usePagePermission(capability);
    if (!canRead) return <DeniedBanner />;
    return <div data-testid="content">Contenu autorisé</div>;
  }

  it("rend le contenu pour admin", () => {
    setSession('admin');
    render(<TestPage capability="set_rooms" />);
    expect(screen.getByTestId('content')).toBeDefined();
  });

  it("rend le banner pour rôle sans read", () => {
    setSession('housekeeping');
    render(<TestPage capability="set_users" />);
    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByText(/Accès restreint/i)).toBeDefined();
  });

  it("housekeeping peut voir les chambres en lecture", () => {
    setSession('housekeeping');
    render(<TestPage capability="set_rooms" />);
    expect(screen.getByTestId('content')).toBeDefined();
  });
});
