import z from "zod";
import {
  KickAPIClient,
  type ClientOptions,
  type Token,
} from "../api-client.js";
import { KickError } from "../errors.js";
import type { ChannelsAPI } from "./channels.js";
import type { ChatAPI, PostChatMessageAsUserParams } from "./chat.js";

interface GetUsersByIdsParams {
  ids: number[];
}

const UsersSchema = z.array(
  z.object({
    email: z.string(),
    name: z.string(),
    profile_picture: z.string(),
    user_id: z.number(),
  }),
);

export class UsersAPI extends KickAPIClient {
  constructor(
    private readonly channels: ChannelsAPI,
    token: Token,
    options?: ClientOptions,
  ) {
    super(token, options);
  }

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
        const [channel] = await this.channels.getChannelsByBroadcasterIds({
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
    private readonly chat: ChatAPI,
    channels: ChannelsAPI,
    token: Token,
    options?: ClientOptions,
  ) {
    super(channels, token, options);
  }

  private async getExtendedUsersData(params?: URLSearchParams) {
    const users = await this.getUsersData(params);

    return users.map((user) => ({
      ...user,
      postChatMessageAsUserToChannel: (
        content: Omit<PostChatMessageAsUserParams, "broadcasterUserId">,
      ) =>
        this.chat.postChatMessageAsUser({
          ...content,
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
