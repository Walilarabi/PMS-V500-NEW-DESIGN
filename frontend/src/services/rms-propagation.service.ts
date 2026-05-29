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
      // STEP 1: Update Pricing Calendar (Supabase)
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

      // STEP 2: Sync to D-EDGE Channel Manager (not yet integrated — skipped)
      try {
        await this.syncToChannelManager(validations, tenantId);
        result.channelManagerSynced = true;
      } catch (cmError: unknown) {
        // Expected until D-EDGE integration is configured — not a fatal error
        result.errors.push(`Channel Manager: ${cmError instanceof Error ? cmError.message : String(cmError)}`);
      }

      // STEP 3: Update Reservations Cache (not yet integrated — skipped)
      try {
        await this.updateReservationsCache(validations, tenantId);
        result.cacheUpdated = true;
      } catch (cacheError: unknown) {
        result.errors.push(`Cache: ${cacheError instanceof Error ? cacheError.message : String(cacheError)}`);
      }

      // STEP 4: Create Audit Log
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
      }

      result.success = result.pricingCalendarUpdated;
      return result;
    } catch (error: unknown) {
      result.errors.push(`Global error: ${error instanceof Error ? error.message : String(error)}`);
      console.error('[RMS] Propagation failed:', error);
      return result;
    }
  }

  /**
   * Sync prices to D-EDGE Channel Manager API
   * TODO Phase 4.5: implement D-EDGE REST API integration
   */
  private static async syncToChannelManager(
    _validations: RMSValidation[],
    _tenantId: string
  ): Promise<void> {
    // Not yet implemented — throws so channelManagerSynced stays false
    throw new Error('D-EDGE Channel Manager integration not yet configured');
  }

  /**
   * Update reservations price cache after propagation
   * TODO Phase 4.5: implement Redis/Supabase cache invalidation
   */
  private static async updateReservationsCache(
    _validations: RMSValidation[],
    _tenantId: string
  ): Promise<void> {
    // Not yet implemented — throws so cacheUpdated stays false
    throw new Error('Reservations cache update not yet implemented');
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
