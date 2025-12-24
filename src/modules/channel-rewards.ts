import z from "zod";
import { UserKickAPIClient } from "../api-client.js";
import type { FormattedType } from "../utils.js";

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

const ChannelRewardOptionsUpdateSchema = ChannelRewardOptionsSchema.partial();

type UpdateChannelRewardOptions = z.infer<
  typeof ChannelRewardOptionsUpdateSchema
>;

export class ChannelRewardsAPI extends UserKickAPIClient {
  private createRewardObject(data: FormattedType<typeof ChannelRewardSchema>) {
    const client = this;
    return {
      ...data,
      async delete() {
        await client.deleteChannelReward(data.id);
      },
      async update(options: UpdateChannelRewardOptions) {
        return await client.updateChannelReward(data.id, options);
      },
    };
  }

  async getChannelRewards() {
    this.requireScopes("channel:rewards:write");
    const rewards = (
      await this.get("/channels/rewards", ChannelRewardsSchema)
    ).map((data) => this.createRewardObject(data));
    return rewards;
  }

  async createChannelReward(
    options: z.infer<typeof ChannelRewardOptionsSchema>
  ) {
    this.requireScopes("channel:rewards:write");
    return this.createRewardObject(
      await (
        await this.post(
          "/channels/rewards",
          options,
          ChannelRewardOptionsSchema
        )
      ).getData(ChannelRewardSchema)
    );
  }

  async deleteChannelReward(id: string) {
    this.requireScopes("channel:rewards:write");
    await this.delete(`/channels/rewards/${id}`);
  }

  async updateChannelReward(id: string, options: UpdateChannelRewardOptions) {
    this.requireScopes("channel:rewards:write");
    return this.createRewardObject(
      await (
        await this.patch(
          `/channels/rewards/${id}`,
          options,
          ChannelRewardOptionsUpdateSchema
        )
      ).getData(ChannelRewardSchema)
    );
  }
}
