import z from "zod";
import type { AppClientOptions, UserClientOptions } from "./client.js";
import { formatData, parseSchema } from "./utils.js";
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
import decamelizeKeys from "decamelize-keys";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  requiredScopes?: Scope[] | undefined;
  requireUserToken?: boolean | undefined;
  RequestSchema?: z.ZodType | undefined;
}

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
    {
      method = "GET",
      body,
      requiredScopes,
      requireUserToken,
      RequestSchema,
    }: RequestOptions = {},
    retry = false
  ): Promise<Response> {
    const { options } = this;
    if (
      (requireUserToken && options.tokenType !== "user") ||
      (requiredScopes &&
        options.tokenType === "user" &&
        !requiredScopes.every((scope) => options.scopes.includes(scope)))
    ) {
      throw new KickAPIError({
        message: "You don't have enough permissions to use this API",
        details: {
          requiredScopes,
          tokenType: options.tokenType,
          tokenScopes:
            options.tokenType === "user" ? options.scopes : undefined,
        },
      });
    }

    const reqBody = RequestSchema
      ? parseSchema(RequestSchema, body, "Request body is invalid")
      : body;

    const res = await fetch(`https://api.kick.com/public/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        ...(method === "GET" || method === "DELETE"
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: JSON.stringify(reqBody && decamelizeKeys(reqBody)),
    });

    if (!res.ok) {
      const data = await res.json();
      const errorOptions = {
        details: { data, endpoint, requestBody: reqBody },
      };
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
            return this.request(
              endpoint,
              { method, body, requiredScopes, requireUserToken, RequestSchema },
              true
            );
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

  protected async get<T>(
    endpoint: string,
    ResponseSchema: z.ZodType<T>,
    requireUserToken?: boolean,
    requiredScopes?: Scope[]
  ) {
    return getResponseData(
      await this.request(endpoint, { requireUserToken, requiredScopes }),
      ResponseSchema
    );
  }

  protected post(
    endpoint: string,
    body: unknown,
    RequestSchema: z.ZodType,
    requireUserToken?: boolean,
    requiredScopes?: Scope[]
  ) {
    return this.request(endpoint, {
      method: "POST",
      body,
      requireUserToken,
      requiredScopes,
      RequestSchema,
    });
  }

  protected async postWithResponseData<T>(
    endpoint: string,
    body: unknown,
    RequestSchema: z.ZodType,
    ResponseSchema: z.ZodType<T>,
    requireUserToken?: boolean,
    requiredScopes?: Scope[]
  ) {
    return getResponseData(
      await this.post(
        endpoint,
        body,
        RequestSchema,
        requireUserToken,
        requiredScopes
      ),
      ResponseSchema
    );
  }

  protected patch(
    endpoint: string,
    body: unknown,
    RequestSchema: z.ZodType,
    requireUserToken?: boolean,
    requiredScopes?: Scope[]
  ) {
    return this.request(endpoint, {
      method: "PATCH",
      body,
      requireUserToken,
      requiredScopes,
      RequestSchema,
    });
  }

  protected async patchWithResponseData<T>(
    endpoint: string,
    body: unknown,
    RequestSchema: z.ZodType,
    ResponseSchema: z.ZodType<T>,
    requireUserToken?: boolean,
    requiredScopes?: Scope[]
  ) {
    return getResponseData(
      await this.patch(
        endpoint,
        body,
        RequestSchema,
        requireUserToken,
        requiredScopes
      ),
      ResponseSchema
    );
  }

  protected async delete(
    endpoint: string,
    requireUserToken?: boolean,
    requiredScopes?: Scope[]
  ) {
    await this.request(endpoint, {
      method: "DELETE",
      requireUserToken,
      requiredScopes,
    });
  }
}
