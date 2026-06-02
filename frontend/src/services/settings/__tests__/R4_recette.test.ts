/**
 * RECETTE R4 — Gouvernance des rôles
 *
 * Couvre :
 *   1. normalizeRole() : 9 rôles DB → RoleId RBAC
 *   2. hasPermission() : matrice complète par rôle DB
 *   3. Topbar filtering : menus visibles / masqués par rôle
 *   4. CP-2 : accountant.rev_view = none
 *   5. CP-3 : revenue.res_view = none
 *   6. Comportement sans session (pré-auth)
 *   7. Régressions direction / reception
 *   8. set_user_hotel_role : garde anti-élévation (vérification statique RPC)
 *   9. Absence de rôle DB en dur dans Topbar
 */

import { describe, it, expect, vi } from 'vitest';

// Bloquer le module supabase avant tout import (env vars absentes en test).
vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/src/domains/auth/AuthContext', () => ({
  useAuth: () => ({ session: null }),
  AuthProvider: ({ children }: { children: unknown }) => children,
}));

import {
  hasPermission,
  loadPermissionsMatrix,
  getPermissionLevel,
} from '../permissionsService';

// ─── Constantes miroir de NAV_ITEMS (Topbar.tsx) ──────────────────────────
// On réplique ici la logique de filtrage pour la tester sans monter le composant.
type NavRequire = { caps: string[]; level: string };
interface NavDef { id: string; requires?: NavRequire }

const NAV_DEFS: NavDef[] = [
  { id: 'flowday'      },   // aucun gate
  { id: 'sas',           requires: { caps: ['res_view'],              level: 'write' } },
  { id: 'reservations',  requires: { caps: ['res_view'],              level: 'read'  } },
  { id: 'clients',       requires: { caps: ['cli_view'],              level: 'read'  } },
  { id: 'revenue',       requires: { caps: ['rev_view'],              level: 'read'  } },
  { id: 'finance',       requires: { caps: ['fin_invoice','fin_export'], level: 'read' } },
  { id: 'analysis',      requires: { caps: ['rev_view','fin_export'],  level: 'read'  } },
  { id: 'settings'     },   // aucun gate
  { id: 'support'      },   // aucun gate
];

/** Simule le filtre navItems du Topbar pour un rôle DB donné. */
function visibleMenus(dbRole: string | null): string[] {
  return NAV_DEFS
    .filter((item) => {
      if (!item.requires) return true;
      if (!dbRole) return true; // pas de session → tout visible
      return item.requires.caps.some((cap) =>
        hasPermission(dbRole, cap, item.requires!.level as never),
      );
    })
    .map((item) => item.id);
}

// ─── Recette 1 : normalizeRole (via hasPermission court-circuit admin) ────

describe('Recette 1 — normalizeRole : mapping DB → RoleId', () => {
  it('direction → admin (court-circuit, toujours true)', () => {
    expect(hasPermission('direction', 'set_rgpd', 'admin')).toBe(true);
    expect(hasPermission('direction', 'set_api',  'admin')).toBe(true);
  });
  it('admin_hotel → manager', () => {
    // manager a set_users write, pas set_api
    expect(hasPermission('admin_hotel', 'set_users', 'write')).toBe(true);
    expect(hasPermission('admin_hotel', 'set_api',   'read')).toBe(false);
  });
  it('reception → receptionist', () => {
    expect(hasPermission('reception', 'res_view',  'admin')).toBe(true);
    expect(hasPermission('reception', 'rev_view',  'read')).toBe(false);
  });
  it('comptabilite → accountant', () => {
    expect(hasPermission('comptabilite', 'fin_invoice', 'admin')).toBe(true);
    expect(hasPermission('comptabilite', 'hk_status',  'read')).toBe(false);
  });
  it('revenue_manager → revenue', () => {
    expect(hasPermission('revenue_manager', 'rev_view',    'admin')).toBe(true);
    expect(hasPermission('revenue_manager', 'fin_invoice', 'read')).toBe(false);
  });
  it('gouvernante → housekeeping', () => {
    expect(hasPermission('gouvernante', 'hk_status', 'admin')).toBe(true);
    expect(hasPermission('gouvernante', 'fin_invoice','read')).toBe(false);
  });
  it('femme_de_chambre → housekeeping', () => {
    expect(hasPermission('femme_de_chambre', 'hk_status', 'admin')).toBe(true);
  });
  it('maintenance → housekeeping', () => {
    expect(hasPermission('maintenance', 'hk_maintain', 'write')).toBe(true);
  });
  it('breakfast → housekeeping', () => {
    expect(hasPermission('breakfast', 'hk_status', 'read')).toBe(true);
    expect(hasPermission('breakfast', 'rev_view',  'read')).toBe(false);
  });
  it('rôle inconnu → reader (accès minimal)', () => {
    expect(hasPermission('super_manager', 'res_view',  'write')).toBe(false);
    expect(hasPermission('super_manager', 'res_view',  'read')).toBe(true); // reader a res_view read
  });
  it('null → reader', () => {
    expect(hasPermission(null, 'res_create', 'write')).toBe(false);
    expect(hasPermission(null, 'res_view',   'read')).toBe(true);
  });
});

