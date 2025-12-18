import type { OnTokensRefreshed } from "./api-client.js";
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
import { AppToken, UserToken } from "./token.js";

interface CreateClientOptions {
  refreshToken?: string;
  onTokensRefreshed?: OnTokensRefreshed;
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
    token: AppToken | UserToken,
    onTokensRefreshed?: OnTokensRefreshed
  ) {
    this.categories = new CategoriesAPI(token, onTokensRefreshed);
    this.users = new UsersAPI(token, onTokensRefreshed);
    this.channels = new ChannelsAPI(token, onTokensRefreshed);
    this.channelRewards = new ChannelRewardsAPI(token, onTokensRefreshed);
    this.chat = new ChatAPI(token, onTokensRefreshed);
    this.moderation = new ModerationAPI(token, onTokensRefreshed);
    this.livestreams = new LivestreamsAPI(token, onTokensRefreshed);
    this.kicks = new KicksAPI(token, onTokensRefreshed);
  }

  static async create(
    auth: KickOAuth,
    accessToken: string,
    { refreshToken, onTokensRefreshed }: CreateClientOptions
  ) {
    const tokenInfo = await auth.introspectToken(accessToken);
    if (!tokenInfo.active) {
      if (!refreshToken) {
        throw new KickAPIError({
          message: "Access token is expired or invalid",
        });
      }
      const tokens = await auth.refreshToken(refreshToken);
      return new Kicklient(new UserToken(auth, tokens), onTokensRefreshed);
    }

    if (tokenInfo.tokenType === "app") {
      return new Kicklient(
        new AppToken(auth, { accessToken, ...tokenInfo }),
        onTokensRefreshed
      );
    }

    if (!refreshToken) {
      throw new KickAPIError({
        message: "User tokens need a refresh token to be provided",
      });
    }

    return new Kicklient(
      new UserToken(auth, { accessToken, refreshToken, ...tokenInfo }),
      onTokensRefreshed
    );
  }
}
