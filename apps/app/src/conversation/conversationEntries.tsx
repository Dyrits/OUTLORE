import type {
  HarnessName,
  Message,
  MessageId,
  MissionId,
  ReplyUsage,
  Skill,
  ThreadId,
  ThreadRoot,
} from "@outlore/contracts";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { MessageImages } from "../attachments/attachmentViews";
import type { ServiceClient } from "../foundation/client";
import { Emblem } from "../foundation/emblems";
import { clockOf, replyWriterOf, stampOf } from "../foundation/formatting";
import { replyUsageTextOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { LoreChangeCard, LoreChangeLine } from "../lore/lore";
import { TerminalMessage } from "../terminal/terminalMessage";
import { terminalSnapshotOf } from "../terminal/terminalSnapshot";
import { ChipText } from "../ui/chips";
import { CopyButton } from "../ui/copyButton";
import { ProviderMark } from "../ui/providerMarks";
import { QuestionCard, QuestionLine } from "../ui/questions";
import { ChoiceBubbles } from "./choiceBubbleViews";
import { Commentable } from "./commentable";
import { commentsOf } from "./comments";
import { SentComments } from "./commentViews";
import type { Entry, QuestLink } from "./entries";
import { Markdown } from "./markdown";
import { QuestReplyLine, ReplyLine } from "./replyLine";
import { StepsGroup } from "./stepsGroup";
import { SuggestionCard, SuggestionLine } from "./suggestions";

const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

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
  replyToText?: string;
  text: string;
  time: string | null;
  /** What the model call behind the reply used, with its cost, shown small under it; null shows nothing. */
  usage?: ReplyUsage | null;
}) {
  return (
    <View style={[styles.messageRow, styles.messageRowAgent, isDraft && styles.draft]}>
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
          <Markdown text={text} />
          {(usage !== null || !isDraft) && (
            <View style={styles.replyFooter}>
              {usage !== null && <Text style={styles.muted}>{replyUsageTextOf(usage)}</Text>}
              {!isDraft && <CopyButton label="Copy reply" style={styles.replyCopy} text={text} />}
            </View>
          )}
        </View>
      </CommentableCard>
    </View>
  );
}

