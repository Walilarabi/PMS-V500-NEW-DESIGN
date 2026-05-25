/**
 * FLOWTYM RMS — Tests Pipeline Monitoring Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPipelineHealth,
  logPipelineRun,
  resetPipelineMonitoring,
  startPipelineRun,
  subscribePipelineHealth,
  withRetry,
} from './pipeline-monitoring.service';

beforeEach(() => {
  resetPipelineMonitoring();
});

describe('startPipelineRun', () => {
  it('enregistre un run avec sa durée', () => {
    const stop = startPipelineRun('full');
    stop({ metrics: { snapshotCount: 365 } });
    const health = getPipelineHealth();
    expect(health.runs).toHaveLength(1);
    expect(health.runs[0].stage).toBe('full');
    expect(health.runs[0].status).toBe('ok');
    expect(health.runs[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(health.runs[0].metrics?.snapshotCount).toBe(365);
  });

  it('permet de marquer un run en failed', () => {
    const stop = startPipelineRun('supabase_sync');
    stop({ status: 'failed', error: 'Network timeout' });
    const health = getPipelineHealth();
    expect(health.runs[0].status).toBe('failed');
    expect(health.runs[0].error).toBe('Network timeout');
    expect(health.errorRate).toBe(1);
  });
});

describe('logPipelineRun', () => {
  it('enregistre un run préfabriqué', () => {
    logPipelineRun({
      stage: 'compression',
      startedAt: '2026-06-01T10:00:00Z',
      durationMs: 42,
      status: 'ok',
    });
    expect(getPipelineHealth().runs).toHaveLength(1);
  });
});

describe('getPipelineHealth — médiane', () => {
  it('calcule la médiane des runs full réussis', () => {
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:00:00Z', durationMs: 100, status: 'ok' });
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:01:00Z', durationMs: 200, status: 'ok' });
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:02:00Z', durationMs: 150, status: 'ok' });
    const health = getPipelineHealth();
    expect(health.medianFullDurationMs).toBe(150);
  });

  it('ignore les failed pour la médiane', () => {
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:00:00Z', durationMs: 100, status: 'ok' });
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:01:00Z', durationMs: 9999, status: 'failed', error: 'X' });
    expect(getPipelineHealth().medianFullDurationMs).toBe(100);
  });
});

describe('getPipelineHealth — error rate', () => {
  it('calcule le ratio failed / total', () => {
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:00:00Z', durationMs: 100, status: 'ok' });
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:01:00Z', durationMs: 100, status: 'ok' });
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:02:00Z', durationMs: 100, status: 'failed', error: 'X' });
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:03:00Z', durationMs: 100, status: 'failed', error: 'X' });
    expect(getPipelineHealth().errorRate).toBe(0.5);
  });

  it('error rate 0 si aucun run', () => {
    expect(getPipelineHealth().errorRate).toBe(0);
  });
});

describe('getPipelineHealth — last full duration', () => {
  it('expose la durée du dernier run full', () => {
    logPipelineRun({ stage: 'compression', startedAt: '2026-06-01T10:00:00Z', durationMs: 20, status: 'ok' });
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:01:00Z', durationMs: 180, status: 'ok' });
    expect(getPipelineHealth().lastFullDurationMs).toBe(180);
  });
});

describe('subscribePipelineHealth', () => {
  it('notifie les abonnés sur chaque run', () => {
    let count = 0;
    const unsub = subscribePipelineHealth(() => { count++; });
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:00:00Z', durationMs: 100, status: 'ok' });
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:01:00Z', durationMs: 100, status: 'ok' });
    expect(count).toBe(2);
    unsub();
    logPipelineRun({ stage: 'full', startedAt: '2026-06-01T10:02:00Z', durationMs: 100, status: 'ok' });
    expect(count).toBe(2); // unsubscribed
  });
});

describe('withRetry', () => {
  it('retry sur erreur et succède au 3ème essai', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'ok';
    }, 3, 1); // baseDelay 1ms pour test rapide
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('lance l\'erreur après le nombre max de tentatives', async () => {
    let attempts = 0;
    await expect(withRetry(async () => {
      attempts++;
      throw new Error('persistent');
    }, 3, 1)).rejects.toThrow('persistent');
    expect(attempts).toBe(3);
  });

  it('renvoie immédiatement la valeur si succès dès le 1er essai', async () => {
    const result = await withRetry(async () => 'first', 3, 1);
    expect(result).toBe('first');
  });
});

describe('cap à MAX_RUNS', () => {
  it('garde au max 60 runs', () => {
    for (let i = 0; i < 75; i++) {
      logPipelineRun({
        stage: 'full',
        startedAt: new Date(Date.now() + i).toISOString(),
        durationMs: i,
        status: 'ok',
      });
    }
    expect(getPipelineHealth().runs.length).toBe(60);
  });
});
