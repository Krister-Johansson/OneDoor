// The errors services throw. Each has a stable `code` that clients can rely
// on. The message is safe to show a client; keep details for logs in `cause`.
export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL';

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION';
}

export class UpstreamUnavailableError extends DomainError {
  readonly code = 'UPSTREAM_UNAVAILABLE';
}

// An error with no domain meaning. Clients see only the fixed message; the
// original error is kept as `cause` for the log.
export class InternalError extends DomainError {
  readonly code = 'INTERNAL';

  constructor(options?: ErrorOptions) {
    super('Internal server error', options);
  }
}
