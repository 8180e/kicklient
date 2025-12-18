import z from "zod";
import type { AppClientOptions, UserClientOptions } from "./client.js";
import { formatData, formatRequestBody } from "./utils.js";
import {
  KickAPIError,
  KickBadRequestError,
  KickForbiddenError,
  KickInternalServerError,
  KickNotFoundError,
  KickTooManyRequestsError,
  KickUnauthorizedError,
} from "./errors.js";
import type { KickOAuth, Scope } from "./auth.js";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  RequestSchema?: z.ZodType | undefined;
}

function extractData<T>(data: unknown, ResponseSchema: z.ZodType<T>) {
  return formatData(z.object({ data: ResponseSchema }), data).data;
}

interface RequestReturn {
  getData<T>(
    ResponseSchema: z.ZodType<T>
  ): Promise<ReturnType<typeof extractData<T>>>;
}

export abstract class KickAPIClient {
  constructor(
    private readonly auth: KickOAuth,
    protected readonly options: AppClientOptions | UserClientOptions
  ) {}

  protected requireScopes(...scopes: Scope[]) {
    const { options } = this;
    const isUserToken = options.tokenType === "user";
    if (
      isUserToken &&
      !scopes.every((scope) => options.scopes.includes(scope))
    ) {
      throw new KickAPIError({
        message:
          "Token does not have the required scopes to call this endpoint",
        details: { requiredScopes: scopes, tokenScopes: options.scopes },
      });
    }

    return {
      withUserToken() {
        if (!isUserToken) {
          throw new KickAPIError({
            message: "This endpoint requires a user access token",
          });
        }
      },
    };
  }

  private async request(
    endpoint: string,
    { method = "GET", body, RequestSchema }: RequestOptions = {},
    retry = false
  ): Promise<RequestReturn> {
    const requestBody = RequestSchema && formatRequestBody(RequestSchema, body);

    const res = await fetch(`https://api.kick.com/public/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const data = await res.json();
      const errorOptions = {
        details: { data, endpoint, requestBody },
      };
      switch (res.status) {
        case 400:
          throw new KickBadRequestError(errorOptions);
        case 401:
          if (retry) {
            if (this.options.tokenType === "app") {
              const tokenData = await this.auth.getAppAccessToken();
              this.options.accessToken = tokenData.accessToken;
              await this.options.onTokensRefreshed?.(tokenData);
            } else {
              if (!this.options.refreshToken) {
                throw new KickUnauthorizedError(errorOptions);
              }
              const tokenData = await this.auth.refreshToken(
                this.options.refreshToken
              );

              this.options.scopes = tokenData.scopes;
              this.options.accessToken = tokenData.accessToken;
              this.options.refreshToken = tokenData.refreshToken;
              await this.options.onTokensRefreshed?.(tokenData);
            }
            return this.request(
              endpoint,
              { method, body, RequestSchema },
              true
            );
          }
          throw new KickUnauthorizedError(errorOptions);
        case 403:
          throw new KickForbiddenError(errorOptions);
        case 404:
          throw new KickNotFoundError(errorOptions);
        case 429:
          if (!retry) {
            this.request(endpoint, { method, body, RequestSchema }, true);
          }
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

    return {
      async getData<T>(ResponseSchema: z.ZodType<T>) {
        if (res.status === 204) {
          throw new KickAPIError({
            message: "Response body does not include content",
          });
        }

        return extractData(await res.json(), ResponseSchema);
      },
    };
  }

  protected async get<T>(endpoint: string, ResponseSchema: z.ZodType<T>) {
    return (await this.request(endpoint)).getData(ResponseSchema);
  }

  protected post(endpoint: string, body: unknown, RequestSchema: z.ZodType) {
    return this.request(endpoint, { method: "POST", body, RequestSchema });
  }

  protected patch(endpoint: string, body: unknown, RequestSchema: z.ZodType) {
    return this.request(endpoint, { method: "PATCH", body, RequestSchema });
  }

  protected async delete(
    endpoint: string,
    body?: unknown,
    RequestSchema?: z.ZodType
  ) {
    await this.request(endpoint, { method: "DELETE", body, RequestSchema });
  }
}
