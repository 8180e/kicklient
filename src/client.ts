import type { KickOAuth, Scope } from "./auth.js";

interface ClientOptionsBase {
  accessToken: string;
}

interface AppClientOptions extends ClientOptionsBase {
  tokenType: "app";
}

interface UserClientOptions extends ClientOptionsBase {
  tokenType: "user";
  scopes: Scope[];
  refreshToken?: string | undefined;
}

export class Kicklient {
  private constructor(
    private readonly options: AppClientOptions | UserClientOptions
  ) {}

  static async create(
    auth: KickOAuth,
    accessToken: string,
    refreshToken?: string
  ) {
    const tokenInfo = await auth.introspectToken(accessToken);
    if (!tokenInfo.active) {
      if (!refreshToken) {
        throw new Error("Access token is expired or invalid");
      }
      const tokens = await auth.refreshToken(refreshToken);
      return new Kicklient({ ...tokens, tokenType: "user" });
    }

    if (tokenInfo.tokenType === "app") {
      return new Kicklient({ accessToken, tokenType: "app" });
    }

    return new Kicklient({
      accessToken,
      refreshToken,
      scopes: tokenInfo.scopes,
      tokenType: "user",
    });
  }
}
