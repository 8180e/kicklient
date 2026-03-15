import type { ClientOptions, Token } from "./api-client.js";
import { getAppAccessToken, refreshToken } from "./auth.js";
import { CategoriesAPI } from "./modules/categories.js";
import { ChannelsAPI } from "./modules/channels.js";
import { ChatAPI } from "./modules/chat.js";
import { EventsAPI, UserEventsAPI } from "./modules/events.js";
import { KicksAPI } from "./modules/kicks.js";
import { LivestreamsAPI } from "./modules/livestreams.js";
import { ModerationAPI } from "./modules/moderation.js";
import { UsersAPI, UserUsersAPI } from "./modules/users.js";

interface AccessToken {
  accessToken: string;
  expiresAt?: number;
}

interface RefreshableAppClientOptions extends AccessToken {
  clientId: string;
  clientSecret: string;
  onTokenRefresh?(
    token: Awaited<ReturnType<typeof getAppAccessToken>>,
  ): unknown;
}

interface RefreshableUserClientOptions extends RefreshableAppClientOptions {
  refreshToken: string;
  onTokenRefresh?(token: Awaited<ReturnType<typeof refreshToken>>): unknown;
}

export class BaseClient {
  categories;
  users;
  channels;
  livestreams;
  events;

  constructor(token: Token, options?: ClientOptions) {
    this.categories = new CategoriesAPI(this, token, options);
    this.users = new UsersAPI(this, token, options);
    this.channels = new ChannelsAPI(this, token, options);
    this.livestreams = new LivestreamsAPI(this, token, options);
    this.events = new EventsAPI(this, token, options);
  }
}

function createRefreshMethod(refresh: () => Promise<void>) {
  let refreshing: Promise<void> | null = null;

  return function () {
    if (refreshing) return refreshing;
    return (refreshing = (async () => {
      try {
        await refresh();
      } finally {
        refreshing = null;
      }
    })());
  };
}

type AppClientOptions = RefreshableAppClientOptions | AccessToken;

export class AppClient extends BaseClient {
  constructor(
    {
      accessToken,
      expiresAt = 999999999999999,
      ...appClientOptions
    }: AppClientOptions,
    options?: ClientOptions,
  ) {
    const token = { accessToken, expiresAt, async refreshTokens() {} };
    if ("clientId" in appClientOptions) {
      token.refreshTokens = createRefreshMethod(async function (
        this: typeof token,
      ) {
        const appToken = await getAppAccessToken(appClientOptions);
        this.accessToken = appToken.accessToken;
        this.expiresAt = Date.now() + appToken.expiresIn * 1000;
        await appClientOptions.onTokenRefresh?.(appToken);
      });
    }

    super(token, options);
  }
}

type UserClientOptions = AccessToken | RefreshableUserClientOptions;

export class UserClient extends BaseClient {
  chat;
  moderation;
  kicks;

  constructor(
    {
      accessToken,
      expiresAt = 999999999999999,
      ...userClientOptions
    }: UserClientOptions,
    options?: ClientOptions,
  ) {
    const token = {
      accessToken,
      refreshToken: "",
      expiresAt,
      async refreshTokens() {},
    };
    if ("clientId" in userClientOptions) {
      token.refreshToken = userClientOptions.refreshToken;
      token.refreshTokens = createRefreshMethod(async function (
        this: typeof token,
      ) {
        const userToken = await refreshToken(userClientOptions);
        this.accessToken = userToken.accessToken;
        this.refreshToken = userToken.refreshToken;
        this.expiresAt = Date.now() + userToken.expiresIn * 1000;
        await userClientOptions.onTokenRefresh?.(userToken);
      });
    }

    super(token, options);

    this.chat = new ChatAPI(this, token, options);
    this.moderation = new ModerationAPI(this, token, options);
    this.kicks = new KicksAPI(this, token, options);
    this.events = new UserEventsAPI(this, token, options);
    this.users = new UserUsersAPI(this, token, options);
  }
}