/** A message's card with the means to comment on it; a card with no message behind it is drawn as it is. */
function CommentableCard({
  about,
  canReply = true,
  children,
  messageId,
  text,
}: {
  about: Message["sender"];
  canReply?: boolean;
  children: ReactNode;
  messageId: MessageId | null;
  text: string;
}) {
  return messageId === null ? (
    children
  ) : (
    <Commentable about={about} canReply={canReply} messageId={messageId} text={text}>
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

/** The label above a message: none for the owner's own, whose faint card says it waits. */
export const senderLabelOf = (message: Pick<Message, "fromTitle" | "sender"> & { isResult?: boolean }) => {
  if (message.sender === "user") return null;
  if (message.sender === "system") {
    return message.fromTitle ? `Notice from "${shortened(message.fromTitle)}"` : "Outlore";
  }
  return `${message.isResult ? "Result from" : "Reply from"} "${shortened(message.fromTitle ?? "a quest")}"`;
};

/** One message: the agent's reply with its provider's mark, or the owner's and another thread's as a card. */
function MessageBubble({
  client,
  fromQuest,
  harness,
  message,
  onOpenMission,
  onSelectThread,
  replyToText,
  skills,
  workspacePath,
}: {
  client: ServiceClient;
  /** The quest a report came from, which its card opens by a small button at its corner. */
  fromQuest: MissionId | null;
  harness: HarnessName;
  message: Message;
  replyToText?: string;
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
  skills: ReadonlyArray<Skill>;
  workspacePath: string | null;
}) {
  // A reply keeps the provider and model that wrote it, whatever the thread runs on now (thread-handover); a
  // reply from before the harness was recorded is the thread's own.
  if (message.sender === "agent") {
    const writer = replyWriterOf(message, harness);
    return (
      <AgentReply
        harness={writer.harness}
        label={writer.label}
        messageId={message.id}
        replyToText={replyToText}
        text={message.text}
        time={stampOf(message.sentAt)}
        usage={message.usage}
      />
    );
  }
  const sender = senderLabelOf(message);
  const isNotice = message.sender === "system";
  const isParentEcho = isNotice || message.sender === "thread";
  const questLink =
    fromQuest === null ? null : { label: "Open quest", missionId: fromQuest, title: message.fromTitle ?? "" };
  const threadLink =
    questLink === null && message.sender === "thread" && message.fromThreadId !== null ? message.fromThreadId : null;
  // The comments a message of the owner carried are drawn apart from what they typed.
  const sent = message.sender === "user" ? commentsOf(message.text) : { body: message.text, items: [] };
  const terminal = message.sender === "user" ? terminalSnapshotOf(sent.body) : null;
  return (
    <View style={[styles.messageRow, message.sender === "user" && styles.messageRowUser]}>
      <CommentableCard about={message.sender} canReply={!isParentEcho} messageId={message.id} text={message.text}>
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
          {questLink !== null && !isNotice && <QuestButton link={questLink} onOpenMission={onOpenMission} />}
        </View>
      </CommentableCard>
    </View>
  );
}

/**
 * The message the thread hangs from, as Slack's thread panel pins the message replied to: a quiet card with its sender
 * and time, then a rule that counts the replies. Read-only: it takes no Reply or comment.
 */
function ThreadRootView({
  harness,
  replyCount,
  root,
}: {
  /** The harness the thread runs on now: the writer of an agent root that records none. */
  harness: HarnessName;
  replyCount: number;
  root: ThreadRoot;
}) {
  const sender =
    root.sender === "user" ? "You" : root.sender === "agent" ? replyWriterOf(root, harness).label : senderLabelOf(root);
  return (
    <View>
      <View style={styles.threadRoot}>
        <View style={styles.senderHeader}>
          <Text style={styles.senderName}>{sender}</Text>
          <Text style={styles.senderTime}>{stampOf(root.sentAt)}</Text>
        </View>
        <Markdown text={root.text} />
      </View>
      <View style={styles.threadRootDivider}>
        <Text style={styles.muted}>{replyCount === 1 ? "1 reply" : `${replyCount} replies`}</Text>
        <View style={styles.threadRootRule} />
      </View>
    </View>
  );
}

/** One conversation entry: an open question or suggestion as a card, a settled one as a line. */
export function EntryView({
  canOpenAside = true,
  channel,
  client,
  entry,
  harness,
  onOpenMission,
  onSelectThread,
  skills,
  workspacePath,
}: {
  canOpenAside?: boolean;
  channel?: { id: import("@outlore/contracts").WorkspaceId | null; name: string } | undefined;
  client: ServiceClient;
  entry: Entry;
  /** The harness the thread runs on now: the mark of a reply that records none. */
  harness: HarnessName;
  /** The skills and workspace the owner's messages are read against, to draw what they named as chips. */
  skills: ReadonlyArray<Skill>;
  workspacePath: string | null;
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
}) {
  if (entry._tag === "LiveFooter") return null;
  if (entry._tag === "Root")
    return <ThreadRootView harness={harness} replyCount={entry.replyCount} root={entry.root} />;
  if (entry._tag === "ThreadOpened") return <ReplyLine isCompact onOpen={onSelectThread} thread={entry.thread} />;
  if (entry._tag === "Steps")
    return <StepsGroup client={client} seconds={entry.seconds} steps={entry.steps} threadId={entry.threadId} />;
  if (entry._tag === "QuestLink")
    return (
      <QuestReplyLine
        client={client}
        isCompact
        label={entry.label}
        missionId={entry.missionId}
        onOpen={onOpenMission}
        title={entry.title}
      />
    );
  if (entry._tag === "BudgetEvent")
    return (
      <View style={styles.questionLine}>
        <Text style={styles.muted}>
          {entry.event.text} · {clockOf(entry.event.at)}
        </Text>
      </View>
    );
  if (entry._tag === "Handover")
    return (
      <View style={styles.questionLine}>
        <Text style={styles.muted}>
          {entry.handover.text} · {clockOf(entry.handover.at)}
        </Text>
      </View>
    );
  if (entry._tag === "LoreChange")
    return entry.change.status === "Awaiting" ? (
      <LoreChangeCard change={entry.change} client={client} />
    ) : (
      <LoreChangeLine change={entry.change} />
    );
  if (entry._tag === "Suggestion")
    return entry.suggestion.outcome === null ? (
      <SuggestionCard canOpenAside={canOpenAside} channel={channel} client={client} suggestion={entry.suggestion} />
    ) : (
      <SuggestionLine onOpenMission={onOpenMission} onSelectThread={onSelectThread} suggestion={entry.suggestion} />
    );
  if (entry._tag === "Question")
    return entry.question.outcome === null ? (
      <QuestionCard client={client} question={entry.question} />
    ) : entry.question.choices === null ? (
      <QuestionLine question={entry.question} />
    ) : (
      <ChoiceBubbles harness={harness} question={entry.question} />
    );
  return (
    <MessageBubble
      client={client}
      fromQuest={entry.fromQuest}
      harness={harness}
      message={entry.message}
      onOpenMission={onOpenMission}
      onSelectThread={onSelectThread}
      replyToText={entry.replyToText}
      skills={skills}
      workspacePath={workspacePath}
    />
  );
}
