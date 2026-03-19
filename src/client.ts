import type { ClientOptions, Token } from "./api-client.js";
import { getAppAccessToken, refreshToken } from "./auth.js";
import { CategoriesAPI } from "./modules/categories.js";
import { ChannelsAPI, UserChannelsAPI } from "./modules/channels.js";
import {
  ChatAPI,
  type PostChatMessageAsBotParams,
  type PostChatMessageAsUserParams,
} from "./modules/chat.js";
import { EventsAPI, UserEventsAPI } from "./modules/events.js";
import { KicksAPI } from "./modules/kicks.js";
import { LivestreamsAPI } from "./modules/livestreams.js";
import { ModerationAPI } from "./modules/moderation.js";
import { UsersAPI, UserUsersAPI } from "./modules/users.js";
import {
  createWebhookHandler,
  type FormattedEventData,
} from "./events-handler.js";
import { ChannelRewardsAPI } from "./modules/channel-rewards.js";

interface AccessToken {
  accessToken: string;
  expiresAt?: number;
  clientId?: never;
  clientSecret?: never;
  refreshToken?: never;
  onTokenRefresh?: never;
}

interface RefreshableAppClientOptions extends Omit<
  AccessToken,
  "clientId" | "clientSecret" | "refreshToken" | "onTokenRefresh"
