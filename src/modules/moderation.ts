import { KickAPIClient } from "../api-client.js";
import decamelizeKeys from "decamelize-keys";

interface ModerationParams {
  broadcasterUserId: number;
  userId: string;
}

interface BanUserParams extends ModerationParams {
  reason?: string;
}

interface TimeoutUserParams extends BanUserParams {
  duration: number;
}

type RemoveBanParams = ModerationParams;

export class ModerationAPI extends KickAPIClient {
  async banUser(options: BanUserParams) {
    await this.post("/v1/moderation/bans", decamelizeKeys(options));
  }

  async timeoutUser(options: TimeoutUserParams) {
    await this.post("/v1/moderation/bans", decamelizeKeys(options));
  }

  removeBan(options: RemoveBanParams) {
    return this.delete("/v1/moderation/bans", decamelizeKeys(options));
  }
}
