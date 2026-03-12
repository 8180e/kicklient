import type z from "zod";

const API_ERRORS = {
  400: "INVALID_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
} as const;

export class KickError extends Error {}

export class KickAPIError extends KickError {
  readonly type;

  constructor(readonly res: Response) {
    super();
    this.type =
      (
        API_ERRORS as Record<
          number,
          (typeof API_ERRORS)[keyof typeof API_ERRORS]
        >
      )[res.status] || ("UNKNOWN" as const);
  }
}

export class KickResponseShapeError extends KickError {
  constructor(readonly error: z.ZodError) {
    super();
  }
}
