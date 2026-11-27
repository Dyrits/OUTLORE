import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, outline, round } from "../foundation/theme";

/** An ordered scale such as effort as one bar of equal segments, the chosen one filled. */
export function EffortBar<T extends string>({
  accessibilityLabel,
  label,
  onChange,
  options,
  value,
}: {
  accessibilityLabel: string;
  label: (option: T) => string;
  onChange: (option: T) => void;
  options: ReadonlyArray<T>;
  value: T;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={local.bar}>
      {options.map((option, index) => {
        const isSelected = option === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            aria-checked={isSelected}
            key={option}
            onPress={() => onChange(option)}
            style={[local.segment, index > 0 && local.divided, isSelected && local.selected]}
          >
            <Text style={[local.text, isSelected && local.textSelected]}>{label(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  bar: { ...outline, ...round, alignSelf: "stretch", flexDirection: "row", maxWidth: 420, overflow: "hidden" },
  divided: { borderColor: colors.borderStrong, borderLeftWidth: 1.5 },
  segment: { alignItems: "center", flex: 1, minWidth: 0, paddingHorizontal: 0, paddingVertical: 7 },
  selected: { backgroundColor: colors.accent },
  text: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
  },
  // The chosen label keeps the same weight, so it takes no more width than the others in a narrow panel.
  textSelected: { color: colors.onAccent },
});
