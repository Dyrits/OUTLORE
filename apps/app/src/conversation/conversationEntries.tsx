import type { HarnessName, Message, MissionId, Skill, ThreadId, ThreadRoot } from "@outlore/contracts";
import { Text, View } from "react-native";
import { MessageImages } from "../attachments/attachmentViews";
import type { ServiceClient } from "../foundation/client";
import { clockOf, replyWriterOf, stampOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { LoreChangeCard, LoreChangeLine } from "../lore/lore";
import { ChipText } from "../ui/chips";
import { QuestionCard, QuestionLine } from "../ui/questions";
import { ChoiceBubbles } from "./choiceBubbleViews";
import type { AnchoredReply, Entry } from "./entries";
import { ExchangeFrame } from "./exchangeFrame";
import { Markdown } from "./markdown";
import { MessageBubble, senderLabelOf } from "./messageBubble";
import { QuestReplyLine, ReplyLine } from "./replyLine";
import { StepsGroup } from "./stepsGroup";
import { SuggestionCard, SuggestionLine } from "./suggestions";

/**
 * The message the thread hangs from, as Slack's thread panel pins the message replied to: a quiet card with its sender
 * and time, then a rule that counts the replies. Read-only: it takes no Reply or comment.
 */
function ThreadRootView({
  client,
  harness,
  replyCount,
  root,
  skills,
  workspacePath,
}: {
  client: ServiceClient;
  /** The harness the thread runs on now: the writer of an agent root that records none. */
  harness: HarnessName;
  replyCount: number;
  root: ThreadRoot;
  /** The skills and workspace the owner's words are read against, to draw what they named as chips. */
  skills: ReadonlyArray<Skill>;
  workspacePath: string | null;
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
        {root.text !== "" &&
          (root.sender === "user" ? (
            <ChipText client={client} skills={skills} text={root.text} workspacePath={workspacePath} />
          ) : (
            <Markdown text={root.text} />
          ))}
        <MessageImages cards={root.attachments ?? []} client={client} />
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
    return (
      <ThreadRootView
        client={client}
        harness={harness}
        replyCount={entry.replyCount}
        root={entry.root}
        skills={skills}
        workspacePath={workspacePath}
      />
    );
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
  const bubble = (
    message: Message,
    parts: { fromQuest: MissionId | null; key?: string; replies?: ReadonlyArray<AnchoredReply>; replyToText?: string },
  ) => (
    <MessageBubble
      client={client}
      fromQuest={parts.fromQuest}
      harness={harness}
      key={parts.key}
      message={message}
      onOpenMission={onOpenMission}
      onSelectThread={onSelectThread}
      replies={parts.replies}
      replyToText={parts.replyToText}
      skills={skills}
      workspacePath={workspacePath}
    />
  );
  const message = bubble(entry.message, entry);
  if (entry.frameMessages === undefined || entry.frameMessages.length === 0) return message;
  // The message, follow-ups, and Companion answers sit in one frame; answers omit the redundant "Replying to" line.
  return (
    <ExchangeFrame
      client={client}
      frameMessages={entry.frameMessages}
      opening={message}
      openingMessage={entry.message}
      renderItem={(item) => bubble(item.message, { fromQuest: null, key: item.key, replies: item.replies })}
      skills={skills}
      workspacePath={workspacePath}
    />
  );
}
