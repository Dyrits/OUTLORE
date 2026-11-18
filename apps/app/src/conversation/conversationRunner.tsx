import type { MissionDetail } from "@outlore/contracts";
import { View } from "react-native";
import { PlanLimitRings } from "../editors/planLimitRings";
import { RunnerPickers } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { ThreadBackups } from "./threadBackups";
import type { useThreadConversation } from "./useThreadConversation";

/** The conversation's current runner, presets and backups, with the plans' limit rings at their right, shared by quests and Chronicler. */
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
    <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
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
      <PlanLimitRings client={client} isAtEnd />
    </View>
  );
}
