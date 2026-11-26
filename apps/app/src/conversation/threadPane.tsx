import type { MessageId, MissionDetail, MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useContext, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BudgetStopCard } from "../editors/budgets";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { useEnding } from "../foundation/useEnding";
import { EndingConfirmation } from "../quests/missionActions";
import { missingFolderOf } from "../realms/missingFolder";
import { MissingFolderNotice } from "../realms/workspaces";
import { takesTurnsIn } from "../rituals/ritualRow";
import { ChronicleTargetContext, matchesThread } from "./chronicleTarget";
import { type CompanionsTab, CompanionsTabLayout } from "./companionsTabLayout";
import { ConversationFailure, ConversationFeed } from "./conversationFeed";
import { RepliesProvider } from "./replies";
import { terminalFolderOf } from "./terminalFolder";
import { ChatterNotices } from "./threadActions";
import { ThreadPaneComposer } from "./threadPaneComposer";
import { ThreadPaneHeader } from "./threadPaneHeader";
import { CommentsProvider } from "./useComments";
import { useThreadConversation } from "./useThreadConversation";

/** One thread's conversation: its settings, notices, feed, and composer. It stands alone in a pane or as a quest's selected thread. */
export function ThreadPane({
  canOpenDetails,
  alternateBody,
  chrome,
  companions,
  tabs,
  isInPane = false,
  client,
  detail,
  isCompact,
  onSelect,
  onOpenMission,
  onOpenBudget,
  onOpenDetails,
  onBack,
  onNewErrand,
}: {
  /** Starts an errand of the quest: an icon among the header's actions, before the separator. */
  onNewErrand?: () => void;
  /** In a narrow window, which has no sidebar: the header's back chevron, which opens the main menu. */
  onBack?: () => void;
  /** The buttons at the end of the header of a pane among several: fold and close; none in the quest's own screen. */
  chrome?: ReactNode;
  alternateBody?: ReactNode;
  companions?: CompanionsTab;
  tabs?: ReactNode;
  /** Whether the thread shows in a pane beside others: its link back to the quest is left out, but a legacy sub-errand keeps its return to its own parent. */
  isInPane?: boolean;
  /** Whether this thread's header offers the link to the quest's side panel, where no top bar has the icon. */
  canOpenDetails: boolean;
  client: ServiceClient;
  /** A narrow window leaves out the line of settings, which the message box and the quest panel show. */
  isCompact: boolean;
  onOpenDetails: () => void;
  onOpenBudget: () => void;
  onOpenMission: (missionId: MissionId) => void;
  detail: MissionDetail;
  onSelect: (threadId: ThreadId) => void;
}) {
  const { thread } = detail;
  const missingFolder = thread.blocker === "MissingWorkspace" ? missingFolderOf(thread) : null;
  const target = useContext(ChronicleTargetContext);
  const ending = useEnding(client, detail.mission);
  const work = thread.parentId === null ? "quest" : "errand";
  const conversation = useThreadConversation(
    client,
    detail,
    thread.id,
    thread.workspace?.path ?? null,
    { isChronicler: false, realmPath: null, viewing: null },
    terminalFolderOf(thread),
    target !== null && matchesThread(target, thread.id, thread.parentId === null) ? target : null,
  );
  const { actionError, comments, act } = conversation;
  // A Reply is offered in a quest's own conversation only: it opens an errand beneath (CHG-0559); an errand's pane has none.
  // A Ritual's own conversation has no composer at all: no thread takes turns there, and its runs are its only errands (CHG-0616), so a Reply is not offered there either.
  const canTakeTurns = takesTurnsIn(thread, detail.mission.ritual);
  const [ritualRunError, setRitualRunError] = useState<string | null>(null);
  const canReply = thread.parentId === null && canTakeTurns;
  const parent = detail.threads.find((candidate) => candidate.id === thread.parentId);
  const startReply = (message: { id: MessageId; text: string }) => {
    const existing = conversation.anchors.find((anchor) => anchor.messageId === message.id);
    if (existing !== undefined) {
      onSelect(existing.threadId);
      return;
    }
    // An errand with no message yet opens at once, hung from the message; its own composer takes the first one.
    void act(
      client
        .request({
          _tag: "ReplyToMessage",
          accountId: thread.accountId,
          effort: thread.effort,
          harness: thread.harness,
          messageId: message.id,
          model: thread.model,
          requestId: newRequestId(),
        })
        .then((started) => onSelect(started.threadId)),
    );
  };
  return (
    <CommentsProvider value={comments}>
      <RepliesProvider value={canReply ? { start: startReply } : null}>
        <View style={[styles.flex, styles.pane]}>
          <ThreadPaneHeader
            act={act}
            canOpenDetails={canOpenDetails}
            chrome={chrome}
            client={client}
            detail={detail}
            ending={ending}
            isInPane={isInPane}
            {...(onBack === undefined ? {} : { onBack })}
            {...(onNewErrand === undefined ? {} : { onNewErrand })}
            canTakeTurns={canTakeTurns}
            onOpenDetails={onOpenDetails}
            onOpenMission={onOpenMission}
            onRitualRunError={setRitualRunError}
            onSelect={onSelect}
          />
          <EndingConfirmation ending={ending} />
          {ending.error !== null && <Text style={styles.error}>{ending.error}</Text>}
          {/* A legacy sub-errand's parent is not the quest pane to its left, so the link back stays: it is the offered return its pane owes it. */}
          {parent !== undefined && (!isInPane || parent.parentId !== null) && (
            <Pressable onPress={() => onSelect(parent.id)}>
              <Text numberOfLines={1} style={styles.link}>
                Opened from: {parent.title}
              </Text>
            </Pressable>
          )}
          <ChatterNotices client={client} notices={detail.chatter} />
          {detail.budgetStop !== null && (
            <BudgetStopCard client={client} onRaise={onOpenBudget} stop={detail.budgetStop} />
          )}
          {actionError !== null && <Text style={styles.error}>{actionError}</Text>}
          {ritualRunError !== null && (
            <Text accessibilityRole="alert" style={styles.error}>
              {ritualRunError}
            </Text>
          )}
          {!isCompact && (
            <Text numberOfLines={1} style={styles.muted}>
              {harnessLabels[thread.harness]}
              {thread.accountId === null ? "" : ` (${thread.accountLabel})`} · {modelLabelOf(thread.model)} ·{" "}
              {effortLabel(thread.effort)} ·{" "}
              {thread.workspace === null
                ? "No realm: the quest's scratch folder"
                : `Realm ${thread.workspace.name} · ${thread.workspace.path}`}
              {thread.workspace?.isMissing === true && " · folder missing"}
              {thread.workspace?.isMissing !== true && thread.ownCopy?.isMissing === true && " · own copy missing"}
            </Text>
          )}
          {thread.state === "Stopped" && thread.waitingCount > 0 && (
            <Text style={styles.muted}>
              {countedOf(thread.waitingCount, "message")} {thread.waitingCount === 1 ? "waits" : "wait"} until you
              resume this {work}.
            </Text>
          )}
          {thread.blocker === "MissingWorkspace" && missingFolder !== null && (
            <MissingFolderNotice
              client={client}
              isOwnCopy={missingFolder.isOwnCopy}
              path={missingFolder.path}
              threadId={thread.id}
            />
          )}
          <ConversationFailure client={client} conversation={conversation} thread={thread} />
          {tabs}
          {alternateBody}
          <View style={alternateBody == null ? [styles.flex, styles.pane] : { display: "none" }}>
            <CompanionsTabLayout
              client={client}
              companions={companions}
              composer={(accessory) => (
                <ThreadPaneComposer
                  accessory={accessory}
                  canTakeTurns={canTakeTurns}
                  client={client}
                  conversation={conversation}
                  detail={detail}
                  isInPane={isInPane}
                  onSelect={onSelect}
                />
              )}
              conversation={conversation}
              feed={
                <ConversationFeed
                  canOpenAside={thread.parentId === null}
                  client={client}
                  conversation={conversation}
                  onOpenMission={onOpenMission}
                  onSelectThread={onSelect}
                  thread={thread}
                  workspacePath={thread.workspace?.path ?? null}
                />
              }
              thread={thread}
            />
          </View>
        </View>
      </RepliesProvider>
    </CommentsProvider>
  );
}
