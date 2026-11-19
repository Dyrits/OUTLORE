import type { MissionDetail, MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useContext, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { BudgetStopCard } from "../editors/budgets";
import type { ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { QuestTabButtonContext } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { useEnding } from "../foundation/useEnding";
import { EndingConfirmation } from "../quests/missionActions";
import { MissingFolderNotice } from "../realms/workspaces";
import { ArchiveButton } from "../ui/archiveButton";
import { Composer, StateIndicator } from "../ui/controls";
import { DoneButton, HeaderSeparator, QuestPanelButton } from "../ui/questHeaderButtons";
import { CommentTray } from "./commentViews";
import { EntryView } from "./conversationEntries";
import { ConversationFooter } from "./conversationFooter";
import { ConversationRunner } from "./conversationRunner";
import type { Entry } from "./entries";
import { MobileHeader } from "./mobileHeader";
import { terminalFolderOf } from "./terminalFolder";
import { ChatterNotices } from "./threadActions";
import { OpenThreadForm } from "./threadTree";
import { CommentsProvider } from "./useComments";
import { useThreadConversation } from "./useThreadConversation";

/** One thread's conversation: its settings, notices, feed, and composer. It stands alone in a pane or as a quest's selected thread. */
export function ThreadPane({
  canOpenDetails,
  chrome,
  isInPane = false,
  client,
  detail,
  isCompact,
  onSelect,
  onOpenMission,
  onOpenBudget,
  onOpenDetails,
  onBack,
}: {
  /** In a narrow window, which has no sidebar: the header's back chevron, which opens the main menu. */
  onBack?: () => void;
  /** The buttons at the end of the header of a pane among several: fold and close; none in the quest's own screen. */
  chrome?: ReactNode;
  /** Whether the thread shows in a pane beside others: its parent is the pane to its left, so the link back is left out. */
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
  const ending = useEnding(client, detail.mission);
  const work = thread.parentId === null ? "quest" : "errand";
  const conversation = useThreadConversation(
    client,
    detail,
    thread.id,
    thread.workspace?.path ?? null,
    { isChronicler: false, realmPath: null, viewing: null },
    terminalFolderOf(thread),
  );
  const { draft, skills, actionError, terminal, followNewest, comments, act } = conversation;
  const [isOpening, setIsOpening] = useState(false);
  const { canOpenBeneath, canResume, canStop, isInTurn } = thread.actions;
  const parent = detail.threads.find((candidate) => candidate.id === thread.parentId);
  // Only a quest's own thread archives it, and not a Ritual's quest or one already archived.
  const isOwnQuest = thread.parentId === null && detail.mission.ritual === null && detail.mission.state !== "Archived";
  const archive = isOwnQuest ? () => ending.start("Archived") : null;
  // Mark as done is a checkbox: pressing it again takes the mark back (ReopenMission, as the Archive's Reopen does).
  const isDone = detail.mission.state === "Done";
  const markDone = isOwnQuest
    ? () =>
        isDone
          ? ending.run(() => client.request({ _tag: "ReopenMission", missionId: detail.mission.id }))
          : ending.start("Done")
    : null;
  const questTab = useContext(QuestTabButtonContext);
  return (
    <CommentsProvider value={comments}>
      <View style={[styles.flex, styles.pane]}>
        {onBack !== undefined && (
          <MobileHeader
            isArchiveDisabled={ending.isBusy}
            onArchive={archive}
            onBack={onBack}
            state={thread.state}
            title={thread.title}
          />
        )}
        {(onBack === undefined || canResume || canOpenDetails) && (
          <View style={styles.header}>
            {onBack === undefined && (
              <>
                <Text numberOfLines={1} style={[styles.paneTitle, styles.flex]}>
                  {thread.title}
                </Text>
                <StateIndicator state={thread.state} />
                {canResume && (
                  <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
                    <Text style={styles.link}>Resume</Text>
                  </Pressable>
                )}
                {archive !== null && (
                  <ArchiveButton isDisabled={ending.isBusy} label="Archive quest" onPress={archive} />
                )}
                {markDone !== null && <DoneButton isDisabled={ending.isBusy} isDone={isDone} onPress={markDone} />}
                {questTab !== null && (
                  <>
                    <HeaderSeparator />
                    <QuestPanelButton isOpen={questTab.isOpen} onPress={questTab.onPress} />
                  </>
                )}
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
                <Text style={styles.link}>Quest panel</Text>
              </Pressable>
            )}
          </View>
        )}
        <EndingConfirmation ending={ending} />
        {ending.error !== null && <Text style={styles.error}>{ending.error}</Text>}
        {parent !== undefined && !isInPane && (
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
            {countedOf(thread.waitingCount, "message")} {thread.waitingCount === 1 ? "waits" : "wait"} until you resume
            this
            {work}.
          </Text>
        )}
        {thread.blocker === "MissingWorkspace" && thread.workspace !== null && (
          <MissingFolderNotice client={client} path={thread.workspace.path} threadId={thread.id} />
        )}
        {thread.failure != null && (
          <View style={styles.failure}>
            <Text style={styles.error}>The last turn failed: {thread.failure}</Text>
            <Text style={styles.muted}>
              Retry runs it again on the Companion chosen below; your next message retries it too.
            </Text>
            {!isInTurn && thread.state !== "Stopped" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => act(client.request({ _tag: "RetryThread", threadId: thread.id }))}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}
        <FlatList<Entry>
          {...followNewest.listPropsOf(<ConversationFooter draft={draft} panel={terminal.panel} thread={thread} />)}
          contentContainerStyle={styles.feed}
          keyExtractor={(entry) => entry.key}
          renderItem={({ item }) => (
            <EntryView
              client={client}
              entry={item}
              harness={thread.harness}
              isInTurn={isInTurn}
              onInterrupt={conversation.interrupt}
              onOpenMission={onOpenMission}
              onSelectThread={onSelect}
              onSteer={conversation.steer}
              skills={skills}
              workspacePath={thread.workspace?.path ?? null}
            />
          )}
          style={styles.flex}
        />
        {isOpening ? (
          <OpenThreadForm
            client={client}
            onCancel={() => setIsOpening(false)}
            onOpened={(threadId) => {
              setIsOpening(false);
              onSelect(threadId);
            }}
            parent={thread}
          />
        ) : (
          <>
            <CommentTray />
            <Composer
              draftKey={`thread:${thread.id}`}
              {...(canOpenBeneath ? { onOpenSideQuest: () => setIsOpening(true) } : {})}
              hasContent={terminal.hasContent || comments.items.length > 0}
              {...(terminal.onBang === null ? {} : { onBang: terminal.onBang })}
              // The harness, account, Companion, and effort can change at any time, in a turn too: a handover
              // (thread-handover). It starts no turn: the running turn finishes as it was, and the next message, or Retry
              // after a failed turn, runs on it.
              accessory={<ConversationRunner client={client} conversation={conversation} thread={thread} />}
              attachments={{ client, refusal: conversation.refusal }}
              dictation={{ client }}
              mentions={{ client, workspacePath: thread.workspace?.path ?? null }}
              skills={skills}
              {...(canStop ? { onStop: conversation.stop } : {})}
              onSend={conversation.send}
              placeholder={conversation.placeholder}
            />
          </>
        )}
      </View>
    </CommentsProvider>
  );
}
