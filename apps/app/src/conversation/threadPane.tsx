import type { MessageId, MissionDetail, MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useContext, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BudgetStopCard } from "../editors/budgets";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { QuestTabButtonContext } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { useEnding } from "../foundation/useEnding";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { EndingConfirmation } from "../quests/missionActions";
import { MissingFolderNotice } from "../realms/workspaces";
import { RunNowButton } from "../rituals/ritualCard";
import { takesTurnsIn } from "../rituals/ritualRow";
import { ArchiveButton } from "../ui/archiveButton";
import { Composer } from "../ui/controls";
import {
  DoneButton,
  HeaderSeparator,
  NewErrandButton,
  NewQuestButton,
  QuestPanelButton,
} from "../ui/questHeaderButtons";
import { ChronicleTargetContext, matchesThread } from "./chronicleTarget";
import { CommentTray } from "./commentViews";
import { type CompanionsTab, CompanionsTabLayout } from "./companionsTabLayout";
import { ConversationFailure, ConversationFeed } from "./conversationFeed";

import { ErrandHeaderActions, hasErrandActions } from "./errandHeaderActions";
import { MobileHeader, mobileIconTarget } from "./mobileHeader";
import { QueuedMessageTray } from "./queuedMessageTray";
import { RepliesProvider, ReplyForm, replyRunnerOf } from "./replies";
import { terminalFolderOf } from "./terminalFolder";
import { ChatterNotices } from "./threadActions";
import { ThreadTitle } from "./threadTitle";
import { OpenThreadForm } from "./threadTree";
import { CommentsProvider } from "./useComments";
import { useThreadConversation } from "./useThreadConversation";

