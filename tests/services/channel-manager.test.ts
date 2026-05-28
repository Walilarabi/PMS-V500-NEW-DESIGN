/**
 * FLOWTYM — Channel Manager Service: no-random-failure guarantee.
 *
 * After setting simulatedFailureRate=0, pushToProvider must never throw
 * a simulated error regardless of how many times it is called.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist mocks before any imports ───────────────────────────────────────────

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));

// Fake localStorage to avoid JSDOM issues
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => Object.keys(store).forEach(k => delete store[k]),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

import {
  pushToProvider,
  clearHistory,
} from '@/src/services/channel-manager.service';

describe('channel-manager: simulatedFailureRate=0', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.keys(store).forEach(k => delete store[k]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushToProvider("D-EDGE") succeeds without any simulated failure', async () => {
    const payload = {
      date: '2026-06-01',
      roomTypeId: 'room-1',
      planId: 'plan-1',
      price: 150,
    };

    const pushPromise = pushToProvider('D-EDGE', payload);
    // Advance timers past simulated latency (350ms × 3 retries max)
    vi.advanceTimersByTime(2000);
    const record = await pushPromise;

    expect(record.status).toBe('success');
    expect(record.lastError).toBeUndefined();
  });

  it('pushToProvider succeeds over 50 consecutive calls without any random failure', async () => {
    const calls: Promise<ReturnType<typeof pushToProvider>>[] = [];
    for (let i = 0; i < 50; i++) {
      calls.push(pushToProvider('D-EDGE', {
        date: `2026-06-${String(i % 28 + 1).padStart(2, '0')}`,
        roomTypeId: 'room-1',
        planId: 'plan-1',
        price: 100 + i,
      }));
    }

    vi.advanceTimersByTime(5000);
    const results = await Promise.all(calls);

    const failed = results.filter(r => r.status === 'error');
    expect(failed).toHaveLength(0);
  });

  it('clearHistory empties the push history', async () => {
    clearHistory();
    // After clearing, getHistory should return an empty array
    const { getHistory } = await import('@/src/services/channel-manager.service');
    expect(getHistory()).toHaveLength(0);
  });
});
