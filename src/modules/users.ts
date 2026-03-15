import z from "zod";
import {
  KickAPIClient,
  type ClientOptions,
  type Token,
} from "../api-client.js";
import { KickError } from "../errors.js";
import type { PostChatMessageAsUserParams } from "./chat.js";
import type {
  BanUserParams,
  RemoveBanParams,
  TimeoutUserParams,
} from "./moderation.js";
import type { UserClient } from "../client.js";

interface GetUsersByIdsParams {
  ids: number[];
}

type WithoutUser<T> = Omit<T, "userId">;
type WithoutBroadcaster<T> = Omit<T, "broadcasterUserId">;

const UsersSchema = z.array(
  z.object({
    email: z.string(),
    name: z.string(),
    profile_picture: z.string(),
    user_id: z.number(),
  }),
);

export class UsersAPI extends KickAPIClient {
  protected createByIdParams(ids: number[]) {
    const params = new URLSearchParams();
    for (const id of ids) params.append("id", id.toString());
    return params;
  }

  protected async getUsersData(params?: URLSearchParams) {
    const { data } = await this.get(`/v1/users?${params || ""}`, UsersSchema);
    return data.map((user) => ({
      ...user,
      getChannel: async () => {
        const [channel] =
          await this.client.channels.getChannelsByBroadcasterIds({
            ids: [user.userId],
          });
        if (!channel) throw new KickError("Channel not found");
        return channel;
      },
    }));
  }

  async getUsersByIds({ ids }: GetUsersByIdsParams) {
    return this.getUsersData(this.createByIdParams(ids));
  }

  async getUserById(id: number) {
    const [user] = await this.getUsersByIds({ ids: [id] });
    if (!user) throw new KickError("User not found");
    return user;
  }
}

export class UserUsersAPI extends UsersAPI {
  constructor(
    protected readonly client: UserClient,
    token: Token,
    options?: ClientOptions,
  ) {
    super(client, token, options);
  }

  private async getExtendedUsersData(params?: URLSearchParams) {
    const users = await this.getUsersData(params);

    return users.map((user) => ({
      ...user,
      postChatMessageAsUserToChannel: (
        content: WithoutBroadcaster<PostChatMessageAsUserParams>,
      ) =>
        this.client.chat.postChatMessageAsUser({
          ...content,
          broadcasterUserId: user.userId,
        }),
      banFromBroadcaster: (params: WithoutUser<BanUserParams>) =>
        this.client.moderation.banUser({ ...params, userId: user.userId }),
      timeoutFromBroadcaster: (params: WithoutUser<TimeoutUserParams>) =>
        this.client.moderation.timeoutUser({ ...params, userId: user.userId }),
      removeBanFromBroadcaster: (params: WithoutUser<RemoveBanParams>) =>
        this.client.moderation.removeBan({ ...params, userId: user.userId }),
      banUserFromChat: (params: WithoutBroadcaster<BanUserParams>) =>
        this.client.moderation.banUser({
          ...params,
          broadcasterUserId: user.userId,
        }),
      timeoutUserFromChat: (params: WithoutBroadcaster<TimeoutUserParams>) =>
        this.client.moderation.timeoutUser({
          ...params,
          broadcasterUserId: user.userId,
        }),
      removeUserBan: (params: WithoutBroadcaster<RemoveBanParams>) =>
        this.client.moderation.removeBan({
          ...params,
          broadcasterUserId: user.userId,
        }),
    }));
  }

  async getUsersByIds({ ids }: GetUsersByIdsParams) {
    return this.getExtendedUsersData(this.createByIdParams(ids));
  }

  async getAuthenticatedUser() {
    const [user] = await this.getExtendedUsersData();
    if (!user) {
      throw new KickError(
        "Expected the API to return the authenticated user, but got no user",
      );
    }
    return user;
  }
}
