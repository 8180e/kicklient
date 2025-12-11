interface KickAPIErrorOptions {
  message?: string;
  details?: unknown;
}

export class KickAPIError extends Error {
  readonly details;

  constructor({ message, details }: KickAPIErrorOptions) {
    super(message);
    this.details = details;
  }
}

export class KickBadRequestError extends KickAPIError {}
export class KickUnauthorizedError extends KickAPIError {}
export class KickForbiddenError extends KickAPIError {}
export class KickNotFoundError extends KickAPIError {}
export class KickTooManyRequestsError extends KickAPIError {}
export class KickInternalServerError extends KickAPIError {}
