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

async function getResponseData<T>(res: Response, ResponseSchema: z.ZodType<T>) {
  if (res.status === 204) {
    throw new KickAPIError({
      message: "Response body does not include content",
    });
  }

  return formatData(z.object({ data: ResponseSchema }), await res.json()).data;
}

export abstract class KickAPIClient {
  constructor(
    private readonly auth: KickOAuth,
    protected readonly options: AppClientOptions | UserClientOptions
  ) {}

  private async request(
    endpoint: string,
    method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
    body?: unknown,
    retry = false
  ): Promise<Response> {
    const res = await fetch(`https://api.kick.com/public/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        ...(method === "GET" || method === "DELETE"
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      const errorOptions = { details: { data, endpoint } };
      switch (res.status) {
        case 400:
          throw new KickBadRequestError(errorOptions);
        case 401:
          if (retry) {
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
            message: "An unexpected API error occurred",
            details: { status: res.status, data },
          });
      }
    }

    return res;
  }

  protected async get<T>(endpoint: string, ResponseSchema: z.ZodType<T>) {
    return getResponseData(await this.request(endpoint), ResponseSchema);
  }

  protected post(endpoint: string, body: unknown) {
    return this.request(endpoint, "POST", body);
  }

  protected async postWithResponseData<T>(
    endpoint: string,
    body: unknown,
    ResponseSchema: z.ZodType<T>
  ) {
    return getResponseData(await this.post(endpoint, body), ResponseSchema);
  }

  protected patch(endpoint: string, body: unknown) {
    return this.request(endpoint, "PATCH", body);
  }

  protected async patchWithResponseData<T>(
    endpoint: string,
    body: unknown,
    ResponseSchema: z.ZodType<T>
  ) {
    return getResponseData(await this.patch(endpoint, body), ResponseSchema);
  }

  protected async delete(endpoint: string) {
    await this.request(endpoint, "DELETE");
  }
}
