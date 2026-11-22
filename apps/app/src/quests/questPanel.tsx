import type { HarnessName, MissionDetail, MissionId, MissionSummary, WorkspaceChoice } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ConnectorChoicePanel } from "../connectors";
import { BudgetMeters } from "../editors/budgets";
import { boardOf } from "../foundation/boardColumns";
import type { ServiceClient } from "../foundation/client";
import { timeOf, usageDetail } from "../foundation/formatting";
import {
  consumptionDetailsOf,
  costTextOf,
  threadCountOf,
  tokenCountOf,
  totalTokensOf,
  usedTextOf,
} from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, stateLabels, stateTones } from "../foundation/theme";
import { RealmArchiveAction } from "../realms/realmArchiveAction";
import { RealmName } from "../realms/realmName";
import { useRitualFormNavigation } from "../rituals/ritualFormNavigation";
import { RitualControls } from "../rituals/rituals";
import { Button } from "../ui/button";
import { ProviderMark } from "../ui/providerMarks";
import { RowChevron, RowIcon, type RowIconName } from "../ui/rowIcons";
import { MissionEndingActions, MissionTitle } from "./missionActions";
import { QuestRealm } from "./questRealm";

/** A labelled group of rows in a rounded card, as in the quest's side panel; the rows are set apart by thin rules. */
export function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={local.group}>
      <Text style={local.groupLabel}>{label}</Text>
      <View style={local.card}>
        <View style={local.cardRows}>{children}</View>
      </View>
    </View>
  );
}

