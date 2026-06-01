/**
 * FLOWTYM — Domain errors.
 *
 * All domain failures inherit from DomainError. The application layer never
 * throws raw Error or rethrows Supabase errors. The mapping happens in the
 * repository layer.
 */

export class DomainError extends Error {
  public readonly code: string;
  public readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.cause = cause;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} with id "${id}" not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends DomainError {
  public readonly issues: ReadonlyArray<{ path: string; message: string }>;
  constructor(issues: ReadonlyArray<{ path: string; message: string }>) {
    super('VALIDATION_ERROR', 'Validation failed');
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export class InfrastructureError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super('INFRASTRUCTURE_ERROR', message, cause);
    this.name = 'InfrastructureError';
  }
}

export type CheckoutBlockedReason =
  | 'no_invoice'
  | 'draft_invoice_only'
  | 'voided_invoice_only'
  | 'balance_due'
  | 'invalid_status'
  | 'version_conflict'
  | 'not_found';

export class CheckoutBlockedError extends DomainError {
  public readonly reason: CheckoutBlockedReason;
  public readonly outstandingBalance?: number;

  constructor(reason: CheckoutBlockedReason, message: string, outstandingBalance?: number) {
    super('CHECKOUT_BLOCKED', message);
    this.name = 'CheckoutBlockedError';
    this.reason = reason;
    this.outstandingBalance = outstandingBalance;
  }

  /** Human-readable label for UI toasts / dialogs. */
  get label(): string {
    switch (this.reason) {
      case 'no_invoice':          return 'Facture manquante';
      case 'draft_invoice_only':  return 'Facture en brouillon';
      case 'voided_invoice_only': return 'Facture annulée';
      case 'balance_due':         return `Solde restant dû${this.outstandingBalance != null ? ` (${this.outstandingBalance} €)` : ''}`;
      case 'invalid_status':      return 'Statut invalide';
      case 'version_conflict':    return 'Conflit de version';
      case 'not_found':           return 'Réservation introuvable';
    }
  }
}

/** PostgrestError → DomainError mapping. */
export function mapSupabaseError(error: { code?: string; message: string; details?: string }): DomainError {
  if (!error) return new InfrastructureError('Unknown error');
  switch (error.code) {
    case 'PGRST116': // No rows returned for .single()
      return new NotFoundError('Resource', '?');
    case '23505': // unique_violation
      return new ConflictError(error.message);
    case '42501': // insufficient_privilege (RLS)
      return new ForbiddenError(error.message);
    default:
      return new InfrastructureError(error.message, error);
  }
}
