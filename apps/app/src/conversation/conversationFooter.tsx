import type { MissionDetail } from "@outlore/contracts";
import type { ReactNode } from "react";
import { View } from "react-native";
import { companionLabelOf } from "../foundation/formatting";
import { AgentReply, WorkingIndicator } from "./conversationEntries";
import { workingLabel } from "./entries";
import { footerOf } from "./threadConversation";

/** The shared live reply or working indicator, followed by the thread's terminal. */
export function ConversationFooter({
  draft,
  thread,
  panel,
}: {
  draft: string;
  thread: MissionDetail["thread"];
  panel: ReactNode;
}) {
  const footer = footerOf(draft, thread.actions.isInTurn);
  return (
    <View>
      {footer === "working" && <WorkingIndicator harness={thread.harness} label={workingLabel} />}
      {footer === "draft" && (
        <AgentReply
          harness={thread.harness}
          isDraft
          label={`${companionLabelOf(thread.harness, null, thread.model)} · writing…`}
          text={draft}
          time={null}
        />
      )}
      {panel}
    </View>
  );
}
