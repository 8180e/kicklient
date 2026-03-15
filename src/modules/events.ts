import z from "zod";
import { KickAPIClient } from "../api-client.js";

interface CreateEventsSubscriptionsParams {
  broadcasterUserId: number;
  events: z.infer<typeof EventSchema>[];
}

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
  }),
);

const CreateEventResponseSchema = z.array(
  z.object({
    subscription_id: z.string(),
    name: EventSchema,
    version: z.number(),
  }),
);

export type KickEvent = z.infer<typeof EventSchema>;

export class EventsAPI extends KickAPIClient {
  async getEventsSubscriptions(broadcasterUserId?: number) {
    const params = new URLSearchParams();
    if (broadcasterUserId) {
      params.append("broadcaster_user_id", broadcasterUserId.toString());
    }

    const { data } = await this.get(
      `/v1/events/subscriptions?${params}`,
      EventSubscriptionSchema,
    );

    return data.map(({ createdAt, updatedAt, ...subscription }) => ({
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      ...subscription,
      delete: () => this.deleteEventsSubscriptions(subscription.id),
    }));
  }

  async createEventsSubscriptions({
    broadcasterUserId,
    events,
  }: CreateEventsSubscriptionsParams) {
    const res = await this.post("/v1/events/subscriptions", {
      broadcaster_user_id: broadcasterUserId,
      events: events.map((name) => ({ name, version: 1 })),
      method: "webhook",
    });
    const { data } = await res.getData(CreateEventResponseSchema);
    return data.map((subscription) => ({
      ...subscription,
      delete: () => this.deleteEventsSubscriptions(subscription.subscriptionId),
    }));
  }

  deleteEventsSubscriptions(...ids: string[]) {
    const params = new URLSearchParams();
    for (const id of ids) params.append("id", id);
    return this.delete(`/v1/events/subscriptions?${params}`);
  }
}

export class UserEventsAPI extends EventsAPI {
  async createEventsSubscriptions({
    events,
  }: Omit<CreateEventsSubscriptionsParams, "broadcasterUserId">) {
    const res = await this.post("/v1/events/subscriptions", {
      events: events.map((name) => ({ name, version: 1 })),
      method: "webhook",
    });
    const { data } = await res.getData(CreateEventResponseSchema);

    return data.map((subscription) => ({
      ...subscription,
      delete: () => this.deleteEventsSubscriptions(subscription.subscriptionId),
    }));
  }
}
