import type { BudgetScope, MissionDetail, MissionId, ThreadId } from "@outlore/contracts";
import { useState } from "react";
import { FlatList, Pressable, Text, useWindowDimensions, View } from "react-native";
import { BudgetScreen, BudgetStopCard } from "../editors/budgets";
import type { ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { usePageNavigation } from "../foundation/pageNavigation";
import { useHasSidebar, useHasTopBar, useQuestPanel } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { useEnding } from "../foundation/useEnding";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { JournalScreen } from "../lore/journal";
import { LoreScreen } from "../lore/lore";
import { EndingConfirmation } from "../quests/missionActions";
import { MissingFolderNotice } from "../realms/workspaces";
import { ArchiveButton } from "../ui/archiveButton";
import { Composer, StateIndicator } from "../ui/controls";
import { CommentTray } from "./commentViews";
import { EntryView } from "./conversationEntries";
import { ConversationFooter } from "./conversationFooter";
import { ConversationRunner } from "./conversationRunner";
import type { Entry } from "./entries";
import { MobileHeader } from "./mobileHeader";
import { terminalFolderOf } from "./terminalFolder";
import { ChatterNotices } from "./threadActions";
import { ThreadPanel } from "./threadPanel";
import { OpenThreadForm, ThreadTree } from "./threadTree";
import { CommentsProvider } from "./useComments";
import { useThreadConversation } from "./useThreadConversation";

/** A thread title cut for a one-line label. */
/** The selected thread: its settings, notices, conversation, and composer. */
function ThreadPane({
  canOpenDetails,
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
  const archive =
    thread.parentId === null && detail.mission.ritual === null && detail.mission.state !== "Archived"
      ? () => ending.start("Archived")
      : null;
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
                {archive !== null && (
                  <ArchiveButton isDisabled={ending.isBusy} label="Archive quest" onPress={archive} />
                )}
              </>
            )}
            {canResume && (
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
        {parent !== undefined && (
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

/** A mission: its thread tree on the side, the selected thread's conversation beside it. */
export function Conversation({
  client,
  missionId,
  onBack,
  onOpenMission,
  onSelectThread,
  onSetDetails,
  selectedThreadId,
}: {
  client: ServiceClient;
  missionId: MissionId;
  /** Shows another thread of this quest; the window keeps which one, so the sidebar can show it too. */
  onSelectThread: (threadId: ThreadId | null) => void;
  /** The thread shown, or null for the quest's top thread. */
  selectedThreadId: ThreadId | null;
  /** Opens or closes the quest's side panel. */
  onSetDetails: (isOpen: boolean) => void;
  /** Goes to the quest's parent view: its realm's quests, or the Borderlands; null while the quest has not loaded. */
  onBack: (quest: { workspaceId: string | null; workspaceName: string | null } | null) => void;
  /** Opens another mission, such as where an off-topic request went. */
  onOpenMission: (missionId: MissionId) => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 820;
  // On a narrow window the errands list is folded to one line until it is wanted, so the conversation keeps the room.
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const selectedId = selectedThreadId;
  const setSelectedId = onSelectThread;
  const { page, onPage } = usePageNavigation();
  const isJournalOpen = page?.kind === "journal";
  const setIsJournalOpen = (isOpen: boolean) => onPage(isOpen ? { kind: "journal" } : null);
  const hasTopBar = useHasTopBar();
  const hasSidebar = useHasSidebar();
  const goBack = () => onBack(data?.mission ?? null);
  const loreThread = page?.kind === "lore" ? page : null;
  const setLoreThread = (thread: { id: ThreadId; title: string } | null) =>
    onPage(thread === null ? null : { kind: "lore", ...thread });
  const budgetScope = page?.kind === "budget" ? page.scope : null;
  const setBudgetScope = (scope: BudgetScope | null) => onPage(scope === null ? null : { kind: "budget", scope });
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId, threadId: selectedId },
    `${missionId}:${selectedId ?? "top"}`,
  );
  // A query for a newly selected thread answers after the previous one; keep showing what matches.
  const detail = data !== null && (selectedId === null || data.thread.id === selectedId) ? data : null;
  // The quest's side panel is shown by the window's frame, beside the top bar's icon, not by this screen. It holds
  // the open thread's groups too: while another thread loads, the one before stays.
  const shown = detail ?? data;
  const hasSideQuests = data?.threads.some((thread) => thread.parentId !== null) ?? false;
  useQuestPanel(
    shown && (
      <ThreadPanel
        client={client}
        detail={shown}
        onOpenBudget={() => setBudgetScope("Mission")}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenLore={() => setLoreThread({ id: shown.thread.id, title: shown.thread.title })}
        onOpenQuest={() => setSelectedId(shown.mission.topThreadId)}
      />
    ),
  );
  if (budgetScope !== null) {
    return (
      <BudgetScreen
        client={client}
        missionId={budgetScope === "Mission" ? missionId : null}
        onBack={() => setBudgetScope(null)}
        title={budgetScope === "Mission" ? `Budget · ${data?.mission.title ?? ""}` : "Global budget"}
      />
    );
  }
  if (loreThread !== null) {
    return (
      <LoreScreen
        client={client}
        onBack={() => setLoreThread(null)}
        threadId={loreThread.id}
        title={`Lore · ${loreThread.title}`}
      />
    );
  }
  if (isJournalOpen) {
    return (
      <JournalScreen
        client={client}
        missionId={missionId}
        onBack={() => setIsJournalOpen(false)}
        title={data?.mission.title ?? ""}
      />
    );
  }
  return (
    <View style={[styles.questLayout, isCompact && styles.questLayoutCompact]}>
      {hasSideQuests && !hasSidebar && (
        // With the sidebar showing, it is the quest's one tree; this one serves the narrow window, which has none.
        <View style={[styles.questSide, isCompact && styles.questSideCompact]}>
          <View style={styles.questSideBar}>
            {isCompact && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isTreeOpen }}
                onPress={() => setIsTreeOpen(!isTreeOpen)}
              >
                <Text style={styles.link}>Errands {isTreeOpen ? "▴" : "▾"}</Text>
              </Pressable>
            )}
          </View>
          {data && (!isCompact || isTreeOpen) && (
            <ThreadTree
              onSelect={(threadId) => {
                setIsTreeOpen(false);
                setSelectedId(threadId);
              }}
              selectedId={data.thread.id}
              shouldShowAgentThreads={settings?.shouldShowAgentThreads ?? true}
              threads={data.threads}
            />
          )}
        </View>
      )}
      <View style={[styles.questMain, isCompact && styles.questMainCompact]}>
        {error !== null && <Text style={styles.error}>{error}</Text>}
        {detail && (
          <ThreadPane
            canOpenDetails={!hasTopBar}
            client={client}
            detail={detail}
            isCompact={isCompact}
            key={detail.thread.id}
            {...(hasSidebar ? {} : { onBack: goBack })}
            onOpenBudget={() => setBudgetScope(detail.budgetStop?.scope ?? "Mission")}
            onOpenDetails={() => onSetDetails(true)}
            onOpenMission={onOpenMission}
            onSelect={setSelectedId}
          />
        )}
      </View>
    </View>
  );
}