function RitualRunAction({
  client,
  missionId,
  onError,
}: {
  client: ServiceClient;
  missionId: MissionId;
  onError: (message: string | null) => void;
}) {
  const { data: ritual, error } = useServiceQuery(client, { _tag: "ReadRitual", missionId }, `ritual:${missionId}`);
  if (error !== null) return <Text style={styles.error}>{error}</Text>;
  if (ritual === null) return null;
  return (
    <RunNowButton
      client={client}
      isBlocked={ritual.isRealmArchived}
      isInHeader
      isUnderway={ritual.lastRunState === "Underway"}
      onError={onError}
      ritualId={ritual.id}
    />
  );
}

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
  onReplyMessage,
  onBack,
  onNewErrand,
}: {
  /** Starts an errand of the quest: an icon among the header's actions, before the separator. */
  onNewErrand?: () => void;
  /** Opens the errand starter pane anchored to a quest message when the owner clicks Reply. */
  onReplyMessage?: (message: { id: MessageId; text: string }) => void;
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
  const { skills, actionError, terminal, comments, act } = conversation;
  const [isOpening, setIsOpening] = useState(false);
  // A Reply is offered in a quest's own conversation only: it opens an errand beneath (CHG-0559); an errand's pane has none.
  // A Ritual's own conversation has no composer at all: no thread takes turns there, and its runs are its only errands
  // (CHG-0616), so a Reply is not offered there either. Run now is the on-the-spot start.
  const [replyTo, setReplyTo] = useState<{ id: MessageId; text: string } | null>(null);
  const takesTurns = takesTurnsIn(thread, detail.mission.ritual);
  const [ritualRunError, setRitualRunError] = useState<string | null>(null);
  const ritualRunAction = takesTurns ? null : (
    <RitualRunAction client={client} missionId={detail.mission.id} onError={setRitualRunError} />
  );
  const canReply = thread.parentId === null && takesTurns;
  const { canOpenBeneath, canResume, canStop } = thread.actions;
  const parent = detail.threads.find((candidate) => candidate.id === thread.parentId);
  // Only a quest's own thread archives it, and not a Ritual or one already archived.
  const isOwnQuest = thread.parentId === null && detail.mission.ritual === null && detail.mission.state !== "Archived";
  const archiveAction = isOwnQuest && (
    <ArchiveButton
      isDelete={detail.mission.isEmpty}
      isDisabled={ending.isBusy}
      label={detail.mission.isEmpty ? "Delete quest" : "Archive quest"}
      onPress={() => ending.start("Archived")}
      style={onBack === undefined ? null : mobileIconTarget}
    />
  );
  // Mark as done is a checkbox: pressing it again takes the mark back (ReopenMission, as the Archive's Reopen does).
  const isDone = detail.mission.state === "Fulfilled";
  const markDone = isOwnQuest
    ? () =>
        isDone
          ? ending.run(() => client.request({ _tag: "ReopenMission", missionId: detail.mission.id }))
          : ending.start("Fulfilled")
    : null;
  const errandActions = <ErrandHeaderActions act={act} client={client} detail={detail} />;
  const doneAction = markDone !== null && (
    <DoneButton
      isDisabled={ending.isBusy || ending.pending !== null}
      isDone={isDone}
      onPress={markDone}
      style={onBack === undefined ? null : mobileIconTarget}
    />
  );
  const hasActions = isOwnQuest || hasErrandActions(detail);
  const windowQuestTab = useContext(QuestTabButtonContext);
  const questTab = isInPane ? null : windowQuestTab;
  // A separator after the last action only divides it from something that follows.
  const hasAfterActions = questTab !== null || chrome != null;
  const startReply = (message: { id: MessageId; text: string }) => {
    const existing = conversation.anchors.find((anchor) => anchor.messageId === message.id);
    if (existing !== undefined) {
      onSelect(existing.threadId);
      return;
    }
    if (onReplyMessage !== undefined) {
      onReplyMessage(message);
      return;
    }
    setReplyTo(message);
  };
  return (
    <CommentsProvider value={comments}>
      <RepliesProvider value={canReply ? { start: startReply } : null}>
        <View style={[styles.flex, styles.pane]}>
          {onBack !== undefined && (
            <MobileHeader
              actions={
                ritualRunAction ??
                (isOwnQuest ? (
                  <>
                    {doneAction}
                    {archiveAction}
                  </>
                ) : (
                  errandActions
                ))
              }
              onBack={onBack}
              title={<ThreadTitle client={client} detail={detail} onOpenMission={onOpenMission} onSelect={onSelect} />}
            />
          )}
          {(onBack === undefined || canResume || canOpenDetails) && (
            <View style={styles.header}>
              {onBack === undefined && (
                <>
                  <View style={styles.flex}>
                    <ThreadTitle client={client} detail={detail} onOpenMission={onOpenMission} onSelect={onSelect} />
                  </View>
                  {canResume && (
                    <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
                      <Text style={styles.link}>Resume</Text>
                    </Pressable>
                  )}
                  {archiveAction}
                  {doneAction}
                  {errandActions}
                  {ritualRunAction}
                  {ritualRunAction !== null && chrome != null && <HeaderSeparator />}
                  {isInPane && thread.parentId === null && takesTurns && (
                    <>
                      <HeaderSeparator />
                      <NewQuestButton
                        onPress={() =>
                          void act(
                            client
                              .request({
                                _tag: "StartEmptyQuest",
                                realmId: detail.mission.workspaceId,
                                requestId: newRequestId(),
                              })
                              .then((started) => onOpenMission(started.missionId)),
                          )
                        }
                      />
                      {hasAfterActions && <HeaderSeparator />}
                    </>
                  )}
                  {onNewErrand !== undefined && (
                    <>
                      <HeaderSeparator />
                      <NewErrandButton onPress={onNewErrand} />
                      {hasAfterActions && <HeaderSeparator />}
                    </>
                  )}
                  {onNewErrand === undefined &&
                    !(isInPane && thread.parentId === null) &&
                    hasActions &&
                    (questTab !== null || chrome != null) && <HeaderSeparator />}
                  {questTab !== null && <QuestPanelButton isOpen={questTab.isOpen} onPress={questTab.onPress} />}
                  {questTab !== null && chrome != null && <HeaderSeparator />}
                  {chrome}
                </>
              )}
              {onBack !== undefined && canResume && (
                <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
                  <Text style={styles.link}>Resume</Text>
                </Pressable>
              )}
              {canOpenDetails && (
                <Pressable onPress={onOpenDetails}>
                  <Text style={styles.link}>{takesTurns ? "Quest panel" : "Ritual panel"}</Text>
                </Pressable>
              )}
            </View>
          )}
          <EndingConfirmation ending={ending} />
          {ending.error !== null && <Text style={styles.error}>{ending.error}</Text>}
          {/* A legacy sub-errand's parent is not the quest pane to its left, so the link back stays: it is the offered
              return its pane owes it. */}
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
            </Text>
          )}
          {thread.state === "Stopped" && thread.waitingCount > 0 && (
            <Text style={styles.muted}>
              {countedOf(thread.waitingCount, "message")} {thread.waitingCount === 1 ? "waits" : "wait"} until you
              resume this
              {work}.
            </Text>
          )}
          {thread.blocker === "MissingWorkspace" && thread.workspace !== null && (
            <MissingFolderNotice client={client} path={thread.workspace.path} threadId={thread.id} />
          )}
          <ConversationFailure client={client} conversation={conversation} thread={thread} />
          {tabs}
          {alternateBody}
          <View style={alternateBody == null ? [styles.flex, styles.pane] : { display: "none" }}>
            <CompanionsTabLayout
              client={client}
              companions={companions}
              composer={(accessory) => (
                <>
                  {replyTo !== null ? (
                    <ReplyForm
                      client={client}
                      message={replyTo}
                      onCancel={() => setReplyTo(null)}
                      onStarted={(started) => {
                        setReplyTo(null);
                        onSelect(started.threadId);
                      }}
                      placeholder="The errand's first message…"
                      runner={replyRunnerOf(thread)}
                    />
                  ) : isOpening ? (
                    <OpenThreadForm
                      client={client}
                      onCancel={() => setIsOpening(false)}
                      onOpened={(threadId) => {
                        setIsOpening(false);
                        onSelect(threadId);
                      }}
                      parent={thread}
                    />
                  ) : takesTurns ? (
                    <>
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
                        // The harness, account, Companion, and effort can change at any time, in a turn too: a handover
                        // (thread-handover). It starts no turn: the running turn finishes as it was, and the next message, or Retry
                        // after a failed turn, runs on it.
                        accessory={accessory}
                        attachments={{ client, refusal: conversation.refusal }}
                        dictation={{ client }}
                        mentions={{ client, workspacePath: thread.workspace?.path ?? null }}
                        skills={skills}
                        {...(canStop ? { onStop: conversation.stop } : {})}
                        onSend={conversation.send}
                        placeholder={conversation.placeholder}
                      />
                    </>
                  ) : (
                    // No composer in a Ritual's own conversation (CHG-0616): the conversation is its runs' history,
                    // written by the runs alone; Run now, in its panel, is the on-the-spot start.
                    <Text style={styles.muted}>This conversation shows the Ritual's runs.</Text>
                  )}
                </>
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
