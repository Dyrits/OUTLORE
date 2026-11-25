import type { BudgetUse } from "@outlore/contracts";
import { Pressable, Text, View } from "react-native";
import { Emblem, type EmblemName } from "../foundation/emblems";
import { budgetUseTextOf, meterLevelOf, reserveOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fonts, radii } from "../foundation/theme";

const levelColors = { normal: colors.textMuted, reached: colors.danger, warning: colors.warning } as const;

/** One meter per set limit, orange from 80% and red at 100%; nothing when the budget is empty. */
export function BudgetMeters({ use, onPress }: { use: BudgetUse; onPress?: () => void }) {
  const meters = (["cost", "tokens"] as const).flatMap((unit) => {
    const limit = use.limits[unit];
    return limit === null ? [] : [{ limit, spent: use.spent[unit], unit }];
  });
  if (meters.length === 0) return null;
  const content = (
    <View style={{ gap: 2 }}>
      {meters.map(({ limit, spent, unit }) => {
        const color = levelColors[meterLevelOf(spent, limit)];
        return (
          <View
            accessibilityLabel={`Budget ${unit}`}
            key={unit}
            style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
          >
            <View
              style={{
                backgroundColor: colors.controlActive,
                borderRadius: 3,
                height: 6,
                overflow: "hidden",
                width: 80,
              }}
            >
              <View style={{ backgroundColor: color, height: 6, width: `${Math.min(100, (spent / limit) * 100)}%` }} />
            </View>
            <Text style={[styles.muted, { color, fontSize: 12 }]}>{budgetUseTextOf(unit, spent, limit)}</Text>
          </View>
        );
      })}
    </View>
  );
  return onPress === undefined ? content : <Pressable onPress={onPress}>{content}</Pressable>;
}

/** What each limit is called in the rail, and the color of its full bar: tokens are Mana, cost is Gold. */
const reserveKinds = {
  cost: { color: colors.warning, emblem: "gem", name: "Gold" },
  tokens: { color: colors.underway, emblem: "flask", name: "Mana" },
} as const satisfies Record<string, { color: string; emblem: EmblemName; name: string }>;

/**
 * The rail's reserves: one row per set limit, its name and what is left above a bar that drains as the budget is
 * spent, turning orange from 80% spent and red when spent. Only what Outlore counts is shown, not the harnesses' plans.
 */
export function ReserveRows({ use }: { use: BudgetUse }) {
  return (
    <View style={{ gap: 8 }}>
      {(["tokens", "cost"] as const).map((unit) => {
        const limit = use.limits[unit];
        if (limit === null) return null;
        const spent = use.spent[unit];
        const level = meterLevelOf(spent, limit);
        const color = level === "normal" ? reserveKinds[unit].color : levelColors[level];
        const { fraction, text } = reserveOf(unit, spent, limit);
        return (
          <View
            accessibilityLabel={`Reserve ${reserveKinds[unit].name}`}
            key={unit}
            style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
          >
            <Emblem name={reserveKinds[unit].emblem} size={22} tint={reserveKinds[unit].color} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.onGround, fontFamily: fonts.sans, fontSize: 16 }}>
                  {reserveKinds[unit].name}
                </Text>
                <Text style={{ color: colors.onGround, fontFamily: fonts.sans, fontSize: 15 }}>{text}</Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.ground,
                  borderColor: colors.edge,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  height: 10,
                  overflow: "hidden",
                  padding: 1,
                }}
              >
                <View
                  style={{ backgroundColor: color, borderRadius: radii.pill, flex: 1, width: `${fraction * 100}%` }}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
