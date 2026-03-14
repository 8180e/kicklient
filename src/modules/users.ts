import z from "zod";
import { KickAPIClient } from "../api-client.js";
import { KickError } from "../errors.js";

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
  protected async getUsersData(params?: URLSearchParams) {
    return (await this.get(`/v1/users?${params || ""}`, UsersSchema)).data;
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
