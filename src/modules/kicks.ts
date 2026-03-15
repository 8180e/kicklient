import z from "zod";
import { KickAPIClient } from "../api-client.js";

interface GetKicksLeaderboardParams {
  top?: number;
}

const KicksDataSchema = z.array(
  z.object({
    gifted_amount: z.number(),
    rank: z.number(),
    user_id: z.number(),
    username: z.string(),
  }),
);

const KicksLeaderboardSchema = z.object({
  lifetime: KicksDataSchema,
  month: KicksDataSchema,
  week: KicksDataSchema,
});

export class KicksAPI extends KickAPIClient {
  async getKicksLeaderboard({ top }: GetKicksLeaderboardParams) {
    const params = new URLSearchParams();
    if (top) params.append("top", top.toString());

    return (await this.get("/v1/kicks/leaderboard", KicksLeaderboardSchema))
      .data;
  }
}
