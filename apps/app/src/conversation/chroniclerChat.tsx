import type { GuildmasterPlace, MessageId, MissionId, ThreadId, Viewing, WorkspaceId } from "@outlore/contracts";
import { type ReactNode, useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { BudgetScreen, BudgetStopCard } from "../editors/budgets";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { companionLabelOf, harnessLabels } from "../foundation/formatting";
import { usePageNavigation } from "../foundation/pageNavigation";
import { allMissions } from "../foundation/queries";
import { realmMarkOf } from "../foundation/realmMark";
import { styles } from "../foundation/styles";
import { colors, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ChipIcon } from "../ui/chips";
import { Composer } from "../ui/controls";
import { ChannelHeader, RealmNote } from "./chroniclerHeader";
import { chroniclerStyles as local } from "./chroniclerStyles";
import { type CompanionsTab, CompanionsTabLayout } from "./companionsTabLayout";
import { ConversationFailure, ConversationFeed } from "./conversationFeed";
import { QueuedMessageTray } from "./queuedMessageTray";
import { RepliesProvider } from "./replies";
import { findNewlyAnchoredQuest } from "./replyLineLabels";
import { useThreadConversation } from "./useThreadConversation";

/** The loaded Chronicle or realm-channel chat: its header, notices, feed, and composer. */
export function ChroniclerChat({
  alternateBody,
  channel,
  chrome,
  client,
  companions,
  onBack,
  onOpenMission,
  onRealm,
  place,
  realmPath,
  tabs,
  viewing,
}: {
  alternateBody?: ReactNode;
  channel?: { id: WorkspaceId | null; name: string } | undefined;
  chrome: ReactNode;
  client: ServiceClient;
  companions?: CompanionsTab | undefined;
  onBack?: (() => void) | undefined;
  onOpenMission: (id: MissionId) => void;
  onRealm: (path: string | null) => void;
  place: GuildmasterPlace;
  realmPath: string | null;
  tabs?: ReactNode;
  viewing: Viewing;
}) {
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  const realms = known?.workspaces ?? [];
  // A realm tied to no folder has a null path too, so no path chosen matches none of them (CHG-0161).
  const realm =
    channel === undefined
      ? (realms.find((candidate) => realmPath !== null && candidate.path === realmPath) ?? null)
      : (realms.find((candidate) => candidate.id === channel.id) ?? null);
  const path = realm?.path ?? null;
  const { data: detail, error } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId: place.missionId, threadId: null },
    `guildmaster:${place.missionId}`,
  );
  const conversation = useThreadConversation(client, detail, place.threadId, path, {
    isChronicler: true,
    realmPath: path,
    viewing,
  });
  const { draft, skills, terminal, actionError, entries, act, anchors, hasLoadedAnchors } = conversation;
  // Auto-open a quest pane when the realm channel Companion opens a new quest directly under a message.
  const seenAnchors = useRef<Set<ThreadId> | null>(null);
  useEffect(() => {
    if (channel === undefined || !hasLoadedAnchors) return;
    if (seenAnchors.current === null) {
      seenAnchors.current = new Set(anchors.map((anchor) => anchor.threadId));
      return;
    }
    const opened = findNewlyAnchoredQuest(anchors, seenAnchors.current);
    for (const anchor of anchors) seenAnchors.current.add(anchor.threadId);
    if (opened !== null) onOpenMission(opened.missionId);
  }, [anchors, channel, hasLoadedAnchors, onOpenMission]);
  // The Guildmaster can have a budget of its own, set on its own screen like a quest's (budget-control).
  const { isChroniclerBudgetOpen: isBudgetOpen, onChroniclerBudget: setIsBudgetOpen } = usePageNavigation();
  if (detail === null) {
    return (
      <View style={local.page}>
        {onBack !== undefined && <ChannelHeader name={channel?.name} onBack={onBack} />}
        <Text style={styles.muted}>{error ?? "Calling Chronicler…"}</Text>
      </View>
    );
  }
  if (isBudgetOpen) {
    return (
      <BudgetScreen
        client={client}
        missionId={place.missionId}
        onBack={() => setIsBudgetOpen(false)}
        title="Budget · Chronicler"
      />
    );
  }
  const { thread } = detail;
  // A Reply in the Chronicle opens an empty quest hung from the message, which Chronicler hears of as one it opened (conversation panes).
  const startReply = (message: { id: MessageId; text: string }) => {
    const existing = anchors.find((anchor) => anchor.messageId === message.id);
    if (existing !== undefined) {
      onOpenMission(existing.missionId);
      return;
    }
    void act(
      client
        .request({
          _tag: "ReplyToMessage",
          accountId: thread.accountId,
          effort: thread.effort,
          harness: thread.harness,
          messageId: message.id,
          model: thread.model,
          ...(realm === null ? {} : { realmPath: realm.path }),
          requestId: newRequestId(),
        })
        .then((started) => onOpenMission(started.missionId)),
    );
  };
  const { canResume, canStop } = thread.actions;
  const mark =
    channel === undefined
      ? thread.state
      : realmMarkOf(
          (known?.missions ?? [])
            .filter((mission) => mission.workspaceId === channel.id)
            .map((mission) => mission.state),
        );
  return (
    <RepliesProvider value={{ start: startReply }}>
      <View style={local.page}>
        {onBack !== undefined ? (
          <ChannelHeader
            actions={
              canResume && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}
                >
                  <Text style={local.link}>Resume</Text>
                </Pressable>
              )
            }
            name={channel?.name}
            onBack={onBack}
          />
        ) : (
          <View style={styles.header}>
            <View style={{ alignItems: "center", height: 26, justifyContent: "center", width: 26 }}>
              <ChipIcon
                color={mark === null ? colors.textMuted : stateTones[mark].color}
                kind={channel?.id === null ? "borderlands" : "realm"}
                size={22}
              />
            </View>
            <Text numberOfLines={1} style={[styles.paneTitle, styles.flex]}>
              {channel?.name ?? "Chronicle"}
            </Text>
            {chrome}
            {canResume && (
              <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
                <Text style={local.link}>Resume</Text>
              </Pressable>
            )}
          </View>
        )}
        {tabs}
        {detail.budgetStop !== null && (
          <BudgetStopCard client={client} onRaise={() => setIsBudgetOpen(true)} stop={detail.budgetStop} />
        )}
        {actionError !== null && <Text style={styles.error}>{actionError}</Text>}
        <ConversationFailure client={client} conversation={conversation} linkStyle={local.link} thread={thread} />
        {channel === undefined && (
          <Text numberOfLines={1} style={local.sub}>
            Chronicler · {harnessLabels[thread.harness]} · {companionLabelOf(thread.harness, null, thread.model)}
          </Text>
        )}
        {alternateBody !== undefined && <View style={local.body}>{alternateBody}</View>}
        <View style={alternateBody !== undefined ? local.hidden : local.chat}>
          <CompanionsTabLayout
            client={client}
            companions={companions}
            composer={(accessory) => (
              <>
                {channel === undefined && realm !== null && (
                  <RealmNote name={realm.name} onClear={() => onRealm(null)} />
                )}
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
                  draftKey={channel === undefined ? "chronicler" : place.threadId}
                  hasContent={terminal.hasContent}
                  {...(terminal.onBang === null ? {} : { onBang: terminal.onBang })}
                  accessory={accessory}
                  attachments={{ client, refusal: conversation.refusal }}
                  dictation={{ client }}
                  mentions={{ client, workspacePath: realm?.path ?? null }}
                  onSend={conversation.send}
                  {...(canStop ? { onStop: conversation.stop } : {})}
                  placeholder={conversation.placeholder}
                  skills={skills}
                />
              </>
            )}
            conversation={conversation}
            feed={
              entries.length === 0 && draft === "" && terminal.panel === null ? (
                <View style={local.empty}>
                  <Text style={local.emptyTitle}>Tell Chronicler what you need.</Text>
                  <Text style={local.emptyText}>
                    It looks for a quest that already covers it and offers to continue that one, or proposes a new quest
                    for you to open.
                  </Text>
                </View>
              ) : (
                <ConversationFeed
                  channel={channel}
                  client={client}
                  conversation={conversation}
                  onOpenMission={onOpenMission}
                  onSelectThread={() => {}}
                  thread={thread}
                  workspacePath={realm?.path ?? null}
                />
              )
            }
            isChronicler
            thread={thread}
          />
        </View>
      </View>
    </RepliesProvider>
  );
}
