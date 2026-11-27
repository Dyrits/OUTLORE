import type { ThreadPermissionMode } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type ModeTerms, notFound, readSettings } from "../core/index.ts";
import { changed } from "./followUps.ts";
import { isNotBeingDeletedOf, isQuestKindOf } from "./questVisibility.ts";

/** The permission mode set directly on a thread, or null when it inherits the Workshop default. */
export const readThreadPermissionMode = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ mode: ThreadPermissionMode | null }>`
    SELECT permission_mode AS mode FROM threads WHERE id = ${threadId}
  `;
  return thread?.mode ?? null;
});

/** The mode set on the realm's channel. A realm whose channel has never opened uses the Workshop default. */
export const readRealmPermissionMode = Effect.fnUntraced(function* (realmId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [channel] = yield* sql<{ mode: ThreadPermissionMode | null }>`
    SELECT t.permission_mode AS mode FROM missions m JOIN threads t ON t.id = m.top_thread_id
    WHERE ${isQuestKindOf(sql, "chronicler")} AND m.chronicler_channel = ${realmId} AND ${isNotBeingDeletedOf(sql)}
  `;
  return channel?.mode ?? null;
});

/** Sets the thread's mode at any time, in a running turn too (CHG-0617): like a runner change, the running turn finishes under the mode it was admitted with and the next turn applies the new one. */
export const setThreadPermissionMode = Effect.fnUntraced(function* (
  threadId: string,
  mode: ThreadPermissionMode | null,
) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ id: string }>`
    UPDATE threads SET permission_mode = ${mode} WHERE id = ${threadId} AND ${isNotBeingDeletedOf(sql, "threads")} RETURNING id
  `;
  if (thread === undefined) return yield* notFound("No such thread.");
  return changed(null);
});

/** The mode the thread's running turn was admitted with, or null between turns or for a turn recorded before the snapshot (CHG-0617). */
export const readRunningTurnMode = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [turn] = yield* sql<{ mode: ThreadPermissionMode | null }>`SELECT permission_mode AS mode FROM turns
    WHERE thread_id = ${threadId} AND status = 'running' ORDER BY started_at DESC, rowid DESC LIMIT 1`;
  return turn?.mode ?? null;
});

/**
 * The effective mode a prompt follows: the running turn's admitted mode, which a change during the turn leaves
 * alone, or between turns the thread's and the Workshop's choice for the turn to come.
 */
export const readModeOfTurn = Effect.fnUntraced(function* (threadId: string) {
  const admitted = yield* readRunningTurnMode(threadId);
  if (admitted !== null) return admitted;
  return effectiveModeOf(yield* readThreadPermissionMode(threadId), (yield* readSettings).defaultPermissionMode);
});

/** The mode the thread runs with: its own when it chose one, otherwise the Workshop's default (CHG-0617). */
export const effectiveModeOf = (
  mode: ThreadPermissionMode | null,
  defaultMode: ThreadPermissionMode,
): ThreadPermissionMode => mode ?? defaultMode;

/**
 * What each permission mode means (CHG-0617, CHG-0621), the one place that says it: the approval level the harnesses
 * enforce their sandbox by, whether a command may leave the sandbox unasked, whether an edit inside the folder runs
 * unasked, and whether every tool call does. Readers judge from these terms, never from a mode's name, and a new mode
 * is one more row (the type forces it).
 */
export const modeTerms: Record<ThreadPermissionMode, ModeTerms> = {
  Auto: {
    approvalLevel: "RiskyOnly",
    areEditsUnasked: false,
    canWorkOutsideSandbox: false,
    isEverythingUnasked: false,
  },
  AutoAcceptEdits: {
    approvalLevel: "CommandsAndEdits",
    areEditsUnasked: true,
    canWorkOutsideSandbox: false,
    isEverythingUnasked: false,
  },
  FullAccess: {
    approvalLevel: "RiskyOnly",
    areEditsUnasked: false,
    canWorkOutsideSandbox: true,
    isEverythingUnasked: true,
  },
  Supervised: {
    approvalLevel: "CommandsAndEdits",
    areEditsUnasked: false,
    canWorkOutsideSandbox: false,
    isEverythingUnasked: false,
  },
};

/** The terms of one mode, whether it came from the thread or the Workshop's default. */
export const termsOfMode = (mode: ThreadPermissionMode): ModeTerms => modeTerms[mode];

/**
 * The level the effective mode derives, which tells the harnesses whether to enforce their sandbox and run their own
 * prompts (CHG-0031): Supervised and Auto-accept edits show the harnesses' prompts, Auto and Full access lean on the
 * sandbox and allow each harness request through the mode instead.
 */
export const harnessApprovalLevelOf = (mode: ThreadPermissionMode | null, defaultMode: ThreadPermissionMode) =>
  termsOfMode(effectiveModeOf(mode, defaultMode)).approvalLevel;