/** One row of a group: an icon, its name, a short value, and a chevron when pressing it opens something. */
export function Row({
  icon,
  label,
  mark,
  onPress,
  value,
}: {
  icon?: RowIconName;
  label: string;
  /** A harness whose logo stands before the value. */
  mark?: HarnessName;
  onPress?: () => void;
  value?: string;
}) {
  const content = (
    <>
      {icon !== undefined && <RowIcon name={icon} tint={colors.textSecondary} />}
      <Text numberOfLines={1} style={local.rowLabel}>
        {label}
      </Text>
      {mark !== undefined && <ProviderMark harness={mark} size={14} />}
      {value !== undefined && (
        <Text numberOfLines={1} style={local.rowValue}>
          {value}
        </Text>
      )}
      {onPress !== undefined && <RowChevron tint={colors.textMuted} />}
    </>
  );
  return onPress === undefined ? (
    <View style={local.row}>{content}</View>
  ) : (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.row, pressed && local.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** What a quest's budget shows as a row value: what is spent against the limit, or that there is none. */
export const budgetValueOf = (budget: MissionDetail["mission"]["budget"]) => {
  const { limits, spent } = budget;
  if (limits.tokens !== null) return `${tokenCountOf(spent.tokens)} of ${tokenCountOf(limits.tokens)} tokens`;
  if (limits.cost !== null) return `$${spent.cost.toFixed(2)} of $${limits.cost.toFixed(2)}`;
  return "No limit";
};

/** What the panel adds for the thread open in the conversation: its Companions group and its rows in Knows and Does. */
export type ThreadSections = {
  /** The thread's Companions group: what it runs on, its backups, and its context. */
  companions: ReactNode;
  knows: ReactNode;
  skills: { content: ReactNode; value: string };
  tools: { content: ReactNode; value: string };
  /** Given for an errand: it names the quest it belongs to and ends on its own. */
  sideQuest: { onOpenQuest: () => void; restore: ReactNode; title: string } | null;
  spends: ReactNode;
};

/**
 * The quest's side panel shows the quest's emblem and name (press to rename), how it stands, and the open thread's Companions, Knows, and Does groups.
 * It leaves the thread's own conversation alone.
 */
export function QuestSidebar({
  client,
  mission,
  onOpenBudget,
  onOpenJournal,
  onOpenMission,
  onBack,
  onOpenQuest,
  thread,
}: {
  client: ServiceClient;
  mission: MissionDetail["mission"];
  /** Opens another quest: the origin quest of a Ritual, or the Ritual made from this quest. */
  onOpenMission: (missionId: MissionId) => void;
  /** Given where the panel previews a quest from the board: returns to the board's overview. */
  onBack?: () => void;
  onOpenBudget: () => void;
  onOpenJournal: () => void;
  /** Given where the panel previews a quest from the board: opens the quest's conversation, under the brief. */
  onOpenQuest?: () => void;
  /** Given in the quest's conversation: what the open thread adds. */
  thread?: ThreadSections;
}) {
  const [section, setSection] = useState<"Skills" | "Tools" | "Connectors" | null>(null);
  const { open: openRitualForm } = useRitualFormNavigation();
  const { usage } = mission;
  const tone = stateTones[mission.state];
  return (
    <View style={local.panel}>
      <ScrollView contentContainerStyle={local.content} style={[styles.flex, section !== null && local.hidden]}>
        <View style={local.hero}>
          {onBack === undefined ? (
            // A plain quest is already named by the column's Quest tab; only an errand or a Ritual says what it is.
            (thread?.sideQuest != null || mission.ritual !== null) && (
              <Text style={local.kicker}>{thread?.sideQuest != null ? "Errand" : "Ritual"}</Text>
            )
          ) : (
            <Pressable accessibilityRole="button" onPress={onBack}>
              <Text style={local.kicker}>‹ The council</Text>
            </Pressable>
          )}
          <View style={local.heroRow}>
            {thread?.sideQuest != null ? (
              <Text style={[local.heroName, styles.flex]}>{thread.sideQuest.title}</Text>
            ) : (
              <MissionTitle client={client} key={mission.title} mission={mission} textStyle={local.heroName} />
            )}
          </View>
          <Text numberOfLines={2} style={local.meta}>
            <Text style={[local.metaState, { color: tone.color }]}>{stateLabels[mission.state]}</Text>
            {[mission.workspaceName, threadCountOf(mission)]
              .filter((part) => part !== null)
              .map((part) => ` · ${part}`)
              .join("")}
          </Text>
        </View>
        {mission.ritual !== null && (
          <RitualControls client={client} missionId={mission.id} onOpenMission={onOpenMission} />
        )}
        {onOpenQuest !== undefined && (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenQuest}
            style={({ pressed }) => [local.open, pressed && local.openPressed]}
          >
            <Text style={local.openText}>Open quest</Text>
          </Pressable>
        )}
        {thread?.sideQuest != null && (
          <Group label="Quest">
            <Row icon="state" label={mission.title} onPress={thread.sideQuest.onOpenQuest} />
          </Group>
        )}
        {thread !== undefined && <Group label="Companions">{thread.companions}</Group>}
        <Group label="Knows">
          <Row icon="book" label="Journal" onPress={onOpenJournal} value="Where it stands" />
          {thread?.sideQuest == null && mission.ritual === null && (
            <QuestRealm
              client={client}
              mission={mission}
              renderRow={(onPress) => (
                <Row icon="state" label="Realm" onPress={onPress} value={mission.workspaceName ?? "None"} />
              )}
            />
          )}
          {thread?.knows}
          {thread !== undefined && (
            <>
              <Row icon="puzzle" label="Skills" onPress={() => setSection("Skills")} value={thread.skills.value} />
              <Row icon="puzzle" label="Tools" onPress={() => setSection("Tools")} value={thread.tools.value} />
            </>
          )}
          <Row icon="puzzle" label="Connectors" onPress={() => setSection("Connectors")} />
        </Group>
        <Group label="Does">
          {thread?.spends}
          <Row icon="wallet" label="Quest budget" onPress={onOpenBudget} value={budgetValueOf(mission.budget)} />
          <Row icon="chart" label="Quest usage" value={usedTextOf(mission.consumption)} />
          {/* An ordinary quest schedules its work for a Ritual: the form takes the quest's realm and keeps a link (CHG-0616);
              it opens as the conversation area's own screen (CHG-0643), covered quests staying beneath it. */}
          {mission.ritual === null && thread?.sideQuest == null && mission.state !== "Archived" && (
            <Row
              icon="moon"
              label="Schedule as a Ritual"
              onPress={() => openRitualForm({ kind: "create", originMissionId: mission.id, realmPath: null })}
            />
          )}
          {/* Archive and completion live in the header, while restore or reopen appears here for archived work. */}
          {thread?.sideQuest != null
            ? thread.sideQuest.restore !== null && <View style={local.does}>{thread.sideQuest.restore}</View>
            : mission.ritual === null &&
              mission.state === "Archived" && (
                <View style={local.does}>
                  <MissionEndingActions client={client} isButtons={true} mission={mission} />
                </View>
              )}
        </Group>
        <View style={local.spends}>
          <BudgetMeters onPress={onOpenBudget} use={mission.budget} />
          <Text style={styles.muted}>{usageDetail(usage)}</Text>
          {consumptionDetailsOf(mission.consumption) !== "" && (
            <Text style={styles.muted}>{consumptionDetailsOf(mission.consumption)}</Text>
          )}
        </View>
      </ScrollView>
      {section !== null && (
        <View style={styles.flex}>
          <View style={local.sectionHeader}>
            <Text accessibilityRole="header" style={local.sectionTitle}>
              {section}
            </Text>
            <Button isPrimary={false} label="Back" onPress={() => setSection(null)} />
          </View>
          <ScrollView contentContainerStyle={local.content} key={section} style={styles.flex}>
            {section === "Skills" && thread?.skills.content}
            {section === "Tools" && thread?.tools.content}
            {section === "Connectors" && (
              <>
                {thread?.sideQuest != null && (
                  <Text style={styles.muted}>These choices apply to the whole quest, including its errands.</Text>
                )}
                <ConnectorChoicePanel
                  client={client}
                  hasHeading={false}
                  level={{ _tag: "Quest", missionId: mission.id }}
                />
              </>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const ledgerColumns = [
  { color: colors.danger, column: "Attention" },
  { color: colors.accent, column: "Underway" },
  { color: stateTones.Resting.color, column: "Resting" },
  { color: colors.success, column: "Fulfilled" },
] as const;

/** One row of an overview's list: a quest's name and where it stands; pressing it selects the quest. */
function OverviewRow({ mission, onPress }: { mission: MissionSummary; onPress: () => void }) {
  const tone = stateTones[mission.state];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.overviewRow, pressed && local.pressed]}
    >
      <View style={[local.overviewDot, { backgroundColor: tone.color }]} />
      <Text numberOfLines={1} style={local.overviewRowText}>
        {mission.title}
      </Text>
      <Text numberOfLines={1} style={local.overviewRowMeta}>
        {[stateLabels[mission.state], mission.workspaceName].filter((part) => part !== null).join(" · ")}
      </Text>
    </Pressable>
  );
}

/** The count of quests in each column, then what needs the owner and what is underway, each a press away from its panel. */
function QuestLedger({
  missions,
  onSelect,
}: {
  missions: ReadonlyArray<MissionSummary>;
  onSelect: (id: MissionId) => void;
}) {
  const board = boardOf(missions);
  const lists = [
    { label: "Needs you", rows: board.Attention },
    { label: "Underway", rows: board.Underway },
  ] as const;
  return (
    <>
      <View style={local.group}>
        <Text style={local.groupLabel}>The quest ledger</Text>
        <View style={local.ledger}>
          {ledgerColumns.map(({ column, color }) => (
            <View key={column} style={local.ledgerTile}>
              <Text style={[local.ledgerCount, { color }]}>{board[column].length}</Text>
              <Text style={local.ledgerLabel}>{stateLabels[column]}</Text>
            </View>
          ))}
        </View>
      </View>
      {lists.map(
        ({ label, rows }) =>
          rows.length > 0 && (
            <View key={label} style={local.group}>
              <Text style={local.groupLabel}>{label}</Text>
              <View style={local.card}>
                {rows.slice(0, 5).map((mission) => (
                  <OverviewRow key={mission.id} mission={mission} onPress={() => onSelect(mission.id)} />
                ))}
                {rows.length > 5 && <Text style={local.overviewMore}>+ {rows.length - 5} more on the board</Text>}
              </View>
            </View>
          ),
      )}
    </>
  );
}

/**
 * What the board's side panel shows for a realm while no quest is chosen: its name, its folder, the ledger
 * of its quests, and those needing the owner or underway.
 */
export function RealmPanel({
  client,
  missions,
  onOpenLore,
  onSelect,
  realm,
}: {
  client: ServiceClient;
  missions: ReadonlyArray<MissionSummary>;
  /** Opens the lore kept for this realm. */
  onOpenLore: () => void;
  onSelect: (id: MissionId) => void;
  realm: WorkspaceChoice;
}) {
  const lastActivity = missions.length === 0 ? null : Math.max(...missions.map((mission) => mission.lastActivityAt));
  const cost = costTextOf({
    estimated: missions.reduce((sum, { consumption }) => sum + consumption.estimated, 0),
    reported: missions.reduce((sum, { consumption }) => sum + consumption.reported, 0),
  });
  const tokens = missions.reduce((sum, { consumption }) => sum + totalTokensOf(consumption), 0);
  const spentText = `${tokenCountOf(tokens)} tokens${cost === null ? "" : ` · ${cost}`}`;
  return (
    <View style={local.panel}>
      <ScrollView contentContainerStyle={local.content} style={styles.flex}>
        <View style={local.hero}>
          <Text style={local.kicker}>Realm</Text>
          <View style={local.heroRow}>
            <RealmName client={client} realm={realm} textStyle={local.heroName} />
          </View>
          <Text numberOfLines={2} style={local.meta}>
            {realm.path ?? "Tied to no folder"}
          </Text>
        </View>
        <Group label="Details">
          <Row label="Quests" value={String(missions.length)} />
          <Row
            label="Errands"
            value={String(missions.reduce((sum, mission) => sum + Math.max(0, mission.threadCount - 1), 0))}
          />
          {lastActivity !== null && <Row label="Last active" value={timeOf(lastActivity)} />}
          <Row label="Spent" value={spentText} />
        </Group>
        <Group label="Lore">
          <Row label="What this realm has learned" onPress={onOpenLore} />
        </Group>
        <ConnectorChoicePanel client={client} key={realm.id} level={{ _tag: "Realm", realmId: realm.id }} />
        <QuestLedger missions={missions} onSelect={onSelect} />
        <RealmArchiveAction client={client} workspaceId={realm.id} />
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  // Each row draws a rule above it; the first row's is pushed out of the clipped card.
  cardRows: { marginTop: -1 },
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 26 },
  does: { borderTopColor: colors.border, borderTopWidth: 1, padding: 12 },
  group: { gap: 6 },
  groupLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
  hero: { gap: 10 },
  heroName: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 27,
  },
  heroRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingRight: 34 },
  hidden: { display: "none" },
  kicker: {
    color: colors.edge,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: "700",
  },
  ledger: { flexDirection: "row", gap: 8 },
  ledgerCount: { fontFamily: fonts.sans, fontSize: 24, fontWeight: "700" },
  ledgerLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  ledgerTile: {
    alignItems: "center",
    backgroundColor: colors.control,
    borderRadius: radii.md,
    flex: 1,
    gap: 2,
    paddingVertical: 10,
  },
  meta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  metaState: { fontWeight: "700" },
  // The field may not outgrow the panel: a web input is as wide as its text unless told otherwise.
  nameField: { flex: 1, minWidth: 0 },
  nameInput: {
    backgroundColor: colors.canvas,
    borderColor: colors.edge,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    fontSize: 18,
    lineHeight: 24,
    minWidth: 0,
    padding: 6,
    width: "100%",
  },
  open: {
    ...outline,
    alignItems: "center",
    backgroundColor: colors.edge,
    borderRadius: radii.sm,
    paddingVertical: 10,
  },
  openPressed: { backgroundColor: colors.highlight },
  openText: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  overviewDot: { borderRadius: radii.pill, height: 8, width: 8 },
  overviewMore: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, padding: 10 },
  overviewRow: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 38, paddingHorizontal: 12 },
  overviewRowMeta: { color: colors.textMuted, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  overviewRowText: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  panel: { backgroundColor: colors.page, flex: 1 },
  pressed: { backgroundColor: colors.controlActive },
  row: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  rowLabel: { color: colors.text, flexGrow: 1, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  rowValue: { color: colors.textMuted, flexShrink: 3, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  sectionHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    padding: 12,
  },
  sectionTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "700" },
  spends: { gap: 10 },
});
