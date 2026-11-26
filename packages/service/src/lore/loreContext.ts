import type { LoreGauge, ModelChoice } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readSettings, tokensOf } from "../core/index.ts";
import { type LoreEntryRow, listInScope, loreLimit, loreLinesOf, readScopeChain } from "./lore.ts";
import { type Fading, readFading, stateOfLoreEntry, summaryOf } from "./loreFading.ts";

// Context window limits, lore gauge readings, and turn context formatting for threads.

/** The soft limit every model is held to, in tokens (thread-panel, The context gauge; CHG-0509). */
export const contextSoftLimit = 272_000;

/** The window counted for a model no harness has reported (thread-panel, The context gauge). */
export const contextWindowFallback = 200_000;

/** The context limit of a reported window: the window, or the soft limit when the window is larger. */
export const contextLimitOf = (reportedWindow: number | null) => {
  const window = reportedWindow ?? contextWindowFallback;
  return { isSoftLimit: window > contextSoftLimit, tokens: Math.min(window, contextSoftLimit) };
};

/** A model's context limit from its newest reported window, held to the soft limit, or the fallback until one is reported. */
export const readContextLimit = Effect.fnUntraced(function* (model: ModelChoice, threadId: string | null = null) {
  const sql = yield* SqlClient.SqlClient;
  // Read the newest window from either `context_readings` or older `usage` rows so context-only turns and historical rows both feed the limit.
  const [latest] =
    model === "default" && threadId !== null
      ? yield* sql<{ contextWindow: number }>`
          SELECT size AS contextWindow FROM (
            SELECT size, recorded_at AS at, 1 AS source, rowid AS seq
            FROM context_readings WHERE thread_id = ${threadId} AND size IS NOT NULL
            UNION ALL
            SELECT context_window AS size, ended_at AS at, 0 AS source, rowid AS seq
            FROM usage WHERE thread_id = ${threadId} AND context_window IS NOT NULL
          ) ORDER BY at DESC, source DESC, seq DESC LIMIT 1`
      : yield* sql<{ contextWindow: number }>`
          SELECT size AS contextWindow FROM (
            SELECT size, recorded_at AS at, 1 AS source, rowid AS seq
            FROM context_readings WHERE model = ${model} AND size IS NOT NULL
            UNION ALL
            SELECT context_window AS size, ended_at AS at, 0 AS source, rowid AS seq
            FROM usage WHERE model = ${model} AND context_window IS NOT NULL
          ) ORDER BY at DESC, source DESC, seq DESC LIMIT 1`;
  return contextLimitOf(latest?.contextWindow ?? null);
});

/** What a turn's context carries of a thread's lore (scoped-intel, Recall). */
type Recall = {
  /** Dormant lore entries in scope, not listed. */
  readonly dormantCount: number;
  /** Active global lore, oldest first, so a new one is added at the end of the index. */
  readonly index: ReadonlyArray<LoreEntryRow>;
  /** Active thread, mission, and workspace lore, most specific first. */
  readonly inFull: ReadonlyArray<LoreEntryRow>;
};

const recallOf = (rows: ReadonlyArray<LoreEntryRow>, fading: Fading): Recall => {
  const active = rows.filter((row) => stateOfLoreEntry(row, fading) === "Active");
  return {
    dormantCount: rows.filter((row) => stateOfLoreEntry(row, fading) === "Dormant").length,
    index: active.filter((row) => row.scope === "Global").toSorted((first, second) => first.savedAt - second.savedAt),
    inFull: active.filter((row) => row.scope !== "Global"),
  };
};

/** The global index: one line per active global lore entry with its identifier, kind, and a short summary. */
const indexLinesOf = (rows: ReadonlyArray<LoreEntryRow>) =>
  rows.map((row) => `- [${row.id}] (global, ${row.kind.toLowerCase()}) ${summaryOf(row.text)}`).join("\n");

