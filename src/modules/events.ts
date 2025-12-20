import z from "zod";
import { KickAPIClient } from "../api-client.js";

const EventSchema = z.enum([
  "chat.message.sent",
  "channel.followed",
  "channel.subscription.renewal",
  "channel.subscription.gifts",
  "channel.subscription.new",
  "channel.reward.redemption.updated",
  "livestream.status.updated",
  "livestream.metadata.updated",
  "moderation.banned",
  "kicks.gifted",
]);

const EventSubscriptionSchema = z.array(
  z.object({
    app_id: z.string(),
    broadcaster_user_id: z.number(),
    created_at: z.string(),
    event: EventSchema,
    id: z.string(),
    method: z.string(),
    updated_at: z.string(),
    version: z.number(),
  })
);

const CreateEventRequestSchema = z.object({
  broadcasterUserId: z.int().optional(),
  events: z.array(z.object({ name: z.string(), version: z.int() })),
  method: z.literal("webhook"),
});

const CreateEventResponseSchema = z.array(
  z.object({
    subscription_id: z.string(),
    name: EventSchema,
    version: z.number(),
  })
);

export class EventsAPI extends KickAPIClient {
  async getEventsSubscriptions(broadcasterUserId?: number) {
    const params = new URLSearchParams();
    if (broadcasterUserId) {
      params.append("broadcaster_user_id", broadcasterUserId.toString());
    }
    return (
      await this.get(`/events/subscriptions?${params}`, EventSubscriptionSchema)
    ).map(({ createdAt, updatedAt, ...subscription }) => ({
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      ...subscription,
    }));
  }

  async createEventsSubscriptions(
    broadcasterUserId: number,
    events: z.infer<typeof EventSchema>[]
  ) {
    return (
      await this.post(
        "/events/subscriptions",
        {
          broadcasterUserId,
          events: events.map((name) => ({ name, version: 1 })),
          method: "webhook",
        },
        CreateEventRequestSchema
      )
    ).getData(CreateEventResponseSchema);
  }
}
