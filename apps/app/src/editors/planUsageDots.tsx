import type { HarnessName, PlanLimitWindow } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { meterLevelOf, planLimitTextOf } from "../foundation/labels";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ProviderMark } from "../ui/providerMarks";
import {
  currentWindowsOf,
  type DotLevel,
  leftPercentOf,
  planUsageOf,
  type RowLevel,
  resetsInTextOf,
} from "./planUsage";

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

/** One window in the hover card: its name, what is left and when it starts over, and a bar of what is left. */
function WindowBar({ now, window }: { now: number; window: PlanLimitWindow }) {
  const level = meterLevelOf(window.usedPercent, 100);
  const resetText = window.resetsAt <= 0 ? "not started" : resetsInTextOf(window.resetsAt - now);
  return (
    <View style={local.window}>
      <View style={local.windowText}>
        <Text style={local.windowName}>{window.label}</Text>
        <Text style={local.windowLeft}>{leftPercentOf(window)}% left</Text>
        <Text style={local.windowReset}>{resetText}</Text>
      </View>
      <View style={local.track}>
        <View style={[local.bar, { backgroundColor: dotColors[level], width: `${leftPercentOf(window)}%` }]} />
      </View>
    </View>
  );
}

/** What hovering or focusing a provider opens: a card above the rail with each window spelled out, as a bar of what is left. */
function UsageCard({
  harness,
  name,
  windows,
}: {
  harness: HarnessName;
  name: string;
  windows: readonly PlanLimitWindow[];
}) {
  const now = Date.now();
  return (
    <View pointerEvents="none" style={local.card}>
      <View style={local.provider}>
        <ProviderMark harness={harness} size={16} />
        <Text style={local.providerName}>{name}</Text>
      </View>
      {windows.map((window) => (
        <WindowBar key={window.label} now={now} window={window} />
      ))}
    </View>
  );
}

const accessibilityTextOf = (name: string, windows: readonly PlanLimitWindow[]) =>
  `${name}: ${windows.map(planLimitTextOf).join("; ")}`;

/**
 * The plan limits each subscription's harness reports, as the rail shows them beside the reserves: each provider's
 * logo with one status dot, green until 80% used, orange from 80% and red at 100%, taken from its tightest limit.
 * Hovering or focusing a provider (a tap on a phone) opens a card with each window's share left as a bar and the time
 * to its reset, or "not started" for a limit nobody has used. An account whose harness reports none shows nothing
 * here (its Charter row says "Limits not reported"), and nothing is shown before a reading arrives.
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
          windows={currentWindowsOf(detailed.planLimits?.windows ?? [], now)}
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
  bar: { borderRadius: radii.pill, height: "100%" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.edge,
    borderRadius: radii.lg,
    borderWidth: 1,
    bottom: "100%",
    elevation: 8,
    gap: 10,
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
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  entry: { alignItems: "center", borderRadius: radii.pill, height: 40, justifyContent: "center", width: 40 },
  entryLifted: { backgroundColor: colors.controlHover },
  group: { paddingTop: 6 },
  provider: { alignItems: "center", flexDirection: "row", gap: 8 },
  providerName: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 7 },
  track: { backgroundColor: colors.ground, borderRadius: radii.pill, height: 6, overflow: "hidden" },
  window: { gap: 5 },
  windowLeft: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    textAlign: "right",
  },
  windowName: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  windowReset: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    minWidth: 44,
    textAlign: "right",
  },
  windowText: { alignItems: "baseline", flexDirection: "row", gap: 8 },
});
