import z from "zod";
import { KickAPIClient } from "../api-client.js";
import decamelizeKeys from "decamelize-keys";

interface PostChatMessageAsBotParams {
  content: string;
  replyToMessageId?: string;
}

interface PostChatMessageAsUserParams extends PostChatMessageAsBotParams {
  broadcasterUserId: number;
}

type PostChatMessageParams = (
  | { type: "user"; broadcasterUserId: number }
  | { type: "bot" }
) & { content: string; replyToMessageId?: string };

const PostMessageResponseSchema = z.object({
  is_sent: z.boolean(),
  message_id: z.string(),
});

export class ChatAPI extends KickAPIClient {
  private async postChatMessage(params: PostChatMessageParams) {
    const res = await this.post("/v1/chat", decamelizeKeys(params));
    const { data } = await res.getData(PostMessageResponseSchema);
    return {
      ...data,
      delete: () => this.deleteChatMessage(data.messageId),
      replyAsBot: (
        params: Omit<PostChatMessageAsBotParams, "replyToMessageId">,
      ) =>
        this.postChatMessageAsBot({
          ...params,
          replyToMessageId: data.messageId,
        }),
      replyAsUser: (
        params: Omit<PostChatMessageAsUserParams, "replyToMessageId">,
      ) =>
        this.postChatMessageAsUser({
          ...params,
          replyToMessageId: data.messageId,
        }),
    };
  }

  postChatMessageAsBot(params: PostChatMessageAsBotParams) {
    return this.postChatMessage({ ...params, type: "bot" });
  }

  postChatMessageAsUser(params: PostChatMessageAsUserParams) {
    return this.postChatMessage({ ...params, type: "user" });
  }

  deleteChatMessage(messageId: string) {
    return this.delete(`/v1/chat/${messageId}`);
  }
}
