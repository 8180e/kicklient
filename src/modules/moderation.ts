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

const RemoveBanOptionsSchema = z.object({
  broadcasterUserId: z.int(),
  userId: z.int(),
});

export class ModerationAPI extends KickAPIClient {
  async banUser(options: z.infer<typeof BanUserOptionsSchema>) {
    this.requireScopesWithUserToken("moderation:ban");
    await this.post("/moderation/bans", options, BanUserOptionsSchema);
  }

  async timeoutUser(options: z.infer<typeof TimeoutUserOptionsSchema>) {
    this.requireScopesWithUserToken("moderation:ban");
    await this.post("/moderation/bans", options, TimeoutUserOptionsSchema);
  }

  async removeBan(options: z.infer<typeof RemoveBanOptionsSchema>) {
    this.requireScopesWithUserToken("moderation:ban");
    await this.delete("/moderation/bans", options, RemoveBanOptionsSchema);
  }
}
