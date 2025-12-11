import z from "zod";
import type { AppClientOptions, UserClientOptions } from "./client.js";
import { formatData } from "./utils.js";

const ResponseSchema = z.object({ data: z.unknown() });

export abstract class KickAPIClient {
  private readonly baseUrl = "https://api.kick.com/public/v1/";

  constructor(private readonly options: AppClientOptions | UserClientOptions) {}

  private async request(
    endpoint: string,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: unknown
  ) {
    const res = await fetch(`${this.baseUrl}/${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        ...(method === "GET" || method === "DELETE"
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: JSON.stringify(body),
    });
    return formatData(ResponseSchema, await res.json());
  }

  protected get(endpoint: string) {
    return this.request(endpoint, "GET");
  }

  protected post(endpoint: string, body?: unknown) {
    return this.request(endpoint, "POST", body);
  }

  protected patch(endpoint: string, body?: unknown) {
    return this.request(endpoint, "PATCH", body);
  }
}
