import type { HarnessName, PlanLimitWindow } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { planLimitTextOf } from "../foundation/labels";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ProviderMark } from "../ui/providerMarks";
import { type DotLevel, type PlanUsage, planUsageOf, type RowLevel } from "./planUsage";

const logoSize = 26;
const dotColors: Record<DotLevel | RowLevel, string> = {
  neutral: colors.textMuted,
  normal: colors.success,
  reached: colors.danger,
  unstarted: colors.textMuted,
  warning: colors.warning,
};

/** A status dot; a limit that has not started is hollow, a provider's dot with no known limit is grey. */
function Dot({ level, style }: { level: DotLevel | RowLevel; style?: object }) {
  const isHollow = level === "unstarted";
  return (
    <View
      style={[
        local.dot,
        isHollow ? { borderColor: colors.textMuted, borderWidth: 1 } : { backgroundColor: dotColors[level] },
        style,
      ]}
    />
  );
}

/** What hovering or focusing a provider opens: a card above the rail with a table of its limits, grouped by model group. */
function UsageCard({ harness, name, usage }: { harness: HarnessName; name: string; usage: PlanUsage }) {
  return (
    <View pointerEvents="none" style={local.card}>
      <View style={local.provider}>
        <ProviderMark harness={harness} size={16} />
        <Text style={local.providerName}>{name}</Text>
      </View>
      <View style={local.table}>
        <View style={local.tableRow}>
          <Text style={[local.head, local.limitCell]}>Limit</Text>
          <Text style={[local.head, local.leftCell]}>Left</Text>
          <Text style={[local.head, local.resetCell]}>Resets in</Text>
        </View>
        {usage.groups.map((group) => (
          <View key={group.name ?? ""}>
            {group.name !== null && <Text style={local.groupName}>{group.name}</Text>}
            {group.rows.map((row) => (
              <View key={row.name} style={[local.tableRow, local.ruled]}>
                <View style={[local.limitCell, local.limitName]}>
                  <Dot level={row.level} />
                  <Text style={local.cell}>{row.name}</Text>
                </View>
                <Text style={[local.cell, local.leftCell]}>{row.leftPercent}%</Text>
                <Text style={[local.muted, local.resetCell]}>{row.resetText}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const accessibilityTextOf = (name: string, windows: readonly PlanLimitWindow[]) =>
  `${name}: ${windows.map(planLimitTextOf).join("; ")}`;

/**
 * The plan limits each subscription's harness reports, as the rail shows them beside the reserves: each provider's
 * logo with one status dot, green until 80% used, orange from 80% and red at 100%, taken from its tightest limit.
 * Hovering or focusing a provider (a tap on a phone) opens a card with a table of its limits grouped by model group:
 * the share left and the time to each reset, or "not started" for a limit nobody has used. An account whose harness
 * reports none shows nothing here (its Charter row says "Limits not reported"), and nothing is shown before a
 * reading arrives.
 */
export function PlanUsageDots({ client }: { client: ServiceClient }) {
  const { data: budgets } = useServiceQuery(client, { _tag: "ReadAccountBudgets" }, "plan-limits");
  const [shown, setShown] = useState<string | null>(null);
  const reported =
    budgets?.filter((budget) => budget.planLimits !== null && budget.planLimits.windows.length > 0) ?? [];
  if (reported.length === 0) return null;
  const now = Date.now();
  const detailed = reported.find((budget) => `${budget.harness}:${budget.accountId ?? ""}` === shown);
  return (
    <View style={local.group}>
      {detailed !== undefined && (
        <UsageCard
          harness={detailed.harness}
          name={detailed.accountId === null ? detailed.harness : detailed.label}
          usage={planUsageOf(detailed.planLimits?.windows ?? [], now)}
        />
      )}
      <View style={local.row}>
        {reported.map((budget) => {
          const key = `${budget.harness}:${budget.accountId ?? ""}`;
          const name = budget.accountId === null ? budget.harness : budget.label;
          const windows = budget.planLimits?.windows ?? [];
          return (
            <Pressable
              accessibilityLabel={accessibilityTextOf(name, windows)}
              accessibilityRole="image"
              key={key}
              onBlur={() => setShown(null)}
              onFocus={() => setShown(key)}
              onHoverIn={() => setShown(key)}
              onHoverOut={() => setShown(null)}
              // A finger cannot hover: a tap opens the card and a second tap closes it.
              onPress={() => setShown(shown === key ? null : key)}
              style={[local.entry, shown === key && local.entryLifted]}
            >
              <ProviderMark harness={budget.harness} size={logoSize} />
              <Dot level={planUsageOf(windows, now).level} style={local.badge} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  badge: {
    borderColor: colors.ground,
    borderWidth: 2,
    bottom: 2,
    height: 12,
    position: "absolute",
    right: 2,
    width: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.edge,
    borderRadius: radii.lg,
    borderWidth: 1,
    bottom: "100%",
    elevation: 8,
    gap: 8,
    left: 0,
    marginBottom: 6,
    padding: 12,
    position: "absolute",
    right: 0,
    shadowColor: colors.shadow,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    zIndex: 10,
  },
  cell: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  entry: { alignItems: "center", borderRadius: radii.pill, height: 40, justifyContent: "center", width: 40 },
  entryLifted: { backgroundColor: colors.controlHover },
  group: { paddingTop: 6 },
  groupName: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    paddingTop: 6,
  },
  head: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  leftCell: { minWidth: 40, textAlign: "right" },
  limitCell: { flex: 1 },
  limitName: { alignItems: "center", flexDirection: "row", gap: 6 },
  muted: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  provider: { alignItems: "center", flexDirection: "row", gap: 8 },
  providerName: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  resetCell: { minWidth: 72, textAlign: "right" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 7 },
  ruled: { borderColor: colors.edge, borderTopWidth: 1 },
  table: { gap: 0 },
  tableRow: { alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 4 },
});
