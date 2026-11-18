import type { AttachmentId, MessageDelivery, SendMessage, ThreadId, Viewing } from "@outlore/contracts";
import { newRequestId } from "../foundation/client";
import { type Comment, messageWithComments } from "./comments";

/** The small differences between Chronicler and a quest conversation. Comments stay quest-only (thread-messaging). */
export type ConversationOptions = { isChronicler: boolean; realmPath: string | null; viewing: Viewing | null };

/** Delivery and placeholder decisions shared by both conversation panes. */
export const conversationStateOf = (state: string, isInTurn: boolean, name: string) => ({
  placeholder:
    state === "Stopped"
      ? `Write to ${name}; it waits until you resume it…`
      : isInTurn
        ? `Write to ${name}; Send waits for its next turn, unless you steer it…`
        : `Write to ${name}…`,
});

/** Sends prepared content in order, clearing it only after the service accepts it. */
export const sendConversationMessage = async (given: {
  client: { readonly request: (request: typeof SendMessage.Type) => Promise<unknown> };
  threadId: ThreadId;
  text: string;
  attachmentIds: ReadonlyArray<AttachmentId>;
  delivery: MessageDelivery | null;
  options: ConversationOptions;
  comments: ReadonlyArray<Comment>;
  prepare: (text: string) => Promise<string>;
  follow: () => void;
  clearComments: () => void;
  sent: () => void;
}) => {
  const prepared = await given.prepare(given.text);
  const text = given.options.isChronicler ? prepared : messageWithComments(prepared, given.comments);
  given.follow();
  await given.client.request({
    _tag: "SendMessage",
    attachmentIds: given.attachmentIds,
    delivery: given.delivery,
    requestId: newRequestId(),
    text,
    threadId: given.threadId,
    ...(given.options.isChronicler ? { realmPath: given.options.realmPath } : {}),
    ...(given.options.viewing === null ? {} : { viewing: given.options.viewing }),
  });
  given.clearComments();
  given.sent();
};

/** What the feed draws beneath settled entries. */
export const footerOf = (draft: string, isInTurn: boolean) => (draft !== "" ? "draft" : isInTurn ? "working" : "empty");
