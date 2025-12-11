import z from "zod";
import type { AppClientOptions, UserClientOptions } from "./client.js";
import { formatData } from "./utils.js";
import {
  KickAPIError,
  KickBadRequestError,
  KickForbiddenError,
  KickInternalServerError,
  KickNotFoundError,
  KickTooManyRequestsError,
  KickUnauthorizedError,
} from "./errors.js";
import type { KickOAuth } from "./auth.js";

const ResponseSchema = z.object({ data: z.unknown() });

export abstract class KickAPIClient {
  private readonly baseUrl = "https://api.kick.com/public/v1";

  constructor(
    private readonly auth: KickOAuth,
    private readonly options: AppClientOptions | UserClientOptions
  ) {}

  private async request(
    endpoint: string,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: unknown,
    retry = false
  ): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        ...(method === "GET" || method === "DELETE"
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const errorOptions = { details: { data, endpoint } };

    if (res.status === 401 && !retry) {
      if (this.options.tokenType === "app") {
        this.options.accessToken = (
          await this.auth.getAppAccessToken()
        ).accessToken;
      } else {
        if (!this.options.refreshToken) {
          throw new KickUnauthorizedError(errorOptions);
        }
        const { scopes, accessToken, refreshToken } =
          await this.auth.refreshToken(this.options.refreshToken);

        this.options.scopes = scopes;
        this.options.accessToken = accessToken;
        this.options.refreshToken = refreshToken;
      }
      return this.request(endpoint, method, body, true);
    }

    if (!res.ok) {
      switch (res.status) {
        case 400:
          throw new KickBadRequestError(errorOptions);
        case 401:
          throw new KickUnauthorizedError(errorOptions);
        case 403:
          throw new KickForbiddenError(errorOptions);
        case 404:
          throw new KickNotFoundError(errorOptions);
        case 429:
          throw new KickTooManyRequestsError(errorOptions);
        case 500:
          throw new KickInternalServerError(errorOptions);
        default:
          throw new KickAPIError({
            message: "An unexpected API error occured",
            details: { status: res.status, data },
          });
      }
    }

    return formatData(ResponseSchema, data).data;
  }

  protected get(endpoint: string) {
    return this.request(endpoint, "GET");
  }

  protected post(endpoint: string, body?: unknown) {
    return this.request(endpoint, "POST", body);
  }

  protected patch(endpoint: string, body?: unknown) {
    return this.request(endpoint, "PATCH", body);
  }
}
