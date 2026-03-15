import z from "zod";
import { KickAPIClient } from "../api-client.js";
import { KickError } from "../errors.js";
import decamelizeKeys from "decamelize-keys";

interface GetChannelsByBroadcasterIdsParams {
  ids: number[];
}

interface GetChannelsBySlugsParams {
  slugs: string[];
}

interface UpdateLivestreamMetadataParams {
  categoryId?: string;
  customTags?: string[];
  streamTitle?: string;
}

const ChannelsSchema = z.array(
  z.object({
    active_subscribers_count: z.number(),
    banner_picture: z.string(),
    broadcaster_user_id: z.number(),
    canceled_subscribers_count: z.number(),
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
  }),
);

export class ChannelsAPI extends KickAPIClient {
  protected async getChannelsData(params?: URLSearchParams) {
    return (
      await this.get(`/v1/channels?${params || ""}`, ChannelsSchema)
    ).data.map(({ stream: { startTime, ...stream }, ...channel }) => ({
      ...channel,
      stream: { ...stream, startTime: new Date(startTime) },
      getBroadcasterData: () =>
        this.client.users.getUserById(channel.broadcasterUserId),
    }));
  }

  getChannelsByBroadcasterIds({ ids }: GetChannelsByBroadcasterIdsParams) {
    const params = new URLSearchParams();
    for (const id of ids) params.append("broadcaster_user_id", id.toString());
    return this.getChannelsData(params);
  }

  getChannelsBySlug({ slugs }: GetChannelsBySlugsParams) {
    const params = new URLSearchParams();
    for (const slug of slugs) params.append("slug", slug);
    return this.getChannelsData(params);
  }
}

export class UserChannelsAPI extends ChannelsAPI {
  async getAuthenticatedUserChannel() {
    const channel = (await this.getChannelsData())[0];
    if (!channel) {
      throw new KickError(
        "Expected the API to return a channel, but got no channel",
      );
    }
    return channel;
  }

  async updateLivestreamMetadata(params: UpdateLivestreamMetadataParams) {
    await this.patch("/v1/channels", decamelizeKeys(params));
  }
}
