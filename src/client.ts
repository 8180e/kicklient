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
import {
  createWebhookHandler,
  type FormattedEventData,
} from "./events-handler.js";
import {
  ChannelRewardsAPI,
  type UpdateChannelRewardParams,
} from "./modules/channel-rewards.js";

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

export abstract class BaseClient {
  categories;
  users;
  channels;
  livestreams;
  events;

  private createUserActions(userId: number) {
    return {
      getChannel: () => this.channels.getChannelByBroadcasterId(userId),
      getLivestream: () =>
        this.livestreams.getLivestreamByBroadcasterId(userId),
    };
  }

  protected readonly eventDataFormatters = {
    "chat.message.sent": (data: FormattedEventData<"chat.message.sent">) => ({
      ...data,
      repliesTo: data.repliesTo && {
        ...data.repliesTo,
        sender: {
          ...data.repliesTo.sender,
          ...this.createUserActions(data.repliesTo.sender.userId),
        },
      },
      sender: { ...data.sender, ...this.createUserActions(data.sender.userId) },
    }),
    "channel.followed": (data: FormattedEventData<"channel.followed">) => ({
      ...data,
      follower: {
        ...data.follower,
        ...this.createUserActions(data.follower.userId),
      },
    }),
    "channel.subscription.renewal": ({
      createdAt,
      expiresAt,
      ...data
    }: FormattedEventData<"channel.subscription.renewal">) => ({
      ...data,
      subscriber: {
        ...data.subscriber,
        ...this.createUserActions(data.subscriber.userId),
      },
      createdAt: new Date(createdAt),
      expiresAt: new Date(expiresAt),
    }),
    "channel.subscription.gifts": ({
      createdAt,
      expiresAt,
      ...data
    }: FormattedEventData<"channel.subscription.gifts">) => ({
      ...data,
      gifter: data.gifter.isAnonymous
        ? { isAnonymous: true as const }
        : { ...data.gifter, ...this.createUserActions(data.gifter.userId) },
      giftees: data.giftees.map((giftee) => ({
        ...giftee,
        ...this.createUserActions(giftee.userId),
      })),
      createdAt: new Date(createdAt),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }),
    "channel.subscription.new": ({
      createdAt,
      expiresAt,
      ...data
    }: FormattedEventData<"channel.subscription.new">) => ({
      ...data,
      subscriber: {
        ...data.subscriber,
        ...this.createUserActions(data.subscriber.userId),
      },
      createdAt: new Date(createdAt),
      expiresAt: new Date(expiresAt),
    }),
    "channel.reward.redemption.updated": ({
      redeemedAt,
      ...data
    }: FormattedEventData<"channel.reward.redemption.updated">) => ({
      ...data,
      redeemer: {
        ...data.redeemer,
        ...this.createUserActions(data.redeemer.userId),
      },
      redeemedAt: new Date(redeemedAt),
    }),
    "livestream.status.updated": ({
      startedAt,
      endedAt,
      ...data
    }: FormattedEventData<"livestream.status.updated">) => ({
      ...data,
      startedAt: new Date(startedAt),
      endedAt: new Date(endedAt || 0),
    }),
    "livestream.metadata.updated": (
      data: FormattedEventData<"livestream.metadata.updated">,
    ) => data,
    "moderation.banned": ({
      metadata: { createdAt, expiresAt, ...metadata },
      ...data
    }: FormattedEventData<"moderation.banned">) => ({
      ...data,
      bannedUser: {
        ...data.bannedUser,
        ...this.createUserActions(data.bannedUser.userId),
      },
      metadata: {
        ...metadata,
        createdAt: new Date(createdAt),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    }),
    "kicks.gifted": ({
      createdAt,
      ...data
    }: FormattedEventData<"kicks.gifted">) => ({
      ...data,
      sender: { ...data.sender, ...this.createUserActions(data.sender.userId) },
      createdAt: new Date(createdAt),
    }),
  };

  constructor(token: Token, options?: ClientOptions) {
    this.categories = new CategoriesAPI(this, token, options);
    this.users = new UsersAPI(this, token, options);
    this.channels = new ChannelsAPI(this, token, options);
    this.livestreams = new LivestreamsAPI(this, token, options);
    this.events = new EventsAPI(this, token, options);
  }

  protected createWebhookHandler(callbacks: {
    [K in keyof typeof this.eventDataFormatters]?: (
      data: ReturnType<(typeof this.eventDataFormatters)[K]>,
    ) => unknown;
  }) {
    return createWebhookHandler({
      "channel.followed": (data) =>
        callbacks["channel.followed"]?.(
          this.eventDataFormatters["channel.followed"](data),
        ),
      "channel.reward.redemption.updated": (data) =>
        callbacks["channel.reward.redemption.updated"]?.(
          this.eventDataFormatters["channel.reward.redemption.updated"](data),
        ),
      "channel.subscription.gifts": (data) =>
        callbacks["channel.subscription.gifts"]?.(
          this.eventDataFormatters["channel.subscription.gifts"](data),
        ),
      "channel.subscription.new": (data) =>
        callbacks["channel.subscription.new"]?.(
          this.eventDataFormatters["channel.subscription.new"](data),
        ),
      "channel.subscription.renewal": (data) =>
        callbacks["channel.subscription.renewal"]?.(
          this.eventDataFormatters["channel.subscription.renewal"](data),
        ),
      "chat.message.sent": (data) =>
        callbacks["chat.message.sent"]?.(
          this.eventDataFormatters["chat.message.sent"](data),
        ),
      "kicks.gifted": (data) =>
        callbacks["kicks.gifted"]?.(
          this.eventDataFormatters["kicks.gifted"](data),
        ),
      "livestream.metadata.updated": (data) =>
        callbacks["livestream.metadata.updated"]?.(
          this.eventDataFormatters["livestream.metadata.updated"](data),
        ),
      "livestream.status.updated": (data) =>
        callbacks["livestream.status.updated"]?.(
          this.eventDataFormatters["livestream.status.updated"](data),
        ),
      "moderation.banned": (data) =>
        callbacks["moderation.banned"]?.(
          this.eventDataFormatters["moderation.banned"](data),
        ),
    });
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

  createKickWebhookHandler(callbacks: {
    [K in keyof typeof this.eventDataFormatters]?: (
      data: ReturnType<(typeof this.eventDataFormatters)[K]>,
    ) => unknown;
  }) {
    return this.createWebhookHandler(callbacks);
  }
}

type UserClientOptions = AccessToken | RefreshableUserClientOptions;

export class UserClient extends BaseClient {
  channelRewards;
  chat;
  moderation;
  kicks;

  private createModerationActions(userId: number, broadcasterUserId: number) {
    return {
      ban: (reason?: string) =>
        this.moderation.banUser({ broadcasterUserId, userId, reason }),
      timeout: (duration: number, reason?: string) =>
        this.moderation.timeoutUser({
          broadcasterUserId,
          userId,
          duration,
          reason,
        }),
      removeBan: () => this.moderation.removeBan({ broadcasterUserId, userId }),
    };
  }

  private readonly userEventDataFormatters = {
    "chat.message.sent": (
      data: ReturnType<(typeof this.eventDataFormatters)["chat.message.sent"]>,
    ) => ({
      ...data,
      repliesTo: data.repliesTo && {
        ...data.repliesTo,
        sender: {
          ...data.repliesTo.sender,
          ...this.createModerationActions(
            data.repliesTo.sender.userId,
            data.broadcaster.userId,
          ),
        },
      },
      sender: {
        ...data.sender,
        ...this.createModerationActions(
          data.sender.userId,
          data.broadcaster.userId,
        ),
      },
    }),
    "channel.followed": (
      data: ReturnType<(typeof this.eventDataFormatters)["channel.followed"]>,
    ) => ({
      ...data,
      follower: {
        ...data.follower,
        ...this.createModerationActions(
          data.follower.userId,
          data.broadcaster.userId,
        ),
      },
    }),
    "channel.subscription.renewal": (
      data: ReturnType<
        (typeof this.eventDataFormatters)["channel.subscription.renewal"]
      >,
    ) => ({
      ...data,
      subscriber: {
        ...data.subscriber,
        ...this.createModerationActions(
          data.subscriber.userId,
          data.broadcaster.userId,
        ),
      },
    }),
    "channel.subscription.gifts": (
      data: ReturnType<
        (typeof this.eventDataFormatters)["channel.subscription.gifts"]
      >,
    ) => ({
      ...data,
      gifter: data.gifter.isAnonymous
        ? { isAnonymous: true as const }
        : {
            ...data.gifter,
            ...this.createModerationActions(
              data.gifter.userId,
              data.broadcaster.userId,
            ),
          },
    }),
    "channel.subscription.new": (
      data: ReturnType<
        (typeof this.eventDataFormatters)["channel.subscription.new"]
      >,
    ) => ({
      ...data,
      subscriber: {
        ...data.subscriber,
        ...this.createModerationActions(
          data.subscriber.userId,
          data.broadcaster.userId,
        ),
      },
    }),
    "channel.reward.redemption.updated": (
      data: ReturnType<
        (typeof this.eventDataFormatters)["channel.reward.redemption.updated"]
      >,
    ) => ({
      ...data,
      reward: {
        ...data.reward,
        delete: () => this.channelRewards.deleteChannelReward(data.reward.id),
        update: (options: UpdateChannelRewardParams) =>
          this.channelRewards.updateChannelReward(data.reward.id, options),
      },
      redeemer: {
        ...data.redeemer,
        ...this.createModerationActions(
          data.redeemer.userId,
          data.broadcaster.userId,
        ),
      },
    }),
    "livestream.status.updated": (
      data: ReturnType<
        (typeof this.eventDataFormatters)["livestream.status.updated"]
      >,
    ) => data,
    "livestream.metadata.updated": (
      data: ReturnType<
        (typeof this.eventDataFormatters)["livestream.metadata.updated"]
      >,
    ) => data,
    "moderation.banned": (
      data: ReturnType<(typeof this.eventDataFormatters)["moderation.banned"]>,
    ) => ({
      ...data,
      bannedUser: {
        ...data.bannedUser,
        ...this.createModerationActions(
          data.bannedUser.userId,
          data.broadcaster.userId,
        ),
      },
    }),
    "kicks.gifted": (
      data: ReturnType<(typeof this.eventDataFormatters)["kicks.gifted"]>,
    ) => ({
      ...data,
      sender: {
        ...data.sender,
        ...this.createModerationActions(
          data.sender.userId,
          data.broadcaster.userId,
        ),
      },
    }),
  };

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

    this.channelRewards = new ChannelRewardsAPI(this, token, options);
    this.chat = new ChatAPI(this, token, options);
    this.moderation = new ModerationAPI(this, token, options);
    this.kicks = new KicksAPI(this, token, options);
    this.events = new UserEventsAPI(this, token, options);
    this.users = new UserUsersAPI(this, token, options);
  }

  createKickWebhookHandler(callbacks: {
    [K in keyof typeof this.userEventDataFormatters]?: (
      data: ReturnType<(typeof this.userEventDataFormatters)[K]>,
    ) => unknown;
  }) {
    return this.createWebhookHandler({
      "channel.followed": (data) =>
        callbacks["channel.followed"]?.(
          this.userEventDataFormatters["channel.followed"](data),
        ),
      "channel.reward.redemption.updated": (data) =>
        callbacks["channel.reward.redemption.updated"]?.(
          this.userEventDataFormatters["channel.reward.redemption.updated"](
            data,
          ),
        ),
      "channel.subscription.gifts": (data) =>
        callbacks["channel.subscription.gifts"]?.(
          this.userEventDataFormatters["channel.subscription.gifts"](data),
        ),
      "channel.subscription.new": (data) =>
        callbacks["channel.subscription.new"]?.(
          this.userEventDataFormatters["channel.subscription.new"](data),
        ),
      "channel.subscription.renewal": (data) =>
        callbacks["channel.subscription.renewal"]?.(
          this.userEventDataFormatters["channel.subscription.renewal"](data),
        ),
      "chat.message.sent": (data) =>
        callbacks["chat.message.sent"]?.(
          this.userEventDataFormatters["chat.message.sent"](data),
        ),
      "kicks.gifted": (data) =>
        callbacks["kicks.gifted"]?.(
          this.userEventDataFormatters["kicks.gifted"](data),
        ),
      "livestream.metadata.updated": (data) =>
        callbacks["livestream.metadata.updated"]?.(
          this.userEventDataFormatters["livestream.metadata.updated"](data),
        ),
      "livestream.status.updated": (data) =>
        callbacks["livestream.status.updated"]?.(
          this.userEventDataFormatters["livestream.status.updated"](data),
        ),
      "moderation.banned": (data) =>
        callbacks["moderation.banned"]?.(
          this.userEventDataFormatters["moderation.banned"](data),
        ),
    });
  }
}
