import { PricingRules, RoomPriceRule, PlanPriceRule } from "../types";

/**
 * Moteur de règles de pricing
 * Centralise toute la logique de différence entre chambres et plans tarifaires
 */

export class PricingRulesEngine {
  private rules: PricingRules;

  constructor(rules: PricingRules) {
    this.rules = rules;
  }

  /**
   * Calcule le prix d'une chambre et d'un plan à partir du prix de référence
   */
  calculatePrice(
    referencePrice: number,
    roomTypeId: string,
    planId: string
  ): number {
    // 1. Appliquer la règle de chambre
    const roomRule = this.rules.roomRules.find(
      (r) => r.roomTypeId === roomTypeId
    );
    let priceAfterRoom = referencePrice;

    if (roomRule && roomTypeId !== this.rules.referenceRoomTypeId) {
      priceAfterRoom = this.applyRule(referencePrice, roomRule);
    }

    // 2. Appliquer la règle de plan
    const planRule = this.rules.planRules.find((r) => r.planId === planId);
    let finalPrice = priceAfterRoom;

    if (planRule && planId !== this.rules.referencePlanId) {
      finalPrice = this.applyRule(priceAfterRoom, planRule);
    }

    return Math.round(finalPrice);
  }

  calculateRoomOnlyPrice(referenceRoomPrice: number, roomTypeId: string): number {
    const roomRule = this.rules.roomRules.find((r) => r.roomTypeId === roomTypeId);
    if (!roomRule || this.isReferenceRoom(roomTypeId)) return Math.round(referenceRoomPrice);
    return Math.round(this.applyRule(referenceRoomPrice, roomRule));
  }

  /**
   * Applique une règle de différence (fixe ou pourcentage)
   */
  private applyRule(
    basePrice: number,
    rule: RoomPriceRule | PlanPriceRule
  ): number {
    if (rule.diffType === "fixed") {
      return basePrice + rule.diffValue;
    } else {
      return basePrice * (1 + rule.diffValue / 100);
    }
  }

  /**
   * Vérifie si une chambre est la chambre de référence
   */
  isReferenceRoom(roomTypeId: string): boolean {
    return roomTypeId === this.rules.referenceRoomTypeId;
  }

  /**
   * Vérifie si un plan est le plan de référence
   */
  isReferencePlan(planId: string): boolean {
    return planId === this.rules.referencePlanId;
  }

  /**
   * Récupère la règle de chambre
   */
  getRoomRule(roomTypeId: string): RoomPriceRule | undefined {
    return this.rules.roomRules.find((r) => r.roomTypeId === roomTypeId);
  }

  /**
   * Récupère la règle de plan
   */
  getPlanRule(planId: string): PlanPriceRule | undefined {
    return this.rules.planRules.find((r) => r.planId === planId);
  }

  /**
   * Récupère la description textuelle des règles
   */
  getRuleDescription(roomTypeId: string, planId: string): string {
    const roomRule = this.getRoomRule(roomTypeId);
    const planRule = this.getPlanRule(planId);

    const parts: string[] = [];

    if (roomRule && !this.isReferenceRoom(roomTypeId)) {
      const sign = roomRule.diffValue >= 0 ? "+" : "";
      const suffix = roomRule.diffType === "percent" ? "%" : "€";
      parts.push(`${sign}${roomRule.diffValue}${suffix}`);
    }

    if (planRule && !this.isReferencePlan(planId)) {
      const sign = planRule.diffValue >= 0 ? "+" : "";
      const suffix = planRule.diffType === "percent" ? "%" : "€";
      parts.push(`${sign}${planRule.diffValue}${suffix}`);
    }

    return parts.length > 0 ? parts.join(" | ") : "Référence";
  }
}
