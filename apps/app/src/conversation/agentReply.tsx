import type { HarnessName, Message, MessageId, ReplyUsage } from "@outlore/contracts";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { replyUsageTextOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { ProviderMark } from "../ui/providerMarks";
import { Commentable } from "./commentable";
import { type CommandRunner, Markdown } from "./markdown";
import { MessageActions } from "./messageActions";

/** A reply or notice title cut for a one-line label. */
export const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

/**
 * A reply from the thread's agent: a parchment card, with the provider's mark in a notch on its top edge, that names
 * the model and its time.
 * A draft has no time yet and is drawn faded.
 */
export function AgentReply({
  harness,
  isDraft = false,
  label,
  messageId = null,
  onRunCommand = null,
  replies = null,
  replyToText,
  text,
  time,
  usage = null,
}: {
  harness: HarnessName;
  isDraft?: boolean;
  label: string;
  /** The message this reply is, which the owner can comment on; null for a draft, which is not a message yet. */
  messageId?: MessageId | null;
  /** Runs a fenced shell command in the conversation's inline terminal, or null when unavailable. */
  onRunCommand?: CommandRunner | null;
  replies?: ReactNode;
  replyToText?: string;
  text: string;
  time: string | null;
  /** What the model call behind the reply used, with its cost, shown small under it; null shows nothing. */
  usage?: ReplyUsage | null;
}) {
  return (
    <View
      style={[
        replies !== null ? styles.messageGroup : styles.messageRow,
        replies !== null ? styles.messageGroupAgent : styles.messageRowAgent,
        isDraft && styles.draft,
      ]}
    >
      <CommentableCard about="agent" messageId={messageId} text={text}>
        <View style={[styles.messageCard, styles.messageCardAgent, styles.messageCardNotched]}>
          <View style={styles.medallion}>
            <ProviderMark harness={harness} size={20} />
          </View>
          <View style={styles.senderHeader}>
            <Text style={styles.senderName}>{label}</Text>
            {time !== null && <Text style={styles.senderTime}>{time}</Text>}
          </View>
          {replyToText ? <Text style={styles.muted}>Replying to: {shortened(replyToText)}</Text> : null}
          <Markdown onRunCommand={isDraft ? null : onRunCommand} text={text} />
          {(usage !== null || !isDraft) && (
            <View style={styles.replyFooter}>
              {usage !== null && <Text style={styles.muted}>{replyUsageTextOf(usage)}</Text>}
              {!isDraft && <MessageActions copyLabel="Copy reply" messageId={messageId} text={text} />}
            </View>
          )}
        </View>
      </CommentableCard>
      {replies}
    </View>
  );
}

/** A message's card with the means to comment on it; a card with no message behind it is drawn as it is. */
export function CommentableCard({
  about,
  children,
  messageId,
  text,
}: {
  about: Message["sender"];
  children: ReactNode;
  messageId: MessageId | null;
  text: string;
}) {
  return messageId === null ? (
    children
  ) : (
    <Commentable about={about} messageId={messageId} text={text}>
      {children}
    </Commentable>
  );
}

/** While a thread works: its provider's mark and the step it is on, in place of lines of updates. */
export function WorkingIndicator({ harness, label }: { harness: HarnessName; label: string }) {
  return (
    <View style={styles.stepsHeader}>
      <ProviderMark harness={harness} />
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}