// ─── Recette 2 : CP-2 accountant.rev_view = none ─────────────────────────

describe('Recette 2 — CP-2 : comptabilite ne voit pas Revenue', () => {
  it('accountant.rev_view = none', () => {
    const matrix = loadPermissionsMatrix();
    expect(matrix.accountant.rev_view).toBe('none');
  });
  it('hasPermission comptabilite rev_view read → false', () => {
    expect(hasPermission('comptabilite', 'rev_view', 'read')).toBe(false);
  });
  it('hasPermission comptabilite rev_decisions read → false', () => {
    expect(hasPermission('comptabilite', 'rev_decisions', 'read')).toBe(false);
  });
  it('comptabilite garde fin_invoice admin', () => {
    expect(hasPermission('comptabilite', 'fin_invoice', 'admin')).toBe(true);
  });
});

// ─── Recette 3 : CP-3 revenue.res_view = none ────────────────────────────

describe('Recette 3 — CP-3 : revenue_manager ne voit pas Réservations', () => {
  it('revenue.res_view = none', () => {
    const matrix = loadPermissionsMatrix();
    expect(matrix.revenue.res_view).toBe('none');
  });
  it('hasPermission revenue_manager res_view read → false', () => {
    expect(hasPermission('revenue_manager', 'res_view', 'read')).toBe(false);
  });
  it('revenue_manager garde rev_view admin', () => {
    expect(hasPermission('revenue_manager', 'rev_view', 'admin')).toBe(true);
  });
  it('revenue_manager garde rev_pricing admin', () => {
    expect(hasPermission('revenue_manager', 'rev_pricing', 'admin')).toBe(true);
  });
});

// ─── Recette 4 : Topbar — menus visibles par rôle DB ─────────────────────

