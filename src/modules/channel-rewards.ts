import z from "zod";
import { KickAPIClient } from "../api-client.js";

const ChannelRewardsSchema = z.array(
  z.object({
    background_color: z.string(),
    cost: z.number(),
    description: z.string(),
    id: z.string(),
    is_enabled: z.boolean(),
    is_paused: z.boolean(),
    is_user_input_required: z.boolean(),
    should_redemptions_skip_request_queue: z.boolean(),
    title: z.string(),
  })
);

export class ChannelRewardsAPI extends KickAPIClient {
  getChannelRewards() {
    return this.get("/channels/rewards", ChannelRewardsSchema, true, [
      "channel:rewards:write",
    ]);
  }
}
