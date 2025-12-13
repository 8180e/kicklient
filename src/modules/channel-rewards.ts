import z from "zod";
import { KickAPIClient } from "../api-client.js";

const ChannelRewardSchema = z.object({
  background_color: z.string(),
  cost: z.number(),
  description: z.string(),
  id: z.string(),
  is_enabled: z.boolean(),
  is_paused: z.boolean(),
  is_user_input_required: z.boolean(),
  should_redemptions_skip_request_queue: z.boolean(),
  title: z.string(),
});

const ChannelRewardsSchema = z.array(ChannelRewardSchema);

const ChannelRewardOptionsSchema = z.object({
  backgroundColor: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, {
      error: "Invalid hex color format",
    })
    .optional(),
  cost: z.int().min(1),
  description: z.string().max(200).optional(),
  isEnabled: z.boolean().optional(),
  isUserInputRequired: z.boolean().optional(),
  shouldRedemptionsSkipRequestQueue: z.boolean().optional(),
  title: z.string().max(50),
});

export class ChannelRewardsAPI extends KickAPIClient {
  getChannelRewards() {
    return this.get("/channels/rewards", ChannelRewardsSchema, true, [
      "channel:rewards:write",
    ]);
  }

  createChannelReward(options: z.infer<typeof ChannelRewardOptionsSchema>) {
    return this.postWithResponseData(
      "/channels/rewards",
      options,
      ChannelRewardOptionsSchema,
      ChannelRewardSchema,
      true,
      ["channel:rewards:write"]
    );
  }

  async deleteChannelReward(id: string) {
    await this.delete(`/channels/rewards/${id}`, true, [
      "channel:rewards:write",
    ]);
  }
}
