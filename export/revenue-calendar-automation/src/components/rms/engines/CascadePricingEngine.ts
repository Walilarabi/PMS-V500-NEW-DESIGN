import { CellStatus, RoomStatus, RoomTypeData } from "../types";
import { PricingRulesEngine } from "./PricingRulesEngine";

/**
 * Moteur de cascade des prix
 * Recalcule automatiquement tous les prix en cascade quand le prix de référence change
 */

export class CascadePricingEngine {
  private rulesEngine: PricingRulesEngine;

  constructor(rulesEngine: PricingRulesEngine) {
    this.rulesEngine = rulesEngine;
  }

  private getStatusLabel(status: CellStatus, override?: string | null): string {
    if (override === "force_open") return "Overbooking";
    if (override === "manual_closed") return "Fermé";
    if (status === "open") return "Disponible";
    if (status === "restricted") return "Restriction";
    if (status === "closed") return "Fermé";
    return "Non éditable";
  }

  private evaluateRoomStatus(status: RoomStatus): RoomStatus {
    let nextStatus: CellStatus = "open";

    if (status.cta || status.ctd || status.minStay || status.maxStay) {
      nextStatus = "restricted";
    }

    if ((status.inventory ?? 0) <= 0) {
      nextStatus = "closed";
    }

    if (status.override === "manual_closed") {
      nextStatus = "closed";
    }

    if (status.override === "force_open") {
      nextStatus = status.cta || status.ctd || status.minStay || status.maxStay ? "restricted" : "open";
    }

    return {
      ...status,
      status: nextStatus,
      label: this.getStatusLabel(nextStatus, status.override),
    };
  }

  private applyRoomStatusToPlans(roomType: RoomTypeData): RoomTypeData {
    return {
      ...roomType,
      ratePlans: roomType.ratePlans.map((plan) => ({
        ...plan,
        prices: plan.prices.map((price) => {
          const roomStatus = roomType.statuses.find((status) => status.date === price.date);
          if (!roomStatus) return price;

          if (roomStatus.cta || roomStatus.ctd || roomStatus.minStay || roomStatus.maxStay) {
            return { ...price, status: "restricted", blockReason: "Restriction de séjour" };
          }

          if (roomStatus.status === "closed") {
            return { ...price, status: "closed", blockReason: roomStatus.override === "manual_closed" ? "Fermeture manuelle" : "Inventaire nul" };
          }

          if (price.planClosed) {
            return { ...price, status: "closed", blockReason: "Plan fermé" };
          }

          return { ...price, status: "open", blockReason: undefined };
        }),
      })),
    };
  }

  /**
   * Met à jour un prix de référence et recalcule en cascade
   * Retourne les nouvelles données avec tous les prix recalculés
   */
  updateReferencePrice(
    roomTypes: RoomTypeData[],
    date: string,
    newPrice: number
  ): RoomTypeData[] {
    return roomTypes.map((roomType) => {
      const updatedRatePlans = roomType.ratePlans.map((plan) => {
        const updatedPrices = plan.prices.map((price) => {
          if (price.date !== date) return price;

          // Si c'est le plan de référence de la chambre de référence, on met à jour directement
          if (
            this.rulesEngine.isReferenceRoom(roomType.roomTypeId) &&
            this.rulesEngine.isReferencePlan(plan.planId)
          ) {
            return { ...price, price: newPrice };
          }

          // Sinon, recalculer en cascade
          const calculatedPrice = this.rulesEngine.calculatePrice(
            newPrice,
            roomType.roomTypeId,
            plan.planId
          );

          return { ...price, price: calculatedPrice };
        });

        return { ...plan, prices: updatedPrices };
      });

      return this.applyRoomStatusToPlans({ ...roomType, ratePlans: updatedRatePlans });
    });
  }

  /**
   * Met à jour un prix spécifique (non-référence) sans cascade
   */
  updateSpecificPrice(
    roomTypes: RoomTypeData[],
    roomTypeId: string,
    planId: string,
    date: string,
    newPrice: number
  ): RoomTypeData[] {
    return roomTypes.map((roomType) => {
      if (roomType.roomTypeId !== roomTypeId) return roomType;

      const updatedRatePlans = roomType.ratePlans.map((plan) => {
        if (plan.planId !== planId) return plan;

        const updatedPrices = plan.prices.map((price) => {
          if (price.date !== date) return price;
          return { ...price, price: newPrice };
        });

        return { ...plan, prices: updatedPrices };
      });

      return this.applyRoomStatusToPlans({ ...roomType, ratePlans: updatedRatePlans });
    });
  }

  updateReferenceRoomPlanPrice(
    roomTypes: RoomTypeData[],
    planId: string,
    date: string,
    newPrice: number
  ): RoomTypeData[] {
    return roomTypes.map((roomType) => {
      const ratePlans = roomType.ratePlans.map((plan) => {
        if (plan.planId !== planId) return plan;
        return {
          ...plan,
          prices: plan.prices.map((price) => {
            if (price.date !== date) return price;
            const priceForRoom = this.rulesEngine.isReferenceRoom(roomType.roomTypeId)
              ? newPrice
              : this.rulesEngine.calculateRoomOnlyPrice(newPrice, roomType.roomTypeId);
            return { ...price, price: priceForRoom };
          }),
        };
      });
      return this.applyRoomStatusToPlans({ ...roomType, ratePlans });
    });
  }

