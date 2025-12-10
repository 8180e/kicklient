import camelcaseKeys, { type ObjectLike } from "camelcase-keys";
import { createHash, randomBytes } from "crypto";
import z from "zod";

export type Scope =
  | "user:read"
  | "channel:read"
  | "channel:write"
  | "chat:write"
  | "streamkey:read"
  | "events:subscribe"
  | "moderation:ban"
  | "moderation:chat_message:manage"
  | "kicks:read"
  | (string & {});

const UserTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.string(),
});

const AppAccessTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

const TokenIntrospectionSchema = z.object({
  data: z.union([
    z.object({ active: z.literal(false) }),
    z.intersection(
      z.object({
        active: z.literal(true),
        client_id: z.string(),
        exp: z.number(),
      }),
      z.union([
        z.object({ token_type: z.literal("app") }),
        z.object({ token_type: z.literal("user"), scope: z.string() }),
      ])
    ),
  ]),
});

function formatData<T extends ObjectLike | readonly ObjectLike[]>(
  Schema: z.ZodType<T>,
  data: unknown
) {
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      "Unexpected response shape: " +
        parsed.error +
        "\nReceived: " +
        JSON.stringify(data, undefined, 2)
    );
  }
  return camelcaseKeys(parsed.data, { deep: true });
}

export class KickOAuth {
  private readonly baseUrl = "https://id.kick.com/oauth";

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string
  ) {}

  private request(endpoint: string, body: Record<string, string>) {
    return fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
  }

  private async getTokenData<T extends ObjectLike | readonly ObjectLike[]>(
    body: Record<string, string>,
    errorMessage: string,
    ResponseSchema: z.ZodType<T>
  ) {
    const res = await this.request("/token", {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      ...body,
    });

    if (!res.ok) {
      throw new Error(errorMessage);
    }

    return formatData(ResponseSchema, await res.json());
  }

  getAuthorizationUrl(scopes: Scope[]) {
    const state = randomBytes(16).toString("hex");
    const codeVerifier = randomBytes(32).toString("base64url");
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      state,
      scope: scopes.join(" "),
      code_challenge: createHash("sha256")
        .update(codeVerifier)
        .digest("base64url"),
      code_challenge_method: "S256",
    });
    if (this.redirectUri.includes("127.0.0.1")) {
      params.append("redirect", "127.0.0.1");
    }
    params.append("redirect_uri", this.redirectUri);
    return {
      url: `${this.baseUrl}/authorize?${params}`,
      state,
      codeVerifier,
    };
  }

  async exchangeCodeForToken(code: string, codeVerifier: string) {
    const { expiresIn, scope, ...token } = await this.getTokenData(
      {
        code,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      },
      "An error occured while exchanging tokens",
      UserTokenSchema
    );
    return {
      ...token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      scopes: scope.split(" ") as Scope[],
    };
  }

  async getAppAccessToken() {
    const { expiresIn, ...token } = await this.getTokenData(
      { grant_type: "client_credentials" },
      "An error occured while getting app access token",
      AppAccessTokenSchema
    );
    return { ...token, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  async refreshToken(refreshToken: string) {
    const { expiresIn, scope, ...token } = await this.getTokenData(
      { refresh_token: refreshToken, grant_type: "refresh_token" },
      "An error occured while refreshing tokens",
      UserTokenSchema
    );
    return {
      ...token,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      scopes: scope.split(" ") as Scope[],
    };
  }

  async revokeToken(
    token: string,
    tokenHintType?: "access_token" | "refresh_token"
  ) {
    const requestBody: Record<string, string> = { token };
    if (tokenHintType) {
      requestBody.token_hint_type = tokenHintType;
    }
    await this.request("/revoke", requestBody);
  }

  async introspectToken(token: string) {
    const res = await fetch("https://api.kick.com/public/v1/token/introspect", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      return { active: false as const };
    }

    if (!res.ok) {
      throw new Error("An error occured while introspecting token");
    }

    const { data } = formatData(TokenIntrospectionSchema, await res.json());
    if (!data.active) {
      return data;
    }

    const { exp, ...tokenData } = data;
    const tokenWithDate = { ...tokenData, expiresAt: new Date(exp * 1000) };
    if (tokenWithDate.tokenType === "app") {
      return tokenWithDate;
    }

    const { scope, ...userTokenData } = tokenWithDate;
    return { ...userTokenData, scopes: scope.split(" ") as Scope[] };
  }
}