> {
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

function createUserActions(client: BaseClient, userId: number) {
  return {
    getChannel() {
      return client.channels.getChannelByBroadcasterId(userId);
    },
    getLivestream() {
      return client.livestreams.getLivestreamByBroadcasterId(userId);
    },
  };
}

function createEventDataFormatters(client: BaseClient) {
  return {
    "chat.message.sent"(data: FormattedEventData<"chat.message.sent">) {
      return {
        ...data,
        repliesTo: data.repliesTo && {
          ...data.repliesTo,
          sender: {
            ...data.repliesTo.sender,
            ...createUserActions(client, data.repliesTo.sender.userId),
          },
        },
        sender: {
          ...data.sender,
          ...createUserActions(client, data.sender.userId),
        },
      };
    },
    "channel.followed"(data: FormattedEventData<"channel.followed">) {
      return {
        ...data,
        follower: {
          ...data.follower,
          ...createUserActions(client, data.follower.userId),
        },
      };
    },
    "channel.subscription.renewal"({
      createdAt,
      expiresAt,
      ...data
    }: FormattedEventData<"channel.subscription.renewal">) {
      return {
        ...data,
        subscriber: {
          ...data.subscriber,
          ...createUserActions(client, data.subscriber.userId),
        },
        createdAt: new Date(createdAt),
        expiresAt: new Date(expiresAt),
      };
    },
    "channel.subscription.gifts"({
      createdAt,
      expiresAt,
      ...data
    }: FormattedEventData<"channel.subscription.gifts">) {
      return {
        ...data,
        gifter: data.gifter.isAnonymous
          ? { isAnonymous: true as const }
          : {
              ...data.gifter,
              ...createUserActions(client, data.gifter.userId),
            },
        giftees: data.giftees.map((giftee) => ({
          ...giftee,
          ...createUserActions(client, giftee.userId),
        })),
        createdAt: new Date(createdAt),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      };
    },
    "channel.subscription.new"({
      createdAt,
      expiresAt,
      ...data
    }: FormattedEventData<"channel.subscription.new">) {
      return {
        ...data,
        subscriber: {
          ...data.subscriber,
          ...createUserActions(client, data.subscriber.userId),
        },
        createdAt: new Date(createdAt),
        expiresAt: new Date(expiresAt),
      };
    },
    "channel.reward.redemption.updated"({
      redeemedAt,
      ...data
    }: FormattedEventData<"channel.reward.redemption.updated">) {
      return {
        ...data,
        redeemer: {
          ...data.redeemer,
          ...createUserActions(client, data.redeemer.userId),
        },
        redeemedAt: new Date(redeemedAt),
      };
    },
    "livestream.status.updated"({
      startedAt,
      endedAt,
      ...data
    }: FormattedEventData<"livestream.status.updated">) {
      return {
        ...data,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt || 0),
      };
    },
    "livestream.metadata.updated"(
      data: FormattedEventData<"livestream.metadata.updated">,
    ) {
      return data;
    },
    "moderation.banned"({
      metadata: { createdAt, expiresAt, ...metadata },
      ...data
    }: FormattedEventData<"moderation.banned">) {
      return {
        ...data,
        bannedUser: {
          ...data.bannedUser,
          ...createUserActions(client, data.bannedUser.userId),
        },
        metadata: {
          ...metadata,
          createdAt: new Date(createdAt),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      };
    },
    "kicks.gifted"({ createdAt, ...data }: FormattedEventData<"kicks.gifted">) {
      return {
        ...data,
        sender: {
          ...data.sender,
          ...createUserActions(client, data.sender.userId),
        },
        createdAt: new Date(createdAt),
      };
    },
  };
}

type Formatters = ReturnType<typeof createEventDataFormatters>;
type Formatted<K extends keyof Formatters> = ReturnType<Formatters[K]>;

type WebhookCallbacks = {
  [K in keyof Formatters]?: (data: Formatted<K>) => unknown;
};

export abstract class BaseClient {
  categories;
  users;
  channels;
  livestreams;
  events;

  protected readonly eventDataFormatters = createEventDataFormatters(this);

  constructor(token: Token, options?: ClientOptions) {
    this.categories = new CategoriesAPI(this, token, options);
    this.users = new UsersAPI(this, token, options);
    this.channels = new ChannelsAPI(this, token, options);
    this.livestreams = new LivestreamsAPI(this, token, options);
    this.events = new EventsAPI(this, token, options);
  }

  protected createWebhookHandler(callbacks: WebhookCallbacks) {
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

  return () => {
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
    if (appClientOptions.clientId) {
      token.refreshTokens = createRefreshMethod(async () => {
        const appToken = await getAppAccessToken(appClientOptions);
        token.accessToken = appToken.accessToken;
        token.expiresAt = Date.now() + appToken.expiresIn * 1000;
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

function createModerationActions(
  client: UserClient,
  userId: number,
  broadcasterUserId: number,
) {
  return {
    ban(reason?: string) {
      return client.moderation.banUser({ broadcasterUserId, userId, reason });
    },
    timeout(duration: number, reason?: string) {
      return client.moderation.timeoutUser({
        broadcasterUserId,
        userId,
        duration,
        reason,
      });
    },
    removeBan() {
      return client.moderation.removeBan({ broadcasterUserId, userId });
    },
  };
}

function createUserEventDataFormatters(client: UserClient) {
  return {
    "chat.message.sent"(data: Formatted<"chat.message.sent">) {
      function createChatActions(messageId: string) {
        return {
          delete() {
            return client.chat.deleteChatMessage(messageId);
          },
          replyAsBot(
            params: Omit<PostChatMessageAsBotParams, "replyToMessageId">,
          ) {
            return client.chat.postChatMessageAsBot({
              ...params,
              replyToMessageId: messageId,
            });
          },
          replyAsUser(
            params: Omit<
              PostChatMessageAsUserParams,
              "replyToMessageId" | "broadcasterUserId"
            >,
          ) {
            return client.chat.postChatMessageAsUser({
              ...params,
              broadcasterUserId: data.broadcaster.userId,
              replyToMessageId: messageId,
            });
          },
        };
      }

      return {
        ...data,
        repliesTo: data.repliesTo && {
          ...data.repliesTo,
          sender: {
            ...data.repliesTo.sender,
            ...createModerationActions(
              client,
              data.repliesTo.sender.userId,
              data.broadcaster.userId,
            ),
          },
          ...createChatActions(data.repliesTo.messageId),
        },
        sender: {
          ...data.sender,
          ...createModerationActions(
            client,
            data.sender.userId,
            data.broadcaster.userId,
          ),
        },
        ...createChatActions(data.messageId),
      };
    },
    "channel.followed"(data: Formatted<"channel.followed">) {
      return {
        ...data,
        follower: {
          ...data.follower,
          ...createModerationActions(
            client,
            data.follower.userId,
            data.broadcaster.userId,
          ),
        },
      };
    },
    "channel.subscription.renewal"(
      data: Formatted<"channel.subscription.renewal">,
    ) {
      return {
        ...data,
        subscriber: {
          ...data.subscriber,
          ...createModerationActions(
            client,
            data.subscriber.userId,
            data.broadcaster.userId,
          ),
        },
      };
    },
    "channel.subscription.gifts"(
      data: Formatted<"channel.subscription.gifts">,
    ) {
      return {
        ...data,
        gifter: data.gifter.isAnonymous
          ? { isAnonymous: true as const }
          : {
              ...data.gifter,
              ...createModerationActions(
                client,
                data.gifter.userId,
                data.broadcaster.userId,
              ),
            },
      };
    },
    "channel.subscription.new"(data: Formatted<"channel.subscription.new">) {
      return {
        ...data,
        subscriber: {
          ...data.subscriber,
          ...createModerationActions(
            client,
            data.subscriber.userId,
            data.broadcaster.userId,
          ),
        },
      };
    },
    "channel.reward.redemption.updated"(
      data: Formatted<"channel.reward.redemption.updated">,
    ) {
      return {
        ...data,
        redeemer: {
          ...data.redeemer,
          ...createModerationActions(
            client,
            data.redeemer.userId,
            data.broadcaster.userId,
          ),
        },
      };
    },
    "livestream.status.updated"(data: Formatted<"livestream.status.updated">) {
      return data;
    },
    "livestream.metadata.updated"(
      data: Formatted<"livestream.metadata.updated">,
    ) {
      return data;
    },
    "moderation.banned"(data: Formatted<"moderation.banned">) {
      return {
        ...data,
        bannedUser: {
          ...data.bannedUser,
          ...createModerationActions(
            client,
            data.bannedUser.userId,
            data.broadcaster.userId,
          ),
        },
      };
    },
    "kicks.gifted"(data: Formatted<"kicks.gifted">) {
      return {
        ...data,
        sender: {
          ...data.sender,
          ...createModerationActions(
            client,
            data.sender.userId,
            data.broadcaster.userId,
          ),
        },
      };
    },
  };
}

type UserFormatters = ReturnType<typeof createUserEventDataFormatters>;
type FormattedUser<K extends keyof UserFormatters> = ReturnType<
  UserFormatters[K]
>;

type UserWebhookCallbacks = {
  [K in keyof UserFormatters]?: (data: FormattedUser<K>) => unknown;
};

export class UserClient extends BaseClient {
  channelRewards;
  chat;
  moderation;
  kicks;
  users;
  events: UserEventsAPI;
  channels: UserChannelsAPI;

  protected readonly userEventDataFormatters =
    createUserEventDataFormatters(this);

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
    if (userClientOptions.clientId) {
      token.refreshToken = userClientOptions.refreshToken;
      token.refreshTokens = createRefreshMethod(async () => {
        const userToken = await refreshToken(userClientOptions);
        token.accessToken = userToken.accessToken;
        token.refreshToken = userToken.refreshToken;
        token.expiresAt = Date.now() + userToken.expiresIn * 1000;
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
    this.channels = new UserChannelsAPI(this, token, options);
  }

  createKickWebhookHandler(callbacks: UserWebhookCallbacks) {
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
