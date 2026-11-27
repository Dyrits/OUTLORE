import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { StateBadge } from "../ui/stateMarks";
import { barBottom } from "./phoneBar";
import type { PhoneChoice, PhoneCreation } from "./phoneChoices";
import type { Choice } from "./phoneSelection";
import { barHeight, withOpacity } from "./phoneShell";

/** The gap between the sheet and the bar beneath it. */
const sheetGap = 10;

/**
 * The floating sheet above the bar (CHG-0773) where the owner chooses a realm, a quest, or an errand; choosing lands in
 * that one's chat. A press outside the sheet closes it.
 */
export function PhoneChooser({
  choices,
  creation,
  failure,
  onChoose,
  onCreate,
  onClose,
  title,
}: {
  choices: ReadonlyArray<PhoneChoice>;
  /** The row at the head of the sheet that makes a new one. */
  creation: PhoneCreation;
  /** Why the last creation failed, shown under the title. */
  failure: string | null;
  onChoose: (choice: Choice) => void;
  onCreate: () => void;
  onClose: () => void;
  title: string;
}) {
  const { height } = useWindowDimensions();
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: false,
    }).start();
  }, [appear]);
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={local.scrim} />
      <Animated.View
        accessibilityLabel={title}
        style={[
          local.sheet,
          {
            maxHeight: height * 0.5,
            opacity: appear,
            transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          },
        ]}
      >
        <View style={local.grab} />
        <Text style={local.title}>{title}</Text>
        {failure !== null && <Text style={local.failure}>{failure}</Text>}
        <ScrollView>
          <Pressable
            accessibilityRole="button"
            onPress={onCreate}
            style={({ pressed }) => [local.row, pressed && local.rowPressed]}
          >
            <View style={local.plus}>
              <Text style={local.plusMark}>+</Text>
            </View>
            <View style={local.text}>
              <Text numberOfLines={1} style={local.name}>
                {creation.name}
              </Text>
              <Text numberOfLines={1} style={local.note}>
                {creation.note}
              </Text>
            </View>
          </Pressable>
          {choices.length === 0 && <Text style={local.empty}>Nothing here yet.</Text>}
          {choices.map((entry) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: entry.isSelected }}
              key={entry.key}
              onPress={() => onChoose(entry.choice)}
              style={({ pressed }) => [local.row, entry.isSelected && local.rowSelected, pressed && local.rowPressed]}
            >
              <View style={local.text}>
                <Text numberOfLines={1} style={local.name}>
                  {entry.name}
                </Text>
                <Text numberOfLines={1} style={local.note}>
                  {entry.note}
                </Text>
              </View>
              {entry.state !== null && <StateBadge state={entry.state} />}
              {entry.isSelected && <Text style={local.tick}>✓</Text>}
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const local = StyleSheet.create({
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, padding: 12 },
  failure: {
    color: colors.dangerText,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  grab: {
    alignSelf: "center",
    backgroundColor: colors.borderStrong,
    borderRadius: 3,
    height: 5,
    marginBottom: 10,
    width: 38,
  },
  name: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  plus: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  plusMark: { color: colors.accentText, fontSize: fontSizes.base, fontWeight: "700", lineHeight: 20 },
  row: { alignItems: "center", borderRadius: radii.xl, flexDirection: "row", gap: 10, marginBottom: 6, padding: 12 },
  rowPressed: { backgroundColor: colors.controlHover },
  rowSelected: { backgroundColor: colors.accentSoft },
  scrim: { backgroundColor: withOpacity("#0f121a", 0.2), bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  sheet: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: 24,
    borderWidth: 1,
    bottom: barBottom + barHeight + sheetGap,
    elevation: 10,
    left: 12,
    padding: 12,
    position: "absolute",
    right: 12,
    shadowColor: colors.shadow,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  text: { flex: 1 },
  tick: { color: colors.accentText, fontSize: fontSizes.base, fontWeight: "700" },
  title: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    fontWeight: "600",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
});
