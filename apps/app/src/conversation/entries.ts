import type {
  Activity,
  BudgetEvent,
  Handover,
  LoreChange,
  Message,
  MissionDetail,
  MissionId,
  Question,
  Suggestion,
  ThreadAnchor,
  ThreadId,
  ThreadRoot,
  ThreadSummary,
} from "@outlore/contracts";
import { settledSuggestionLabelOf } from "../foundation/labels";
import { isPendingOwnerMessage } from "./queuedMessages";

/** A quest or Ritual the Guildmaster opened, created, or continued, which the conversation draws as a card of its own. */
export type QuestLink = { key: string; label: string; missionId: MissionId; sentAt: number; title: string };

/** A reply line hung directly beneath its visible anchor message so both share one aligned column. */
export type AnchoredReply =
  | { _tag: "ThreadOpened"; key: string; thread: ThreadSummary }
  | ({ _tag: "QuestLink" } & QuestLink);

/** One entry of a thread's conversation, with the key the list keeps it by. */
export type Entry = { key: string; at: number } & (
  | {
      _tag: "Message";
      message: Message;
      fromQuest: MissionId | null;
      replies?: ReadonlyArray<AnchoredReply>;
      replyToText?: string;
    }
  /** The settled actions of one turn gathered under one collapsible line. */
  | { _tag: "Steps"; isCurrent: boolean; seconds: number; steps: ReadonlyArray<Step>; threadId: ThreadId }
  | { _tag: "Question"; question: Question }
  | { _tag: "LiveFooter" }
  | { _tag: "Suggestion"; suggestion: Suggestion }
  | { _tag: "BudgetEvent"; event: BudgetEvent }
  | { _tag: "Handover"; handover: Handover }
  | { _tag: "LoreChange"; change: LoreChange }
  | { _tag: "ThreadOpened"; thread: ThreadSummary }
  /** The message of the parent conversation the thread hangs from, pinned above its own messages, with the reply count. */
  | { _tag: "Root"; replyCount: number; root: ThreadRoot }
  | ({ _tag: "QuestLink" } & Omit<QuestLink, "key">)
);

/** A line sits just after the reply that answers what it belongs to. */
const afterReply = 0.5;

/** One step of a turn, separate from its chat messages: an action the thread ran or was allowed to run, or a tool call its harness reported. */
export type Step =
  | { _tag: "Action"; at: number; id: string; question: Question }
  | { _tag: "Call"; activity: Activity; at: number; id: string };

/**
 * The outcomes that settle an action with no word from the owner worth a line of its own. A choice question is never
 * one: it stays in the conversation, as the agent's bubbles with the owner's answers attached (CHG-0535).
 */
const isFoldedAction = (question: Question) =>
  question.choices === null &&
  question.outcome !== null &&
  !["Denied", "Discarded", "Withdrawn"].includes(question.outcome);

/** Settled actions grouped between incoming messages, with elapsed time from the message that began the turn. */
const stepGroupsOf = (
  messages: ReadonlyArray<Message>,
  questions: ReadonlyArray<Question>,
  activities: ReadonlyArray<Activity>,
  isWorking: boolean,
) => {
  const groups: Array<{ isCurrent: boolean; seconds: number; steps: Array<Step> }> = [];
  const actions = [
    ...questions
      .filter(isFoldedAction)
      .map((question): Step => ({ _tag: "Action", at: question.askedAt, id: question.id, question })),
    ...activities.map((activity): Step => ({ _tag: "Call", activity, at: activity.at, id: `call:${activity.id}` })),
  ].sort((current, next) => current.at - next.at);
  let before: Message | undefined;
  const close = (isTrailing: boolean, until: number) => {
    const from = before?.sentAt ?? Number.NEGATIVE_INFINITY;
    const steps = actions.filter((action) => action.at >= from && action.at < until);
    const first = steps[0];
    const last = steps.at(-1);
    if (first !== undefined && last !== undefined)
      groups.push({
        isCurrent: isWorking && isTrailing,
        seconds: Math.max(0, Math.round((last.at - (before?.sentAt ?? first.at)) / 1000)),
        steps,
      });
  };
  for (const message of [...messages].sort((current, next) => current.sequence - next.sequence)) {
    if (message.sender !== "agent") {
      close(false, message.sentAt);
      before = message;
    }
  }
  close(true, Number.POSITIVE_INFINITY);
  return groups;
};

