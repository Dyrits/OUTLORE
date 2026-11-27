import type { AttachmentId, Message, Skill } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { Composer } from "../ui/controls";
import type { FrameMessage } from "./entries";

/**
 * One framed Companion exchange: the opening message, its follow-ups and answers, a compact inline follow-up composer
 * with `@`-mention support, and an opt-in control to share the frame as passive context for the main Companion's next
 * turn (CHG-0787).
 */
export function ExchangeFrame({
  client,
  frameMessages,
  opening,
  openingMessage,
  renderItem,
  skills,
  workspacePath,
}: {
  client: ServiceClient;
  frameMessages: ReadonlyArray<FrameMessage>;
  opening: ReactNode;
  openingMessage: Message;
  renderItem: (item: FrameMessage) => ReactNode;
  skills: ReadonlyArray<Skill>;
  workspacePath: string | null;
}) {
  const [isReplying, setReplying] = useState(false);
  const [isSharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAnswer = frameMessages.some((item) => item.message.sender === "agent");
  const contextState = openingMessage.companionFrameContext ?? "None";

  const sendFollowUp = async (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => {
    setError(null);
    await client.request({
      _tag: "SendMessage",
      attachmentIds,
      delivery: null,
      frameMessageId: openingMessage.id,
      requestId: newRequestId(),
      text,
      threadId: openingMessage.threadId,
    });
    setReplying(false);
  };

  const shareContext = () => {
    if (isSharing) return;
    setSharing(true);
    setError(null);
    void client
      .request({
        _tag: "ShareCompanionFrame",
        frameMessageId: openingMessage.id,
        threadId: openingMessage.threadId,
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not add to context."))
      .finally(() => setSharing(false));
  };

  return (
    <View style={styles.exchangeFrame}>
      {opening}
      {frameMessages.map(renderItem)}
      <View style={local.footer}>
        <View style={local.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSharing}
            onPress={() => {
              setReplying((isCurrentlyReplying) => !isCurrentlyReplying);
              setError(null);
            }}
            style={local.actionButton}
          >
            <Text style={styles.link}>{isReplying ? "Cancel" : "Follow up"}</Text>
          </Pressable>
          {hasAnswer && contextState === "None" && (
            <Pressable
              accessibilityRole="button"
              disabled={isSharing}
              onPress={shareContext}
              style={local.actionButton}
            >
              <Text style={styles.link}>Add to context</Text>
            </Pressable>
          )}
          {hasAnswer && contextState === "Shared" && <Text style={styles.muted}>In context</Text>}
          {hasAnswer && contextState === "Outdated" && (
            <>
              <Text style={styles.muted}>In context</Text>
              <Pressable
                accessibilityRole="button"
                disabled={isSharing}
                onPress={shareContext}
                style={local.actionButton}
              >
                <Text style={styles.link}>Update context</Text>
              </Pressable>
            </>
          )}
        </View>
        {isReplying && (
          <View style={local.composer}>
            <Composer
              mentions={{ canAskCompanions: true, client, workspacePath }}
              onSend={sendFollowUp}
              placeholder="Follow up with this Companion… (@ to add another)"
              skills={skills}
            />
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
  composer: { marginTop: 6 },
  footer: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 4, paddingTop: 6 },
});
