import type { MissionSummary } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BudgetMeters } from "../editors/budgets";
import { type BoardColumn, isStateShownOn } from "../foundation/boardColumns";
import type { ServiceClient } from "../foundation/client";
import { costTextOf, tokenCountOf, totalTokensOf } from "../foundation/labels";
import { colors, fontSizes, fonts, outline, round, stateLabels, stateTones } from "../foundation/theme";
import { StateBadge } from "../ui/controls";
import { MissionEndingActions } from "./missionActions";

/** One mission as a card: its title, where and how much, its budget, and its ending actions. */
export function MissionCard({
  client,
  column,
  isSelected = false,
  mission,
  onOpen,
  onOpenQuest,
}: {
  client: ServiceClient;
  /** The column it sits in, or null outside the board (the Archived view). */
  column: BoardColumn | null;
  /** Whether the quest panel beside the board shows this quest. */
  isSelected?: boolean;
  mission: MissionSummary;
  /** Pressing the card: opens the quest, or selects it for the panel beside the board. */
  onOpen: () => void;
  /** Opens the quest itself, from the Open link on the card. */
  onOpenQuest: () => void;
}) {
  const isCircled = mission.state === "Attention";
  // A card under the pointer straightens and rises a little, so the board answers the hand.
  const [isHovered, setIsHovered] = useState(false);
  const cost = costTextOf(mission.consumption);
  const tokens = totalTokensOf(mission.consumption);
  return (
    <View
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      style={[
        local.card,
        mission.state === "Done" && local.cardDone,
        isCircled && local.cardAttention,
        isHovered && local.cardHovered,
        isSelected && local.cardSelected,
      ]}
    >
      {mission.state === "Done" && column === null && (
        <View pointerEvents="none" style={local.ribbon}>
          <Text style={local.ribbonText}>{stateLabels.Done}</Text>
        </View>
      )}
      {isCircled && (
        <View pointerEvents="none" style={local.circle}>
          <Text style={local.seal}>!</Text>
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={onOpen} style={local.cardMain}>
        <View style={local.titleRow}>
          <Text numberOfLines={3} style={[local.cardTitle, local.titleText]}>
            {mission.state === "Done" && <Text style={local.tick}>✓ </Text>}
            {mission.title}
          </Text>
        </View>
        <View
          accessibilityLabel={`${cost === null ? "" : `${cost.startsWith("≈") ? "Estimated cost" : "API cost"} ${cost.replace("≈ ", "")}, `}${tokens} tokens`}
          style={local.costRow}
        >
          <View style={local.coin} />
          {cost !== null && <Text style={local.cost}>{cost}</Text>}
          <Text style={local.tokens}>{tokenCountOf(tokens)} tokens</Text>
        </View>
      </Pressable>
      {mission.state !== "Done" && (column === null || isStateShownOn(column, mission.state)) && (
        <StateBadge state={mission.state} />
      )}
      <BudgetMeters use={mission.budget} />
      <MissionEndingActions client={client} mission={mission} onOpen={onOpenQuest} />
    </View>
  );
}

/** A column's heading, in the color of what the column means. */
function _ColumnHeading({ column }: { column: BoardColumn }) {
  return (
    <Text accessibilityRole="header" style={[local.columnHeading, { color: stateTones[column].color }]}>
      {stateLabels[column]}
    </Text>
  );
}

const local = StyleSheet.create({
  card: {
    ...outline,
    ...round,
    backgroundColor: colors.canvas,
    borderColor: colors.edge,
    borderWidth: 1,
    gap: 10,
    marginBottom: 22,
    padding: 16,
    paddingTop: 22,
  },
  cardAttention: { borderColor: colors.danger },
  cardDone: { opacity: 0.8 },
  cardHovered: { borderColor: colors.highlight, opacity: 1 },
  cardMain: { gap: 4 },
  cardSelected: { borderColor: colors.accent },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 24,
  },
  circle: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: 16,
    bottom: -8,
    height: 30,
    justifyContent: "center",
    position: "absolute",
    right: -7,
    width: 30,
    zIndex: 1,
  },
  coin: { backgroundColor: colors.edge, borderRadius: 8, height: 15, width: 15 },
  column: {
    borderRightColor: colors.border,
    borderRightWidth: 1,
    flexBasis: 220,
    flexGrow: 1,
    minWidth: 0,
    paddingRight: 16,
  },
  columnHeading: { fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700", marginBottom: 12 },
  // The columns wrap when the board is narrow, as beside the quest panel, so a card never gets too thin to read.
  columns: { alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 16 },
  cost: { color: colors.text, fontFamily: fonts.mono, fontSize: 15 },
  costRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    paddingTop: 8,
  },
  earlier: { alignItems: "center", gap: 2, marginBottom: 12, paddingVertical: 6 },
  earlierRule: { color: colors.edge, fontFamily: fonts.sans, fontSize: 13, opacity: 0.8 },
  earlierText: { color: colors.highlight, fontFamily: fonts.sans, fontSize: 16, fontStyle: "italic" },
  // An empty column shows a lone gilt ornament, not a sentence.
  empty: { color: colors.edge, fontSize: 22, marginBottom: 12, opacity: 0.6, textAlign: "center" },
  highlighted: { backgroundColor: colors.marker },
  ribbon: {
    backgroundColor: colors.success,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 9,
    paddingVertical: 2,
    position: "absolute",
    right: 0,
    top: -7,
    zIndex: 1,
  },
  ribbonText: {
    color: colors.onGround,
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: "700",
  },
  seal: { color: colors.canvas, fontFamily: fonts.sans, fontSize: 18 },
  stacked: { gap: 8 },
  tick: { color: colors.success },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  titleText: { flex: 1 },
  tokens: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 15 },
});
