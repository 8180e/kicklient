import type { OnTokensRefreshed } from "./api-client.js";
import type { KickOAuth } from "./auth.js";
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

abstract class BaseClient {
  readonly categories;
  readonly users;
  readonly channels;
  readonly channelRewards;
  readonly chat;
  readonly moderation;
  readonly livestreams;
  readonly kicks;

  protected constructor(
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
}

export class AppClient extends BaseClient {
  static async create(
    auth: KickOAuth,
    accessToken: string,
    onTokensRefreshed?: OnTokensRefreshed
  ) {
    const tokenInfo = await auth.introspectToken(accessToken);
    if (!tokenInfo.active) {
      const tokens = await auth.getAppAccessToken();
      await onTokensRefreshed?.(tokens);
      return new AppClient(new AppToken(auth, tokens), onTokensRefreshed);
    }
    return new AppClient(
      new AppToken(auth, { accessToken, ...tokenInfo }),
      onTokensRefreshed
    );
  }
}

export class UserClient extends BaseClient {
  static async create(
    auth: KickOAuth,
    accessToken: string,
    refreshToken: string,
    onTokensRefreshed?: OnTokensRefreshed
  ) {
    const tokenInfo = await auth.introspectToken(accessToken);
    if (!tokenInfo.active) {
      if (!refreshToken) {
        throw new KickAPIError({
          message: "Access token is expired or invalid",
        });
      }
      const tokens = await auth.refreshToken(refreshToken);
      await onTokensRefreshed?.(tokens);
      return new UserClient(new UserToken(auth, tokens), onTokensRefreshed);
    }

    if (tokenInfo.tokenType === "app") {
      throw new KickAPIError({
        message:
          "You provided an app token to a UserClient. Please use AppClient instead.",
      });
    }

    return new UserClient(
      new UserToken(auth, { accessToken, refreshToken, ...tokenInfo }),
      onTokensRefreshed
    );
  }
}
