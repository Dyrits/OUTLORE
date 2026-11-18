import type { AttachmentId, MessageDelivery, MissionDetail, ThreadId } from "@outlore/contracts";
import { useState } from "react";
import { imageRefusalOf } from "../attachments/attachmentRules";
import { useHarnesses } from "../editors/runners";
import { useThreadPresets } from "../editors/useThreadPresets";
import { actWith } from "../foundation/acting";
import type { ServiceClient } from "../foundation/client";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useSkills } from "../foundation/useSkills";
import { useTerminal } from "../terminal/useTerminal";
import { entriesOf } from "./entries";
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
) {
  const draft = useDraft(client, threadId);
  const entries = detail === null ? [] : entriesOf(detail, detail.thread.actions.isInTurn);
  const followNewest = useFollowNewest(entries);
  const skills = useSkills(client, path);
  const terminal = useTerminal(threadId, terminalPath);
  const comments = useThreadComments(threadId);
  const [actionError, setActionError] = useState<string | null>(null);
  const presetChoice = useThreadPresets(client, threadId, setActionError);
  const { data: harnesses } = useHarnesses(client);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const thread = detail?.thread ?? null;
  const state = conversationStateOf(
    thread?.state ?? "Idle",
    thread?.actions.isInTurn ?? false,
    settings?.defaultDelivery ?? "Steer",
    options.isChronicler ? "Chronicler" : thread?.parentId === null ? "this quest" : "this errand",
  );
  const sendAs = (delivery: MessageDelivery | null) => (text: string, attachmentIds: ReadonlyArray<AttachmentId>) =>
    sendConversationMessage({
      attachmentIds,
      clearComments: options.isChronicler ? () => {} : comments.clear,
      client,
      comments: comments.items,
      delivery,
      follow: followNewest.follow,
      options,
      prepare: terminal.prepare,
      sent: terminal.sent,
      text,
      threadId,
    });
  return {
    act: actWith(setActionError),
    actionError,
    alternative: { label: state.other, onSend: sendAs(state.other) },
    comments,
    draft,
    entries,
    followNewest,
    harnesses,
    interrupt: () => client.request({ _tag: "InterruptThread", threadId }),
    placeholder: state.placeholder,
    presetChoice,
    refusal: thread === null ? null : imageRefusalOf(harnesses, thread.harness, thread.model),
    send: sendAs(state.delivery),
    skills,
    stop: () => client.request({ _tag: "StopThread", threadId }),
    terminal,
  };
}
