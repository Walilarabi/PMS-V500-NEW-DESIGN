/**
 * FLOWTYM RMS — Tests du moteur de cascade chambres virtuelles.
 */
import { describe, it, expect } from 'vitest';
import {
  computeVirtualInventoryForDate,
  propagateVirtualRoomCascade,
  rebuildAllVirtualInventories,
} from './VirtualRoomCascadeEngine';
import type { RoomTypeData, RoomStatus } from '../types';

function makeStatus(date: string, inventory: number, capacity?: number): RoomStatus {
  return {
    date,
    status: 'open',
    label: 'Disponible',
    inventory,
    capacity: capacity ?? inventory,
    sold: 0,
    override: null,
    minStay: null,
    maxStay: null,
    cta: false,
    ctd: false,
  };
}

function makeRoom(overrides: Partial<RoomTypeData>): RoomTypeData {
  return {
    internalId: 1,
    roomTypeId: 'rt_std',
    roomTypeName: 'Standard',
    roomTypeCode: 'STD',
    capacity: 10,
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
    ...overrides,
  };
}

describe('computeVirtualInventoryForDate', () => {
  it("mode 'all' : retourne le min des composantes", () => {
    const date = '2026-06-01';
    const compA = makeRoom({ roomTypeId: 'rt_a', statuses: [makeStatus(date, 5)] });
    const compB = makeRoom({ roomTypeId: 'rt_b', statuses: [makeStatus(date, 8)] });
    const virtual = makeRoom({
      roomTypeId: 'rt_virt',
      isVirtual: true,
      virtualKind: 'adjacent',
      virtualComposition: { componentRoomTypeIds: ['rt_a', 'rt_b'], componentsRequired: 'all' },
      statuses: [makeStatus(date, 0)],
    });

    const inv = computeVirtualInventoryForDate(virtual, [compA, compB, virtual], date);
    expect(inv).toBe(5);
  });

  it("mode 'any' : retourne la somme des composantes", () => {
    const date = '2026-06-01';
    const compA = makeRoom({ roomTypeId: 'rt_a', statuses: [makeStatus(date, 5)] });
    const compB = makeRoom({ roomTypeId: 'rt_b', statuses: [makeStatus(date, 8)] });
    const virtual = makeRoom({
      roomTypeId: 'rt_virt',
      isVirtual: true,
      virtualKind: 'split_twin',
      virtualComposition: { componentRoomTypeIds: ['rt_a', 'rt_b'], componentsRequired: 'any' },
      statuses: [makeStatus(date, 0)],
    });

    const inv = computeVirtualInventoryForDate(virtual, [compA, compB, virtual], date);
    expect(inv).toBe(13);
  });

  it('retourne capacité si pas de composantes', () => {
    const v = makeRoom({ isVirtual: true, capacity: 7, statuses: [makeStatus('2026-06-01', 0)] });
    expect(computeVirtualInventoryForDate(v, [v], '2026-06-01')).toBe(7);
  });

  it('retourne 0 si toutes les composantes sont introuvables', () => {
    const v = makeRoom({
      isVirtual: true,
      virtualComposition: { componentRoomTypeIds: ['ghost_1'], componentsRequired: 'all' },
      statuses: [makeStatus('2026-06-01', 0)],
    });
    expect(computeVirtualInventoryForDate(v, [v], '2026-06-01')).toBe(0);
  });
});

describe('propagateVirtualRoomCascade — physique → virtuelle', () => {
  it("recalcule l'inventaire virtuel quand une composante change", () => {
    const date = '2026-06-01';
    const compA = makeRoom({ roomTypeId: 'rt_a', statuses: [makeStatus(date, 3)] }); // A vient d'être réduit
    const compB = makeRoom({ roomTypeId: 'rt_b', statuses: [makeStatus(date, 8)] });
    const virtual = makeRoom({
      roomTypeId: 'rt_virt',
      isVirtual: true,
      virtualKind: 'adjacent',
      virtualComposition: { componentRoomTypeIds: ['rt_a', 'rt_b'], componentsRequired: 'all' },
      statuses: [makeStatus(date, 10)], // état stale
    });

    const next = propagateVirtualRoomCascade([compA, compB, virtual], 'rt_a', date);
    const v = next.find((r) => r.roomTypeId === 'rt_virt')!;
    const newStatus = v.statuses.find((s) => s.date === date)!;
    expect(newStatus.inventory).toBe(3); // min(3, 8)
  });

  it("ne change rien si la chambre mutée n'est dans aucune virtuelle", () => {
    const date = '2026-06-01';
    const compA = makeRoom({ roomTypeId: 'rt_a', statuses: [makeStatus(date, 5)] });
    const other = makeRoom({ roomTypeId: 'rt_other', statuses: [makeStatus(date, 5)] });
    const next = propagateVirtualRoomCascade([compA, other], 'rt_other', date);
    expect(next).toEqual([compA, other]);
  });
});

