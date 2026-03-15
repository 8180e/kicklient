import crypto from "crypto";
import z from "zod";

const UserSchema = z.object({
  is_anonymous: z.boolean(),
  user_id: z.number(),
  username: z.string(),
  is_verified: z.boolean(),
  profile_picture: z.string(),
  channel_slug: z.string(),
});

export const BaseEventSchema = z.object({ broadcaster: UserSchema });

export const ChatMessageSentSchema = BaseEventSchema.extend({
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

export const ChannelFollowedSchema = BaseEventSchema.extend({
  follower: UserSchema,
});

export const ChannelSubscriptionRenewalSchema = BaseEventSchema.extend({
  subscriber: UserSchema,
  duration: z.number(),
  created_at: z.string(),
  expires_at: z.string(),
});

export const ChannelSubscriptionGiftsSchema = BaseEventSchema.extend({
  gifter: z.union([UserSchema, z.object({ is_anonymous: z.literal(true) })]),
  giftees: z.array(UserSchema),
  created_at: z.string(),
  expires_at: z.string(),
});

export const ChannelSubscriptionNewSchema = BaseEventSchema.extend({
  subscriber: UserSchema,
  duration: z.number(),
  created_at: z.string(),
  expires_at: z.string(),
});

export const ChannelRewardRedemptionUpdatedSchema = BaseEventSchema.extend({
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

export const LivestreamStatusUpdatedSchema = BaseEventSchema.extend({
  is_live: z.boolean(),
  title: z.string(),
  started_at: z.string(),
  ended_at: z.union([z.string(), z.null()]),
});

export const LivestreamMetadataUpdatedSchema = BaseEventSchema.extend({
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

export const ModerationBannedSchema = BaseEventSchema.extend({
  moderator: UserSchema,
  banned_user: UserSchema,
  metadata: z.object({
    reason: z.string(),
    created_at: z.string(),
    expires_at: z.union([z.string(), z.null()]),
  }),
});

export const KicksGiftedSchema = BaseEventSchema.extend({
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

export const publicKey = crypto.createPublicKey(PUBLIC_KEY);
