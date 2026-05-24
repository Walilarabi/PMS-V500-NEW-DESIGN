/**
 * FLOWTYM — Tests du hook useConfigBlob.
 *
 * Couvre la lecture localStorage, l'écriture, la fusion avec defaults
 * et la réconciliation Supabase.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));

// Stubs pour les fonctions Supabase (le hook les importe via le service)
const fetchSpy = vi.fn();
const syncSpy = vi.fn();
vi.mock('@/src/services/settings/settingsPersistence', () => ({
  syncConfigBlobToSupabase: (...args: unknown[]) => syncSpy(...args),
  fetchConfigBlobFromSupabase: (...args: unknown[]) => fetchSpy(...args),
}));

import { useConfigBlob } from './useConfigBlob';

interface TestConfig {
  name: string;
  count: number;
  flag?: boolean;
}

const DEFAULT: TestConfig = { name: 'default', count: 0, flag: false };

describe('useConfigBlob', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') window.localStorage.clear();
    fetchSpy.mockReset();
    syncSpy.mockReset();
    fetchSpy.mockResolvedValue(null);
    syncSpy.mockResolvedValue(true);
  });

  it("retourne le default si rien n'est persisté", async () => {
    const { result } = renderHook(() => useConfigBlob<TestConfig>('test_a', DEFAULT));
    expect(result.current[0]).toEqual(DEFAULT);
  });

  it("charge depuis le localStorage si présent", async () => {
    window.localStorage.setItem(
      'flowtym.cfg.test_b',
      JSON.stringify({ name: 'persisté', count: 42 }),
    );
    const { result } = renderHook(() => useConfigBlob<TestConfig>('test_b', DEFAULT));
    expect(result.current[0].name).toBe('persisté');
    expect(result.current[0].count).toBe(42);
    expect(result.current[0].flag).toBe(false); // merge avec default
  });

  it("écrit dans le localStorage à chaque update", async () => {
    const { result } = renderHook(() => useConfigBlob<TestConfig>('test_c', DEFAULT));
    act(() => {
      result.current[1]({ name: 'updated', count: 99, flag: true });
    });
    const raw = window.localStorage.getItem('flowtym.cfg.test_c');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).count).toBe(99);
  });

  it("supporte la forme fonctionnelle (prev => next)", () => {
    const { result } = renderHook(() => useConfigBlob<TestConfig>('test_d', { ...DEFAULT, count: 5 }));
    act(() => {
      result.current[1]((prev) => ({ ...prev, count: prev.count + 10 }));
    });
    expect(result.current[0].count).toBe(15);
  });

  it("appelle syncConfigBlobToSupabase à chaque update", () => {
    const { result } = renderHook(() => useConfigBlob<TestConfig>('test_e', DEFAULT));
    act(() => {
      result.current[1]({ name: 'sync_test', count: 1 });
    });
    expect(syncSpy).toHaveBeenCalledWith('test_e', expect.objectContaining({ name: 'sync_test' }));
  });

  it("réconcilie depuis Supabase au mount si data distante existe", async () => {
    fetchSpy.mockResolvedValue({ name: 'from_remote', count: 7, flag: true });
    const { result } = renderHook(() => useConfigBlob<TestConfig>('test_f', DEFAULT));
    await waitFor(() => {
      expect(result.current[0].name).toBe('from_remote');
      expect(result.current[2].remoteReady).toBe(true);
    });
  });

  it("merge defaults + remote (champs manquants côté remote = defaults)", async () => {
    fetchSpy.mockResolvedValue({ name: 'partiel' });
    const { result } = renderHook(() =>
      useConfigBlob<TestConfig>('test_g', { ...DEFAULT, count: 99 }),
    );
    await waitFor(() => {
      expect(result.current[0].name).toBe('partiel');
      // count manquait côté remote → default préservé
      expect(result.current[0].count).toBe(99);
    });
  });

  it("expose le flag syncing pendant le fetch initial", async () => {
    fetchSpy.mockImplementation(() => new Promise((r) => setTimeout(() => r(null), 50)));
    const { result } = renderHook(() => useConfigBlob<TestConfig>('test_h', DEFAULT));
    expect(result.current[2].syncing).toBe(true);
    await waitFor(() => expect(result.current[2].syncing).toBe(false));
  });
});
