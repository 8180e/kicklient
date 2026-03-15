import z from "zod";
import { KickAPIClient } from "../api-client.js";
import decamelizeKeys from "decamelize-keys";
import { KickError } from "../errors.js";

export interface GetLivestreamsParams {
  broadcasterUserIds?: number[];
  categoryId?: number;
  language?: string;
  limit?: number;
  sort?: "viewer_count" | "started_at";
}

const LivestreamsSchema = z.array(
  z.object({
    broadcaster_user_id: z.number(),
    category: z.object({
      id: z.number(),
      name: z.string(),
      thumbnail: z.string(),
    }),
    channel_id: z.number(),
    custom_tags: z.array(z.string()).optional(),
    has_mature_content: z.boolean(),
    language: z.string(),
    slug: z.string(),
    started_at: z.string(),
    stream_title: z.string(),
    thumbnail: z.string(),
    viewer_count: z.number(),
  }),
);

const LivestreamStatsSchema = z.object({ total_count: z.number() });

export class LivestreamsAPI extends KickAPIClient {
  async getLivestreams({
    broadcasterUserIds = [],
    categoryId,
    limit,
    ...params
  }: GetLivestreamsParams = {}) {
    const urlParams = new URLSearchParams(decamelizeKeys(params));
    for (const broadcasterUserId of broadcasterUserIds) {
      urlParams.append("broadcaster_user_id", broadcasterUserId.toString());
    }
    if (categoryId) urlParams.set("category_id", categoryId.toString());
    if (limit) urlParams.set("limit", limit.toString());

    const { data } = await this.get(
      `/v1/livestreams?${params}`,
      LivestreamsSchema,
    );

    return data.map(({ startedAt, ...stream }) => ({
      ...stream,
      startedAt: new Date(startedAt),
    }));
  }

  async getLivestreamByBroadcasterId(id: number) {
    const [stream] = await this.getLivestreams({ broadcasterUserIds: [id] });
    if (!stream) throw new KickError("Stream not found");
    return stream;
  }

  async getLivestreamsStats() {
    return (await this.get("/v1/livestreams/stats", LivestreamStatsSchema))
      .data;
  }
}
