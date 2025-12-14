import z from "zod";
import { KickAPIClient } from "../api-client.js";

const BanUserOptionsSchema = z.object({
  broadcasterUserId: z.int(),
  reason: z.string().max(100).optional(),
  userId: z.int(),
});

const TimeoutUserOptionsSchema = BanUserOptionsSchema.extend({
  duration: z.int().min(1).max(10080),
});

export class ModerationAPI extends KickAPIClient {
  async banUser(options: z.infer<typeof BanUserOptionsSchema>) {
    await this.post("/moderation/bans", options, BanUserOptionsSchema, true, [
      "moderation:ban",
    ]);
  }

  async timeoutUser(options: z.infer<typeof TimeoutUserOptionsSchema>) {
    await this.post(
      "/moderation/bans",
      options,
      TimeoutUserOptionsSchema,
      true,
      ["moderation:ban"]
    );
  }
}
