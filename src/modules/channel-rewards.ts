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

interface GetChannelRewardRedemptionsByIdsParams {
  ids: string[];
}

interface GetChannelRewardRedemptionsParams {
  rewardId?: string;
  status?: z.infer<typeof ChannelRewardRedemptionStatus>;
}

interface AcceptChannelRewardRedemptionsParams {
  ids: string[];
}

type RejectChannelRewardRedemptionsParams =
  AcceptChannelRewardRedemptionsParams;

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

const ChannelRewardRedemptionStatus = z.enum([
  "pending",
  "accepted",
  "rejected",
]);

const ChannelRewardRedemptionsSchema = z.array(
  z.object({
    redemptions: z.array(
      z.object({
        id: z.string(),
        redeemed_at: z.string(),
        redeemer: z.object({ user_id: z.number() }),
        status: ChannelRewardRedemptionStatus,
        user_input: z.string(),
      }),
    ),
    reward: z.object({
      can_manage: z.boolean(),
      cost: z.number(),
      description: z.string(),
      id: z.string(),
      is_deleted: z.boolean(),
      title: z.string(),
    }),
  }),
);

const AcceptChannelRewardRedemptionsResponse = z.array(
  z.object({ id: z.string(), reason: z.string() }),
);

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
    const { data } = await res.getData(ChannelRewardSchema);
    return this.createRewardObject(data);
  }

  deleteChannelReward(id: string) {
    return this.delete(`${this.endpoint}/${id}`);
  }

  async updateChannelReward(id: string, params: UpdateChannelRewardParams) {
    const reqBody = decamelizeKeys(params);
    const res = await this.patch(`${this.endpoint}/${id}`, reqBody);
    const { data } = await res.getData(ChannelRewardSchema);
    return this.createRewardObject(data);
  }

  private getChannelRewardRedemptionsData(params: URLSearchParams) {
    return this.getPaginatedData(
      `${this.endpoint}/redemptions`,
      params,
      ChannelRewardRedemptionsSchema,
    );
  }

  getChannelRewardRedemptionsByIds({
    ids,
  }: GetChannelRewardRedemptionsByIdsParams) {
    const params = new URLSearchParams();
    for (const id of ids) params.append("id", id);
    return this.getChannelRewardRedemptionsData(params);
  }

  getChannelRewardRedemptions(params: GetChannelRewardRedemptionsParams) {
    const urlParams = new URLSearchParams(decamelizeKeys(params));
    return this.getChannelRewardRedemptionsData(urlParams);
  }

  async acceptChannelRewardRedemptions(
    params: AcceptChannelRewardRedemptionsParams,
  ) {
    const res = await this.post(`${this.endpoint}/redemptions/accept`, params);
    return (await res.getData(AcceptChannelRewardRedemptionsResponse)).data;
  }

  async rejectChannelRewardRedemptions(
    params: RejectChannelRewardRedemptionsParams,
  ) {
    const res = await this.post(`${this.endpoint}/redemptions/accept`, params);
    return (await res.getData(AcceptChannelRewardRedemptionsResponse)).data;
  }
}
