import z from "zod";
import { KickAPIError, KickResponseShapeError } from "./errors.js";
import camelcaseKeys, { type ObjectLike } from "camelcase-keys";

interface Token {
  accessToken: string;
  expiresAt: number;
  refreshTokens(): Promise<void>;
}

interface ClientOptions {
  retries?: number;
  retryBaseDelay?: number;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exponentialBackoff(base: number, attempt: number) {
  const jitter = Math.random() * 200;
  return base * 2 ** attempt + jitter;
}

export abstract class KickAPIClient {
  private readonly options;

  constructor(
    private readonly token: Token,
    options: ClientOptions = {},
  ) {
    this.options = { retries: 5, retryBaseDelay: 500, ...options };
  }

  private async request(
    endpoint: string,
    { method = "GET", body }: RequestOptions = {},
  ) {
    const makeRequest = () =>
      fetch(`https://api.kick.com/public${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token.accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

    const makeRequestWithRefresh = async () => {
      if (Date.now() >= this.token.expiresAt - 30_000) {
        await this.token.refreshTokens();
      }

      const res = await makeRequest();

      if (res.status !== 401) return res;

      await this.token.refreshTokens();
      return makeRequest();
    };

    let res = await makeRequestWithRefresh();

    let attempt = 0;

    while (res.status === 429 && attempt < this.options.retries) {
      await sleep(exponentialBackoff(this.options.retryBaseDelay, attempt));
      res = await makeRequestWithRefresh();
      attempt++;
    }

    if (!res.ok) throw new KickAPIError(res);

    return {
      async getData<T extends ObjectLike | readonly ObjectLike[]>(
        Schema: z.ZodType<T>,
      ) {
        const parsed = Schema.safeParse(await res.json());
        if (!parsed.success) throw new KickResponseShapeError(parsed.error);
        return camelcaseKeys(parsed.data, { deep: true });
      },
    };
  }

  protected async get<T extends ObjectLike | readonly ObjectLike[]>(
    endpoint: string,
    ResponseSchema: z.ZodType<T>,
  ) {
    return (await this.request(endpoint)).getData(ResponseSchema);
  }

  protected post(endpoint: string, body: unknown) {
    return this.request(endpoint, { method: "POST", body });
  }

  protected patch(endpoint: string, body: unknown) {
    return this.request(endpoint, { method: "PATCH", body });
  }

  protected async delete(endpoint: string, body?: unknown) {
    await this.request(endpoint, { method: "DELETE", body });
  }
}
