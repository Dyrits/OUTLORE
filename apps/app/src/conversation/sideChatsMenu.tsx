import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, radii } from "../foundation/theme";
import type { MessageMatch } from "./conversationSearch";
import type { Entry } from "./entries";
import { sideChatsOf } from "./sideChats";

/** Conditional jump menu in the conversation bar listing framed Companion side conversations (CHG-0787). */
export function SideChatsMenu({
  entries,
  onSelect,
  selectedKey,
}: {
  entries: ReadonlyArray<Entry>;
  onSelect: (match: MessageMatch | null) => void;
  selectedKey: string | null;
}) {
  const [isOpen, setOpen] = useState(false);
  const items = sideChatsOf(entries);
  if (items.length === 0) return null;
  const label = items.length === 1 ? "1 side chat" : `${items.length} side chats`;
  return (
    <View style={local.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setOpen((isCurrentlyOpen) => !isCurrentlyOpen)}
        style={local.trigger}
      >
        <Text style={styles.link}>{isOpen ? `Close (${label})` : label}</Text>
      </Pressable>
      {isOpen && (
        <View style={local.list}>
          {items.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.key}
              onPress={() => {
                onSelect({ index: item.index, key: item.key });
                setOpen(false);
              }}
              style={[local.row, item.key === selectedKey && local.rowSelected]}
            >
              <Text numberOfLines={1} style={local.preview}>
                {item.preview}
              </Text>
              <Text numberOfLines={1} style={styles.muted}>
                {item.models.join(", ")} · {item.count === 1 ? "1 reply" : `${item.count} replies`}
                {item.contextState === "Shared"
                  ? " · In context"
                  : item.contextState === "Outdated"
                    ? " · Context outdated"
                    : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  list: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 2,
    marginTop: 4,
    padding: 4,
  },
  preview: { color: colors.text, fontSize: 13 },
  row: { borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 6 },
  rowSelected: { backgroundColor: colors.controlActive },
  trigger: { alignItems: "center", justifyContent: "center", minHeight: 32, paddingHorizontal: 5 },
  wrap: { alignItems: "flex-end" },
});