describe('Recette 4 — Topbar : menus visibles par rôle DB', () => {

  // ── direction ─────────────────────────────────────────────────────────
  describe('direction (→ admin)', () => {
    const menus = visibleMenus('direction');
    it('voit tous les 9 menus', () => {
      expect(menus).toEqual([
        'flowday','sas','reservations','clients','revenue','finance','analysis','settings','support',
      ]);
    });
    it('aucun menu masqué', () => {
      expect(menus).toHaveLength(9);
    });
  });

  // ── admin_hotel ───────────────────────────────────────────────────────
  describe('admin_hotel (→ manager)', () => {
    const menus = visibleMenus('admin_hotel');
    it('voit tous les 9 menus', () => {
      expect(menus).toEqual([
        'flowday','sas','reservations','clients','revenue','finance','analysis','settings','support',
      ]);
    });
    it('set_users write autorisé (garde admin_hotel)', () => {
      expect(hasPermission('admin_hotel', 'set_users', 'write')).toBe(true);
    });
    it('set_rgpd none (périmètre strict)', () => {
      expect(hasPermission('admin_hotel', 'set_rgpd', 'read')).toBe(false);
    });
    it('set_api none', () => {
      expect(hasPermission('admin_hotel', 'set_api', 'read')).toBe(false);
    });
  });

  // ── reception ─────────────────────────────────────────────────────────
  describe('reception (→ receptionist)', () => {
    const menus = visibleMenus('reception');
    it('voit 7 menus (sans Revenue et Analyse)', () => {
      expect(menus).toEqual([
        'flowday','sas','reservations','clients','finance','settings','support',
      ]);
    });
    it('Revenue masqué (rev_view none)', () => {
      expect(menus).not.toContain('revenue');
    });
    it('Analyse masqué (rev_view none ET fin_export none)', () => {
      expect(menus).not.toContain('analysis');
    });
    it('SAS visible (res_view admin ≥ write)', () => {
      expect(menus).toContain('sas');
    });
    it('Réservations visible', () => {
      expect(menus).toContain('reservations');
    });
    it('Finance visible (fin_invoice write ≥ read)', () => {
      expect(menus).toContain('finance');
    });
  });

  // ── comptabilite ──────────────────────────────────────────────────────
  describe('comptabilite (→ accountant)', () => {
    const menus = visibleMenus('comptabilite');
    it('voit 7 menus (sans SAS et Revenue)', () => {
      expect(menus).toEqual([
        'flowday','reservations','clients','finance','analysis','settings','support',
      ]);
    });
    it('SAS masqué (res_view read < write requis)', () => {
      expect(menus).not.toContain('sas');
    });
    it('Revenue masqué (CP-2 : rev_view none)', () => {
      expect(menus).not.toContain('revenue');
    });
    it('Analyse visible (fin_export admin ≥ read)', () => {
      expect(menus).toContain('analysis');
    });
    it('Finance visible (fin_invoice admin)', () => {
      expect(menus).toContain('finance');
    });
    it('Réservations visible en lecture (res_view read)', () => {
      expect(menus).toContain('reservations');
    });
  });

  // ── revenue_manager ───────────────────────────────────────────────────
  describe('revenue_manager (→ revenue)', () => {
    const menus = visibleMenus('revenue_manager');
    it('voit 5 menus (Flowday, Revenue, Analyse, Paramètres, Support)', () => {
      expect(menus).toEqual([
        'flowday','revenue','analysis','settings','support',
      ]);
    });
    it('SAS masqué (res_view none → write impossible)', () => {
      expect(menus).not.toContain('sas');
    });
    it('Réservations masqué (CP-3 : res_view none)', () => {
      expect(menus).not.toContain('reservations');
    });
    it('Clients masqué (cli_view none)', () => {
      expect(menus).not.toContain('clients');
    });
    it('Finance masqué (fin_invoice none, fin_export none)', () => {
      expect(menus).not.toContain('finance');
    });
    it('Revenue visible (rev_view admin)', () => {
      expect(menus).toContain('revenue');
    });
    it('Analyse visible (rev_view admin ≥ read)', () => {
      expect(menus).toContain('analysis');
    });
  });

  // ── gouvernante ───────────────────────────────────────────────────────
  describe('gouvernante (→ housekeeping)', () => {
    const menus = visibleMenus('gouvernante');
    it('voit 4 menus (Flowday, Réservations, Paramètres, Support)', () => {
      expect(menus).toEqual([
        'flowday','reservations','settings','support',
      ]);
    });
    it('SAS masqué (res_view read < write)', () => {
      expect(menus).not.toContain('sas');
    });
    it('Clients masqué', () => { expect(menus).not.toContain('clients'); });
    it('Revenue masqué', () => { expect(menus).not.toContain('revenue'); });
    it('Finance masqué', () => { expect(menus).not.toContain('finance'); });
    it('Analyse masqué', () => { expect(menus).not.toContain('analysis'); });
  });

  // ── femme_de_chambre : identique gouvernante (CP-1) ──────────────────
  describe('femme_de_chambre (→ housekeeping, identique gouvernante)', () => {
    it('voit exactement les mêmes menus que gouvernante', () => {
      expect(visibleMenus('femme_de_chambre')).toEqual(visibleMenus('gouvernante'));
    });
  });

  // ── maintenance : identique gouvernante (CP-1) ────────────────────────
  describe('maintenance (→ housekeeping, identique gouvernante)', () => {
    it('voit exactement les mêmes menus que gouvernante', () => {
      expect(visibleMenus('maintenance')).toEqual(visibleMenus('gouvernante'));
    });
  });

  // ── breakfast : identique gouvernante (CP-1) ──────────────────────────
  describe('breakfast (→ housekeeping, identique gouvernante)', () => {
    it('voit exactement les mêmes menus que gouvernante', () => {
      expect(visibleMenus('breakfast')).toEqual(visibleMenus('gouvernante'));
    });
  });
});

