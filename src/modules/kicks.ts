import z from "zod";
import { KickAPIClient } from "../api-client.js";
import { parseSchema } from "../utils.js";

const GetKicksLeaderboardOptionsSchema = z.int().min(1).max(100);

const KicksDataSchema = z.array(
  z.object({
    gifted_amount: z.number(),
    rank: z.number(),
    user_id: z.number(),
    username: z.string(),
  })
);

const KicksLeaderboardSchema = z.object({
  lifetime: KicksDataSchema,
  month: KicksDataSchema,
  week: KicksDataSchema,
});

export class KicksAPI extends KickAPIClient {
  getKicksLeaderboard(top?: number) {
    this.requireScopes("kicks:read");

    const params = new URLSearchParams();

    if (top) {
      parseSchema(GetKicksLeaderboardOptionsSchema, top);
      params.append("top", top.toString());
    }

    return this.get("/kicks/leaderboard", KicksLeaderboardSchema);
  }
}
