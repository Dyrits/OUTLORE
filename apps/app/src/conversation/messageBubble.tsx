import type { HarnessName, Message, MissionId, Skill, ThreadId } from "@outlore/contracts";
import { Pressable, Text, View } from "react-native";
import { MessageImages } from "../attachments/attachmentViews";
import type { ServiceClient } from "../foundation/client";
import { Emblem } from "../foundation/emblems";
import { replyWriterOf, stampOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { TerminalMessage } from "../terminal/terminalMessage";
import { terminalSnapshotOf } from "../terminal/terminalSnapshot";
import { ChipText } from "../ui/chips";
import { AgentReply, CommentableCard, shortened } from "./agentReply";
import { commentsOf } from "./comments";
import { SentComments } from "./commentViews";
import type { AnchoredReply, QuestLink } from "./entries";
import { Markdown } from "./markdown";
import { MessageActions } from "./messageActions";
import { QuestReplyLine, ReplyLine } from "./replyLine";

/** Each sender's card. */
const cardStyles = {
  agent: styles.messageCardAgent,
  system: styles.messageCardNotice,
  thread: styles.messageCardThread,
  user: styles.messageCardUser,
} satisfies Record<Message["sender"], unknown>;

/** The small button at a card's top right corner that opens the quest or Ritual the card speaks of. */
function QuestButton({
  isInline = false,
  link,
  onOpenMission,
}: {
  isInline?: boolean;
  link: Pick<QuestLink, "label" | "missionId" | "title">;
  onOpenMission: (missionId: MissionId) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${link.label}: ${link.title}`}
      accessibilityRole="button"
      onPress={() => onOpenMission(link.missionId)}
      style={({ pressed }) => [
        styles.cardCornerButton,
        isInline && styles.cardCornerButtonInline,
        pressed && styles.questButtonPressed,
      ]}
    >
      <Emblem name="sword" tint={colors.highlight} />
    </Pressable>
  );
}

/** Compact reply lines hung directly beneath their anchor message in the same aligned column. */
function AnchoredReplies({
  client,
  onOpenMission,
  onSelectThread,
  replies,
}: {
  client: ServiceClient;
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
  replies: ReadonlyArray<AnchoredReply>;
}) {
  if (replies.length === 0) return null;
  return (
    <View style={styles.anchoredReplies}>
      {replies.map((reply) =>
        reply._tag === "ThreadOpened" ? (
          <ReplyLine isCompact key={reply.key} onOpen={onSelectThread} thread={reply.thread} />
        ) : (
          <QuestReplyLine
            client={client}
            isCompact
            key={reply.key}
            label={reply.label}
            missionId={reply.missionId}
            onOpen={onOpenMission}
            title={reply.title}
          />
        ),
      )}
    </View>
  );
}

/** The label above a message: none for the owner's own, whose faint card says it waits. */
export const senderLabelOf = (message: Pick<Message, "fromTitle" | "sender"> & { isResult?: boolean }) => {
  if (message.sender === "user") return null;
  if (message.sender === "system") {
    return message.fromTitle ? `Notice from "${shortened(message.fromTitle)}"` : "Outlore";
  }
  return `${message.isResult ? "Result from" : "Reply from"} "${shortened(message.fromTitle ?? "a quest")}"`;
};

/** One message: the agent's reply with its provider's mark, or the owner's and another thread's as a card. */
export function MessageBubble({
  client,
  fromQuest,
  harness,
  message,
  onOpenMission,
  onSelectThread,
  replies,
  replyToText,
  skills,
  workspacePath,
}: {
  client: ServiceClient;
  /** The quest a report came from, which its card opens by a small button at its corner. */
  fromQuest: MissionId | null;
  harness: HarnessName;
  message: Message;
  replies?: ReadonlyArray<AnchoredReply>;
  replyToText?: string;
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
  skills: ReadonlyArray<Skill>;
  workspacePath: string | null;
}) {
  const anchored =
    replies !== undefined && replies.length > 0 ? (
      <AnchoredReplies
        client={client}
        onOpenMission={onOpenMission}
        onSelectThread={onSelectThread}
        replies={replies}
      />
    ) : null;
  // A reply keeps the provider and model that wrote it, whatever the thread runs on now (thread-handover); a
  // reply from before the harness was recorded is the thread's own.
  if (message.sender === "agent") {
    const writer = replyWriterOf(message, harness);
    return (
      <AgentReply
        harness={writer.harness}
        label={writer.label}
        messageId={message.id}
        replies={anchored}
        replyToText={replyToText}
        text={message.text}
        time={stampOf(message.sentAt)}
        usage={message.usage}
      />
    );
  }
  const sender = senderLabelOf(message);
  const isNotice = message.sender === "system";
  const questLink =
    fromQuest === null ? null : { label: "Open quest", missionId: fromQuest, title: message.fromTitle ?? "" };
  const threadLink =
    questLink === null && message.sender === "thread" && message.fromThreadId !== null ? message.fromThreadId : null;
  // The comments a message of the owner carried are drawn apart from what they typed.
  const sent = message.sender === "user" ? commentsOf(message.text) : { body: message.text, items: [] };
  const terminal = message.sender === "user" ? terminalSnapshotOf(sent.body) : null;
  return (
    <View
      style={
        anchored !== null
          ? [styles.messageGroup, message.sender === "user" && styles.messageGroupUser]
          : [styles.messageRow, message.sender === "user" && styles.messageRowUser]
      }
    >
      <CommentableCard about={message.sender} messageId={message.id} text={message.text}>
        <View
          style={[
            styles.messageCard,
            cardStyles[message.sender],
            questLink !== null && !isNotice && styles.cardWithCorner,
          ]}
        >
          {/* The owner's own messages need no label, as in a chat; a queued one says it waits. */}
          {isNotice ? (
            <View style={styles.noticeHeader}>
              <View style={[styles.senderHeader, styles.noticeMetadata]}>
                <Text style={styles.senderName}>{sender}</Text>
                <Text style={styles.senderTime}>{stampOf(message.sentAt)}</Text>
              </View>
              {questLink !== null && <QuestButton isInline link={questLink} onOpenMission={onOpenMission} />}
            </View>
          ) : (
            sender !== null &&
            (threadLink !== null ? (
              <Pressable accessibilityRole="button" onPress={() => onSelectThread(threadLink)}>
                <Text style={[styles.senderName, styles.link]}>{sender}</Text>
              </Pressable>
            ) : (
              <Text style={styles.senderName}>{sender}</Text>
            ))
          )}
          {message.sender === "user" ? (
            terminal !== null ? (
              <View style={{ gap: 10 }}>
                {terminal.before !== "" && (
                  <ChipText client={client} skills={skills} text={terminal.before} workspacePath={workspacePath} />
                )}
                <TerminalMessage cwd={terminal.cwd} output={terminal.output} />
                {terminal.after !== "" && (
                  <ChipText client={client} skills={skills} text={terminal.after} workspacePath={workspacePath} />
                )}
              </View>
            ) : sent.body === "" ? null : (
              <ChipText client={client} skills={skills} text={sent.body} workspacePath={workspacePath} />
            )
          ) : (
            <Markdown text={message.text} />
          )}
          <SentComments items={sent.items} />
          <MessageImages cards={message.attachments} client={client} />
          {message.sender === "user" && (
            <View style={styles.replyFooter}>
              <Text style={styles.senderTime}>{stampOf(message.sentAt)}</Text>
              <MessageActions copyLabel="Copy message" messageId={message.id} text={sent.body} />
            </View>
          )}
          {questLink !== null && !isNotice && <QuestButton link={questLink} onOpenMission={onOpenMission} />}
        </View>
      </CommentableCard>
      {anchored}
    </View>
  );
}
