import { createHash, randomBytes } from "crypto";
import z from "zod";
import { KickAPIError } from "./errors.js";
import decamelizeKeys from "decamelize-keys";
import { handleResponse } from "./utils.js";

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
      ]),
    ),
  ]),
});

interface ClientId {
  clientId: string;
}

interface ClientSecret {
  clientSecret: string;
}

type Scope =
  | "user:read"
  | "channel:read"
  | "channel:write"
  | "channel:rewards:read"
  | "channel:rewards:write"
  | "chat:write"
  | "streamkey:read"
  | "events:subscribe"
  | "moderation:ban"
  | "moderation:chat_message:manage"
  | "kicks:read"
  | (string & {});

function getScopesArr(scopes: string): Scope[] {
  return scopes.split(" ");
}

interface GetAuthorizationUrlParams extends ClientId {
  redirectUri: string;
  scopes: Scope[];
}

export function getAuthorizationUrl({
  clientId,
  redirectUri,
  scopes,
}: GetAuthorizationUrlParams) {
  const state = randomBytes(16).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(" "),
    code_challenge: createHash("sha256")
      .update(codeVerifier)
      .digest("base64url"),
    code_challenge_method: "S256",
  });
  return {
    url: `https://id.kick.com/oauth/authorize?${params}`,
    state,
    codeVerifier,
  };
}

interface ExchangeCodeForTokenParams extends ClientId, ClientSecret {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export async function exchangeCodeForToken(params: ExchangeCodeForTokenParams) {
  const res = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...decamelizeKeys(params),
      grant_type: "authorization_code",
    }),
  });

  const { scope, ...data } = await handleResponse(UserTokenSchema, res);

  return { ...data, scopes: getScopesArr(scope) };
}

interface GetAppAccessTokenParams extends ClientId, ClientSecret {}

export async function getAppAccessToken(params: GetAppAccessTokenParams) {
  const res = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...decamelizeKeys(params),
      grant_type: "client_credentials",
    }),
  });

  return handleResponse(AppAccessTokenSchema, res);
}

interface RefreshTokenParams extends ClientId, ClientSecret {
  refreshToken: string;
}

export async function refreshToken(params: RefreshTokenParams) {
  const res = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...decamelizeKeys(params),
      grant_type: "refresh_token",
    }),
  });

  const { scope, ...data } = await handleResponse(UserTokenSchema, res);

  return { ...data, scopes: getScopesArr(scope) };
}

interface RevokeTokenParams {
  token: string;
  tokenHintType?: "access_token" | "refresh_token";
}

export async function revokeToken(params: RevokeTokenParams) {
  const res = await fetch("https://id.kick.com/oauth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(decamelizeKeys(params)),
  });

  if (!res.ok) throw new KickAPIError(res);
}

interface IntrospectTokenParams {
  accessToken: string;
}

export async function introspectToken({ accessToken }: IntrospectTokenParams) {
  const res = await fetch("https://id.kick.com/oauth/token/introspect", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) return { active: false as const };

  const { data } = await handleResponse(TokenIntrospectionSchema, res);

  if (!data.active || data.tokenType === "app") return data;

  const { scope, ...userTokenData } = data;

  return { ...userTokenData, scopes: getScopesArr(scope) };
}
