import type { KickOAuth, Scope } from "./auth.js";

interface AppTokenOptions {
  expiresAt: Date;
  accessToken: string;
}

export class AppToken {
  accessToken;
  expiresAt;

  constructor(
    protected readonly auth: KickOAuth,
    { expiresAt, accessToken }: AppTokenOptions
  ) {
    this.accessToken = accessToken;
    this.expiresAt = expiresAt;
  }

  async refreshTokens() {
    const tokenData = await this.auth.getAppAccessToken();
    this.accessToken = tokenData.accessToken;
    this.expiresAt = tokenData.expiresAt;
    return tokenData;
  }
}

interface UserTokenOptions extends AppTokenOptions {
  scopes: Scope[];
  refreshToken: string;
}

export class UserToken extends AppToken {
  scopes;
  refreshToken;

  constructor(
    auth: KickOAuth,
    { scopes, refreshToken, ...token }: UserTokenOptions
  ) {
    super(auth, token);
    this.scopes = scopes;
    this.refreshToken = refreshToken;
  }

  async refreshTokens() {
    const tokenData = await this.auth.refreshToken(this.refreshToken);

    this.expiresAt = tokenData.expiresAt;
    this.scopes = tokenData.scopes;
    this.accessToken = tokenData.accessToken;
    this.refreshToken = tokenData.refreshToken;

    return tokenData;
  }
}
