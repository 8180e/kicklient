import type { ObjectLike } from "camelcase-keys";
import crypto from "crypto";
import z from "zod";
import { parseData } from "./utils.js";

const UserSchema = z.object({
  is_anonymous: z.boolean(),
  user_id: z.number(),
  username: z.string(),
  is_verified: z.boolean(),
  profile_picture: z.string(),
  channel_slug: z.string(),
});

const BaseEventSchema = z.object({ broadcaster: UserSchema });

const ChatMessageSentSchema = BaseEventSchema.extend({
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
        }),
      ),
    }),
  }),
  content: z.string(),
  emotes: z.array(
    z.object({
      emote_id: z.string(),
      positions: z.array(z.object({ s: z.number(), e: z.number() })),
    }),
  ),
});

const ChannelFollowedSchema = BaseEventSchema.extend({ follower: UserSchema });

const ChannelSubscriptionRenewalSchema = BaseEventSchema.extend({
  subscriber: UserSchema,
  duration: z.number(),
  created_at: z.string(),
  expires_at: z.string(),
});

const ChannelSubscriptionGiftsSchema = BaseEventSchema.extend({
  gifter: z.union([UserSchema, z.object({ is_anonymous: z.literal(true) })]),
  giftees: z.array(UserSchema),
  created_at: z.string(),
  expires_at: z.string(),
});

const ChannelSubscriptionNewSchema = BaseEventSchema.extend({
  subscriber: UserSchema,
  duration: z.number(),
  created_at: z.string(),
  expires_at: z.string(),
});

const ChannelRewardRedemptionUpdatedSchema = BaseEventSchema.extend({
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
});

const LivestreamStatusUpdatedSchema = BaseEventSchema.extend({
  is_live: z.boolean(),
  title: z.string(),
  started_at: z.string(),
  ended_at: z.union([z.string(), z.null()]),
});

const LivestreamMetadataUpdatedSchema = BaseEventSchema.extend({
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
});

const ModerationBannedSchema = BaseEventSchema.extend({
  moderator: UserSchema,
  banned_user: UserSchema,
  metadata: z.object({
    reason: z.string(),
    created_at: z.string(),
    expires_at: z.union([z.string(), z.null()]),
  }),
});

const KicksGiftedSchema = BaseEventSchema.extend({
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
});

const PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----
`;

interface EventSchemas {
  "chat.message.sent": typeof ChatMessageSentSchema;
  "channel.followed": typeof ChannelFollowedSchema;
  "channel.subscription.renewal": typeof ChannelSubscriptionRenewalSchema;
  "channel.subscription.gifts": typeof ChannelSubscriptionGiftsSchema;
  "channel.subscription.new": typeof ChannelSubscriptionNewSchema;
  "channel.reward.redemption.updated": typeof ChannelRewardRedemptionUpdatedSchema;
  "livestream.status.updated": typeof LivestreamStatusUpdatedSchema;
  "livestream.metadata.updated": typeof LivestreamMetadataUpdatedSchema;
  "moderation.banned": typeof ModerationBannedSchema;
  "kicks.gifted": typeof KicksGiftedSchema;
}

const publicKey = crypto.createPublicKey(PUBLIC_KEY);

export type FormattedEventData<T extends keyof EventSchemas> = ReturnType<
  typeof parseData<z.infer<EventSchemas[T]>>
>;

type Callbacks = {
  [K in keyof EventSchemas]?: (data: FormattedEventData<K>) => unknown;
};

type Handler = (req: Request) => Promise<Response>;

export function createWebhookHandler(callbacks: Callbacks): Handler {
  return async (req) => {
    try {
      const messageId = req.headers.get("kick-event-message-id");
      const timestamp = req.headers.get("kick-event-message-timestamp");
      const signature = req.headers.get("kick-event-signature");
      const event = req.headers.get("kick-event-type");

      if (!messageId || !timestamp || !signature || !event) {
        return new Response(undefined, { status: 401 });
      }

      const rawBody = await req.text();

      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(`${messageId}.${timestamp}.${rawBody}`);
      verifier.end();

      const signatureBuffer = Buffer.from(signature, "base64");
      const valid = verifier.verify(publicKey, signatureBuffer);

      if (!valid) return new Response(undefined, { status: 401 });

      const data = JSON.parse(rawBody);

      function callWithData<T extends ObjectLike | readonly ObjectLike[]>(
        Schema: z.ZodType<T>,
        handler?: (data: ReturnType<typeof parseData<T>>) => unknown,
      ) {
        return handler?.(parseData(data, Schema));
      }

      switch (event) {
        case "chat.message.sent":
          await callWithData(ChatMessageSentSchema, callbacks[event]);
          break;
        case "channel.followed":
          await callWithData(ChannelFollowedSchema, callbacks[event]);
          break;
        case "channel.subscription.renewal":
          await callWithData(
            ChannelSubscriptionRenewalSchema,
            callbacks[event],
          );
          break;
        case "channel.subscription.gifts":
          await callWithData(ChannelSubscriptionGiftsSchema, callbacks[event]);
          break;
        case "channel.subscription.new":
          await callWithData(ChannelSubscriptionNewSchema, callbacks[event]);
          break;
        case "channel.reward.redemption.updated":
          await callWithData(
            ChannelRewardRedemptionUpdatedSchema,
            callbacks[event],
          );
          break;
        case "livestream.status.updated":
          await callWithData(LivestreamStatusUpdatedSchema, callbacks[event]);
          break;
        case "livestream.metadata.updated":
          await callWithData(LivestreamMetadataUpdatedSchema, callbacks[event]);
          break;
        case "moderation.banned":
          await callWithData(ModerationBannedSchema, callbacks[event]);
          break;
        case "kicks.gifted":
          await callWithData(KicksGiftedSchema, callbacks[event]);
          break;
      }

      return new Response(undefined, { status: 200 });
    } catch {
      return new Response(undefined, { status: 401 });
    }
  };
}
