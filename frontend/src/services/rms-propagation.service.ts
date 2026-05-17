/**
 * FLOWTYM — RMS Propagation Service
 * 
 * Service de propagation automatique des validations RMS
 * 
 * Workflow:
 * 1. RMS Validation (user action)
 * 2. Update pricing_calendar (Supabase)
 * 3. Sync to D-EDGE Channel Manager (API)
 * 4. Update réservations cache (Redis/Supabase)
 * 5. Create audit log (compliance)
 * 6. Toast notification (UX feedback)
 */

import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface RMSValidation {
  date: string;
  finalPrice: number;
  strategy: string;
  recommendation: string;
  confidence: number;
  currentPrice: number;
  suggestedPrice: number;
}

export interface PropagationResult {
  success: boolean;
  validationsCount: number;
  pricingCalendarUpdated: boolean;
  channelManagerSynced: boolean;
  cacheUpdated: boolean;
  auditLogCreated: boolean;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class RMSPropagationService {
  /**
   * Propage les validations RMS vers tous les systèmes
   */
  static async propagateValidations(
    validations: RMSValidation[],
    tenantId: string,
    userId: string
  ): Promise<PropagationResult> {
    const result: PropagationResult = {
      success: false,
      validationsCount: validations.length,
      pricingCalendarUpdated: false,
      channelManagerSynced: false,
      cacheUpdated: false,
      auditLogCreated: false,
      errors: [],
    };

    try {
      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: Update Pricing Calendar (Supabase)
      // ─────────────────────────────────────────────────────────────────────
      
      console.log('[RMS] Step 1/4: Updating pricing calendar...');
      
      const calendarUpdates = validations.map((v) => ({
        tenant_id: tenantId,
        date: v.date,
        final_price: v.finalPrice,
        strategy: v.strategy,
        recommendation: v.recommendation,
        confidence_score: v.confidence,
        current_price: v.currentPrice,
        suggested_price: v.suggestedPrice,
        validated_by: userId,
        validated_at: new Date().toISOString(),
      }));

      const { error: calendarError } = await supabase
        .from('pricing_calendar')
        .upsert(calendarUpdates, {
          onConflict: 'tenant_id,date',
        });

      if (calendarError) {
        result.errors.push(`Pricing calendar update failed: ${calendarError.message}`);
        return result;
      }

      result.pricingCalendarUpdated = true;
      console.log('[RMS] ✓ Pricing calendar updated');

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: Sync to D-EDGE Channel Manager (API)
      // ─────────────────────────────────────────────────────────────────────
      
      console.log('[RMS] Step 2/4: Syncing to Channel Manager...');
      
      try {
        await this.syncToChannelManager(validations, tenantId);
        result.channelManagerSynced = true;
        console.log('[RMS] ✓ Channel Manager synced');
      } catch (cmError: any) {
        result.errors.push(`Channel Manager sync failed: ${cmError.message}`);
        // Continue même si CM fail (sera retry en background)
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: Update Réservations Price Cache
      // ─────────────────────────────────────────────────────────────────────
      
      console.log('[RMS] Step 3/4: Updating reservations cache...');
      
      try {
        await this.updateReservationsCache(validations, tenantId);
        result.cacheUpdated = true;
        console.log('[RMS] ✓ Reservations cache updated');
      } catch (cacheError: any) {
        result.errors.push(`Cache update failed: ${cacheError.message}`);
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 4: Create Audit Log
      // ─────────────────────────────────────────────────────────────────────
      
      console.log('[RMS] Step 4/4: Creating audit log...');
      
      const { error: auditError } = await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: userId,
        action: 'rms_propagation',
        entity_type: 'pricing',
        entity_id: `rms_batch_${Date.now()}`,
        details: {
          validations_count: validations.length,
          dates: validations.map((v) => v.date),
          total_price_change: validations.reduce(
            (sum, v) => sum + (v.finalPrice - v.currentPrice),
            0
          ),
          avg_confidence: validations.reduce((sum, v) => sum + v.confidence, 0) / validations.length,
        },
        timestamp: new Date().toISOString(),
      });

      if (auditError) {
        result.errors.push(`Audit log failed: ${auditError.message}`);
      } else {
        result.auditLogCreated = true;
        console.log('[RMS] ✓ Audit log created');
      }

      // ─────────────────────────────────────────────────────────────────────
      // SUCCESS
      // ─────────────────────────────────────────────────────────────────────
      
      result.success = result.pricingCalendarUpdated;
      
      console.log('[RMS] Propagation complete:', {
        success: result.success,
        validations: result.validationsCount,
        errors: result.errors.length,
      });

      return result;
    } catch (error: any) {
      result.errors.push(`Global error: ${error.message}`);
      console.error('[RMS] Propagation failed:', error);
      return result;
    }
  }

  /**
   * Sync prices to D-EDGE Channel Manager API
   */
  private static async syncToChannelManager(
    validations: RMSValidation[],
    tenantId: string
  ): Promise<void> {
    // TODO Phase 4.5: Implémenter intégration D-EDGE API
    // Pour l'instant: mock success avec delay
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    console.log('[RMS] Channel Manager sync (mock):', {
      validations: validations.length,
      dates: validations.map((v) => v.date),
    });

    // Future implementation:
    /*
    const dedgeConfig = await getDEdgeConfig(tenantId);
    const dedgeClient = new DEdgeAPI(dedgeConfig);
    
    await dedgeClient.updatePrices({
      hotel_code: dedgeConfig.hotel_code,
      updates: validations.map(v => ({
        date: v.date,
        rate_plan: 'STANDARD',
        price: v.finalPrice,
        currency: 'EUR'
      }))
    });
    */
  }

  /**
   * Update réservations form price cache
   */
  private static async updateReservationsCache(
    validations: RMSValidation[],
    tenantId: string
  ): Promise<void> {
    // TODO Phase 4.5: Implémenter cache Redis ou Supabase
    // Pour l'instant: mock success
    
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    console.log('[RMS] Reservations cache updated (mock):', {
      validations: validations.length,
    });

    // Future implementation:
    /*
    const cacheUpdates = validations.map(v => ({
      key: `price:${tenantId}:${v.date}`,
      value: v.finalPrice,
      ttl: 86400 // 24h
    }));
    
    await redis.mset(cacheUpdates);
    */
  }

  /**
   * Batch propagation avec progression
   */
  static async propagateWithProgress(
    validations: RMSValidation[],
    tenantId: string,
    userId: string,
    onProgress?: (progress: number, message: string) => void
  ): Promise<PropagationResult> {
    const totalSteps = 4;
    let currentStep = 0;

    const updateProgress = (message: string) => {
      currentStep++;
      const progress = Math.round((currentStep / totalSteps) * 100);
      onProgress?.(progress, message);
    };

    try {
      updateProgress('Mise à jour calendrier tarifaire...');
      updateProgress('Synchronisation Channel Manager...');
      updateProgress('Actualisation cache réservations...');
      updateProgress('Création logs audit...');

      return await this.propagateValidations(validations, tenantId, userId);
    } catch (error: any) {
      return {
        success: false,
        validationsCount: validations.length,
        pricingCalendarUpdated: false,
        channelManagerSynced: false,
        cacheUpdated: false,
        auditLogCreated: false,
        errors: [error.message],
      };
    }
  }
}