  /**
   * Recalcule tous les prix à partir des prix de référence actuels
   * Utile après un changement de règles
   */
  recalculateAllPrices(roomTypes: RoomTypeData[]): RoomTypeData[] {
    // Trouver les prix de référence par date
    const referenceRoom = roomTypes.find((rt) =>
      this.rulesEngine.isReferenceRoom(rt.roomTypeId)
    );

    if (!referenceRoom) return roomTypes;

    const referencePlan = referenceRoom.ratePlans.find((rp) =>
      this.rulesEngine.isReferencePlan(rp.planId)
    );

    if (!referencePlan) return roomTypes;

    const referencePricesByDate = new Map<string, number>();
    referencePlan.prices.forEach((p) => {
      referencePricesByDate.set(p.date, p.price);
    });

    return roomTypes.map((roomType) => {
      const updatedRatePlans = roomType.ratePlans.map((plan) => {
        const updatedPrices = plan.prices.map((price) => {
          const refPrice = referencePricesByDate.get(price.date);
          if (refPrice === undefined) return price;

          const calculatedPrice = this.rulesEngine.calculatePrice(
            refPrice,
            roomType.roomTypeId,
            plan.planId
          );

          return { ...price, price: calculatedPrice };
        });

        return { ...plan, prices: updatedPrices };
      });

      return this.applyRoomStatusToPlans({ ...roomType, ratePlans: updatedRatePlans });
    });
  }

  /**
   * Met à jour l'inventaire d'une chambre
   */
  updateInventory(
    roomTypes: RoomTypeData[],
    roomTypeId: string,
    date: string,
    newInventory: number
  ): RoomTypeData[] {
    return roomTypes.map((roomType) => {
      if (roomType.roomTypeId !== roomTypeId) return roomType;

      const updatedStatuses = roomType.statuses.map((status) => {
        if (status.date !== date) return status;
        const capacity = status.capacity ?? roomType.capacity ?? 0;
        const override = newInventory > capacity ? "force_open" : newInventory === 0 ? "manual_closed" : null;
        return this.evaluateRoomStatus({ ...status, inventory: newInventory, override });
      });

      return this.applyRoomStatusToPlans({ ...roomType, statuses: updatedStatuses });
    });
  }

  updateStayRestriction(
    roomTypes: RoomTypeData[],
    roomTypeId: string,
    date: string,
    field: "minStay" | "maxStay",
    value: number | null
  ): RoomTypeData[] {
    return roomTypes.map((roomType) => {
      if (roomType.roomTypeId !== roomTypeId) return roomType;
      const statuses = roomType.statuses.map((status) =>
        status.date === date ? this.evaluateRoomStatus({ ...status, [field]: value }) : status
      );
      return this.applyRoomStatusToPlans({ ...roomType, statuses });
    });
  }

  updateArrivalDepartureRestriction(
    roomTypes: RoomTypeData[],
    roomTypeId: string,
    date: string,
    field: "cta" | "ctd",
    value: boolean
  ): RoomTypeData[] {
    return roomTypes.map((roomType) => {
      if (roomType.roomTypeId !== roomTypeId) return roomType;
      const statuses = roomType.statuses.map((status) =>
        status.date === date ? this.evaluateRoomStatus({ ...status, [field]: value }) : status
      );
      return this.applyRoomStatusToPlans({ ...roomType, statuses });
    });
  }

  updatePlanRestriction(
    roomTypes: RoomTypeData[],
    roomTypeId: string,
    planId: string,
    date: string,
    closed: boolean
  ): RoomTypeData[] {
    return roomTypes.map((roomType) => {
      if (roomType.roomTypeId !== roomTypeId) return roomType;
      const ratePlans = roomType.ratePlans.map((plan) => {
        if (plan.planId !== planId) return plan;
        return {
          ...plan,
          prices: plan.prices.map((price) =>
            price.date === date ? { ...price, planClosed: closed } : price
          ),
        };
      });
      return this.applyRoomStatusToPlans({ ...roomType, ratePlans });
    });
  }

  /**
   * Met à jour le statut d'une chambre
   */
  updateStatus(
    roomTypes: RoomTypeData[],
    roomTypeId: string,
    date: string,
    newStatus: string,
    newLabel: string
  ): RoomTypeData[] {
    return roomTypes.map((roomType) => {
      if (roomType.roomTypeId !== roomTypeId) return roomType;

      const updatedStatuses = roomType.statuses.map((status) => {
        if (status.date !== date) return status;
        return this.evaluateRoomStatus({ ...status, status: newStatus as any, label: newLabel });
      });

      return this.applyRoomStatusToPlans({ ...roomType, statuses: updatedStatuses });
    });
  }
}
