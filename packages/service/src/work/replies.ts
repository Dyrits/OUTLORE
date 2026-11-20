import type { ReplyToMessageResult, ThreadAnchor } from "@outlore/contracts";
import {
  type AccountId,
  type EffortChoice,
  type HarnessName,
  MissionId,
  type ModelChoice,
  ThreadId,
} from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { changed, unchanged } from "./followUps.ts";
import { insertMission } from "./missions.ts";
import { openThreadByOwner } from "./tree.ts";

// Reply and the errand anchor (conversation panes, batch 4): what hangs from a message, and starting a quest or an
// errand from one. The anchor of a thread is `threads.anchor_message_id`; a message has at most one.

/** What a thread hangs from, for the messages of one conversation: its errands, and the quests started by a Reply. */
export const readThreadAnchors = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ messageId: string; missionId: string; threadId: string; title: string }>`
      SELECT t.anchor_message_id AS messageId, t.mission_id AS missionId, t.id AS threadId, t.title AS title
      FROM threads t JOIN messages m ON m.id = t.anchor_message_id
      WHERE m.thread_id = ${threadId} AND t.is_deleting = 0
      ORDER BY m.sequence, t.rowid`;
  return rows.map((row) => row as unknown as ThreadAnchor);
});

/** The runner the owner chose for the reply: what it leaves out comes from what is started. */
type Choice = {
  readonly accountId?: AccountId | null | undefined;
  readonly effort: EffortChoice;
  readonly harness?: HarnessName | undefined;
  readonly model: ModelChoice;
};

/**
 * The owner replies to a message. In Chronicler's conversation it starts a quest in the Borderlands, which Chronicler
 * then hears of as it does of a quest it opened; in a quest's own conversation it opens an errand beneath the quest,
 * which starts from that conversation, the message included. An errand's conversation takes no Reply: the owner starts
 * errands from a quest only. A message that already has a reply answers it, and starts nothing.
 */
export const replyToMessage = Effect.fnUntraced(function* (input: {
  readonly choice: Choice;
  readonly messageId: string;
  /** The realm's folder a quest starts in, from the Chronicle's realm menu; an errand always follows its quest. */
  readonly realmPath: string | null;
  readonly text: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  const [message] = yield* sql<{
    archivedAt: number | null;
    ending: string | null;
    channel: string | null;
    workspaceId: string | null;
    isGuildmaster: number;
    parentId: string | null;
    threadId: string;
  }>`
      SELECT m.thread_id AS threadId, t.parent_id AS parentId, t.archived_at AS archivedAt, q.ending AS ending,
        q.is_guildmaster AS isGuildmaster, q.chronicler_channel AS channel, t.workspace_id AS workspaceId
      FROM messages m JOIN threads t ON t.id = m.thread_id JOIN missions q ON q.id = t.mission_id
      WHERE m.id = ${input.messageId} AND t.is_deleting = 0`;
  if (message === undefined) return yield* notFound("No such message.");
  const [existing] = yield* sql<{ missionId: string; threadId: string }>`
      SELECT id AS threadId, mission_id AS missionId FROM threads WHERE anchor_message_id = ${input.messageId} AND is_deleting = 0`;
  if (existing !== undefined)
    return unchanged<ReplyToMessageResult>({
      isNew: false,
      missionId: MissionId.make(existing.missionId),
      threadId: ThreadId.make(existing.threadId),
    } satisfies ReplyToMessageResult);
  if (message.isGuildmaster === 1) {
    const started = yield* insertMission(
      input.text,
      {
        accountId: input.choice.accountId,
        effort: input.choice.effort,
        harness: input.choice.harness,
        model: input.choice.model,
      },
      message.channel === null ? input.realmPath : null,
      true,
      null,
      [],
      message.workspaceId,
    );
    // Chronicler hears of this quest's result, Attention, and failure, as of a quest it opened.
    if (message.channel === null)
      yield* sql`UPDATE missions SET opened_by_guildmaster = 1 WHERE id = ${started.missionId}`;
    yield* sql`UPDATE threads SET anchor_message_id = ${input.messageId} WHERE id = ${started.threadId}`;
    return changed<ReplyToMessageResult>(
      { isNew: true, missionId: started.missionId, threadId: started.threadId },
      { threadsToWake: [started.threadId] },
    );
  }
  if (message.parentId !== null)
    return yield* invalid("An errand takes no Reply: write in it, or reply in the quest to open another errand.");
  if (message.archivedAt !== null || message.ending === "Archived")
    return yield* invalid("This quest is archived. Restore it to reply.");
  const opened = yield* openThreadByOwner(
    message.threadId,
    input.text,
    {
      accountId: input.choice.accountId,
      effort: input.choice.effort,
      harness: input.choice.harness,
      model: input.choice.model,
    },
    false,
    [],
    null,
    input.messageId,
  );
  const [errand] = yield* sql<{
    missionId: string;
  }>`SELECT mission_id AS missionId FROM threads WHERE id = ${opened.value.threadId}`;
  return changed(
    {
      isNew: true,
      missionId: MissionId.make(errand?.missionId ?? ""),
      threadId: opened.value.threadId,
    } satisfies ReplyToMessageResult,
    opened.followUps,
  );
});
