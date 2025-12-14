import type { KickOAuth, Scope } from "./auth.js";
import { KickAPIError } from "./errors.js";
import { CategoriesAPI } from "./modules/categories.js";
import { ChannelRewardsAPI } from "./modules/channel-rewards.js";
import { ChannelsAPI } from "./modules/channels.js";
import { ChatAPI } from "./modules/chat.js";
import { KicksAPI } from "./modules/kicks.js";
import { LivestreamsAPI } from "./modules/livestreams.js";
import { ModerationAPI } from "./modules/moderation.js";
import { UsersAPI } from "./modules/users.js";

interface ClientOptionsBase {
  accessToken: string;
}

export interface AppClientOptions extends ClientOptionsBase {
  tokenType: "app";
}

export interface UserClientOptions extends ClientOptionsBase {
  tokenType: "user";
  scopes: Scope[];
  refreshToken?: string | undefined;
}

export class Kicklient {
  readonly categories;
  readonly users;
  readonly channels;
  readonly channelRewards;
  readonly chat;
  readonly moderation;
  readonly livestreams;
  readonly kicks;

  private constructor(
    auth: KickOAuth,
    options: AppClientOptions | UserClientOptions
  ) {
    this.categories = new CategoriesAPI(auth, options);
    this.users = new UsersAPI(auth, options);
    this.channels = new ChannelsAPI(auth, options);
    this.channelRewards = new ChannelRewardsAPI(auth, options);
    this.chat = new ChatAPI(auth, options);
    this.moderation = new ModerationAPI(auth, options);
    this.livestreams = new LivestreamsAPI(auth, options);
    this.kicks = new KicksAPI(auth, options);
  }

  static async create(
    auth: KickOAuth,
    accessToken: string,
    refreshToken?: string
  ) {
    const tokenInfo = await auth.introspectToken(accessToken);
    if (!tokenInfo.active) {
      if (!refreshToken) {
        throw new KickAPIError({
          message: "Access token is expired or invalid",
        });
      }
      const tokens = await auth.refreshToken(refreshToken);
      return new Kicklient(auth, { ...tokens, tokenType: "user" });
    }

    if (tokenInfo.tokenType === "app") {
      return new Kicklient(auth, { accessToken, tokenType: "app" });
    }

    return new Kicklient(auth, {
      accessToken,
      refreshToken,
      scopes: tokenInfo.scopes,
      tokenType: "user",
    });
  }
}
