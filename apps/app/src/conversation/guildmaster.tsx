import type { GuildmasterPlace, MissionId, Viewing } from "@outlore/contracts";
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
 * Chronicler: one permanent conversation that takes any request, looks for a quest that already fits, offers to continue
 * it or proposes a new one as a card for the owner to open, and shows each action as a card (quest coordination). A
 * realm chosen on a realm's page is attached to the next message. It sits in a panel the owner folds (`onFold`).
 */
export function ChroniclerConversation({
  client,
  isFull,
  onFold,
  onOpenMission,
  onRealm,
  onToggleFull,
  realmPath,
  viewing,
}: {
  client: ServiceClient;
  /** Whether the panel fills the whole content area. */
  isFull: boolean;
  /** Folds the panel this conversation sits in; none when the top bar's button folds it, so no ✕ is shown. */
  onFold: (() => void) | null;
  /** Fills the content area with the panel, or restores it. */
  onToggleFull: () => void;
  onOpenMission: (id: MissionId) => void;
  onRealm: (path: string | null) => void;
  realmPath: string | null;
  /** The screen the panel is open beside, which Chronicler reads with each message. */
  viewing: Viewing;
}) {
  const { data: place, error } = useServiceQuery(client, { _tag: "ReadGuildmaster" }, "guildmaster");
  if (place === null)
    return (
      <View style={local.page}>
        <Text style={styles.muted}>{error ?? "Calling Chronicler…"}</Text>
      </View>
    );
  return (
    <ChroniclerChat
      client={client}
      isFull={isFull}
      onFold={onFold}
      onOpenMission={onOpenMission}
      onRealm={onRealm}
      onToggleFull={onToggleFull}
      place={place}
      realmPath={realmPath}
      viewing={viewing}
    />
  );
}

function ChroniclerChat({
  client,
  isFull,
  onFold,
  onOpenMission,
  onRealm,
  onToggleFull,
  place,
  realmPath,
  viewing,
}: {
  client: ServiceClient;
  isFull: boolean;
  onFold: (() => void) | null;
  onOpenMission: (id: MissionId) => void;
  onRealm: (path: string | null) => void;
  onToggleFull: () => void;
  place: GuildmasterPlace;
  realmPath: string | null;
  viewing: Viewing;
}) {
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  const realms = known?.workspaces ?? [];
  // A realm tied to no folder has a null path too, so no path chosen matches none of them (CHG-0161).
  const realm = realmPath === null ? null : (realms.find((candidate) => candidate.path === realmPath) ?? null);
  const { data: detail } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId: place.missionId, threadId: null },
    `guildmaster:${place.missionId}`,
  );
  const conversation = useThreadConversation(client, detail, place.threadId, realmPath, {
    isChronicler: true,
    realmPath,
    viewing,
  });
  const { draft, followNewest, skills, terminal, actionError, entries, act } = conversation;
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
    <View style={local.page}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={[local.title, styles.flex]}>
          Chronicler
        </Text>
        <StateIndicator state={thread.state} />
        <Pressable
          accessibilityLabel={isFull ? "Restore Chronicler" : "Expand Chronicler"}
          accessibilityRole="button"
          onPress={onToggleFull}
        >
          <Text style={local.link}>{isFull ? "⤡" : "⤢"}</Text>
        </Pressable>
        {onFold !== null && (
          <Pressable accessibilityLabel="Fold Chronicler" accessibilityRole="button" onPress={onFold}>
            <Text style={local.link}>✕</Text>
          </Pressable>
        )}
        {canResume && (
          <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
            <Text style={local.link}>Resume</Text>
          </Pressable>
        )}
      </View>
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
        {harnessLabels[thread.harness]} · {companionLabelOf(thread.harness, null, thread.model)}
      </Text>
      {entries.length === 0 && draft === "" && terminal.panel === null ? (
        <View style={local.empty}>
          <Text style={local.emptyTitle}>Tell Chronicler what you need.</Text>
          <Text style={local.emptyText}>
            It looks for a quest that already covers it and offers to continue that one, or proposes a new quest for you
            to open.
          </Text>
        </View>
      ) : (
        <FlatList<Entry>
          {...followNewest.listPropsOf(<ConversationFooter draft={draft} panel={terminal.panel} thread={thread} />)}
          contentContainerStyle={styles.feed}
          keyExtractor={(entry) => entry.key}
          renderItem={({ item }) => (
            <EntryView
              client={client}
              entry={item}
              harness={thread.harness}
              onOpenMission={onOpenMission}
              onSelectThread={() => {}}
              skills={skills}
              workspacePath={realm?.path ?? null}
            />
          )}
          style={styles.flex}
        />
      )}
      {realm !== null && <RealmNote name={realm.name} onClear={() => onRealm(null)} />}
      <Composer
        draftKey="chronicler"
        hasContent={terminal.hasContent}
        {...(terminal.onBang === null ? {} : { onBang: terminal.onBang })}
        accessory={<ConversationRunner client={client} conversation={conversation} isChronicler thread={thread} />}
        attachments={{ client, refusal: conversation.refusal }}
        mentions={{ client, workspacePath: realm?.path ?? null }}
        onSend={conversation.send}
        {...(canStop ? { onStop: conversation.stop } : {})}
        placeholder={conversation.placeholder}
        {...(isInTurn ? { alternative: conversation.alternative } : {})}
        skills={skills}
        {...(isInTurn ? { onInterrupt: conversation.interrupt } : {})}
      />
    </View>
  );
}

const local = StyleSheet.create({
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
