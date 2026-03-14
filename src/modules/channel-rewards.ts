import z from "zod";
import {
  KickAPIClient,
  type ClientOptions,
  type Token,
} from "../api-client.js";
import decamelizeKeys from "decamelize-keys";
import type { UsersAPI } from "./users.js";
import { KickError } from "../errors.js";

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

const RedemptionsSchema = z.array(
  z.object({
    id: z.string(),
    redeemed_at: z.string(),
    redeemer: z.object({ user_id: z.number() }),
    status: ChannelRewardRedemptionStatus,
    user_input: z.string(),
  }),
);

const ChannelRewardRedemptionsSchema = z.array(
  z.object({
    redemptions: RedemptionsSchema,
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

  constructor(
    private readonly users: UsersAPI,
    token: Token,
    options?: ClientOptions,
  ) {
    super(token, options);
  }

  private createRewardMethods(rewardId: string) {
    return {
      delete: () => this.deleteChannelReward(rewardId),
      update: (options: UpdateChannelRewardParams) =>
        this.updateChannelReward(rewardId, options),
    };
  }

  async getChannelRewards() {
    const { data } = await this.get(this.endpoint, ChannelRewardsSchema);
    return data.map((data) => ({
      ...data,
      ...this.createRewardMethods(data.id),
    }));
  }

  async createChannelReward(params: CreateChannelRewardParams) {
    const res = await this.post(this.endpoint, decamelizeKeys(params));
    const { data } = await res.getData(ChannelRewardSchema);
    return { ...data, ...this.createRewardMethods(data.id) };
  }

  deleteChannelReward(id: string) {
    return this.delete(`${this.endpoint}/${id}`);
  }

  async updateChannelReward(id: string, params: UpdateChannelRewardParams) {
    const reqBody = decamelizeKeys(params);
    const res = await this.patch(`${this.endpoint}/${id}`, reqBody);
    const { data } = await res.getData(ChannelRewardSchema);
    return { ...data, ...this.createRewardMethods(data.id) };
  }

  private async *getChannelRewardRedemptionsData(params: URLSearchParams) {
    const gen = this.getPaginatedData(
      `${this.endpoint}/redemptions`,
      params,
      ChannelRewardRedemptionsSchema,
    );

    for await (const page of gen) {
      let ids: string[] = [];

      yield page.map(({ reward, redemptions, ...page }) => ({
        ...page,
        redemptions: redemptions.map(({ redeemer, ...redemption }) => ({
          ...redemption,
          redeemer: {
            ...redeemer,
            getUser: async () => {
              const [user] = await this.users.getUsersByIds({
                ids: [redeemer.userId],
              });
              if (!user) throw new KickError("User not found");
              return user;
            },
          },
          select() {
            ids.push(redemption.id);
          },
          deselect() {
            ids = ids.filter((id) => id !== redemption.id);
          },
        })),
        reward: { ...reward, ...this.createRewardMethods(reward.id) },
        acceptAll: () =>
          this.acceptChannelRewardRedemptions({
            ids: redemptions.map(({ id }) => id),
          }),
        rejectAll: () =>
          this.rejectChannelRewardRedemptions({
            ids: redemptions.map(({ id }) => id),
          }),
        acceptSelected: () => this.acceptChannelRewardRedemptions({ ids }),
        rejectSelected: () => this.rejectChannelRewardRedemptions({ ids }),
      }));
    }
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
