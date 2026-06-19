/**
 * FLOWTYM — Helper de timeout pour appels Supabase / réseau.
 *
 * Garantit qu'aucune mutation utilisateur ne peut « mouliner indéfiniment » :
 * passé `ms` millisecondes, la promesse rejette avec un message clair que
 * l'UI peut afficher à l'utilisateur.
 *
 * Usage typique :
 *
 *   const { data, error } = await withTimeout(
 *     supabase.from('room_types').upsert(payload).select('id').maybeSingle(),
 *     15_000,
 *     'Sauvegarde de la chambre',
 *   );
 *
 * En cas de timeout, l'erreur retournée est une `TimeoutError` avec :
 *   - `name: 'TimeoutError'`
 *   - `message: '<label> a dépassé le délai (<ms>ms)…'`
 * pour que les couches supérieures puissent afficher un message explicite.
 */

export class TimeoutError extends Error {
  override name = 'TimeoutError';
  constructor(public label: string, public ms: number) {
    super(
      `${label} a dépassé le délai (${ms}ms). Vérifiez votre connexion ou réessayez. ` +
      `Si le problème persiste, contactez le support.`,
    );
  }
}

/**
 * Wrappe une promesse avec un timeout. Si la promesse ne se résout pas
 * dans le délai imparti, la promesse retournée rejette avec une
 * `TimeoutError`. La promesse originale n'est pas annulée (impossible
 * en JS) mais son résultat est ignoré côté caller.
 */
export function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms: number,
  label = 'Opération',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(label, ms));
    }, ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err)   => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Émet un toast de feedback utilisateur (succès / erreur / info).
 * Repose sur l'event bus déjà câblé dans l'app (`app-toast` → bridge
 * dans main.tsx vers le système toast()). Émet à la fois `type` (legacy)
 * et `variant` (mapping vers ToastVariant : success/destructive/default).
 */
export function emitToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  if (typeof window === 'undefined') return;
  const variant = type === 'success' ? 'success' : type === 'error' ? 'destructive' : 'default';
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type, variant } }));
}
