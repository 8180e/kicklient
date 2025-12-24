import crypto from "crypto";
import express from "express";
import { AppClient, type UserClient } from "./client.js";
import { EventSchema, type KickEvent } from "./modules/events.js";
import z from "zod";
import { formatData, parseSchema } from "./utils.js";
import type { UpdateChannelRewardOptions } from "./modules/channel-rewards.js";

const PublicKeySchema = z.object({
  data: z.object({ public_key: z.string() }),
});

const UserSchema = z.object({
  is_anonymous: z.boolean(),
  user_id: z.number(),
  username: z.string(),
  is_verified: z.boolean(),
  profile_picture: z.string(),
  channel_slug: z.string(),
});

const BaseEventSchema = z.object({ broadcaster: UserSchema });

const eventSchemas = {
  "chat.message.sent": BaseEventSchema.extend({
    message_id: z.string(),
    replies_to: z.union([
      z.object({
        message_id: z.string(),
        content: z.string(),
        sender: UserSchema,
      }),
      z.null(),
    ]),
    sender: UserSchema.extend({
      identity: z.object({
        username_color: z.string(),
        badges: z.array(
          z.object({
            text: z.string(),
            type: z.string(),
            count: z.number().optional(),
          })
        ),
      }),
    }),
    content: z.string(),
    emotes: z.array(
      z.object({
        emote_id: z.string(),
        positions: z.array(z.object({ s: z.number(), e: z.number() })),
      })
    ),
  }),

  "channel.followed": BaseEventSchema.extend({ follower: UserSchema }),

  "channel.subscription.renewal": BaseEventSchema.extend({
    subscriber: UserSchema,
    duration: z.number(),
    created_at: z.string(),
    expires_at: z.string(),
  }),

  "channel.subscription.gifts": BaseEventSchema.extend({
    gifter: z.union([UserSchema, z.object({ is_anonymous: z.literal(true) })]),
    giftees: z.array(UserSchema),
    created_at: z.string(),
    expires_at: z.string(),
  }),

  "channel.subscription.new": BaseEventSchema.extend({
    subscriber: UserSchema,
    duration: z.number(),
    created_at: z.string(),
    expires_at: z.string(),
  }),

  "channel.reward.redemption.updated": BaseEventSchema.extend({
    id: z.string(),
    user_input: z.string(),
    status: z.enum(["pending", "accepted", "rejected"]),
    redeemed_at: z.string(),
    reward: z.object({
      id: z.string(),
      title: z.string(),
      cost: z.number(),
      description: z.string(),
    }),
    redeemer: UserSchema.omit({ is_anonymous: true }),
    broadcaster: UserSchema.omit({ is_anonymous: true }),
  }),

  "livestream.status.updated": BaseEventSchema.extend({
    is_live: z.boolean(),
    title: z.string(),
    started_at: z.string(),
    ended_at: z.union([z.string(), z.null()]),
  }),

  "livestream.metadata.updated": BaseEventSchema.extend({
    metadata: z.object({
      title: z.string(),
      language: z.string(),
      has_mature_content: z.boolean(),
      category: z.object({
        id: z.number(),
        name: z.string(),
        thumbnail: z.string(),
      }),
    }),
  }),

  "moderation.banned": BaseEventSchema.extend({
    moderator: UserSchema,
    banned_user: UserSchema,
    metadata: z.object({
      reason: z.string(),
      created_at: z.string(),
      expires_at: z.union([z.string(), z.null()]),
    }),
  }),

  "kicks.gifted": BaseEventSchema.extend({
    broadcaster: UserSchema.omit({ is_anonymous: true }),
    sender: UserSchema.omit({ is_anonymous: true }),
    gift: z.object({
      amount: z.number(),
      name: z.string(),
      type: z.string(),
      tier: z.string(),
      message: z.string(),
      pinned_time_seconds: z.number(),
    }),
    created_at: z.string(),
  }),
};

function createUserActions(client: UserClient | AppClient, userId: number) {
  return {
    async getChannel() {
      return (await client.channels.getChannelsByBroadcasterId(userId))[0]!;
    },
    async getLivestream() {
      return (
        await client.livestreams.getLivestreams({ broadcasterUserId: userId })
      )[0]!;
    },
  };
}

function createUserModerationActions(
  client: UserClient,
  userId: number,
  broadcasterUserId: number
) {
  return {
    async ban(reason?: string) {
      await client.moderation.banUser({ broadcasterUserId, userId, reason });
    },
    async timeout(duration: number, reason?: string) {
      await client.moderation.timeoutUser({
        broadcasterUserId,
        userId,
        duration,
        reason,
      });
    },
    async removeBan() {
      await client.moderation.removeBan({ broadcasterUserId, userId });
    },
  };
}

