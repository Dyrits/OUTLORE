import type { HarnessName, PlanLimitWindow } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { ServiceClient } from "../foundation/client";
import { meterLevelOf, planLimitTextOf } from "../foundation/labels";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ProviderMark } from "../ui/providerMarks";
import { currentWindowsOf, leftPercentOf, type Ring, resetsInTextOf, ringStackOf } from "./planRings";

const size = 44;
const stroke = 4;
const gap = 2;
/** A plan with three windows, such as OpenCode Go's, draws thinner rings so its logo keeps room. */
const thinStroke = 3;
const thinGap = 1;

const levelColors = { normal: colors.success, reached: colors.danger, warning: colors.warning } as const;

/** One plan's windows as concentric rings around its provider's logo; the filled arc, the share left, starts at the top and runs clockwise. */
function PlanRings({
  harness,
  logoSize,
  rings,
  stroke,
}: {
  harness: HarnessName;
  logoSize: number;
  rings: readonly Ring[];
  stroke: number;
}) {
  return (
    <View style={local.ringBox}>
      <Svg height={size} style={local.ringSvg} viewBox={`0 0 ${size} ${size}`} width={size}>
        {rings.map((ring) => (
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            key={`track:${ring.window.label}`}
            r={ring.radius}
            stroke={colors.edge}
            strokeOpacity={0.6}
            strokeWidth={stroke}
          />
        ))}
        {rings.map((ring) => (
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            key={`fill:${ring.window.label}`}
            r={ring.radius}
            stroke={levelColors[ring.level]}
            strokeDasharray={`${ring.filled} ${ring.circumference}`}
            strokeLinecap="round"
            strokeWidth={stroke}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </Svg>
      <ProviderMark harness={harness} size={logoSize} />
    </View>
  );
}

/** One window in the hover card: its name, what is left and when it starts over, and a bar of what is left. */
function WindowBar({ now, window }: { now: number; window: PlanLimitWindow }) {
  const level = meterLevelOf(window.usedPercent, 100);
  return (
    <View style={local.window}>
      <View style={local.windowText}>
        <Text style={local.windowName}>{window.label}</Text>
        <Text style={local.windowLeft}>{leftPercentOf(window)}% left</Text>
        <Text style={local.windowReset}>{resetsInTextOf(window.resetsAt - now)}</Text>
      </View>
      <View style={local.track}>
        <View style={[local.bar, { backgroundColor: levelColors[level], width: `${leftPercentOf(window)}%` }]} />
      </View>
    </View>
  );
}

/** What hovering or focusing a provider's rings opens: a card above them with the provider and each window spelled out. */
function UsageCard({
  harness,
  isBelow,
  name,
  windows,
}: {
  harness: HarnessName;
  isBelow: boolean;
  name: string;
  windows: readonly PlanLimitWindow[];
}) {
  const now = Date.now();
  return (
    <View pointerEvents="none" style={[local.card, isBelow && local.cardBelow]}>
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

/**
 * A tab on the window's left border that unfolds the plan limits to its right, over whatever stands there, whether the
 * sidebar is shown or not. It folds back on a second press. Nothing shows while no plan reports a limit.
 */
export function UsageEdge({ client }: { client: ServiceClient }) {
  const { data: budgets } = useServiceQuery(client, { _tag: "ReadAccountBudgets" }, "plan-limits");
  const [isOpen, setIsOpen] = useState(false);
  if (!budgets?.some((budget) => budget.planLimits !== null && budget.planLimits.windows.length > 0)) return null;
  return (
    <View pointerEvents="box-none" style={local.edge}>
      <Pressable
        accessibilityLabel={`${isOpen ? "Fold" : "Unfold"} plan limits`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(!isOpen)}
        style={[local.edgeTab, isOpen && local.edgeTabOpen]}
      >
        <Svg fill="none" height={14} stroke={colors.textMuted} strokeWidth={2.2} viewBox="0 0 24 24" width={14}>
          <Circle cx={12} cy={12} r={8} />
          <Circle cx={12} cy={12} r={2.5} />
        </Svg>
      </Pressable>
      {isOpen && (
        <View style={local.edgeStrip}>
          <PlanLimitRings client={client} isCardBelow />
        </View>
      )}
    </View>
  );
}

/**
 * The plan limits each subscription's harness reports, as the rail shows them beside the reserves: one ring per
 * window around the provider's logo, the rings of the different providers side by side in a row, green until 80%, orange
 * from 80% and red at 100%. Hovering or focusing a provider lifts its rings and opens a card with each window's share
 * left and time to its reset. An account whose harness reports none shows nothing here (its Charter row says
 * "Limits not reported"), and nothing is shown before a reading arrives.
 */
export function PlanLimitRings({ client, isCardBelow = false }: { client: ServiceClient; isCardBelow?: boolean }) {
  const { data: budgets } = useServiceQuery(client, { _tag: "ReadAccountBudgets" }, "plan-limits");
  const [shown, setShown] = useState<string | null>(null);
  const reported =
    budgets?.filter((budget) => budget.planLimits !== null && budget.planLimits.windows.length > 0) ?? [];
  if (reported.length === 0) return null;
  const detailed = reported.find((budget) => `${budget.harness}:${budget.accountId ?? ""}` === shown);
  return (
    <View style={local.group}>
      {detailed !== undefined && (
        <UsageCard
          harness={detailed.harness}
          isBelow={isCardBelow}
          name={detailed.accountId === null ? detailed.harness : detailed.label}
          windows={currentWindowsOf(detailed.planLimits?.windows ?? [], Date.now())}
        />
      )}
      <View style={local.row}>
        {reported.map((budget) => {
          const key = `${budget.harness}:${budget.accountId ?? ""}`;
          const name = budget.accountId === null ? budget.harness : budget.label;
          const windows = currentWindowsOf(budget.planLimits?.windows ?? [], Date.now());
          const isThin = windows.length > 2;
          const ringStroke = isThin ? thinStroke : stroke;
          const { logoSize, rings } = ringStackOf(windows, size, ringStroke, isThin ? thinGap : gap);
          return (
            <Pressable
              accessibilityLabel={`${name}: ${windows.map(planLimitTextOf).join("; ")}`}
              accessibilityRole="image"
              key={key}
              onBlur={() => setShown(null)}
              onFocus={() => setShown(key)}
              onHoverIn={() => setShown(key)}
              onHoverOut={() => setShown(null)}
              style={[local.circle, shown === key && local.circleLifted]}
            >
              <PlanRings harness={budget.harness} logoSize={logoSize} rings={rings} stroke={ringStroke} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
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
  // Under rings at the top of the window, the card opens downward.
  cardBelow: { bottom: "auto", marginBottom: 0, marginTop: 6, top: "100%" },
  circle: { borderRadius: radii.pill, padding: 3 },
  circleLifted: { backgroundColor: colors.controlHover, transform: [{ scale: 1.08 }] },
  edge: { alignItems: "center", flexDirection: "row", left: 0, position: "absolute", top: "22%", zIndex: 9 },
  edgeStrip: {
    backgroundColor: colors.surface,
    borderBottomRightRadius: radii.lg,
    borderColor: colors.edge,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    marginLeft: -1,
    padding: 6,
    shadowColor: colors.shadow,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  edgeTab: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderBottomRightRadius: radii.md,
    borderColor: colors.edge,
    borderTopRightRadius: radii.md,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    paddingRight: 1,
    width: 16,
  },
  edgeTabOpen: { backgroundColor: colors.ground },
  group: { paddingTop: 6 },
  provider: { alignItems: "center", flexDirection: "row", gap: 8 },
  providerName: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  ringBox: { alignItems: "center", height: size, justifyContent: "center", width: size },
  ringSvg: { position: "absolute" },
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
