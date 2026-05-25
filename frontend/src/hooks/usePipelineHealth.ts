/**
 * FLOWTYM RMS — Hook usePipelineHealth
 *
 * Expose la santé du pipeline Market Intelligence sous forme d'un état
 * React réactif. S'abonne via `subscribePipelineHealth` et déclenche un
 * re-render à chaque nouveau run.
 */

import { useEffect, useState } from 'react';
import {
  getPipelineHealth,
  subscribePipelineHealth,
  type PipelineHealthSnapshot,
} from '../services/marketIntelligence/pipeline-monitoring.service';

export function usePipelineHealth(): PipelineHealthSnapshot {
  const [snapshot, setSnapshot] = useState<PipelineHealthSnapshot>(() => getPipelineHealth());

  useEffect(() => {
    return subscribePipelineHealth(() => {
      setSnapshot(getPipelineHealth());
    });
  }, []);

  return snapshot;
}
