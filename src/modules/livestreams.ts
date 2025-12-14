import z from "zod";
import { KickAPIClient } from "../api-client.js";
import { formatRequestBody } from "../utils.js";

const GetLivestreamsOptionsSchema = z
  .object({
    broadcasterUserId: z.union([z.int(), z.array(z.int()).max(50)]),
    categoryId: z.int(),
    language: z.string(),
    limit: z.int().min(1).max(100),
    sort: z.enum(["viewer_count", "started_at"]),
  })
  .partial();

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
  })
);

export class LivestreamsAPI extends KickAPIClient {
  async getLivestreams(options?: z.infer<typeof GetLivestreamsOptionsSchema>) {
    const params = new URLSearchParams();

    if (options) {
      const reqBody = formatRequestBody(GetLivestreamsOptionsSchema, options);

      for (const key in reqBody) {
        const value = reqBody[key as keyof typeof reqBody];

        if (Array.isArray(value)) {
          for (const v of value) {
            params.append(key, v.toString());
          }
        } else {
          if (value) {
            params.append(key, value.toString());
          }
        }
      }
    }

    return (await this.get(`/livestreams?${params}`, LivestreamsSchema)).map(
      ({ startedAt, ...stream }) => ({
        ...stream,
        startedAt: new Date(startedAt),
      })
    );
  }
}
