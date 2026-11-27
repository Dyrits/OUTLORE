import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { type MessageMatch, matchingMessages, nextMatchOf } from "./conversationSearch";
import type { Entry } from "./entries";
import { SideChatsMenu } from "./sideChatsMenu";

/** Finds and reveals matching messages without filtering the conversation feed. */
export function ConversationSearchBar({
  entries,
  onSelect,
  selectedKey,
}: {
  entries: ReadonlyArray<Entry>;
  onSelect: (match: MessageMatch | null) => void;
  selectedKey: string | null;
}) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = matchingMessages(entries, query);
  const selected = matches.findIndex(({ key }) => key === selectedKey);
  const toggle = () => {
    setOpen(!isOpen);
    setQuery("");
    onSelect(null);
  };
  const change = (text: string) => {
    setQuery(text);
    onSelect(matchingMessages(entries, text)[0] ?? null);
  };
  const move = (direction: -1 | 1) => onSelect(nextMatchOf(matches, selected, direction));
  const status =
    matches.length === 0
      ? "No matches"
      : selected < 0
        ? `${matches.length} matches`
        : `${selected + 1} of ${matches.length}`;

  return (
    <View style={local.bar}>
      {isOpen && (
        <>
          <TextInput
            accessibilityLabel="Find in conversation"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onChangeText={change}
            placeholder="Find in conversation"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, local.input]}
            value={query}
          />
          {query.trim() !== "" && (
            <Text accessibilityLiveRegion="polite" role="status" style={styles.muted}>
              {status}
            </Text>
          )}
          <SearchButton glyph="↑" isDisabled={matches.length === 0} label="Previous match" onPress={() => move(-1)} />
          <SearchButton glyph="↓" isDisabled={matches.length === 0} label="Next match" onPress={() => move(1)} />
        </>
      )}
      <SideChatsMenu entries={entries} onSelect={onSelect} selectedKey={selectedKey} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={toggle}
        style={local.button}
      >
        <Text style={styles.link}>{isOpen ? "Close find" : "Find"}</Text>
      </Pressable>
    </View>
  );
}

function SearchButton({
  glyph,
  isDisabled,
  label,
  onPress,
}: {
  glyph: string;
  isDisabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={local.button}
    >
      <Text style={isDisabled ? styles.muted : styles.link}>{glyph}</Text>
    </Pressable>
  );
}

const local = StyleSheet.create({
  bar: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" },
  button: { alignItems: "center", justifyContent: "center", minHeight: 32, minWidth: 32, paddingHorizontal: 5 },
  input: { flex: 1, minWidth: 128 },
});
