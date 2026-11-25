import type { MissionDetail } from "@outlore/contracts";
import { companionLabelOf } from "../foundation/formatting";
import { AgentReply, WorkingIndicator } from "./agentReply";
import { workingLabel } from "./entries";
import { footerOf, workingRunnerOf } from "./threadConversation";

/** The live reply or working indicator, shown above pending messages. */
export function ConversationFooter({ draft, thread }: { draft: string; thread: MissionDetail["thread"] }) {
  const footer = footerOf(draft, thread.actions.isInTurn);
  // The Companion that runs the turn, not the one the owner picked during it (thread-handover).
  const runner = workingRunnerOf(thread);
  return (
    <>
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
    </>
  );
}
