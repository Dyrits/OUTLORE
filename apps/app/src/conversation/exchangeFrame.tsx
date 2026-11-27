import type { Message } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import type { CompanionAnswer } from "./entries";

/**
 * One framed Companion exchange: the opening message, its follow-ups and answers, a compact inline follow-up input,
 * and an opt-in control to share the frame as passive context for the main Companion's next turn (CHG-0786).
 */
export function ExchangeFrame({
  answers,
  client,
  opening,
  openingMessage,
  renderItem,
}: {
  answers: ReadonlyArray<CompanionAnswer>;
  client: ServiceClient;
  opening: ReactNode;
  openingMessage: Message;
  renderItem: (item: CompanionAnswer) => ReactNode;
}) {
  const [isReplying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAnswer = answers.some((item) => item.message.sender === "agent");
  const contextState = openingMessage.companionFrameContext ?? "None";

  const sendFollowUp = () => {
    const text = draft.trim();
    if (text === "" || isBusy) return;
    setBusy(true);
    setError(null);
    void client
      .request({
        _tag: "SendMessage",
        attachmentIds: [],
        delivery: null,
        frameMessageId: openingMessage.id,
        requestId: newRequestId(),
        text,
        threadId: openingMessage.threadId,
      })
      .then(() => {
        setDraft("");
        setReplying(false);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not send follow-up."))
      .finally(() => setBusy(false));
  };

  const shareContext = () => {
    if (isBusy) return;
    setBusy(true);
    setError(null);
    void client
      .request({
        _tag: "ShareCompanionFrame",
        frameMessageId: openingMessage.id,
        threadId: openingMessage.threadId,
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not add to context."))
      .finally(() => setBusy(false));
  };

  return (
    <View style={styles.exchangeFrame}>
      {opening}
      {answers.map(renderItem)}
      <View style={local.footer}>
        <View style={local.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => {
              setReplying((open) => !open);
              setError(null);
            }}
            style={local.actionButton}
          >
            <Text style={styles.link}>{isReplying ? "Cancel" : "Follow up"}</Text>
          </Pressable>
          {hasAnswer && contextState === "None" && (
            <Pressable accessibilityRole="button" disabled={isBusy} onPress={shareContext} style={local.actionButton}>
              <Text style={styles.link}>Add to context</Text>
            </Pressable>
          )}
          {hasAnswer && contextState === "Shared" && <Text style={styles.muted}>In context</Text>}
          {hasAnswer && contextState === "Outdated" && (
            <>
              <Text style={styles.muted}>In context</Text>
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={shareContext} style={local.actionButton}>
                <Text style={styles.link}>Update context</Text>
              </Pressable>
            </>
          )}
        </View>
        {isReplying && (
          <View style={local.composer}>
            <TextInput
              accessibilityLabel="Follow up in this frame"
              editable={!isBusy}
              multiline
              onChangeText={setDraft}
              onSubmitEditing={sendFollowUp}
              placeholder="Follow up with this Companion…"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, local.input]}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isBusy || draft.trim() === ""}
              onPress={sendFollowUp}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{isBusy ? "Sending…" : "Send"}</Text>
            </Pressable>
          </View>
        )}
        {error !== null && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  actionButton: { paddingVertical: 4 },
  actions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  composer: { alignItems: "flex-end", flexDirection: "row", gap: 8, marginTop: 6 },
  footer: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 4, paddingTop: 6 },
  input: { flex: 1, maxHeight: 120, minHeight: 36 },
});
