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

const LivestreamMetadataOptionsSchema = z.object({
  categoryId: z.int().optional(),
  customTags: z.array(z.string()).optional(),
  streamTitle: z.string().optional(),
});

export class ChannelsAPI extends KickAPIClient {
  async getAuthenticatedUserChannel() {
    this.requireUserToken();
    this.requireScopes("channel:read");
    const channel = (await this.get("/channels", ChannelsSchema))[0];
    if (!channel) {
      throw new KickAPIError({
        message: "Expected the API to return a channel, but got no channel",
      });
    }
    return {
      ...channel,
      stream: {
        ...channel.stream,
        startTime: new Date(channel.stream.startTime),
      },
    };
  }

  async getChannelsByBroadcasterId(...ids: number[]) {
    this.requireScopes("channel:read");
    if (ids.length > 50) {
      throw new KickAPIError({
        message: "Can not provide more than 50 user IDs",
      });
    }
    const params = new URLSearchParams();
    for (const id of ids) {
      params.append("broadcaster_user_id", id.toString());
    }
    return (await this.get(`/channels?${params}`, ChannelsSchema)).map(
      ({ stream: { startTime, ...stream }, ...channel }) => ({
        ...channel,
        stream: { ...stream, startTime: new Date(startTime) },
      })
    );
  }

  async getChannelsBySlug(...slugs: string[]) {
    this.requireScopes("channel:read");
    if (slugs.length > 50) {
      throw new KickAPIError({ message: "Can not provide more than 50 slugs" });
    }
    if (slugs.some((slug) => slug.length > 25)) {
      throw new KickAPIError({
        message: "A slug can not have more than 25 characters",
      });
    }
    const params = new URLSearchParams();
    for (const slug of slugs) {
      params.append("slug", slug);
    }
    return (await this.get(`/channels?${params}`, ChannelsSchema)).map(
      ({ stream: { startTime, ...stream }, ...channel }) => ({
        ...channel,
        stream: { ...stream, startTime: new Date(startTime) },
      })
    );
  }

  async updateLivestreamMetadata(
    options: z.infer<typeof LivestreamMetadataOptionsSchema>
  ) {
    this.requireUserToken();
    this.requireScopes("channel:write");
    await this.patch("/channels", options, LivestreamMetadataOptionsSchema);
  }
}