describe('propagateVirtualRoomCascade — virtuelle → composantes (mode all)', () => {
  it("cap l'inventaire des composantes au niveau de la virtuelle", () => {
    const date = '2026-06-01';
    const compA = makeRoom({ roomTypeId: 'rt_a', statuses: [makeStatus(date, 10)] });
    const compB = makeRoom({ roomTypeId: 'rt_b', statuses: [makeStatus(date, 10)] });
    const virtual = makeRoom({
      roomTypeId: 'rt_virt',
      isVirtual: true,
      virtualKind: 'adjacent',
      virtualComposition: { componentRoomTypeIds: ['rt_a', 'rt_b'], componentsRequired: 'all' },
      statuses: [makeStatus(date, 4)], // 4 paires vendables → cap A et B à 4
    });

    const next = propagateVirtualRoomCascade([compA, compB, virtual], 'rt_virt', date);
    const a = next.find((r) => r.roomTypeId === 'rt_a')!;
    const b = next.find((r) => r.roomTypeId === 'rt_b')!;
    expect(a.statuses.find((s) => s.date === date)!.inventory).toBe(4);
    expect(b.statuses.find((s) => s.date === date)!.inventory).toBe(4);
  });

  it("ne propage pas en mode 'any'", () => {
    const date = '2026-06-01';
    const compA = makeRoom({ roomTypeId: 'rt_a', statuses: [makeStatus(date, 10)] });
    const virtual = makeRoom({
      roomTypeId: 'rt_virt',
      isVirtual: true,
      virtualKind: 'split_twin',
      virtualComposition: { componentRoomTypeIds: ['rt_a'], componentsRequired: 'any' },
      statuses: [makeStatus(date, 3)],
    });
    const next = propagateVirtualRoomCascade([compA, virtual], 'rt_virt', date);
    expect(next.find((r) => r.roomTypeId === 'rt_a')!.statuses[0].inventory).toBe(10);
  });
});

describe('rebuildAllVirtualInventories', () => {
  it("recalcule toutes les chambres virtuelles à toutes les dates", () => {
    const compA = makeRoom({
      roomTypeId: 'rt_a',
      statuses: [makeStatus('2026-06-01', 5), makeStatus('2026-06-02', 2)],
    });
    const compB = makeRoom({
      roomTypeId: 'rt_b',
      statuses: [makeStatus('2026-06-01', 8), makeStatus('2026-06-02', 10)],
    });
    const virtual = makeRoom({
      roomTypeId: 'rt_virt',
      isVirtual: true,
      virtualKind: 'adjacent',
      virtualComposition: { componentRoomTypeIds: ['rt_a', 'rt_b'], componentsRequired: 'all' },
      statuses: [makeStatus('2026-06-01', 0), makeStatus('2026-06-02', 0)],
    });

    const next = rebuildAllVirtualInventories([compA, compB, virtual]);
    const v = next.find((r) => r.roomTypeId === 'rt_virt')!;
    expect(v.statuses.find((s) => s.date === '2026-06-01')!.inventory).toBe(5);
    expect(v.statuses.find((s) => s.date === '2026-06-02')!.inventory).toBe(2);
  });

  it("no-op si aucune chambre virtuelle", () => {
    const compA = makeRoom({ roomTypeId: 'rt_a', statuses: [makeStatus('2026-06-01', 5)] });
    const next = rebuildAllVirtualInventories([compA]);
    expect(next).toBe(next); // référence renvoyée
  });
});
