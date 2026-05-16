// ─── D-EDGE Channel Manager Connectivity ──────────────────────────────────────
// Stub pour la connectivité avec D-EDGE (RateGain)
// En production, ces fonctions appelleraient l'API D-EDGE

import { RoomTypeData, RatePlanData } from "../types";

interface DEdgePayload {
  hotelId: string;
  roomTypeId?: string;
  ratePlanId?: string;
  date: string;
  action: "update_rate" | "update_inventory" | "update_restriction" | "push_all";
  value?: number;
  restriction?: "minStay" | "maxStay" | "cta" | "ctd";
  restrictionValue?: number | boolean;
}

interface DEdgeResponse {
  success: boolean;
  messageId: string;
  timestamp: string;
  errors?: string[];
}

// Configuration D-EDGE
const DEDGE_CONFIG = {
  apiUrl: "https://api.d-edge.com/v1",
  hotelId: "HOTEL_001", // À configurer
  apiKey: "", // Clé API D-EDGE
  enabled: false, // Activer/désactiver la sync
};

/**
 * Pousse une modification vers D-EDGE
 */
export async function pushToDEdge(payload: DEdgePayload): Promise<DEdgeResponse> {
  if (!DEDGE_CONFIG.enabled) {
    console.log("[D-EDGE] Sync désactivée - modification locale uniquement");
    return { success: true, messageId: "local_only", timestamp: new Date().toISOString() };
  }

  try {
    // En production: appel réel à l'API D-EDGE
    // const response = await fetch(`${DEDGE_CONFIG.apiUrl}/inventory`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Authorization": `Bearer ${DEDGE_CONFIG.apiKey}`,
    //     "X-Hotel-ID": DEDGE_CONFIG.hotelId,
    //   },
    //   body: JSON.stringify(payload),
    // });
    // return await response.json();

    // Simulation pour démo
    await new Promise(r => setTimeout(r, 300));
    console.log("[D-EDGE] Push:", payload);
    return {
      success: true,
      messageId: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[D-EDGE] Erreur de synchronisation:", error);
    return {
      success: false,
      messageId: "error",
      timestamp: new Date().toISOString(),
      errors: ["Échec de la synchronisation D-EDGE"],
    };
  }
}

/**
 * Pousse toutes les modifications d'un type de chambre
 */
export async function pushRoomToDEdge(room: RoomTypeData, date: string): Promise<DEdgeResponse[]> {
  const results: DEdgeResponse[] = [];

  for (const status of room.statuses) {
    if (status.date === date) {
      results.push(await pushToDEdge({
        hotelId: DEDGE_CONFIG.hotelId,
        roomTypeId: room.roomTypeId,
        date,
        action: "update_inventory",
        value: status.inventory,
      }));

      if (status.minStay !== null) {
        results.push(await pushToDEdge({
          hotelId: DEDGE_CONFIG.hotelId,
          roomTypeId: room.roomTypeId,
          date,
          action: "update_restriction",
          restriction: "minStay",
          restrictionValue: status.minStay,
        }));
      }
    }
  }

  for (const plan of room.ratePlans) {
    const price = plan.prices.find(p => p.date === date);
    if (price) {
      results.push(await pushToDEdge({
        hotelId: DEDGE_CONFIG.hotelId,
        roomTypeId: room.roomTypeId,
        ratePlanId: plan.planId,
        date,
        action: "update_rate",
        value: price.price,
      }));
    }
  }

  return results;
}

/**
 * Vérifie si un tarif est verrouillé par D-EDGE
 */
export function isRateLockedByDEdge(plan: RatePlanData): boolean {
  return plan.connectivityType === "D-EDGE" && plan.isConnectivityLocked;
}

/**
 * Déverrouille un tarif D-EDGE (nécessite déliaison préalable)
 */
export async function unlockDERate(planId: string): Promise<boolean> {
  if (!DEDGE_CONFIG.enabled) return true;

  // En production: appel API pour délier le tarif
  console.log("[D-EDGE] Demande de déliaison pour:", planId);
  await new Promise(r => setTimeout(r, 500));
  return true;
}
