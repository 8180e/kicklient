import z from "zod";
import { KickAPIClient } from "../api-client.js";
import type { CamelCaseKeys } from "camelcase-keys";
import decamelizeKeys from "decamelize-keys";

interface CreateChannelRewardParams {
  backgroundColor?: string;
  cost: number;
  description?: string;
  isEnabled?: boolean;
  isUserInputRequired?: boolean;
  shouldRedemptionsSkipRequestQueue?: boolean;
  title: string;
}

type UpdateChannelRewardParams = Partial<CreateChannelRewardParams>;

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

const ChannelRewardsSchema = z.object({ data: z.array(ChannelRewardSchema) });

export class ChannelRewardsAPI extends KickAPIClient {
  private readonly endpoint = "/v1/channels/rewards";

  private createRewardObject(
    data: CamelCaseKeys<z.infer<typeof ChannelRewardSchema>>,
  ) {
    return {
      ...data,
      delete: () => this.deleteChannelReward(data.id),
      update: (options: UpdateChannelRewardParams) =>
        this.updateChannelReward(data.id, options),
    };
  }

  async getChannelRewards() {
    const { data } = await this.get(this.endpoint, ChannelRewardsSchema);
    return data.map((data) => this.createRewardObject(data));
  }

  async createChannelReward(params: CreateChannelRewardParams) {
    const res = await this.post(this.endpoint, decamelizeKeys(params));
    return this.createRewardObject(await res.getData(ChannelRewardSchema));
  }

  deleteChannelReward(id: string) {
    return this.delete(`${this.endpoint}/${id}`);
  }

  async updateChannelReward(id: string, params: UpdateChannelRewardParams) {
    const reqBody = decamelizeKeys(params);
    const res = await this.patch(`${this.endpoint}/${id}`, reqBody);
    return this.createRewardObject(await res.getData(ChannelRewardSchema));
  }
}
