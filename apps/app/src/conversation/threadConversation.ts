import type {
  AttachmentId,
  HarnessName,
  MessageDelivery,
  ModelChoice,
  SendMessage,
  ThreadId,
  Viewing,
} from "@outlore/contracts";
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
        ? "Write for the next turn…"
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

/**
 * The runner a working thread shows: the one its running turn was admitted on, which the owner's later pick does not
 * change (thread-handover). Outside a turn, or for a turn recorded before models were, the thread's own choice stands.
 */
export const workingRunnerOf = (thread: {
  readonly harness: HarnessName;
  readonly model: ModelChoice;
  readonly turnHarness: HarnessName | null;
  readonly turnModel: ModelChoice | null;
}): { harness: HarnessName; model: ModelChoice } =>
  thread.turnHarness === null
    ? { harness: thread.harness, model: thread.model }
    : { harness: thread.turnHarness, model: thread.turnModel ?? "default" };

/** What the feed draws beneath settled entries. */
export const footerOf = (draft: string, isInTurn: boolean) => (draft !== "" ? "draft" : isInTurn ? "working" : "empty");
