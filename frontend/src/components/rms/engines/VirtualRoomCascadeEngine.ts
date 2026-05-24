/**
 * FLOWTYM RMS — Moteur de cascade pour chambres virtuelles.
 *
 * Une chambre virtuelle n'a pas d'inventaire propre : son stock vendable
 * dépend de l'inventaire de ses chambres physiques composantes.
 *
 * Formules :
 *   • mode 'all'  → V_inv = min(C_inv pour C ∈ composantes)
 *     (chaque vente de V consomme 1 unité de chaque composante)
 *   • mode 'any'  → V_inv = somme(C_inv pour C ∈ composantes)
 *     (chaque vente de V consomme 1 unité d'une seule composante)
 *
 * Le moteur est *pur* — il prend un état RoomTypeData[] en entrée et
 * retourne un nouvel état avec les inventaires virtuels recalculés.
 * Aucune mutation, aucun side-effect.
 */
import type { RoomTypeData, RoomStatus } from '../types';

/**
 * Recalcule l'inventaire d'une chambre virtuelle pour une date donnée
 * en fonction des composantes actuelles.
 */
export function computeVirtualInventoryForDate(
  virtualRoom: RoomTypeData,
  allRooms: RoomTypeData[],
  date: string,
): number {
  const composition = virtualRoom.virtualComposition;
  if (!composition || composition.componentRoomTypeIds.length === 0) {
    return virtualRoom.capacity;
  }
  const components = composition.componentRoomTypeIds
    .map((id) => allRooms.find((r) => r.roomTypeId === id))
    .filter((r): r is RoomTypeData => Boolean(r));

  if (components.length === 0) return 0;

  const inventories = components.map((c) => {
    const status = c.statuses.find((s) => s.date === date);
    return status?.inventory ?? c.capacity ?? 0;
  });

  if (composition.componentsRequired === 'all') {
    return Math.min(...inventories);
  }
  // 'any' → somme des composantes (stock cumulé)
  return inventories.reduce((s, v) => s + v, 0);
}

/**
 * Propage la cascade après mutation d'une chambre. Si la mutation
 * concerne une chambre physique, on met à jour toutes les chambres
 * virtuelles qui la contiennent. Si la mutation concerne une chambre
 * virtuelle, on diminue les inventaires des composantes en mode 'all'
 * (verrouillage de la composante au niveau de la virtuelle vendue).
 *
 * Retourne un nouveau tableau RoomTypeData[] (immutable).
 */
export function propagateVirtualRoomCascade(
  roomTypes: RoomTypeData[],
  mutatedRoomTypeId: string,
  date: string,
): RoomTypeData[] {
  const mutated = roomTypes.find((r) => r.roomTypeId === mutatedRoomTypeId);
  if (!mutated) return roomTypes;

  // Cas 1 : la mutation concerne une chambre virtuelle.
  //   → en mode 'all', cap les inventaires des composantes à V_inventory
  //     (on ne peut pas vendre plus de C que ce qui reste pour V)
  if (mutated.isVirtual && mutated.virtualComposition) {
    const composition = mutated.virtualComposition;
    if (composition.componentsRequired !== 'all') return roomTypes;
    const virtualStatus = mutated.statuses.find((s) => s.date === date);
    if (!virtualStatus) return roomTypes;
    const virtualInv = virtualStatus.inventory;

    return roomTypes.map((rt) => {
      if (!composition.componentRoomTypeIds.includes(rt.roomTypeId)) return rt;
      // Cap chaque composante à virtualInv (ne pas augmenter au-delà)
      const newStatuses = rt.statuses.map((s) => {
        if (s.date !== date) return s;
        if (s.inventory <= virtualInv) return s; // déjà cohérent
        return { ...s, inventory: virtualInv } as RoomStatus;
      });
      return { ...rt, statuses: newStatuses };
    });
  }

  // Cas 2 : la mutation concerne une chambre physique.
  //   → recalcule l'inventaire de toutes les virtuelles qui la composent
  const virtualsAffected = roomTypes.filter(
    (r) =>
      r.isVirtual &&
      r.virtualComposition?.componentRoomTypeIds.includes(mutatedRoomTypeId),
  );
  if (virtualsAffected.length === 0) return roomTypes;

  return roomTypes.map((rt) => {
    if (!rt.isVirtual) return rt;
    const isAffected = virtualsAffected.some((v) => v.roomTypeId === rt.roomTypeId);
    if (!isAffected) return rt;
    const newInv = computeVirtualInventoryForDate(rt, roomTypes, date);
    const newStatuses = rt.statuses.map((s) => {
      if (s.date !== date) return s;
      if (s.inventory === newInv) return s;
      return { ...s, inventory: newInv } as RoomStatus;
    });
    return { ...rt, statuses: newStatuses };
  });
}

/**
 * Recalcule l'inventaire virtuel pour TOUTES les dates et TOUTES les
 * chambres virtuelles. Utilisé au chargement initial ou après un
 * recalcul global (ex : import).
 */
export function rebuildAllVirtualInventories(roomTypes: RoomTypeData[]): RoomTypeData[] {
  const hasVirtual = roomTypes.some((r) => r.isVirtual);
  if (!hasVirtual) return roomTypes;

  return roomTypes.map((rt) => {
    if (!rt.isVirtual || !rt.virtualComposition) return rt;
    const newStatuses = rt.statuses.map((s) => {
      const newInv = computeVirtualInventoryForDate(rt, roomTypes, s.date);
      if (s.inventory === newInv) return s;
      return { ...s, inventory: newInv } as RoomStatus;
    });
    return { ...rt, statuses: newStatuses };
  });
}