/** A settled action does not establish what a working thread is doing now. */
export const workingLabel = "Working…";

/** The entries newest first: a feed drawn inverted starts from the bottom of the view, where the newest entry sits. */
export const newestFirstOf = (entries: ReadonlyArray<Entry>): Array<Entry> => [...entries].reverse();

/**
 * Messages, questions, off-topic suggestions, budget lines, handovers, lore changes, and the threads opened beneath, in the order they happened.
 * An aside is left out: its suggestion line already leads to it.
 * Pending owner messages are left out of the feed because they sit in the stacked tray above the composer.
 * In the Guildmaster's conversation what it opened, created, or continued, becomes a card standing just after its confirmation. A report from a quest carries its own small button.
 * What hangs from a message (its `anchors`) stands as a reply line there: an errand the owner replied into under the
 * message replied to, an agent-opened errand under its agent reply, and a quest a Reply started under the message replied to.
 */
export const entriesOf = (
  detail: MissionDetail,
  isWorking = false,
  anchors: ReadonlyArray<ThreadAnchor> = [],
): Array<Entry> => {
  // Earlier builds wrote internal system cards. A system message linked to a quest is a visible notice.
  // Pending owner messages live in the queued-message tray above the composer until a turn takes them in.
  const messages = detail.messages.filter(
    (message) => (message.sender !== "system" || message.fromMissionId != null) && !isPendingOwnerMessage(message),
  );
  const replies = messages.filter((message) => message.sender === "agent");
  /** The message an anchor names, if it is one of this conversation's. */
  const anchorCard = new Map(messages.map((message) => [message.id, message]));
  const anchorOf = new Map(anchors.map((anchor) => [anchor.threadId, anchor]));
  /** Where a thread's reply line stands: under the message replied to, in a card's place, or where it was opened. */
  const replyLineAt = (thread: ThreadSummary): number => {
    const card = anchorOf.get(thread.id);
    const message = card === undefined ? undefined : anchorCard.get(card.messageId);
    if (message === undefined) return thread.openedAt;
    return message.sender === "system" ? message.sentAt : message.sentAt + afterReply;
  };
  /** The first reply written at or after the time. */
  const replyFrom = (time: number) => replies.find((reply) => reply.sentAt >= time);
  const isSettledByGuildmaster = (suggestion: Suggestion) =>
    suggestion.isFromGuildmaster && suggestion.outcome !== null && suggestion.outcome !== "Withdrawn";
  /** Each quest the Guildmaster settled, as a card that stands just after the reply confirming it. */
  const questLinks = detail.suggestions.flatMap((suggestion): Array<Entry> => {
    if (
      !isSettledByGuildmaster(suggestion) ||
      suggestion.targetMissionId === null ||
      anchors.some((anchor) => anchor.threadId === suggestion.targetThreadId)
    )
      return [];
    const at = suggestion.resolvedAt ?? suggestion.askedAt;
    return [
      {
        _tag: "QuestLink",
        at: (replyFrom(at)?.sentAt ?? at) + afterReply,
        key: suggestion.id,
        label: settledSuggestionLabelOf(suggestion),
        missionId: suggestion.targetMissionId,
        sentAt: at,
        title: suggestion.targetTitle ?? "",
      },
    ];
  });
  const stepGroups = stepGroupsOf(messages, detail.questions, detail.activities, isWorking);
  const stepIds = new Set(stepGroups.flatMap((group) => group.steps.map((step) => step.id)));
  const { root } = detail.thread;
  // A thread's own first message is its root, pinned above, so it does not repeat among the replies.
  const visibleMessages = messages.filter((message) => message.id !== root?.id);
  const visibleMessageIds = new Set(visibleMessages.map((message) => message.id));
  const repliesByMessageId = new Map<Message["id"], Array<AnchoredReply>>();
  const attachReply = (messageId: Message["id"], reply: AnchoredReply) => {
    const existing = repliesByMessageId.get(messageId);
    if (existing === undefined) repliesByMessageId.set(messageId, [reply]);
    else existing.push(reply);
  };
  const standaloneThreads: Array<Entry> = [];
  for (const thread of detail.threads) {
    if (thread.parentId !== detail.thread.id || thread.isAside) continue;
    const anchor = anchorOf.get(thread.id);
    if (anchor !== undefined && visibleMessageIds.has(anchor.messageId)) {
      attachReply(anchor.messageId, { _tag: "ThreadOpened", key: `opened:${thread.id}`, thread });
    } else {
      standaloneThreads.push({ _tag: "ThreadOpened", at: replyLineAt(thread), key: `opened:${thread.id}`, thread });
    }
  }
  const standaloneAnchoredQuests: Array<Entry> = [];
  for (const anchor of anchors) {
    if (anchor.missionId === detail.mission.id) continue;
    const message = anchorCard.get(anchor.messageId);
    if (message === undefined) continue;
    const link = {
      _tag: "QuestLink" as const,
      key: `anchored:${anchor.threadId}`,
      label: "Opened a quest",
      missionId: anchor.missionId,
      sentAt: message.sentAt,
      title: anchor.title,
    };
    if (visibleMessageIds.has(anchor.messageId)) {
      attachReply(anchor.messageId, link);
    } else {
      standaloneAnchoredQuests.push({ ...link, at: message.sentAt + afterReply });
    }
  }
  const entries: Array<Entry> = [
    // The root stands before everything the thread did: the oldest entry, so the inverted feed draws it at the top.
    ...(root == null
      ? []
      : [
          {
            _tag: "Root",
            at: Number.NEGATIVE_INFINITY,
            key: `root:${root.id}`,
            replyCount:
              detail.threads.find((thread) => thread.id === detail.thread.id)?.replyCount ??
              messages.filter((message) => message.sender !== "system").length +
                detail.questions.filter((question) => question.source === "Thread").length,
            root,
          } satisfies Entry,
        ]),
    ...stepGroups.map(
      (group): Entry => ({
        _tag: "Steps",
        at: group.steps[0]?.at ?? 0,
        isCurrent: group.isCurrent,
        key: `steps:${group.steps[0]?.id}`,
        seconds: group.seconds,
        steps: group.steps,
        threadId: detail.thread.id,
      }),
    ),
    ...standaloneThreads,
    ...visibleMessages.map((message): Entry => {
      const messageReplies = repliesByMessageId.get(message.id);
      return {
        _tag: "Message",
        at: message.sentAt,
        fromQuest:
          (message.sender === "thread" || message.sender === "system") && message.fromMissionId !== detail.mission.id
            ? message.fromMissionId
            : null,
        key: message.id,
        message,
        ...(messageReplies === undefined ? {} : { replies: messageReplies }),
        ...(message.replyToMessageId == null
          ? {}
          : { replyToText: anchorCard.get(message.replyToMessageId)?.text ?? "" }),
      };
    }),
    // A quest a Reply started, when its anchor is not drawn as a message above.
    ...standaloneAnchoredQuests,
    ...questLinks,
    ...detail.questions
      .filter((question) => !stepIds.has(question.id))
      .map((question): Entry => ({ _tag: "Question", at: question.askedAt, key: question.id, question })),
    ...detail.suggestions
      .filter((suggestion) => !(isSettledByGuildmaster(suggestion) && suggestion.targetMissionId !== null))
      .map(
        (suggestion): Entry => ({
          _tag: "Suggestion",
          // What the Guildmaster settled with nowhere to lead shows after its confirmation; the rest where it was asked.
          at: isSettledByGuildmaster(suggestion)
            ? (replyFrom(suggestion.resolvedAt ?? suggestion.askedAt)?.sentAt ??
                suggestion.resolvedAt ??
                suggestion.askedAt) + afterReply
            : suggestion.askedAt,
          key: suggestion.id,
          suggestion,
        }),
      ),
    ...detail.budgetEvents.map((event): Entry => ({ _tag: "BudgetEvent", at: event.at, event, key: event.id })),
    ...detail.handovers.map((handover): Entry => ({ _tag: "Handover", at: handover.at, handover, key: handover.id })),
    ...detail.loreChanges.map((change): Entry => ({ _tag: "LoreChange", at: change.at, change, key: change.id })),
  ];
  entries.sort((current, next) => current.at - next.at);
  return entries;
};
