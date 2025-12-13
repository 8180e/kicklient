import z from "zod";
import { KickAPIClient } from "../api-client.js";

const PostMessageOptionsSchema = z.intersection(
  z.object({
    content: z.string().max(500),
    replyToMessageId: z.uuid().optional(),
  }),
  z.union([
    z.object({ type: z.literal("user"), broadcasterUserId: z.int() }),
    z.object({ type: z.literal("bot") }),
  ])
);

const PostMessageResponseSchema = z.object({
  is_sent: z.boolean(),
  message_id: z.string(),
});

export class ChatAPI extends KickAPIClient {
  postChatMessage(options: z.infer<typeof PostMessageOptionsSchema>) {
    return this.postWithResponseData(
      "/chat",
      options,
      PostMessageOptionsSchema,
      PostMessageResponseSchema,
      true,
      ["chat:write"]
    );
  }
}