function createEventDataFormatters(client: AppClient | UserClient) {
  return {
    "chat.message.sent"(data: unknown) {
      const formattedData = formatData(eventSchemas["chat.message.sent"], data);
      return {
        ...formattedData,
        repliesTo: formattedData.repliesTo && {
          ...formattedData.repliesTo,
          sender: {
            ...formattedData.repliesTo.sender,
            ...createUserActions(client, formattedData.repliesTo.sender.userId),
          },
        },
        sender: {
          ...formattedData.sender,
          ...createUserActions(client, formattedData.sender.userId),
        },
      };
    },
    "channel.followed"(data: unknown) {
      const formattedData = formatData(eventSchemas["channel.followed"], data);
      return {
        ...formattedData,
        follower: {
          ...formattedData.follower,
          ...createUserActions(client, formattedData.follower.userId),
        },
      };
    },
    "channel.subscription.renewal"(data: unknown) {
      const { createdAt, expiresAt, ...formattedData } = formatData(
        eventSchemas["channel.subscription.renewal"],
        data
      );
      return {
        ...formattedData,
        subscriber: {
          ...formattedData.subscriber,
          ...createUserActions(client, formattedData.subscriber.userId),
        },
        createdAt: new Date(createdAt),
        expiresAt: new Date(expiresAt),
      };
    },
    "channel.subscription.gifts"(data: unknown) {
      const { createdAt, expiresAt, ...formattedData } = formatData(
        eventSchemas["channel.subscription.gifts"],
        data
      );
      return {
        ...formattedData,
        gifter: formattedData.gifter.isAnonymous
          ? { isAnonymous: true as const }
          : {
              ...formattedData.gifter,
              ...createUserActions(client, formattedData.gifter.userId),
            },
        giftees: formattedData.giftees.map((giftee) => ({
          ...giftee,
          ...createUserActions(client, giftee.userId),
        })),
        createdAt: new Date(createdAt),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      };
    },
    "channel.subscription.new"(data: unknown) {
      const { createdAt, expiresAt, ...formattedData } = formatData(
        eventSchemas["channel.subscription.new"],
        data
      );
      return {
        ...formattedData,
        subscriber: {
          ...formattedData.subscriber,
          ...createUserActions(client, formattedData.subscriber.userId),
        },
        createdAt: new Date(createdAt),
        expiresAt: new Date(expiresAt),
      };
    },
    "channel.reward.redemption.updated"(data: unknown) {
      const { redeemedAt, ...formattedData } = formatData(
        eventSchemas["channel.reward.redemption.updated"],
        data
      );
      return {
        ...formattedData,
        redeemer: {
          ...formattedData.redeemer,
          ...createUserActions(client, formattedData.redeemer.userId),
        },
        redeemedAt: new Date(redeemedAt),
      };
    },
    "livestream.status.updated"(data: unknown) {
      const { startedAt, endedAt, ...formattedData } = formatData(
        eventSchemas["livestream.status.updated"],
        data
      );
      return {
        ...formattedData,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt || 0),
      };
    },
    "livestream.metadata.updated"(data: unknown) {
      return formatData(eventSchemas["livestream.metadata.updated"], data);
    },
    "moderation.banned"(data: unknown) {
      const {
        metadata: { createdAt, expiresAt, ...metadata },
        ...formattedData
      } = formatData(eventSchemas["moderation.banned"], data);
      return {
        ...formattedData,
        bannedUser: {
          ...formattedData.bannedUser,
          ...createUserActions(client, formattedData.bannedUser.userId),
        },
        metadata: {
          ...metadata,
          createdAt: new Date(createdAt),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      };
    },
    "kicks.gifted"(data: unknown) {
      const { createdAt, ...formattedData } = formatData(
        eventSchemas["kicks.gifted"],
        data
      );
      return {
        ...formattedData,
        sender: {
          ...formattedData.sender,
          ...createUserActions(client, formattedData.sender.userId),
        },
        createdAt: new Date(createdAt),
      };
    },
  };
}

