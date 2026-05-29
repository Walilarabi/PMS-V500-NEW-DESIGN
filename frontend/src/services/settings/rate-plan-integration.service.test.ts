/**
 * FLOWTYM — Tests de l'intégration des plans tarifaires importés.
 *
 * Couvre la suggestion de mapping (chambres + pensions) et la fonction
 * pure de validation. L'intégration `integrateRatePlans` n'est pas
 * testée ici car elle dépend du store rateCalendarStore — un test
 * d'intégration séparé serait nécessaire.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/src/components/rms/store/rateCalendarStore', () => ({
  useRateCalendarStore: { getState: () => ({ roomTypes: [], dateColumns: [] }) },
}));

import {
  suggestRoomMapping,
  suggestMealPlanMapping,
  suggestRoomMappingFromRows,
} from './rate-plan-integration.service';
import type { RoomTypeData } from '@/src/components/rms/types';

function makeRoom(id: string, name: string, code: string): RoomTypeData {
  return {
    internalId: 0,
    roomTypeId: id,
    roomTypeName: name,
    roomTypeCode: code,
    capacity: 2,
    bathroom: 'Douche',
    equipment: [],
    view: '',
    description: '',
    isReference: false,
    isActive: true,
    assignedRatePlanIds: [],
    distributionChannels: [],
    diffFromRef: 0,
    diffType: 'fixed',
    statuses: [],
    ratePlans: [],
  };
}

describe('suggestRoomMapping', () => {
  const rooms = [
    makeRoom('rt_std', 'Standard', 'STD'),
    makeRoom('rt_sup', 'Supérieure', 'SUP'),
    makeRoom('rt_jr', 'Junior Suite', 'JR'),
  ];

  it('matche les noms exacts', () => {
    const m = suggestRoomMapping(['Standard', 'Supérieure'], rooms);
    expect(m['Standard']).toBe('rt_std');
    expect(m['Supérieure']).toBe('rt_sup');
  });

  it('matche insensible à la casse / aux accents', () => {
    const m = suggestRoomMapping(['SUPERIEURE', 'standard'], rooms);
    expect(m['SUPERIEURE']).toBe('rt_sup');
    expect(m['standard']).toBe('rt_std');
  });

  it('matche les codes courts', () => {
    const m = suggestRoomMapping(['STD', 'JR'], rooms);
    expect(m['STD']).toBe('rt_std');
    expect(m['JR']).toBe('rt_jr');
  });

  it('ignore les libellés inconnus', () => {
    const m = suggestRoomMapping(['Penthouse'], rooms);
    expect(m['Penthouse']).toBeUndefined();
  });
});

describe('suggestMealPlanMapping', () => {
  it('détecte Room Only / sans petit-déjeuner', () => {
    const m = suggestMealPlanMapping(['Room only', 'Sans petit-déjeuner']);
    expect(m['Room only']).toBe('RO');
    expect(m['Sans petit-déjeuner']).toBe('RO');
  });

  it('détecte Bed & Breakfast / Petit-déjeuner', () => {
    const m = suggestMealPlanMapping(['Bed and breakfast', 'Petit-déjeuner inclus', 'B&B Premium']);
    expect(m['Bed and breakfast']).toBe('BB');
    expect(m['Petit-déjeuner inclus']).toBe('BB');
    expect(m['B&B Premium']).toBe('BB');
  });

  it('détecte Half board / Demi-pension', () => {
    const m = suggestMealPlanMapping(['Half board', 'Demi-pension']);
    expect(m['Half board']).toBe('HB');
    expect(m['Demi-pension']).toBe('HB');
  });

  it('détecte Full board / Pension complète', () => {
    const m = suggestMealPlanMapping(['Full board', 'Pension complète']);
    expect(m['Full board']).toBe('FB');
    expect(m['Pension complète']).toBe('FB');
  });

  it('détecte All inclusive', () => {
    const m = suggestMealPlanMapping(['All inclusive', 'Tout compris']);
    expect(m['All inclusive']).toBe('AI');
    expect(m['Tout compris']).toBe('AI');
  });

  it('détecte Package / Forfait', () => {
    const m = suggestMealPlanMapping(['Package weekend', 'Forfait spa']);
    expect(m['Package weekend']).toBe('Package');
    expect(m['Forfait spa']).toBe('Package');
  });

  it('fallback sur RO pour les libellés inconnus', () => {
    const m = suggestMealPlanMapping(['Unknown meal plan']);
    expect(m['Unknown meal plan']).toBe('RO');
  });
});

describe('suggestRoomMappingFromRows', () => {
  const rows = [
    { id: 'rt_std', room_type_code: 'STD', room_type_name: 'Standard' },
    { id: 'rt_sup', room_type_code: 'SUP', room_type_name: 'Supérieure' },
    { id: 'rt_jr', room_type_code: 'JR', room_type_name: 'Junior Suite' },
  ];

  it('matche les noms exacts', () => {
    const m = suggestRoomMappingFromRows(['Standard', 'Supérieure'], rows);
    expect(m['Standard']).toBe('rt_std');
    expect(m['Supérieure']).toBe('rt_sup');
  });

  it('matche insensible à la casse / aux accents', () => {
    const m = suggestRoomMappingFromRows(['SUPERIEURE', 'standard'], rows);
    expect(m['SUPERIEURE']).toBe('rt_sup');
    expect(m['standard']).toBe('rt_std');
  });

  it('matche par code de chambre', () => {
    const m = suggestRoomMappingFromRows(['STD', 'JR'], rows);
    expect(m['STD']).toBe('rt_std');
    expect(m['JR']).toBe('rt_jr');
  });

  it('matche le libellé contenant le nom de la chambre', () => {
    const m = suggestRoomMappingFromRows(['Standard Double', 'Supérieure Vue Mer'], rows);
    expect(m['Standard Double']).toBe('rt_std');
    expect(m['Supérieure Vue Mer']).toBe('rt_sup');
  });

  it('ignore les libellés inconnus (pas de clé dans le résultat)', () => {
    const m = suggestRoomMappingFromRows(['Penthouse'], rows);
    expect(m['Penthouse']).toBeUndefined();
  });

  it('retourne un objet vide pour un tableau vide de chambres', () => {
    const m = suggestRoomMappingFromRows(['Standard'], []);
    expect(Object.keys(m)).toHaveLength(0);
  });

  it('retourne un objet vide pour un tableau vide d\'entrées Excel', () => {
    const m = suggestRoomMappingFromRows([], rows);
    expect(Object.keys(m)).toHaveLength(0);
  });
});
