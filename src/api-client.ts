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
import type { CamelCaseKeys, ObjectLike } from "camelcase-keys";

type RequestReturn<T> = T extends readonly any[] | ObjectLike // eslint-disable-line @typescript-eslint/no-explicit-any
  ? CamelCaseKeys<
      T,
      true,
      false,
      false,
      readonly never[],
      readonly never[],
      "data"
    >
  : T;

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  ResponseSchema?: z.ZodType<T> | undefined;
}

export abstract class KickAPIClient {
  constructor(
    private readonly auth: KickOAuth,
    private readonly options: AppClientOptions | UserClientOptions
  ) {}

  private async request<T>(
    endpoint: string,
    options: Omit<RequestOptions<T>, "ResponseSchema"> & {
      ResponseSchema: z.ZodType<T>;
    },
    retry?: boolean
  ): Promise<RequestReturn<T>>;

  private async request(
    endpoint: string,
    options?: Omit<RequestOptions<unknown>, "ResponseSchema">,
    retry?: boolean
  ): Promise<void>;

  private async request<T>(
    endpoint: string,
    { method = "GET", body, ResponseSchema }: RequestOptions<T> = {},
    retry = false
  ): Promise<RequestReturn<T> | void> {
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
            return this.request(
              endpoint,
              { method, body, ResponseSchema: ResponseSchema! },
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

    if (ResponseSchema) {
      if (res.status === 204) {
        throw new KickAPIError({
          message: "Response body does not include content",
        });
      }

      const json = await res.json();
      return formatData(z.object({ data: ResponseSchema }), json)
        .data as RequestReturn<T>;
    }
  }

  protected async get<T>(endpoint: string, ResponseSchema: z.ZodType<T>) {
    return this.request(endpoint, { ResponseSchema });
  }

  protected async post<T>(
    endpoint: string,
    body: unknown,
    ResponseSchema: z.ZodType<T>
  ): Promise<RequestReturn<T>>;

  protected async post(endpoint: string, body: unknown): Promise<void>;

  protected async post<T>(
    endpoint: string,
    body: unknown,
    ResponseSchema?: z.ZodType<T>
  ) {
    return ResponseSchema
      ? this.request(endpoint, { method: "POST", body, ResponseSchema })
      : this.request(endpoint, { method: "POST", body });
  }

  protected async patch<T>(
    endpoint: string,
    body: unknown,
    ResponseSchema: z.ZodType<T>
  ): Promise<RequestReturn<T>>;

  protected async patch(endpoint: string, body: unknown): Promise<void>;

  protected patch<T>(
    endpoint: string,
    body: unknown,
    ResponseSchema?: z.ZodType<T>
  ) {
    return ResponseSchema
      ? this.request(endpoint, { method: "PATCH", body, ResponseSchema })
      : this.request(endpoint, { method: "PATCH", body });
  }

  protected delete(endpoint: string) {
    return this.request(endpoint, { method: "DELETE" });
  }
}
