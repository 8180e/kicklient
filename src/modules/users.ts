import z from "zod";
import { KickAPIClient } from "../api-client.js";
import { KickAPIError } from "../errors.js";

const UsersSchema = z.array(
  z.object({
    email: z.string(),
    name: z.string(),
    profile_picture: z.string(),
    user_id: z.number(),
  })
);

export class UsersAPI extends KickAPIClient {
  async getAuthenticatedUser() {
    this.requireScopesWithUserToken("user:read");
    const user = (await this.get("/users", UsersSchema))[0];
    if (!user) {
      throw new KickAPIError({
        message:
          "Expected the API to return the authenticated user, but got no user",
      });
    }
    return user;
  }

  getUsersById(...ids: number[]) {
    this.requireScopes("user:read");
    const params = new URLSearchParams();
    for (const id of ids) {
      params.append("id", id.toString());
    }
    return this.get(`/users?${params}`, UsersSchema);
  }
}
