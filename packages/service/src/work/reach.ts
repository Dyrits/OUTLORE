import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { isGuildmasterThread } from "./guildmasterPlace.ts";
import { readTurnReach } from "./mentions.ts";

// Who a thread may message and whose journal it may read (thread-messaging, Who can message whom; CHG-0181): the tree's
// own rules, Chronicler's, and what the owner's mentions and the messages delivered to the thread's current turn open. The
// tools ask here, so the rule, its grants, and the note that tells the thread of them (`readMentionNote`) read the same
// resolution of a mention.

/**
 * Whether a thread may message another by the tree's rules: its parent, a thread directly beneath it, any thread to
 * the Guildmaster, and the Guildmaster to a quest's top thread (quest coordination, References between quests).
 */
const isWithinTree = Effect.fnUntraced(function* (fromId: string, toId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`
      SELECT id FROM threads
      WHERE (id = ${toId} AND parent_id = ${fromId})
        OR (id = ${fromId} AND parent_id = ${toId})
      UNION
      SELECT t.id FROM threads t JOIN missions m ON m.id = t.mission_id
      WHERE t.id = ${toId} AND m.is_guildmaster = 1 AND t.id <> ${fromId} AND t.is_deleting = 0
      UNION
      SELECT t.id FROM threads t JOIN missions m ON m.id = t.mission_id
      WHERE t.id = ${toId} AND m.is_guildmaster = 0 AND t.parent_id IS NULL AND t.is_deleting = 0
        AND EXISTS (SELECT 1 FROM threads f JOIN missions fm ON fm.id = f.mission_id
          WHERE f.id = ${fromId} AND fm.is_guildmaster = 1)`;
  return rows.length > 0;
});

/**
 * Whether a thread may message another: by the tree's rules, or because the owner mentioned that thread's quest or
 * errand in a message its current turn received, or because the other thread wrote to it in that turn.
 */
export const mayMessage = Effect.fnUntraced(function* (fromId: string, toId: string) {
  return (yield* isWithinTree(fromId, toId)) || (yield* readTurnReach(fromId)).reachable.has(toId);
});

/**
 * Whether a thread may read another quest's journal: Chronicler reads any; another thread only one the owner mentioned,
 * or one of whose errands the owner mentioned, in a message its current turn received.
 */
export const mayReadJournal = Effect.fnUntraced(function* (threadId: string, missionId: string) {
  return (yield* readTurnReach(threadId)).readable.has(missionId) || (yield* isGuildmasterThread(threadId));
});
