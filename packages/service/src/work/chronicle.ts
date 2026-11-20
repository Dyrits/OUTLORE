import type { ChronicleItem } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { dayMillis } from "../core/index.ts";

/** Recent cross-realm activity plus one reminder per conversation still waiting for the owner. */
export const readChronicle = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  return yield* sql<ChronicleItem>`
    WITH items AS (
      SELECT 'realm:' || id AS id, 'RealmOpened' AS kind, name AS title, created_at AS at,
        NULL AS missionId, NULL AS threadId, id AS realmId FROM workspaces WHERE archived_at IS NULL
      UNION ALL
      SELECT 'quest:' || m.id, 'QuestOpened', m.title, m.created_at, m.id, NULL, top.workspace_id
        FROM missions m JOIN threads top ON top.id = m.top_thread_id WHERE m.is_guildmaster = 0 AND top.is_deleting = 0
      UNION ALL
      SELECT 'end:' || id, CASE ending WHEN 'Done' THEN 'Finished' ELSE 'Archived' END, title,
        COALESCE(done_at, last_activity_at), id, NULL, NULL
        FROM missions WHERE is_guildmaster = 0 AND ending IN ('Done', 'Archived')
      UNION ALL
      SELECT 'state:' || t.id, CASE t.state WHEN 'Failed' THEN 'Failed' ELSE 'Waiting' END,
        t.title, COALESCE((SELECT MAX(sent_at) FROM messages WHERE thread_id = t.id), m.last_activity_at),
        m.id, t.id, t.workspace_id FROM threads t JOIN missions m ON m.id = t.mission_id
        WHERE m.is_guildmaster = 0 AND m.ending IS NULL AND t.archived_at IS NULL AND t.is_deleting = 0
          AND (t.state = 'Failed' OR (t.state = 'Attention'
            AND COALESCE((SELECT MAX(sent_at) FROM messages WHERE thread_id = t.id), m.last_activity_at) <= ${now - dayMillis}))
    )
    SELECT * FROM items ORDER BY kind = 'Waiting' DESC, at DESC, id LIMIT 150`;
});
