import type { AccountId, MessageId, MissionId, ThreadId } from "@outlore/contracts";
import { createContext, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Runner } from "../editors/runners";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, outline, round } from "../foundation/theme";
import { Composer } from "../ui/controls";
import { excerptOf } from "./comments";

// Reply and the errand anchor (conversation panes): a message of a main conversation can be replied to, which starts a
// quest in the Chronicle or an errand beneath a quest. An errand's own conversation offers no Reply.

/** How a conversation's messages are replied to: which message, and its text for the quote. */
export type RepliesApi = { readonly start: (message: { id: MessageId; text: string }) => void };

/** Offered where a Reply starts something — the Chronicle and a quest's own conversation; absent in an errand's pane. */
const RepliesContext = createContext<RepliesApi | null>(null);
export const RepliesProvider = RepliesContext.Provider;
export const useReplies = () => useContext(RepliesContext);

/** What a thread runs on, as the Reply composer starts from: what the replied-to conversation runs on itself. */
export const replyRunnerOf = (thread: {
  accountId: AccountId | null;
  effort: Runner["effort"];
  harness: Runner["harness"];
  model: Runner["model"];
}): Runner => ({
  accountId: thread.accountId,
  effort: thread.effort,
  harness: thread.harness,
  model: thread.model,
});

/**
 * The composer a Reply opens: a quote of the message replied to, the Companion the work starts on, and the first
 * message that opens it. Sending asks the service, which starts a quest in the Chronicle or an errand beneath a quest,
 * or answers with the thread a Reply there had already started, and hands it to `onStarted`, which opens its pane.
 */
export function ReplyForm({
  client,
  message,
  onCancel,
  onStarted,
  placeholder,
  realmPath = null,
  runner,
}: {
  client: ServiceClient;
  /** The message replied to: which one it is, and its text for the quote. */
  message: { id: MessageId; text: string };
  onCancel: () => void;
  onStarted: (started: { missionId: MissionId; threadId: ThreadId }) => void;
  /** What the first message of the reply opens: "The quest's first message…" or "The errand's first message…". */
  placeholder: string;
  /** The realm a quest starts in, from the Chronicle's realm menu; an errand follows its quest without one. */
  realmPath?: string | null;
  runner: Runner;
}) {
  const send = async (text: string) => {
    const started = await client.request({
      _tag: "ReplyToMessage",
      accountId: runner.accountId,
      effort: runner.effort,
      harness: runner.harness,
      messageId: message.id,
      model: runner.model,
      ...(realmPath === null ? {} : { realmPath }),
      requestId: newRequestId(),
      text,
    });
    onStarted(started);
  };
  return (
    <View style={local.form}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={[styles.label, styles.flex]}>
          Reply to “{excerptOf(message.text)}”
        </Text>
        <Pressable accessibilityLabel="Cancel the reply" accessibilityRole="button" hitSlop={8} onPress={onCancel}>
          <Text style={styles.error}>✕</Text>
        </Pressable>
      </View>
      <Composer dictation={{ client }} onSend={send} placeholder={placeholder} />
    </View>
  );
}

const local = StyleSheet.create({
  form: { ...outline, ...round, backgroundColor: colors.surface, gap: 8, padding: 10 },
  label: { color: colors.textMuted, fontSize: fontSizes.sm, fontWeight: "600" },
});
