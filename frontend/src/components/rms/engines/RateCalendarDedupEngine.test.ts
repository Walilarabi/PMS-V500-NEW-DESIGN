/**
 * FLOWTYM RMS — Tests du moteur de déduplication Calendrier tarifaire.
 *
 * Couvre le bug Phase 4 :
 *   "dédoublement Ouverture/Fermeture + 3 lignes tarifaires dupliquées
 *   pour un même plan tarifaire"
 */
import { describe, it, expect } from 'vitest';
import {
  dedupRatePlans, dedupRoomStatuses, dedupRoomType, dedupRoomTypes,
} from './RateCalendarDedupEngine';
import type { RatePlanData, RoomStatus, RoomTypeData } from '../types';

function plan(id: string, code: string, name = code): RatePlanData {
  return {
    internalId: 0,
    planId: id,
    planCode: code,
    planName: name,
    pensionType: 'RO',
    channelType: 'OTA',
    calcMode: 'fixed',
    calcValue: 0,
    referencePlanId: '',
    isReference: false,
    isActive: true,
    connectivityType: 'Aucun',
    isConnectivityLocked: false,
    assignedRoomTypeIds: [],
    distributionChannels: [],
    prices: [],
  };
}

function status(date: string, inventory: number, extras: Partial<RoomStatus> = {}): RoomStatus {
  return {
    date,
    status: 'open',
    label: '',
    inventory,
    capacity: inventory,
    sold: 0,
    override: null,
    minStay: null,
    maxStay: null,
    cta: false,
    ctd: false,
    ...extras,
  };
}

function room(overrides: Partial<RoomTypeData>): RoomTypeData {
  return {
    internalId: 0,
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

describe('dedupRatePlans', () => {
  it("ne touche pas une liste sans doublon", () => {
    const plans = [plan('p1', 'FLEX_RO'), plan('p2', 'NR_RO')];
    expect(dedupRatePlans(plans)).toHaveLength(2);
  });

  it("garde la dernière occurrence en cas de doublon planCode", () => {
    const plans = [
      plan('p1', 'FLEX_RO', 'Flex RO v1'),
      plan('p2', 'NR_RO'),
      plan('p3', 'FLEX_RO', 'Flex RO v2'), // doublon — gagne
    ];
    const r = dedupRatePlans(plans);
    expect(r).toHaveLength(2);
    const flex = r.find((p) => p.planCode === 'FLEX_RO');
    expect(flex?.planName).toBe('Flex RO v2');
  });

  it("normalise la casse + le trim pour la clé", () => {
    const plans = [
      plan('p1', '  flex_ro  '),
      plan('p2', 'FLEX_RO'),
    ];
    expect(dedupRatePlans(plans)).toHaveLength(1);
  });

  it("3 doublons → 1 seul gagnant", () => {
    const plans = [
      plan('p1', 'FLEX_RO'),
      plan('p2', 'FLEX_RO'),
      plan('p3', 'FLEX_RO'),
    ];
    expect(dedupRatePlans(plans)).toHaveLength(1);
  });

  it("ignore les plans sans planCode ni planId (≥2 items pour passer le shortcut)", () => {
    const plans = [plan('', ''), plan('', '')];
    expect(dedupRatePlans(plans)).toHaveLength(0);
  });

  it("conserve un seul item s'il est valide (≥2 items pour passer le shortcut)", () => {
    const plans = [plan('', ''), plan('p1', 'OK')];
    expect(dedupRatePlans(plans)).toHaveLength(1);
  });
});

describe('dedupRoomStatuses', () => {
  it("garde une seule entrée par date", () => {
    const statuses = [
      status('2026-06-01', 5),
      status('2026-06-02', 8),
      status('2026-06-01', 10), // doublon date
    ];
    const r = dedupRoomStatuses(statuses);
    expect(r).toHaveLength(2);
    expect(r.find((s) => s.date === '2026-06-01')?.inventory).toBe(10); // gagnant
  });

  it("trie par date ascendante en sortie", () => {
    const statuses = [
      status('2026-06-03', 5),
      status('2026-06-01', 5),
      status('2026-06-02', 5),
    ];
    const r = dedupRoomStatuses(statuses);
    expect(r.map((s) => s.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });

  it("préserve restrictionId / version du plus récent", () => {
    const statuses = [
      status('2026-06-01', 5, { restrictionId: 'r1', restrictionVersion: 1 }),
      status('2026-06-01', 5, { restrictionId: 'r2', restrictionVersion: 2 }),
    ];
    const r = dedupRoomStatuses(statuses);
    expect(r[0].restrictionId).toBe('r2');
    expect(r[0].restrictionVersion).toBe(2);
  });
});

describe('dedupRoomTypes', () => {
  it("fusionne deux RoomType avec le même code en concaténant + dédupliquant", () => {
    const rooms = [
      room({ roomTypeId: 'rt_1', roomTypeCode: 'STD', ratePlans: [plan('p1', 'FLEX_RO')] }),
      room({ roomTypeId: 'rt_2', roomTypeCode: 'STD', ratePlans: [plan('p2', 'NR_RO')] }),
    ];
    const r = dedupRoomTypes(rooms);
    expect(r).toHaveLength(1);
    expect(r[0].ratePlans).toHaveLength(2);
  });

  it("préserve l'ordre quand pas de doublons", () => {
    const rooms = [
      room({ roomTypeId: 'rt_a', roomTypeCode: 'A' }),
      room({ roomTypeId: 'rt_b', roomTypeCode: 'B' }),
    ];
    const r = dedupRoomTypes(rooms);
    expect(r[0].roomTypeCode).toBe('A');
    expect(r[1].roomTypeCode).toBe('B');
  });
});

describe('dedupRoomType — combiné plans + statuses', () => {
  it("dédupe les deux dimensions en un appel", () => {
    const rt = room({
      ratePlans: [plan('p1', 'FLEX_RO'), plan('p2', 'FLEX_RO')],
      statuses: [status('2026-06-01', 5), status('2026-06-01', 10)],
    });
    const r = dedupRoomType(rt);
    expect(r.ratePlans).toHaveLength(1);
    expect(r.statuses).toHaveLength(1);
  });

  it("retourne la même référence si aucun doublon", () => {
    const rt = room({
      ratePlans: [plan('p1', 'FLEX_RO')],
      statuses: [status('2026-06-01', 5)],
    });
    expect(dedupRoomType(rt)).toBe(rt);
  });
});
