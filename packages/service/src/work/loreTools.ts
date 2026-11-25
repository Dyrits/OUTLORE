import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { toolText } from "../core/index.ts";
import { forgetLoreEntry, relyOnLore, saveLoreEntry, searchLoreText, updateLoreEntry } from "../lore/index.ts";
import { searchInvalid } from "./loreToolDefinitions.ts";
import type { ToolHandlers } from "./threadTools.ts";

// Stored and wire names keep `intel` so existing data and agents still work: thread tool names (`save_intel`, ...).

/** Answers the lore thread tools (scoped-intel, External contract); `commit` runs a change in one transaction and announces it. */
export const loreToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Pick<ToolHandlers, "forget_intel" | "relied_on_intel" | "save_intel" | "search_intel" | "update_intel"> => ({
  forget_intel: (threadId, { id }) => commit(forgetLoreEntry(threadId, id)),
  relied_on_intel: (threadId, { ids }) => commit(relyOnLore(threadId, ids)),
  save_intel: (threadId, { journalEntry, kind, scope, text }) =>
    commit(saveLoreEntry(threadId, text, scope, kind, journalEntry ?? null)),
  search_intel: (threadId, { ids, query, scope }) =>
    query === undefined && (ids === undefined || ids.length === 0)
      ? Effect.succeed(searchInvalid)
      : commit(
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            const chronicler =
              yield* sql`SELECT id FROM missions WHERE is_guildmaster = 1 AND top_thread_id = ${threadId}`;
            return yield* searchLoreText(threadId, query ?? null, ids ?? [], scope ?? null, chronicler.length > 0);
          }),
        ).pipe(Effect.map(toolText)),
  update_intel: (threadId, { id, scope, text }) => commit(updateLoreEntry(threadId, id, text ?? null, scope ?? null)),
});
