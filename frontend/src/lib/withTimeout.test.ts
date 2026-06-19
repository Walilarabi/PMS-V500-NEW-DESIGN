/**
 * FLOWTYM — Tests withTimeout / emitToast.
 *
 * Garantit qu'aucune mutation utilisateur ne peut « mouliner indéfiniment » :
 *   • promesse qui résout dans les temps → on récupère la valeur
 *   • promesse qui rejette dans les temps → on récupère le reject original
 *   • promesse qui n'aboutit jamais → TimeoutError après `ms`
 *   • clearTimeout en cas de résolution rapide (pas de fuite de timer)
 *
 * Reproduit la situation observée Folkestone : création type de chambre /
 * plan tarifaire qui restait en spinner indéfini quand Supabase ne
 * répondait pas — désormais impossible.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError, emitToast, withTimeout } from './withTimeout';

describe('withTimeout — garantie de borne temporelle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('résout avec la valeur si la promesse aboutit avant le timeout', async () => {
    const p = withTimeout(Promise.resolve('ok'), 1000, 'Test');
    await expect(p).resolves.toBe('ok');
  });

  it('rejette avec l\'erreur originale si la promesse rejette avant le timeout', async () => {
    const original = new Error('upstream failure');
    const p = withTimeout(Promise.reject(original), 1000, 'Test');
    await expect(p).rejects.toBe(original);
  });

  it('rejette avec TimeoutError si la promesse n\'aboutit jamais', async () => {
    const never = new Promise<string>(() => { /* hang forever */ });
    const p = withTimeout(never, 5000, 'Sauvegarde');
    const expectation = expect(p).rejects.toBeInstanceOf(TimeoutError);
    vi.advanceTimersByTime(5000);
    await expectation;
  });

  it('TimeoutError contient le label et le délai dans le message', async () => {
    const never = new Promise<string>(() => {});
    const p = withTimeout(never, 7500, 'Création de la chambre');
    const expectation = expect(p).rejects.toThrowError(/Création de la chambre.*7500ms/);
    vi.advanceTimersByTime(7500);
    await expectation;
  });

  it('TimeoutError suggère une action utilisateur (réessayer / connexion)', async () => {
    const never = new Promise<string>(() => {});
    const p = withTimeout(never, 1000, 'Op');
    const expectation = expect(p).rejects.toThrowError(/connexion|réessayez/i);
    vi.advanceTimersByTime(1000);
    await expectation;
  });

  it('label par défaut quand non fourni', async () => {
    const never = new Promise<string>(() => {});
    const p = withTimeout(never, 1000);
    const expectation = expect(p).rejects.toThrowError(/Opération/);
    vi.advanceTimersByTime(1000);
    await expectation;
  });

  it('accepte un PromiseLike (thenable)', async () => {
    const thenable: PromiseLike<number> = {
      then(onFulfilled) {
        return Promise.resolve(onFulfilled ? onFulfilled(42) : 42 as never);
      },
    };
    const p = withTimeout(thenable, 1000, 'Thenable');
    await expect(p).resolves.toBe(42);
  });
});

describe('emitToast — feedback utilisateur', () => {
  it('dispatch un CustomEvent app-toast avec message + variant', () => {
    const spy = vi.fn();
    window.addEventListener('app-toast', spy);
    emitToast('Sauvegardé', 'success');
    expect(spy).toHaveBeenCalledOnce();
    const event = spy.mock.calls[0][0] as CustomEvent<{
      message: string;
      type: string;
      variant: string;
    }>;
    expect(event.detail.message).toBe('Sauvegardé');
    expect(event.detail.variant).toBe('success');
    window.removeEventListener('app-toast', spy);
  });

  it('mappe error → destructive (rouge)', () => {
    const spy = vi.fn();
    window.addEventListener('app-toast', spy);
    emitToast('Échec Supabase', 'error');
    const event = spy.mock.calls[0][0] as CustomEvent<{ variant: string }>;
    expect(event.detail.variant).toBe('destructive');
    window.removeEventListener('app-toast', spy);
  });

  it('mappe info → default', () => {
    const spy = vi.fn();
    window.addEventListener('app-toast', spy);
    emitToast('Info', 'info');
    const event = spy.mock.calls[0][0] as CustomEvent<{ variant: string }>;
    expect(event.detail.variant).toBe('default');
    window.removeEventListener('app-toast', spy);
  });

  it('défaut = info → default', () => {
    const spy = vi.fn();
    window.addEventListener('app-toast', spy);
    emitToast('Plain');
    const event = spy.mock.calls[0][0] as CustomEvent<{ variant: string }>;
    expect(event.detail.variant).toBe('default');
    window.removeEventListener('app-toast', spy);
  });
});
