import type { ChronicleItem } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { changed, unchanged } from "./followUps.ts";

/** One row of the feed, with SQLite's numbers for what the contract reads as a boolean. */
type ChronicleRow = Omit<ChronicleItem, "isUnread"> & { readonly isUnread: number };

/**
 * The Chronicle's feed and record (CHG-0569, conversation-panes): what asks for the owner across realms and the
 * Borderlands — unread replies and results, open Attention requests, failures — each with its unread state, beside
 * the routine events of History. One attention update per conversation: replies and results group into one entry
 * counting its messages, and a waiting or failed conversation appears once, whatever its age, so a standing request
 * can never duplicate itself. Reading a conversation (thread_reads) is what turns its markers read.
 */
export const readChronicle = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<ChronicleRow>`
    WITH items AS (
      SELECT 'realm:' || id AS id, 'RealmOpened' AS kind, name AS title, created_at AS at, 1 AS count, 0 AS isUnread,
        NULL AS messageId, NULL AS missionId, NULL AS threadId, id AS realmId FROM workspaces WHERE archived_at IS NULL
      UNION ALL
      SELECT 'quest:' || m.id, 'QuestOpened', m.title, m.created_at, 1, 0, NULL, m.id, NULL, top.workspace_id
        FROM missions m JOIN threads top ON top.id = m.top_thread_id WHERE m.is_guildmaster = 0 AND top.is_deleting = 0
      UNION ALL
      SELECT 'end:' || id, CASE ending WHEN 'Fulfilled' THEN 'Finished' ELSE 'Archived' END, title,
        COALESCE(done_at, last_activity_at), 1, 0, NULL, id, NULL, NULL
        FROM missions WHERE is_guildmaster = 0 AND ending IN ('Fulfilled', 'Archived')
      UNION ALL
      SELECT 'move:' || x.id, 'Moved', m.title, x.at, 1, 0, NULL, x.mission_id, NULL, x.to_workspace_id
        FROM quest_moves x JOIN missions m ON m.id = x.mission_id
      UNION ALL
      SELECT 'replies:' || t.id, 'Replies', t.title, MAX(ms.sent_at), COUNT(*), 1,
        (SELECT id FROM messages newest WHERE newest.thread_id = t.id AND newest.sender_kind IN ('agent', 'thread')
           AND newest.sent_at > COALESCE(r.read_at, 0) ORDER BY newest.sent_at DESC, newest.sequence DESC LIMIT 1),
        m.id, t.id, t.workspace_id
        FROM threads t
          JOIN missions m ON m.id = t.mission_id
          LEFT JOIN thread_reads r ON r.thread_id = t.id
          JOIN messages ms ON ms.thread_id = t.id AND ms.sender_kind IN ('agent', 'thread')
            AND ms.sent_at > COALESCE(r.read_at, 0)
        WHERE m.is_guildmaster = 0 AND m.ending IS NULL AND t.is_deleting = 0 AND t.archived_at IS NULL
        GROUP BY t.id
      UNION ALL
      SELECT 'waiting:' || t.id, 'Waiting', t.title, MAX(q.asked_at), 1,
        COALESCE(MAX(r.read_at), 0) < MAX(q.asked_at), NULL, m.id, t.id, t.workspace_id
        FROM threads t
          JOIN missions m ON m.id = t.mission_id
          JOIN questions q ON q.thread_id = t.id AND q.outcome IS NULL
          LEFT JOIN thread_reads r ON r.thread_id = t.id
        WHERE t.state = 'Attention' AND m.is_guildmaster = 0 AND m.ending IS NULL AND t.is_deleting = 0
          AND t.archived_at IS NULL
        GROUP BY t.id
      UNION ALL
      SELECT 'failed:' || t.id, 'Failed', t.title,
        COALESCE((SELECT MAX(sent_at) FROM messages WHERE thread_id = t.id), m.last_activity_at), 1,
        COALESCE(MAX(r.read_at), 0)
          < COALESCE((SELECT MAX(sent_at) FROM messages WHERE thread_id = t.id), m.last_activity_at),
        NULL, m.id, t.id, t.workspace_id
        FROM threads t
          JOIN missions m ON m.id = t.mission_id
          LEFT JOIN thread_reads r ON r.thread_id = t.id
        WHERE t.state = 'Failed' AND m.is_guildmaster = 0 AND m.ending IS NULL AND t.is_deleting = 0
          AND t.archived_at IS NULL
        GROUP BY t.id
    )
    SELECT items.*, CASE WHEN kind = 'Waiting' THEN
      (SELECT q.id FROM questions q WHERE q.thread_id = items.threadId AND q.outcome IS NULL
        ORDER BY q.asked_at DESC, q.id ASC LIMIT 1) ELSE NULL END AS questionId
    FROM items ORDER BY at DESC, id LIMIT 150`;
  return rows.map((row): ChronicleItem => ({ ...row, isUnread: row.isUnread === 1 }));
});

/** Records that the owner read the thread's conversation now (CHG-0569): nothing before this is unread in it again. */
export const markThreadRead = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const [row] = yield* sql<{
    readAt: number;
  }>`SELECT read_at AS readAt FROM thread_reads WHERE thread_id = ${threadId}`;
  if (row !== undefined && row.readAt >= now) return unchanged(null);
  if (row === undefined) yield* sql`INSERT INTO thread_reads (thread_id, read_at) VALUES (${threadId}, ${now})`;
  else yield* sql`UPDATE thread_reads SET read_at = ${now} WHERE thread_id = ${threadId}`;
  return changed(null);
});
