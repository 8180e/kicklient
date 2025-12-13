import z from "zod";
import { KickAPIClient } from "../api-client.js";
import { KickAPIError } from "../errors.js";

const ChannelsSchema = z.array(
  z.object({
    banner_picture: z.string(),
    broadcaster_user_id: z.number(),
    category: z.object({
      id: z.number(),
      name: z.string(),
      thumbnail: z.string(),
    }),
    channel_description: z.string(),
    slug: z.string(),
    stream: z.object({
      custom_tags: z.array(z.string()).optional(),
      is_live: z.boolean(),
      is_mature: z.boolean(),
      key: z.string(),
      language: z.string(),
      start_time: z.string(),
      thumbnail: z.string(),
      url: z.string(),
      viewer_count: z.number(),
    }),
    stream_title: z.string(),
  })
);

export class ChannelsAPI extends KickAPIClient {
  async getAuthenticatedUserChannel() {
    const channel = (
      await this.get("/channels", ChannelsSchema, true, ["channel:read"])
    )[0];
    if (!channel) {
      throw new KickAPIError({
        message: "Expected the API to return a channel, but got no channel",
      });
    }
    return channel;
  }

  getChannelsByBroadcasterId(...ids: number[]) {
    if (ids.length > 50) {
      throw new KickAPIError({
        message: "Can not provide more than 50 user IDs",
      });
    }
    const params = new URLSearchParams();
    for (const id of ids) {
      params.append("broadcaster_user_id", id.toString());
    }
    return this.get(`/channels?${params}`, ChannelsSchema, false, [
      "channel:read",
    ]);
  }
}
