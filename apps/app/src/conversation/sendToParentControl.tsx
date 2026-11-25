import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { ChipIcon, type ChipKind } from "../ui/chips";

/** Slack-like "Also send to <parent>" checkbox with a message-only vs. full-context toggle. */
export function SendToParentControl({
  includeFullContext,
  isChecked,
  onToggleChecked,
  onToggleFullContext,
  parentKind,
  parentLabel,
}: {
  includeFullContext: boolean;
  isChecked: boolean;
  onToggleChecked: () => void;
  onToggleFullContext: (includeFullContext: boolean) => void;
  /** What the target is: a realm for a quest, shown with the hash that names it, or the quest an errand sits in. */
  parentKind: Extract<ChipKind, "quest" | "realm">;
  parentLabel: string;
}) {
  return (
    <View style={local.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked }}
        onPress={onToggleChecked}
        style={local.checkboxRow}
      >
        <View style={[local.box, isChecked && local.boxChecked]}>
          {isChecked && <Text style={local.check}>✓</Text>}
        </View>
        <Text numberOfLines={1} style={local.label}>
          Also send to
        </Text>
        <ChipIcon color={colors.textMuted} kind={parentKind} size={12} />
        <Text numberOfLines={1} style={local.label}>
          {parentLabel}
        </Text>
      </Pressable>
      {isChecked && (
        <View style={local.scopeGroup}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: !includeFullContext }}
            onPress={() => onToggleFullContext(false)}
            style={[local.scopePill, !includeFullContext && local.scopePillActive]}
          >
            <Text style={[local.scopeText, !includeFullContext && local.scopeTextActive]}>This message</Text>
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: includeFullContext }}
            onPress={() => onToggleFullContext(true)}
            style={[local.scopePill, includeFullContext && local.scopePillActive]}
          >
            <Text style={[local.scopeText, includeFullContext && local.scopeTextActive]}>Full context</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  box: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 15,
    justifyContent: "center",
    width: 15,
  },
  boxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  check: {
    color: colors.canvas,
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  checkboxRow: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 6,
  },
  label: {
    color: colors.textMuted,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  scopeGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  scopePill: {
    borderColor: colors.edge,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  scopePillActive: {
    backgroundColor: colors.controlActive,
    borderColor: colors.accent,
  },
  scopeText: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.xs,
  },
  scopeTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
});