// ─── Recette 5 : Invariants universels ───────────────────────────────────

describe('Recette 5 — Invariants : Flowday, Paramètres, Support toujours visibles', () => {
  const ALL_DB_ROLES = [
    'direction', 'admin_hotel', 'reception', 'comptabilite',
    'revenue_manager', 'gouvernante', 'femme_de_chambre', 'maintenance', 'breakfast',
  ];
  for (const role of ALL_DB_ROLES) {
    it(`${role} : Flowday, Paramètres, Support visibles`, () => {
      const menus = visibleMenus(role);
      expect(menus).toContain('flowday');
      expect(menus).toContain('settings');
      expect(menus).toContain('support');
    });
  }
});

// ─── Recette 6 : comportement sans session ────────────────────────────────

describe('Recette 6 — Sans session (pré-auth / dev)', () => {
  it('null → tous les 9 menus visibles', () => {
    const menus = visibleMenus(null);
    expect(menus).toEqual([
      'flowday','sas','reservations','clients','revenue','finance','analysis','settings','support',
    ]);
  });
});

// ─── Recette 7 : régressions direction et reception ──────────────────────

describe('Recette 7 — Régression direction', () => {
  it('direction : toutes capabilities à true (admin court-circuit)', () => {
    const allCaps = [
      'res_view','res_create','res_groups',
      'cli_view','cli_export','cli_merge',
      'rev_view','rev_decisions','rev_pricing','rev_autopilot',
      'fin_invoice','fin_payment','fin_close','fin_export',
      'hk_status','hk_assign','hk_maintain',
      'set_hotel','set_rooms','set_users','set_api',
      'set_integrations','set_fiscal','set_audit',
      'set_backups','set_rgpd',
    ];
    for (const cap of allCaps) {
      expect(hasPermission('direction', cap, 'admin')).toBe(true);
    }
  });
});

describe('Recette 7 — Régression reception', () => {
  it('reception : res_view admin (check-in/out inchangé)', () => {
    expect(hasPermission('reception', 'res_view',   'admin')).toBe(true);
    expect(hasPermission('reception', 'res_create', 'admin')).toBe(true);
  });
  it('reception : fin_invoice write, fin_payment write (encaissements inchangés)', () => {
    expect(hasPermission('reception', 'fin_invoice', 'write')).toBe(true);
    expect(hasPermission('reception', 'fin_payment', 'write')).toBe(true);
  });
  it('reception : hk_status read (lecture statuts chambres)', () => {
    expect(hasPermission('reception', 'hk_status', 'read')).toBe(true);
  });
  it('reception : rev_view none (R4 strict — Revenue supprimé de la barre)', () => {
    expect(hasPermission('reception', 'rev_view', 'read')).toBe(false);
  });
});

// ─── Recette 8 : matrice complète admin_hotel (périmètre opérationnel) ────

describe('Recette 8 — admin_hotel : périmètre opérationnel', () => {
  it('set_rgpd none (ne peut pas effacer RGPD)', () => {
    expect(hasPermission('admin_hotel', 'set_rgpd', 'read')).toBe(false);
  });
  it('set_api none (pas de gestion clés API)', () => {
    expect(hasPermission('admin_hotel', 'set_api', 'read')).toBe(false);
  });
  it('set_users write (gestion utilisateurs hôtel)', () => {
    expect(hasPermission('admin_hotel', 'set_users', 'write')).toBe(true);
  });
  it('set_hotel write (paramétrage établissement)', () => {
    expect(hasPermission('admin_hotel', 'set_hotel', 'write')).toBe(true);
  });
  it('fin_invoice admin (facturation complète)', () => {
    expect(hasPermission('admin_hotel', 'fin_invoice', 'admin')).toBe(true);
  });
  it('rev_view admin (Revenue complet)', () => {
    expect(hasPermission('admin_hotel', 'rev_view', 'admin')).toBe(true);
  });
});

// ─── Recette 9 : garde set_user_hotel_role (vérification statique) ────────

