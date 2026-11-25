import type { AttachmentId, MessageId, MissionDetail, SendToParentScope, ThreadId } from "@outlore/contracts";
import { useState } from "react";
import { imageRefusalOf } from "../attachments/attachmentRules";
import { useHarnesses } from "../editors/runners";
import { useThreadPresets } from "../editors/useThreadPresets";
import { actWith } from "../foundation/acting";
import type { ServiceClient } from "../foundation/client";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useSkills } from "../foundation/useSkills";
import { useTerminal } from "../terminal/useTerminal";
import type { ChronicleTarget } from "./chronicleTarget";
import { entriesOf } from "./entries";
import { pendingOwnerMessagesOf } from "./queuedMessages";
import { type ConversationOptions, conversationStateOf, sendConversationMessage } from "./threadConversation";
import { useThreadComments } from "./useComments";
import { useDraft, useFollowNewest } from "./useConversationFeed";

/** Wires one thread into a conversation; callers draw the same send, runner, feed, and interruption behavior. */
export function useThreadConversation(
  client: ServiceClient,
  detail: MissionDetail | null,
  threadId: ThreadId,
  path: string | null,
  options: ConversationOptions,
  /** Where the `!` terminal starts; the thread's working folder, which an own copy makes differ from `path`. */
  terminalPath: string | null = path,
  target: ChronicleTarget | null = null,
) {
  const draft = useDraft(client, threadId);
  // What hangs from the messages of this conversation, so their reply lines stand under them (conversation panes).
  const { data: anchors } = useServiceQuery(client, { _tag: "ReadThreadAnchors", threadId }, `anchors:${threadId}`);
  const entries = detail === null ? [] : entriesOf(detail, detail.thread.actions.isInTurn, anchors ?? []);
  const pendingMessages = detail === null ? [] : pendingOwnerMessagesOf(detail.messages);
  const followNewest = useFollowNewest(entries, target);
  const skills = useSkills(client, path);
  const terminal = useTerminal(client, threadId, terminalPath);
  const comments = useThreadComments(threadId);
  const [actionError, setActionError] = useState<string | null>(null);
  const presetChoice = useThreadPresets(client, threadId, setActionError);
  const { data: harnesses } = useHarnesses(client);
  const thread = detail?.thread ?? null;
  const state = conversationStateOf(
    thread?.state ?? "Resting",
    thread?.actions.isInTurn ?? false,
    options.isChronicler ? "Chronicler" : thread?.parentId === null ? "this quest" : "this errand",
  );
  const send = (
    text: string,
    attachmentIds: ReadonlyArray<AttachmentId>,
    sendToParent: SendToParentScope | null = null,
  ) =>
    sendConversationMessage({
      attachmentIds,
      clearComments: options.isChronicler ? () => {} : comments.clear,
      client,
      comments: comments.items,
      delivery: null,
      follow: followNewest.follow,
      options,
      prepare: terminal.prepare,
      sendToParent,
      sent: terminal.sent,
      text,
      threadId,
    });
  return {
    act: actWith(setActionError),
    actionError,
    anchors: anchors ?? [],
    comments,
    draft,
    editQueued: (messageId: MessageId, text: string) => client.request({ _tag: "EditQueuedMessage", messageId, text }),
    entries,
    followNewest,
    harnesses,
    hasLoadedAnchors: anchors !== null,
    interrupt: () => client.request({ _tag: "InterruptThread", threadId }),
    pendingMessages,
    placeholder: state.placeholder,
    presetChoice,
    refusal: thread === null ? null : imageRefusalOf(harnesses, thread.harness, thread.model),
    removeQueued: (messageId: MessageId) => client.request({ _tag: "RemoveQueuedMessage", messageId }),
    send,
    skills,
    steer: (messageId: MessageId) => client.request({ _tag: "SteerQueuedMessage", messageId }),
    stop: () => client.request({ _tag: "StopThread", threadId }),
    terminal,
    unsteer: (messageId: MessageId) => client.request({ _tag: "UnsteerQueuedMessage", messageId }),
  };
}
