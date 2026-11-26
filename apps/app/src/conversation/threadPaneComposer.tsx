import type { MissionDetail, ThreadId } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { Text } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { Composer } from "../ui/controls";
import { CommentTray } from "./commentViews";
import { QueuedMessageTray } from "./queuedMessageTray";
import { parentTargetLabelOf, sendToParentScopeOf } from "./sendToParent";
import { SendToParentControl } from "./sendToParentControl";
import { OpenThreadForm } from "./threadTree";
import { isUnstartedErrand } from "./unstartedErrand";
import { UnstartedErrandWarning } from "./unstartedErrandWarning";
import type { useThreadConversation } from "./useThreadConversation";

/** Composer area of a thread pane: either the new-errand form, the thread composer with its trays, or the Ritual notice. */
export function ThreadPaneComposer({
  accessory,
  client,
  conversation,
  detail,
  isInPane,
  onSelect,
  canTakeTurns,
}: {
  accessory: ReactNode;
  client: ServiceClient;
  conversation: ReturnType<typeof useThreadConversation>;
  detail: MissionDetail;
  isInPane: boolean;
  onSelect: (threadId: ThreadId) => void;
  canTakeTurns: boolean;
}) {
  const { thread } = detail;
  const { act, comments, skills, terminal } = conversation;
  const { canOpenBeneath, canStop } = thread.actions;
  const [isOpening, setIsOpening] = useState(false);
  const [alsoSendToParent, setAlsoSendToParent] = useState(false);
  const [shouldIncludeFullContext, setIncludeFullContext] = useState(false);
  const parentLabel = canTakeTurns ? parentTargetLabelOf(detail) : null;
  if (isOpening) {
    return (
      <OpenThreadForm
        client={client}
        onCancel={() => setIsOpening(false)}
        onOpened={(threadId) => {
          setIsOpening(false);
          onSelect(threadId);
        }}
        parent={thread}
      />
    );
  }
  if (!canTakeTurns) {
    // No composer in a Ritual's own conversation (CHG-0616): the conversation is its runs' history, written by the runs alone; Run now, in its panel, is the on-the-spot start.
    return <Text style={styles.muted}>This conversation shows the Ritual's runs.</Text>;
  }
  return (
    <>
      {isUnstartedErrand(thread, detail.messages) && (
        <UnstartedErrandWarning act={act} client={client} thread={thread} />
      )}
      <CommentTray />
      <QueuedMessageTray
        isInTurn={thread.actions.isInTurn}
        messages={conversation.pendingMessages}
        onEdit={conversation.editQueued}
        onInterrupt={conversation.interrupt}
        onRemove={conversation.removeQueued}
        onSteer={conversation.steer}
        onUnsteer={conversation.unsteer}
      />
      <Composer
        draftKey={`thread:${thread.id}`}
        {...(canOpenBeneath && !isInPane ? { onOpenSideQuest: () => setIsOpening(true) } : {})}
        hasContent={terminal.hasContent || comments.items.length > 0}
        {...(terminal.onBang === null ? {} : { onBang: terminal.onBang })}
        // The harness, account, Companion, and effort can change at any time, in a turn too: a handover (thread-handover).
        // It starts no turn: the running turn finishes as it was, and the next message, or Retry after a failed turn, runs on it.
        accessory={accessory}
        attachments={{ client, refusal: conversation.refusal }}
        dictation={{ client }}
        mentions={{ client, workspacePath: thread.workspace?.path ?? null }}
        skills={skills}
        {...(canStop ? { onStop: conversation.stop } : {})}
        onSend={async (text, attachmentIds) => {
          const scope = parentLabel === null ? null : sendToParentScopeOf(alsoSendToParent, shouldIncludeFullContext);
          await conversation.send(text, attachmentIds, scope);
          if (alsoSendToParent) {
            setAlsoSendToParent(false);
            setIncludeFullContext(false);
          }
        }}
        placeholder={conversation.placeholder}
      />
      {parentLabel !== null && (
        <SendToParentControl
          isChecked={alsoSendToParent}
          onToggleChecked={() => setAlsoSendToParent((current) => !current)}
          onToggleFullContext={setIncludeFullContext}
          parentKind={thread.parentId === null ? "realm" : "quest"}
          parentLabel={parentLabel}
          shouldIncludeFullContext={shouldIncludeFullContext}
        />
      )}
    </>
  );
}
