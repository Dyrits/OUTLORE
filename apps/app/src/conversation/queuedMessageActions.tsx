import type { Message, MessageId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { InterruptIcon, SteerIcon } from "../ui/composerIcons";

export function QueuedMessageActions({
  client,
  isInTurn,
  message,
  onInterrupt,
  onSteer,
}: {
  client: ServiceClient;
  isInTurn: boolean;
  message: Message;
  onInterrupt: () => Promise<unknown>;
  onSteer: (messageId: MessageId) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const act = async (request: Promise<unknown>) => {
    setIsSaving(true);
    setError(null);
    try {
      await request;
      setDraft(null);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {draft !== null && (
        <TextInput
          accessibilityLabel="Queued message text"
          autoFocus
          editable={!isSaving}
          multiline
          onChangeText={(text) => {
            setDraft(text);
            setError(null);
          }}
          style={styles.input}
          value={draft}
        />
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {draft === null ? (
          <>
            {isInTurn && (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => void act(onSteer(message.id))}
                  style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
                >
                  <SteerIcon tint={colors.accentText} />
                  <Text style={styles.link}>Steer</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => void act(onInterrupt())}
                  style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
                >
                  <InterruptIcon tint={colors.accentText} />
                  <Text style={styles.link}>Interrupt</Text>
                </Pressable>
              </>
            )}
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => setDraft(message.text)}>
              <Text style={styles.link}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void act(client.request({ _tag: "RemoveQueuedMessage", messageId: message.id }))}
            >
              <Text style={styles.link}>Remove</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() =>
                void act(client.request({ _tag: "EditQueuedMessage", messageId: message.id, text: draft }))
              }
            >
              <Text style={styles.link}>Save changes</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => {
                setDraft(null);
                setError(null);
              }}
            >
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </>
        )}
      </View>
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
