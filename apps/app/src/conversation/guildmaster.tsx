import type { GuildmasterPlace, MessageId, MissionId, Viewing, WorkspaceId } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { BudgetScreen, BudgetStopCard } from "../editors/budgets";
import type { ServiceClient } from "../foundation/client";
import { companionLabelOf, harnessLabels } from "../foundation/formatting";
import { usePageNavigation } from "../foundation/pageNavigation";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Composer, StateIndicator } from "../ui/controls";
import { EntryView } from "./conversationEntries";
import { ConversationFooter } from "./conversationFooter";
import { ConversationRunner } from "./conversationRunner";
import type { Entry } from "./entries";
import { RepliesProvider, ReplyForm, replyRunnerOf } from "./replies";
import { useThreadConversation } from "./useThreadConversation";

/** The realm chosen for the next message, shown over the message box and cleared with its ×. */
function RealmNote({ name, onClear }: { name: string; onClear: () => void }) {
  return (
    <View style={local.note}>
      <Text style={local.noteText}>
        The next quest opens in <Text style={local.noteName}>{name}</Text>
      </Text>
      <Pressable accessibilityLabel="Clear the realm" accessibilityRole="button" onPress={onClear}>
        <Text style={local.noteClear}>×</Text>
      </Pressable>
    </View>
  );
}

/**
 * The Chronicle: Chronicler's one permanent conversation, the first pane of the window (CHG-0564). It takes any request,
 * looks for a quest that already fits, offers to continue it or proposes a new one as a card for the owner to open, and
 * shows each quest it opened as a reply line under its message (quest coordination). A realm chosen on a realm's page is
 * attached to the next message. `chrome` is the buttons at the end of its header: fold, or close on a narrow window.
 */
export function ChroniclerConversation({
  alternateBody,
  channel,
  chrome,
  client,
  onOpenMission,
  onRealm,
  realmPath,
  tabs,
  viewing,
}: {
  /** Shown in place of the conversation and its composer, under the tabs (a realm's Quests tab); undefined shows the conversation. */
  alternateBody?: ReactNode;
  /** The buttons at the end of the header, which the pane that holds the conversation chooses. */
  channel?: { id: WorkspaceId | null; name: string } | undefined;
  chrome: ReactNode;
  client: ServiceClient;
  onOpenMission: (id: MissionId) => void;
  onRealm: (path: string | null) => void;
  realmPath: string | null;
  /** The tabs under the header, which the pane that holds the conversation chooses. */
  tabs?: ReactNode;
  /** The screen the panel is open beside, which Chronicler reads with each message. */
  viewing: Viewing;
}) {
  const { data: place, error } = useServiceQuery(
    client,
    { _tag: "ReadGuildmaster", ...(channel === undefined ? {} : { channelId: channel.id }) },
    channel === undefined ? "guildmaster" : `channel:${channel.id ?? "borderlands"}`,
  );
  if (place === null)
    return (
      <View style={local.page}>
        <Text style={styles.muted}>{error ?? "Calling Chronicler…"}</Text>
      </View>
    );
  return (
    <ChroniclerChat
      alternateBody={alternateBody}
      channel={channel}
      chrome={chrome}
      client={client}
      key={place.threadId}
      onOpenMission={onOpenMission}
      onRealm={onRealm}
      place={place}
      realmPath={realmPath}
      tabs={tabs}
      viewing={viewing}
    />
  );
}

