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
    this.requireScopesWithUserToken("chat:write");
    return this.postWithResponseData(
      "/chat",
      options,
      PostMessageOptionsSchema,
      PostMessageResponseSchema
    );
  }

  async deleteChatMessage(messageId: string) {
    this.requireScopesWithUserToken("moderation:chat_message:manage");
    await this.delete(`/chat/${messageId}`);
  }
}
