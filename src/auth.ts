import { createHash, randomBytes } from "crypto";

type Scope =
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

export class KickOAuth {
  private readonly baseUrl = "https://id.kick.com/oauth";

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string
  ) {}

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
    const res = await fetch(`${this.baseUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });

    return res.json();
  }
}