/** What the lore in a thread's scope takes in a turn's context: active count and tokens in full or as index lines. */
export const readLoreSize = Effect.fnUntraced(function* (threadId: string) {
  const recall = recallOf(yield* listInScope(yield* readScopeChain(threadId)), yield* readFading);
  return {
    count: recall.inFull.length + recall.index.length,
    tokens:
      recall.inFull.reduce((sum, row) => sum + tokensOf(row.text), 0) +
      recall.index.reduce((sum, row) => sum + tokensOf(summaryOf(row.text)), 0),
  };
});

/** How much of its model's context window the lore in a thread's scope takes (scoped-intel, Size warning). */
export const readGauge = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const { count, tokens } = yield* readLoreSize(threadId);
  const [thread] = yield* sql<{ model: ModelChoice }>`SELECT model FROM threads WHERE id = ${threadId}`;
  const { intelWarningPercent } = yield* readSettings;
  const { isSoftLimit, tokens: windowTokens } = yield* readContextLimit(thread?.model ?? "default", threadId);
  return {
    count,
    isOverWarning: tokens * 100 > windowTokens * intelWarningPercent,
    isSoftLimit,
    tokens,
    warningPercent: intelWarningPercent,
    windowTokens,
  } satisfies LoreGauge;
});

/** How a thread keeps lore; part of its system prompt, the same every turn (scoped-intel). */
export const loreInstructions = [
  "# Lore",
  "Lore is what Outlore keeps between threads: rules, preferences, decisions, facts, and temporary notes, each at the scope where it applies. Each of your turns starts with the lore in your scope.",
  `Before saving, check there is something worth keeping: saving nothing is better than a vague or forced lore entry. When you learn something later work should know, save it with save_intel: one fact per lore entry, at most ${loreLimit} tokens. Choose the narrowest tool scope that fits: thread (the errand and the threads beneath it; on a quest's top thread, the quest), mission (the quest and all its threads), workspace (the realm, with or without a folder, and all its quests), or global (everywhere; it waits for the owner's approval).`,
  "Choose its kind: rule (never fades), preference, decision, fact, or temporary (fades in days). Lore nobody uses fades, so search_intel for what you need: reading a lore entry there keeps it alive. When a lore entry from your context shaped what you did, say so with relied_on_intel and its ids; that keeps it alive too.",
  "A save that says the same as a lore entry in its scope or a wider one, or a newer version of it, replaces it: the lore entry keeps its id and takes the new text. When the lore entry rests on a journal entry, give its number as journalEntry; otherwise the message you are answering is recorded as its origin.",
  "When the owner gives you a rule in a chat, such as 'always run the tests before a commit', save it as a lore entry of kind rule without being asked.",
  "Correct a lore entry that turned out wrong with update_intel, and delete one that no longer holds with forget_intel. When a lore entry is not specific to where it was saved, such as a general convention or a preference of the owner, propose a wider scope with update_intel; the owner approves the move.",
  "Where the mission stands belongs in the journal, not in lore.",
].join("\n");

/** A thread's lore for each turn's message: the lore in its scope (scoped-intel, Recall). */
export const loreContextOf = Effect.fnUntraced(function* (threadId: string) {
  const chain = yield* readScopeChain(threadId);
  const recall = recallOf(yield* listInScope(chain), yield* readFading);
  const count = recall.dormantCount;
  const dormant =
    count === 0
      ? []
      : count === 1
        ? ["1 dormant lore entry in your scope is not listed; search_intel finds it by words."]
        : [`${count} dormant lore entries in your scope are not listed; search_intel finds them by words.`];
  return [
    "# Lore at this turn",
    "The lore in your scope, most specific first; when two conflict, the one listed first wins:",
    recall.inFull.length === 0 ? "(none yet)" : loreLinesOf(recall.inFull),
    "",
    "Global lore, as an index of one line each; read one in full with search_intel and its id:",
    recall.index.length === 0 ? "(none yet)" : indexLinesOf(recall.index),
    ...dormant,
    ...(chain.workspaceId === null ? ["Your quest has no realm, so realm lore is not available to you."] : []),
  ].join("\n");
});