function createUserEventDataFormatters(client: UserClient) {
  const formatters = createEventDataFormatters(client);
  return {
    "chat.message.sent"(data: unknown) {
      const formattedData = formatters["chat.message.sent"](data);
      return {
        ...formattedData,
        repliesTo: formattedData.repliesTo && {
          ...formattedData.repliesTo,
          sender: {
            ...formattedData.repliesTo.sender,
            ...createUserModerationActions(
              client,
              formattedData.repliesTo.sender.userId,
              formattedData.broadcaster.userId
            ),
          },
        },
        sender: {
          ...formattedData.sender,
          ...createUserModerationActions(
            client,
            formattedData.sender.userId,
            formattedData.broadcaster.userId
          ),
        },
      };
    },
    "channel.followed"(data: unknown) {
      const formattedData = formatters["channel.followed"](data);
      return {
        ...formattedData,
        follower: {
          ...formattedData.follower,
          ...createUserModerationActions(
            client,
            formattedData.follower.userId,
            formattedData.broadcaster.userId
          ),
        },
      };
    },
    "channel.subscription.renewal"(data: unknown) {
      const formattedData = formatters["channel.subscription.renewal"](data);
      return {
        ...formattedData,
        subscriber: {
          ...formattedData.subscriber,
          ...createUserModerationActions(
            client,
            formattedData.subscriber.userId,
            formattedData.broadcaster.userId
          ),
        },
      };
    },
    "channel.subscription.gifts"(data: unknown) {
      const formattedData = formatters["channel.subscription.gifts"](data);
      return {
        ...formattedData,
        gifter: formattedData.gifter.isAnonymous
          ? { isAnonymous: true as const }
          : {
              ...formattedData.gifter,
              ...createUserModerationActions(
                client,
                formattedData.gifter.userId,
                formattedData.broadcaster.userId
              ),
            },
      };
    },
    "channel.subscription.new"(data: unknown) {
      const formattedData = formatters["channel.subscription.new"](data);
      return {
        ...formattedData,
        subscriber: {
          ...formattedData.subscriber,
          ...createUserModerationActions(
            client,
            formattedData.subscriber.userId,
            formattedData.broadcaster.userId
          ),
        },
      };
    },
    "channel.reward.redemption.updated"(data: unknown) {
      const formattedData =
        formatters["channel.reward.redemption.updated"](data);
      return {
        ...formattedData,
        reward: {
          ...formattedData.reward,
          async delete() {
            await client.channelRewards.deleteChannelReward(
              formattedData.reward.id
            );
          },
          async update(options: UpdateChannelRewardOptions) {
            await client.channelRewards.updateChannelReward(
              formattedData.reward.id,
              options
            );
          },
        },
        redeemer: {
          ...formattedData.redeemer,
          ...createUserModerationActions(
            client,
            formattedData.redeemer.userId,
            formattedData.broadcaster.userId
          ),
        },
      };
    },
    "livestream.status.updated"(data: unknown) {
      return formatters["livestream.status.updated"](data);
    },
    "livestream.metadata.updated"(data: unknown) {
      return formatters["livestream.metadata.updated"](data);
    },
    "moderation.banned"(data: unknown) {
      const formattedData = formatters["moderation.banned"](data);
      return {
        ...formattedData,
        bannedUser: {
          ...formattedData.bannedUser,
          ...createUserModerationActions(
            client,
            formattedData.bannedUser.userId,
            formattedData.broadcaster.userId
          ),
        },
      };
    },
    "kicks.gifted"(data: unknown) {
      const formattedData = formatters["kicks.gifted"](data);
      return {
        ...formattedData,
        sender: {
          ...formattedData.sender,
          ...createUserModerationActions(
            client,
            formattedData.sender.userId,
            formattedData.broadcaster.userId
          ),
        },
      };
    },
  };
}

type KickEventHandlers = {
  [E in KickEvent]: <E extends KickEvent>(
    payload: ReturnType<
      ReturnType<
        typeof createEventDataFormatters | typeof createUserEventDataFormatters
      >[E]
    >
  ) => unknown;
};

interface User {
  formatters: ReturnType<
    typeof createEventDataFormatters | typeof createUserEventDataFormatters
  >;
  handlers: Partial<KickEventHandlers>;
}

export class KickAPIEvents {
  private readonly app = express();
  private readonly users = new Map<number, User>();
  private key = crypto.createPublicKey(`
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----
`);

  constructor(port = 3000) {
    this.app.use(
      express.json({ verify: (req, _res, buf) => (req.rawBody = buf) })
    );

    this.app.post("/", async (req, res) => {
      const messageId = req.headers["kick-event-message-id"];
      const timestamp = req.headers["kick-event-message-timestamp"];
      const signatureBase64 = req.headers["kick-event-signature"];

      if (!messageId || !timestamp || typeof signatureBase64 !== "string") {
        return res.sendStatus(401);
      }

      const verifySignature = () =>
        crypto.verify(
          "sha256",
          Buffer.from(`${messageId}.${timestamp}.${req.rawBody.toString()}`),
          { key: this.key, padding: crypto.constants.RSA_PKCS1_PADDING },
          Buffer.from(signatureBase64, "base64")
        );

      if (!verifySignature()) {
        this.key = crypto.createPublicKey(
          parseSchema(
            PublicKeySchema,
            await (
              await fetch("https://api.kick.com/public/v1/public-key")
            ).json()
          ).data.public_key
        );
        if (!verifySignature()) {
          return res.sendStatus(401);
        }
      }

      const eventType = parseSchema(
        EventSchema,
        req.headers["kick-event-type"]
      );

      const user = this.users.get(req.body.broadcaster.user_id);

      await user?.handlers[eventType]?.(user.formatters[eventType](req.body));

      res.sendStatus(200);
    });

    this.app.listen(port);
  }

  async on<E extends KickEvent, C extends AppClient | UserClient>(
    event: E,
    userId: number,
    client: C,
    callback: (
      payload: ReturnType<
        ReturnType<
          C extends AppClient
            ? typeof createEventDataFormatters
            : typeof createUserEventDataFormatters
        >[E]
      >
    ) => unknown
  ) {
    if (client instanceof AppClient) {
      await client.events.createEventsSubscriptions(userId, [event]);
    } else {
      await client.events.createEventsSubscriptions([event]);
    }

    const user = this.users.get(userId);

    if (user) {
      user.handlers = { ...user.handlers, [event]: callback };
    } else {
      this.users.set(userId, {
        formatters:
          client instanceof AppClient
            ? createEventDataFormatters(client)
            : createUserEventDataFormatters(client),
        handlers: { [event]: callback },
      });
    }
  }
}
