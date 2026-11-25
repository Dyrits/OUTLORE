import { Schema } from "effect";
import { ModelChoice } from "./companions.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId, MessageId, MissionId, ThreadId } from "./ids.ts";
import { RequestId } from "./records.ts";
import { OwnerMessageText } from "./texts.ts";

// Where a quest or an errand hangs from (conversation panes, Reply and the errand anchor): the message of the
// conversation it came out of, which carries its reply line. A thread's anchor is kept beside the thread, not in its
// record, so older threads read as having none and keep the card they had.

/** One thread anchored on a message of the conversation asked about: which message, and the quest and thread it is. */
export const ThreadAnchor = Schema.Struct({
  /** The message of the conversation that carries the reply line: the one replied to, or the agent reply for an errand it opened. */
  messageId: MessageId,
  missionId: MissionId,
  threadId: ThreadId,
  /** The thread's title now, so a reply line keeps it even when its quest is no longer listed. */
  title: Schema.String,
});
export type ThreadAnchor = typeof ThreadAnchor.Type;

/** Reads what hangs from the messages of a thread: its errands, and the quests started by a Reply in a main conversation. */
export const ReadThreadAnchors = Schema.TaggedStruct("ReadThreadAnchors", { threadId: ThreadId });

/**
 * The owner replies to a message. In a main conversation (the Chronicle) it starts a quest; in a quest's own conversation
 * it opens an errand beneath the quest, with the message as context. A message has at most one reply: replying again
 * answers the thread it already started, with `isNew` false. An errand's conversation takes no Reply.
 */
export const ReplyToMessage = Schema.TaggedStruct("ReplyToMessage", {
  /** The provider account, or null for the harness's own sign-in; absent keeps the default of what is started. */
  accountId: Schema.optionalKey(Schema.NullOr(AccountId)),
  effort: EffortChoice,
  /** Absent runs on the default harness of a quest, or the parent's for an errand. */
  harness: Schema.optionalKey(HarnessName),
  messageId: MessageId,
  model: ModelChoice,
  /** The realm's folder a quest starts in, from the Chronicle's realm menu; absent starts it in none. */
  realmPath: Schema.optionalKey(Schema.NullOr(Schema.String)),
  requestId: RequestId,
  /** The first message; absent in the Chronicle starts an empty quest, whose own composer takes it. An errand needs one. */
  text: Schema.optionalKey(OwnerMessageText),
});

/** The thread a Reply started, or already had. */
export const ReplyToMessageResult = Schema.Struct({
  /** False when the message already had a reply and nothing was started. */
  isNew: Schema.Boolean,
  missionId: MissionId,
  threadId: ThreadId,
});
export type ReplyToMessageResult = typeof ReplyToMessageResult.Type;

/** The requests about anchors. */
export const threadAnchorRequests = [ReadThreadAnchors, ReplyToMessage] as const;

/** What each of them answers. */
export const threadAnchorResults = {
  ReadThreadAnchors: Schema.Array(ThreadAnchor),
  ReplyToMessage: ReplyToMessageResult,
} as const;