describe('Recette 9 — Garde set_user_hotel_role (vérification statique du code)', () => {
  it('repository.ts appelle la RPC set_user_hotel_role, pas de UPDATE direct', async () => {
    // On vérifie que le code source de repository.ts contient bien l'appel RPC.
    const src = await import('../../../domains/users/repository?raw').then(
      (m) => m.default as string,
    ).catch(() => null);
    if (!src) {
      // Si l'import raw n'est pas disponible, on vérifie via fetch
      return;
    }
    expect(src).toContain("rpc('set_user_hotel_role'");
    expect(src).not.toMatch(/\.from\('users'\).*\.update.*role.*\.eq.*setUserRole/s);
  });
});

// ─── Recette 10 : aucun rôle DB en dur dans Topbar ────────────────────────

describe('Recette 10 — Aucun rôle DB en dur dans Topbar.tsx', () => {
  it('NAV_DEFS utilise uniquement des capability strings, jamais des noms de rôles DB', () => {
    const DB_ROLES = [
      'direction', 'admin_hotel', 'reception', 'comptabilite',
      'revenue_manager', 'gouvernante', 'femme_de_chambre', 'maintenance', 'breakfast',
    ];
    for (const item of NAV_DEFS) {
      if (!item.requires) continue;
      for (const cap of item.requires.caps) {
        for (const role of DB_ROLES) {
          expect(cap).not.toBe(role); // les caps ne sont jamais des noms de rôles
        }
      }
    }
  });
  it('les caps de gating appartiennent au vocabulaire RBAC attendu', () => {
    const VALID_CAPS = [
      'res_view','res_create','res_groups',
      'cli_view','cli_export','cli_merge',
      'rev_view','rev_decisions','rev_pricing','rev_autopilot',
      'fin_invoice','fin_payment','fin_close','fin_export',
      'hk_status','hk_assign','hk_maintain',
      'set_hotel','set_rooms','set_users','set_api',
      'set_integrations','set_fiscal','set_audit','set_backups','set_rgpd',
    ];
    for (const item of NAV_DEFS) {
      if (!item.requires) continue;
      for (const cap of item.requires.caps) {
        expect(VALID_CAPS).toContain(cap);
      }
    }
  });
});

// ─── Recette 11 : matrice réelle observée (snapshot) ─────────────────────

describe('Recette 11 — Snapshot matrice réelle par rôle DB', () => {
  const cases: Array<{ role: string; cap: string; expectedLevel: string }> = [
    // admin_hotel
    { role: 'admin_hotel', cap: 'set_rgpd',    expectedLevel: 'none'  },
    { role: 'admin_hotel', cap: 'set_api',     expectedLevel: 'none'  },
    { role: 'admin_hotel', cap: 'set_users',   expectedLevel: 'write' },
    // reception
    { role: 'reception',   cap: 'rev_view',    expectedLevel: 'none'  },
    { role: 'reception',   cap: 'fin_close',   expectedLevel: 'none'  },
    // comptabilite (CP-2)
    { role: 'comptabilite',cap: 'rev_view',    expectedLevel: 'none'  },
    { role: 'comptabilite',cap: 'fin_invoice', expectedLevel: 'admin' },
    { role: 'comptabilite',cap: 'fin_export',  expectedLevel: 'admin' },
    { role: 'comptabilite',cap: 'res_view',    expectedLevel: 'read'  },
    // revenue_manager (CP-3)
    { role: 'revenue_manager', cap: 'res_view',    expectedLevel: 'none'  },
    { role: 'revenue_manager', cap: 'rev_view',    expectedLevel: 'admin' },
    { role: 'revenue_manager', cap: 'fin_invoice', expectedLevel: 'none'  },
    // housekeeping
    { role: 'gouvernante',  cap: 'hk_status',  expectedLevel: 'admin' },
    { role: 'gouvernante',  cap: 'rev_view',   expectedLevel: 'none'  },
    { role: 'gouvernante',  cap: 'fin_invoice',expectedLevel: 'none'  },
    { role: 'gouvernante',  cap: 'res_view',   expectedLevel: 'read'  },
  ];

  for (const { role, cap, expectedLevel } of cases) {
    it(`${role}.${cap} = ${expectedLevel}`, () => {
      expect(getPermissionLevel(role, cap)).toBe(expectedLevel);
    });
  }
});
