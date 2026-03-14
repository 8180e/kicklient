import z from "zod";
import { KickAPIClient } from "../api-client.js";
import decamelizeKeys from "decamelize-keys";

type PostChatMessageParams = (
  | { type: "user"; broadcasterUserId: number }
  | { type: "bot" }
) & { content: string; replyToMessageId: string };

const PostMessageResponseSchema = z.object({
  is_sent: z.boolean(),
  message_id: z.string(),
});

export class ChatAPI extends KickAPIClient {
  async postChatMessage(params: PostChatMessageParams) {
    const res = await this.post("/v1/chat", decamelizeKeys(params));
    const { data } = await res.getData(PostMessageResponseSchema);
    return { ...data, delete: () => this.deleteChatMessage(data.messageId) };
  }

  deleteChatMessage(messageId: string) {
    return this.delete(`/v1/chat/${messageId}`);
  }
}
