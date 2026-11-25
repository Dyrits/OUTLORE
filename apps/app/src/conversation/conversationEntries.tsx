import type { HarnessName, MissionId, Skill, ThreadId, ThreadRoot } from "@outlore/contracts";
import { Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { clockOf, replyWriterOf, stampOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { LoreChangeCard, LoreChangeLine } from "../lore/lore";
import { QuestionCard, QuestionLine } from "../ui/questions";
import { ChoiceBubbles } from "./choiceBubbleViews";
import type { Entry } from "./entries";
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
      replies={entry.replies}
      replyToText={entry.replyToText}
      skills={skills}
      workspacePath={workspacePath}
    />
  );
}
