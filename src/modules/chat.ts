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
  async postChatMessage(options: z.infer<typeof PostMessageOptionsSchema>) {
    this.requireScopes("chat:write").withUserToken();
    return (
      await this.post("/chat", options, PostMessageOptionsSchema)
    ).getData(PostMessageResponseSchema);
  }

  async deleteChatMessage(messageId: string) {
    this.requireScopes("moderation:chat_message:manage").withUserToken();
    await this.delete(`/chat/${messageId}`);
  }
}
