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
    if (
      this.options.tokenType === "app" ||
      !this.options.scopes.includes("user:read")
    ) {
      throw new KickAPIError({
        message: "You don't have enough permissions to use this API",
        details: {
          requiredScopes: ["user:read"],
          tokenType: this.options.tokenType,
          tokenScopes:
            this.options.tokenType === "user" ? this.options.scopes : undefined,
        },
      });
    }
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
    if (
      this.options.tokenType === "user" &&
      !this.options.scopes.includes("user:read")
    ) {
      throw new KickAPIError({
        message: "You don't have enough permissions to use this API",
        details: {
          requiredScopes: ["user:read"],
          tokenType: this.options.tokenType,
          tokenScopes:
            this.options.tokenType === "user" ? this.options.scopes : undefined,
        },
      });
    }
    const params = new URLSearchParams();
    for (const id of ids) {
      params.append("id", id.toString());
    }
    return this.get(`/users?${params}`, UsersSchema);
  }
}
