import type { MissionDetail } from "@outlore/contracts";
import { RunnerPickers } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { ThreadBackups } from "./threadBackups";
import type { useThreadConversation } from "./useThreadConversation";

/** The conversation's current runner, presets and backups, shared by quests and Chronicler. */
export function ConversationRunner({
  client,
  thread,
  conversation,
  isChronicler = false,
}: {
  client: ServiceClient;
  thread: MissionDetail["thread"];
  conversation: ReturnType<typeof useThreadConversation>;
  isChronicler?: boolean;
}) {
  return (
    <RunnerPickers
      client={client}
      {...(isChronicler ? { dockRank: 1 } : {})}
      extra={<ThreadBackups client={client} key={thread.id} threadId={thread.id} />}
      harnesses={conversation.harnesses}
      isChronicler={isChronicler}
      isCompact
      onChange={(next) =>
        conversation.act(client.request({ _tag: "ChangeThreadRunner", ...next, threadId: thread.id }))
      }
      presetChoice={conversation.presetChoice}
      value={thread}
    />
  );
}
