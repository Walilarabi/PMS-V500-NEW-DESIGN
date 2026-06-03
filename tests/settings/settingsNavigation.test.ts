/**
 * FLOWTYM — Tests · Settings Navigation.
 */
import { describe, it, expect } from 'vitest';
import {
  SETTINGS_NAVIGATION, findDomainForPage, getDomainById,
  isSettingsPage, ALL_SETTINGS_PAGES,
} from '@/src/pages/settings/settingsNavigation';

describe('settingsNavigation', () => {
  it('contient les domaines transverses dans l\'ordre attendu', () => {
    // Ordre courant : les 10 domaines historiques + 2 domaines transverses
    // ajoutés ensuite (partners en distribution, communication en R-comm).
    const ids = SETTINGS_NAVIGATION.map((d) => d.id);
    expect(ids).toEqual([
      'establishment', 'inventory', 'pricing', 'partners', 'distribution',
      'reservations', 'communication', 'finance', 'housekeeping',
      'automation', 'security', 'integrations',
    ]);
  });

  it('inclut les 10 domaines obligatoires', () => {
    const ids = new Set(SETTINGS_NAVIGATION.map((d) => d.id));
    for (const required of [
      'establishment', 'inventory', 'pricing', 'distribution',
      'reservations', 'finance', 'housekeeping',
      'automation', 'security', 'integrations',
    ]) {
      expect(ids.has(required)).toBe(true);
    }
  });

  it('chaque domaine a au moins un sous-menu', () => {
    for (const d of SETTINGS_NAVIGATION) {
      expect(d.items.length).toBeGreaterThan(0);
    }
  });

  it('chaque sous-menu a une PageId valide', () => {
    for (const d of SETTINGS_NAVIGATION) {
      for (const it of d.items) {
        expect(it.id).toMatch(/^settings(_\w+)?$/);
        expect(it.label.length).toBeGreaterThan(0);
        expect(it.icon).toBeDefined();
      }
    }
  });

  it('findDomainForPage retrouve le bon domaine', () => {
    expect(findDomainForPage('settings_users').id).toBe('security');
    expect(findDomainForPage('settings_fiscal').id).toBe('finance');
    expect(findDomainForPage('settings_rooms').id).toBe('inventory');
    expect(findDomainForPage('settings_branding').id).toBe('establishment');
  });

  it('findDomainForPage retombe sur établissement si page inconnue', () => {
    expect(findDomainForPage('settings_unknown_xyz' as never).id).toBe('establishment');
  });

  it('getDomainById trouve un domaine connu', () => {
    expect(getDomainById('security')?.label).toBe('Sécurité & Administration');
  });

  it('getDomainById renvoie undefined pour id inconnu', () => {
    expect(getDomainById('xxx')).toBeUndefined();
  });

  it('isSettingsPage marque correctement les pages Settings', () => {
    expect(isSettingsPage('settings')).toBe(true);
    expect(isSettingsPage('settings_hotel')).toBe(true);
    expect(isSettingsPage('rev_dashboard' as never)).toBe(false);
  });

  it('ALL_SETTINGS_PAGES est unique et non vide', () => {
    expect(ALL_SETTINGS_PAGES.length).toBeGreaterThan(50);
    const set = new Set(ALL_SETTINGS_PAGES);
    expect(set.size).toBe(ALL_SETTINGS_PAGES.length);  // pas de doublons
  });
});
