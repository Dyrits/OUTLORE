import { Schema } from "effect";
import { MessageId, MissionId, QuestionId, ThreadId, WorkspaceId } from "./ids.ts";

export const ChronicleItem = Schema.Struct({
  at: Schema.Number,
  /** How many unread messages one update covers; one for every entry that is not a group of replies. */
  count: Schema.Number,
  id: Schema.String,
  /** Whether the owner has not read this update yet: reading clears the indicator, while a request stays until answered. */
  isUnread: Schema.Boolean,
  kind: Schema.Literals([
    "RealmOpened",
    "QuestOpened",
    "Finished",
    "Archived",
    "Waiting",
    "Failed",
    "Replies",
    "Moved",
  ]),
  /** The latest message of an unread update, to read it in its conversation; null for what is not one message. */
  messageId: Schema.NullOr(MessageId),
  missionId: Schema.NullOr(MissionId),
  /** The unanswered request selected for a waiting entry. */
  questionId: Schema.optional(Schema.NullOr(QuestionId)),
  realmId: Schema.NullOr(WorkspaceId),
  threadId: Schema.NullOr(ThreadId),
  title: Schema.String,
});
export type ChronicleItem = typeof ChronicleItem.Type;