function ChroniclerChat({
  alternateBody,
  channel,
  chrome,
  client,
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
  const { data: detail } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId: place.missionId, threadId: null },
    `guildmaster:${place.missionId}`,
  );
  const conversation = useThreadConversation(client, detail, place.threadId, path, {
    isChronicler: true,
    realmPath: path,
    viewing,
  });
  const { draft, followNewest, skills, terminal, actionError, entries, act } = conversation;
  // A Reply in the Chronicle starts a quest, which Chronicler hears of as one it opened (conversation panes).
  const [replyTo, setReplyTo] = useState<{ id: MessageId; text: string } | null>(null);
  // The Guildmaster can have a budget of its own, set on its own screen like a quest's (budget-control).
  const { isChroniclerBudgetOpen: isBudgetOpen, onChroniclerBudget: setIsBudgetOpen } = usePageNavigation();
  if (detail === null) {
    return (
      <View style={local.page}>
        <Text style={styles.muted}>Calling Chronicler…</Text>
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
  const { canResume, canStop, isInTurn } = thread.actions;
  return (
    <RepliesProvider value={{ start: (message) => setReplyTo(message) }}>
      <View style={local.page}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={[local.title, styles.flex]}>
            {channel?.name ?? "Chronicle"}
          </Text>
          <StateIndicator state={thread.state} />
          {chrome}
          {canResume && (
            <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
              <Text style={local.link}>Resume</Text>
            </Pressable>
          )}
        </View>
        {tabs}
        {detail.budgetStop !== null && (
          <BudgetStopCard client={client} onRaise={() => setIsBudgetOpen(true)} stop={detail.budgetStop} />
        )}
        {actionError !== null && <Text style={styles.error}>{actionError}</Text>}
        {thread.failure != null && (
          <View style={styles.failure}>
            <Text style={styles.error}>The last turn failed: {thread.failure}</Text>
            <Text style={styles.muted}>Your next message retries it.</Text>
            {!isInTurn && thread.state !== "Stopped" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => act(client.request({ _tag: "RetryThread", threadId: thread.id }))}
              >
                <Text style={local.link}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}
        <Text numberOfLines={1} style={local.sub}>
          Chronicler · {harnessLabels[thread.harness]} · {companionLabelOf(thread.harness, null, thread.model)}
        </Text>
        {alternateBody !== undefined ? (
          <View style={local.body}>{alternateBody}</View>
        ) : entries.length === 0 && draft === "" && terminal.panel === null ? (
          <View style={local.empty}>
            <Text style={local.emptyTitle}>Tell Chronicler what you need.</Text>
            <Text style={local.emptyText}>
              It looks for a quest that already covers it and offers to continue that one, or proposes a new quest for
              you to open.
            </Text>
          </View>
        ) : (
          <FlatList<Entry>
            {...followNewest.listPropsOf(<ConversationFooter draft={draft} panel={terminal.panel} thread={thread} />)}
            contentContainerStyle={styles.feed}
            keyExtractor={(entry) => entry.key}
            renderItem={({ item }) => (
              <EntryView
                channel={channel}
                client={client}
                entry={item}
                harness={thread.harness}
                isInTurn={isInTurn}
                onInterrupt={conversation.interrupt}
                onOpenMission={onOpenMission}
                onSelectThread={() => {}}
                onSteer={conversation.steer}
                skills={skills}
                workspacePath={realm?.path ?? null}
              />
            )}
            style={styles.flex}
          />
        )}
        {channel === undefined && realm !== null && <RealmNote name={realm.name} onClear={() => onRealm(null)} />}
        {alternateBody !== undefined ? null : replyTo !== null ? (
          <ReplyForm
            client={client}
            message={replyTo}
            onCancel={() => setReplyTo(null)}
            onStarted={(started) => {
              setReplyTo(null);
              onOpenMission(started.missionId);
            }}
            placeholder="The quest's first message…"
            realmPath={realm?.path ?? null}
            runner={replyRunnerOf(thread)}
          />
        ) : (
          <Composer
            draftKey={channel === undefined ? "chronicler" : place.threadId}
            hasContent={terminal.hasContent}
            {...(terminal.onBang === null ? {} : { onBang: terminal.onBang })}
            accessory={<ConversationRunner client={client} conversation={conversation} isChronicler thread={thread} />}
            attachments={{ client, refusal: conversation.refusal }}
            dictation={{ client }}
            mentions={{ client, workspacePath: realm?.path ?? null }}
            onSend={conversation.send}
            {...(canStop ? { onStop: conversation.stop } : {})}
            placeholder={conversation.placeholder}
            skills={skills}
          />
        )}
      </View>
    </RepliesProvider>
  );
}

const local = StyleSheet.create({
  body: { flex: 1 },
  empty: { alignItems: "center", flex: 1, gap: 8, justifyContent: "center", paddingHorizontal: 24 },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    maxWidth: 520,
    textAlign: "center",
  },
  emptyTitle: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  handoff: { gap: 6 },
  link: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.md },
  note: { alignItems: "center", flexDirection: "row", gap: 8 },
  noteClear: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  noteName: { color: colors.highlight, fontFamily: fonts.sans, fontWeight: "700" },
  noteText: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md },
  page: { backgroundColor: colors.page, flex: 1, gap: 8, paddingBottom: 14, paddingHorizontal: 16, paddingTop: 12 },
  sub: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md, opacity: 0.8 },
  title: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
});
