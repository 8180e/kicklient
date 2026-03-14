import z from "zod";
import {
  KickAPIClient,
  type ClientOptions,
  type Token,
} from "../api-client.js";
import { KickError } from "../errors.js";
import type { ChannelsAPI } from "./channels.js";

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

export async function getUser(users: UsersAPI, id: number) {
  const [user] = await users.getUsersByIds({ ids: [id] });
  if (!user) throw new KickError("User not found");
  return user;
}

export class UsersAPI extends KickAPIClient {
  constructor(
    private readonly channels: ChannelsAPI,
    token: Token,
    options?: ClientOptions,
  ) {
    super(token, options);
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
    const params = new URLSearchParams();
    for (const id of ids) params.append("id", id.toString());
    return this.getUsersData(params);
  }
}

export class UserUsersAPI extends UsersAPI {
  async getAuthenticatedUser() {
    const user = (await this.getUsersData())[0];
    if (!user) {
      throw new KickError(
        "Expected the API to return the authenticated user, but got no user",
      );
    }
    return user;
  }
}
