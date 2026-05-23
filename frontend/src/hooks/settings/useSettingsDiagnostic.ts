/**
 * FLOWTYM — Hook React pour le diagnostic Control Center.
 *
 * - Première exécution au mount (rapport instantané).
 * - Recalcule à chaque changement des stores critiques (configStore,
 *   eventsStore, rateCalendarStore) — le tableau reste vivant.
 * - Expose un `rerun()` manuel + l'état `running` pour le bouton
 *   "Lancer diagnostic PMS" (animation loader).
 */
import { useCallback, useEffect, useState } from 'react';
import type { DiagnosticReport } from '@/src/types/settings/diagnostic';
import { runDiagnostic } from '@/src/services/settings/settingsDiagnosticEngine';
import { logAudit } from '@/src/services/settings/settingsAuditLogger';
import { useConfigStore } from '@/src/store/configStore';
import { useEventsStore } from '@/src/store/eventsStore';
import { useRateCalendarStore } from '@/src/components/rms/store/rateCalendarStore';

export function useSettingsDiagnostic() {
  const [report, setReport] = useState<DiagnosticReport>(() => runDiagnostic());
  const [running, setRunning] = useState(false);

  // Auto-recalcul à chaque changement de stores
  const cfgVersion = useConfigStore((s) => `${s.hotel.name}|${s.rooms.length}|${s.users.length}|${s.channels.length}|${s.taxes.hebergement}|${s.taxes.fb}|${s.taxes.sejour}|${s.pricingRules.length}`);
  const evtVersion = useEventsStore((s) => `${s.events.length}|${s.sources.filter((x) => x.active).length}|${s.syncLogs.length}`);
  const calVersion = useRateCalendarStore((s) => `${s.roomTypes.length}|${s.roomTypes.reduce((a, r) => a + (r.ratePlans?.length ?? 0), 0)}`);

  useEffect(() => {
    setReport(runDiagnostic());
  }, [cfgVersion, evtVersion, calVersion]);

  /**
   * Diagnostic manuel : déclenche un délai court (UX loader) puis
   * recalcule et journalise. Utilisé par le bouton "Lancer diagnostic PMS".
   */
  const rerun = useCallback(async () => {
    setRunning(true);
    await new Promise<void>((res) => setTimeout(res, 600));
    const r = runDiagnostic();
    setReport(r);
    logAudit({
      action: 'diagnostic_run',
      detail: `Score système ${r.scores.system_health.value}/100 · ${r.alerts.length} alerte(s)`,
    });
    setRunning(false);
    return r;
  }, []);

  return { report, running, rerun };
}
