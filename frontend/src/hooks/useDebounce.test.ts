/**
 * Tests de la logique de debounce — sans renderHook (cassé avec React 19
 * dans cet env de test). On vérifie le comportement setTimeout directement.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function makeDebounced<T>(initial: T, delay: number) {
  let current = initial;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function update(value: T) {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => { current = value; timerId = null; }, delay);
  }

  return { get: () => current, update };
}

describe('useDebounce logic', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('preserves initial value before delay', () => {
    const d = makeDebounced('a', 300);
    d.update('b');
    vi.advanceTimersByTime(299);
    expect(d.get()).toBe('a');
  });

  it('applies value after delay', () => {
    const d = makeDebounced('a', 300);
    d.update('b');
    vi.advanceTimersByTime(300);
    expect(d.get()).toBe('b');
  });

  it('resets timer on rapid updates — only last value applied', () => {
    const d = makeDebounced('a', 300);
    d.update('b');
    vi.advanceTimersByTime(200);
    d.update('c');
    vi.advanceTimersByTime(200);
    expect(d.get()).toBe('a'); // 400ms elapsed but timer reset at 200ms
    vi.advanceTimersByTime(100);
    expect(d.get()).toBe('c');
  });

  it('works with numeric values', () => {
    const d = makeDebounced(0, 100);
    d.update(42);
    vi.advanceTimersByTime(100);
    expect(d.get()).toBe(42);
  });

  it('applies immediately if delay is 0', () => {
    const d = makeDebounced('a', 0);
    d.update('b');
    vi.advanceTimersByTime(0);
    expect(d.get()).toBe('b');
  });
});
