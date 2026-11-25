import type { LoreEntry } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { timeOf } from "../foundation/formatting";
import { loreFadingLabelOf, loreOriginLabelOf, scopeNameOf } from "../foundation/loreLabels";
import { styles } from "../foundation/styles";

/** One lore entry in the panel, with Edit, Pin or Unpin, Restore when it faded, Delete, and its History. */
export function LoreEntryRow({
  client,
  loreEntry,
  onHistory,
}: {
  client: ServiceClient;
  loreEntry: LoreEntry;
  onHistory: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = loreOriginLabelOf(loreEntry.origin);
  const act = (request: Promise<unknown>, after: () => void) =>
    request.then(
      () => {
        after();
        setError(null);
      },
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.section}>
      <Text style={styles.muted}>
        {scopeNameOf(loreEntry.scopeLabel)} · saved by{" "}
        {loreEntry.savedByTitle === null ? "you" : `"${loreEntry.savedByTitle}"`} · {timeOf(loreEntry.savedAt)}
        {loreEntry.updatedAt !== loreEntry.savedAt ? ` · changed ${timeOf(loreEntry.updatedAt)}` : ""} ·{" "}
        {loreEntry.tokens} tokens
      </Text>
      <Text style={styles.muted}>{loreFadingLabelOf(loreEntry)}</Text>
      {origin !== null && <Text style={styles.muted}>{origin}</Text>}
      {draft === null ? (
        <View style={styles.row}>
          <Text style={[styles.body, styles.flex]}>{loreEntry.text}</Text>
          <Pressable onPress={() => setDraft(loreEntry.text)}>
            <Text style={styles.link}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              act(
                client.request({ _tag: "PinIntel", isPinned: !loreEntry.isPinned, loreEntryId: loreEntry.id }),
                () => {},
              )
            }
          >
            <Text style={styles.link}>{loreEntry.isPinned ? "Unpin" : "Pin"}</Text>
          </Pressable>
          {loreEntry.state !== "Active" && (
            <Pressable
              onPress={() => act(client.request({ _tag: "RestoreIntel", loreEntryId: loreEntry.id }), () => {})}
            >
              <Text style={styles.link}>Restore</Text>
            </Pressable>
          )}
          <Pressable onPress={() => act(client.request({ _tag: "DeleteIntel", loreEntryId: loreEntry.id }), () => {})}>
            <Text style={styles.link}>Delete</Text>
          </Pressable>
          <Pressable onPress={onHistory}>
            <Text style={styles.link}>History</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.inlineRow}>
          <TextInput
            accessibilityLabel="Lore text"
            multiline
            onChangeText={setDraft}
            style={[styles.input, styles.flex]}
            value={draft}
          />
          <Pressable
            onPress={() =>
              act(client.request({ _tag: "EditIntel", loreEntryId: loreEntry.id, text: draft }), () => setDraft(null))
            }
          >
            <Text style={styles.link}>Save</Text>
          </Pressable>
          <Pressable onPress={() => setDraft(null)}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
