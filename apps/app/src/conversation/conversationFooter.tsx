import type { MissionDetail } from "@outlore/contracts";
import type { ReactNode } from "react";
import { View } from "react-native";
import { companionLabelOf } from "../foundation/formatting";
import { AgentReply, WorkingIndicator } from "./conversationEntries";
import { workingLabel } from "./entries";
import { footerOf, workingRunnerOf } from "./threadConversation";

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
  // The Companion that runs the turn, not the one the owner picked during it (thread-handover).
  const runner = workingRunnerOf(thread);
  return (
    <View>
      {footer === "working" && <WorkingIndicator harness={runner.harness} label={workingLabel} />}
      {footer === "draft" && (
        <AgentReply
          harness={runner.harness}
          isDraft
          label={`${companionLabelOf(runner.harness, null, runner.model)} · writing…`}
          text={draft}
          time={null}
        />
      )}
      {panel}
    </View>
  );
}
