import crypto from "crypto";
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
  ChannelFollowedSchema,
  ChannelRewardRedemptionUpdatedSchema,
  ChannelSubscriptionGiftsSchema,
  ChannelSubscriptionNewSchema,
  ChannelSubscriptionRenewalSchema,
  ChatMessageSentSchema,
  KicksGiftedSchema,
  LivestreamMetadataUpdatedSchema,
  LivestreamStatusUpdatedSchema,
  ModerationBannedSchema,
  publicKey,
} from "./events-handler.js";
import { parseData } from "./utils.js";
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
    "chat.message.sent": (data: unknown) => {
      const formattedData = parseData(data, ChatMessageSentSchema);
      return {
        ...formattedData,
        repliesTo: formattedData.repliesTo && {
          ...formattedData.repliesTo,
          sender: {
            ...formattedData.repliesTo.sender,
            ...this.createUserActions(formattedData.repliesTo.sender.userId),
          },
        },
        sender: {
          ...formattedData.sender,
          ...this.createUserActions(formattedData.sender.userId),
        },
      };
    },
    "channel.followed": (data: unknown) => {
      const formattedData = parseData(data, ChannelFollowedSchema);
      return {
        ...formattedData,
        follower: {
          ...formattedData.follower,
          ...this.createUserActions(formattedData.follower.userId),
        },
      };
    },
    "channel.subscription.renewal": (data: unknown) => {
      const { createdAt, expiresAt, ...formattedData } = parseData(
        data,
        ChannelSubscriptionRenewalSchema,
      );
      return {
        ...formattedData,
        subscriber: {
          ...formattedData.subscriber,
          ...this.createUserActions(formattedData.subscriber.userId),
        },
        createdAt: new Date(createdAt),
        expiresAt: new Date(expiresAt),
      };
    },
    "channel.subscription.gifts": (data: unknown) => {
      const { createdAt, expiresAt, ...formattedData } = parseData(
        data,
        ChannelSubscriptionGiftsSchema,
      );
      return {
        ...formattedData,
        gifter: formattedData.gifter.isAnonymous
          ? { isAnonymous: true as const }
          : {
              ...formattedData.gifter,
              ...this.createUserActions(formattedData.gifter.userId),
            },
        giftees: formattedData.giftees.map((giftee) => ({
          ...giftee,
          ...this.createUserActions(giftee.userId),
        })),
        createdAt: new Date(createdAt),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      };
    },
    "channel.subscription.new": (data: unknown) => {
      const { createdAt, expiresAt, ...formattedData } = parseData(
        data,
        ChannelSubscriptionNewSchema,
      );
      return {
        ...formattedData,
        subscriber: {
          ...formattedData.subscriber,
          ...this.createUserActions(formattedData.subscriber.userId),
        },
        createdAt: new Date(createdAt),
        expiresAt: new Date(expiresAt),
      };
    },
    "channel.reward.redemption.updated": (data: unknown) => {
      const { redeemedAt, ...formattedData } = parseData(
        data,
        ChannelRewardRedemptionUpdatedSchema,
      );
      return {
        ...formattedData,
        redeemer: {
          ...formattedData.redeemer,
          ...this.createUserActions(formattedData.redeemer.userId),
        },
        redeemedAt: new Date(redeemedAt),
      };
    },
    "livestream.status.updated": (data: unknown) => {
      const { startedAt, endedAt, ...formattedData } = parseData(
        data,
        LivestreamStatusUpdatedSchema,
      );
      return {
        ...formattedData,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt || 0),
      };
    },
    "livestream.metadata.updated": (data: unknown) => {
      return parseData(data, LivestreamMetadataUpdatedSchema);
    },
    "moderation.banned": (data: unknown) => {
      const {
        metadata: { createdAt, expiresAt, ...metadata },
        ...formattedData
      } = parseData(data, ModerationBannedSchema);
      return {
        ...formattedData,
        bannedUser: {
          ...formattedData.bannedUser,
          ...this.createUserActions(formattedData.bannedUser.userId),
        },
        metadata: {
          ...metadata,
          createdAt: new Date(createdAt),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      };
    },
    "kicks.gifted": (data: unknown) => {
      const { createdAt, ...formattedData } = parseData(
        data,
        KicksGiftedSchema,
      );
      return {
        ...formattedData,
        sender: {
          ...formattedData.sender,
          ...this.createUserActions(formattedData.sender.userId),
        },
        createdAt: new Date(createdAt),
      };
    },
  };

  constructor(token: Token, options?: ClientOptions) {
    this.categories = new CategoriesAPI(this, token, options);
    this.users = new UsersAPI(this, token, options);
    this.channels = new ChannelsAPI(this, token, options);
    this.livestreams = new LivestreamsAPI(this, token, options);
    this.events = new EventsAPI(this, token, options);
  }

  protected createWebhookHandler(
    onMessage: (data: unknown) => unknown,
  ): (req: Request) => Promise<Response> {
    return async (req) => {
      try {
        const messageId = req.headers.get("kick-event-message-id");
        const timestamp = req.headers.get("kick-event-message-timestamp");
        const signature = req.headers.get("kick-event-signature");

        if (!messageId || !timestamp || !signature) {
          return new Response(undefined, { status: 401 });
        }

        const verifier = crypto.createVerify("RSA-SHA256");
        verifier.update(`${messageId}.${timestamp}.${await req.text()}`);
        verifier.end();

        const signatureBuffer = Buffer.from(signature, "base64");
        const valid = verifier.verify(publicKey, signatureBuffer);

        if (!valid) return new Response(undefined, { status: 401 });

        await onMessage(await req.json());

        return new Response(undefined, { status: 200 });
      } catch {
        return new Response(undefined, { status: 401 });
      }
    };
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

  createKickWebhookHandler<T extends keyof typeof this.eventDataFormatters>(
    event: T,
    onMessage: (
      data: ReturnType<(typeof this.eventDataFormatters)[T]>,
    ) => unknown,
  ) {
    return this.createWebhookHandler((data) =>
      onMessage(
        this.eventDataFormatters[event](data) as ReturnType<
          (typeof this.eventDataFormatters)[T]
        >,
      ),
    );
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
    "chat.message.sent": (data: unknown) => {
      const formattedData = this.eventDataFormatters["chat.message.sent"](data);
      return {
        ...formattedData,
        repliesTo: formattedData.repliesTo && {
          ...formattedData.repliesTo,
          sender: {
            ...formattedData.repliesTo.sender,
            ...this.createModerationActions(
              formattedData.repliesTo.sender.userId,
              formattedData.broadcaster.userId,
            ),
          },
        },
        sender: {
          ...formattedData.sender,
          ...this.createModerationActions(
            formattedData.sender.userId,
            formattedData.broadcaster.userId,
          ),
        },
      };
    },
    "channel.followed": (data: unknown) => {
      const formattedData = this.eventDataFormatters["channel.followed"](data);
      return {
        ...formattedData,
        follower: {
          ...formattedData.follower,
          ...this.createModerationActions(
            formattedData.follower.userId,
            formattedData.broadcaster.userId,
          ),
        },
      };
    },
    "channel.subscription.renewal": (data: unknown) => {
      const formattedData =
        this.eventDataFormatters["channel.subscription.renewal"](data);
      return {
        ...formattedData,
        subscriber: {
          ...formattedData.subscriber,
          ...this.createModerationActions(
            formattedData.subscriber.userId,
            formattedData.broadcaster.userId,
          ),
        },
      };
    },
    "channel.subscription.gifts": (data: unknown) => {
      const formattedData =
        this.eventDataFormatters["channel.subscription.gifts"](data);
      return {
        ...formattedData,
        gifter: formattedData.gifter.isAnonymous
          ? { isAnonymous: true as const }
          : {
              ...formattedData.gifter,
              ...this.createModerationActions(
                formattedData.gifter.userId,
                formattedData.broadcaster.userId,
              ),
            },
      };
    },
    "channel.subscription.new": (data: unknown) => {
      const formattedData =
        this.eventDataFormatters["channel.subscription.new"](data);
      return {
        ...formattedData,
        subscriber: {
          ...formattedData.subscriber,
          ...this.createModerationActions(
            formattedData.subscriber.userId,
            formattedData.broadcaster.userId,
          ),
        },
      };
    },
    "channel.reward.redemption.updated": (data: unknown) => {
      const formattedData =
        this.eventDataFormatters["channel.reward.redemption.updated"](data);
      return {
        ...formattedData,
        reward: {
          ...formattedData.reward,
          delete: () =>
            this.channelRewards.deleteChannelReward(formattedData.reward.id),
          update: (options: UpdateChannelRewardParams) =>
            this.channelRewards.updateChannelReward(
              formattedData.reward.id,
              options,
            ),
        },
        redeemer: {
          ...formattedData.redeemer,
          ...this.createModerationActions(
            formattedData.redeemer.userId,
            formattedData.broadcaster.userId,
          ),
        },
      };
    },
    "livestream.status.updated":
      this.eventDataFormatters["livestream.status.updated"],
    "livestream.metadata.updated":
      this.eventDataFormatters["livestream.metadata.updated"],
    "moderation.banned": (data: unknown) => {
      const formattedData = this.eventDataFormatters["moderation.banned"](data);
      return {
        ...formattedData,
        bannedUser: {
          ...formattedData.bannedUser,
          ...this.createModerationActions(
            formattedData.bannedUser.userId,
            formattedData.broadcaster.userId,
          ),
        },
      };
    },
    "kicks.gifted": (data: unknown) => {
      const formattedData = this.eventDataFormatters["kicks.gifted"](data);
      return {
        ...formattedData,
        sender: {
          ...formattedData.sender,
          ...this.createModerationActions(
            formattedData.sender.userId,
            formattedData.broadcaster.userId,
          ),
        },
      };
    },
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

  createKickWebhookHandler<T extends keyof typeof this.userEventDataFormatters>(
    event: T,
    onMessage: (
      data: ReturnType<(typeof this.userEventDataFormatters)[T]>,
    ) => unknown,
  ) {
    return this.createWebhookHandler((data) =>
      onMessage(
        this.userEventDataFormatters[event](data) as ReturnType<
          (typeof this.userEventDataFormatters)[T]
        >,
      ),
    );
  }
}
