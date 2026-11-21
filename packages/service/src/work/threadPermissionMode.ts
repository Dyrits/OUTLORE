import type { ApprovalLevel, ThreadPermissionMode } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { changed } from "./followUps.ts";

export const readThreadPermissionMode = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ mode: ThreadPermissionMode | null }>`
    SELECT permission_mode AS mode FROM threads WHERE id = ${threadId}
  `;
  return thread?.mode ?? null;
});

export const setThreadPermissionMode = Effect.fnUntraced(function* (
  threadId: string,
  mode: ThreadPermissionMode | null,
) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ id: string }>`
    UPDATE threads SET permission_mode = ${mode}
    WHERE id = ${threadId} AND is_deleting = 0
      AND NOT EXISTS (SELECT 1 FROM turns WHERE thread_id = ${threadId} AND status = 'running')
    RETURNING id
  `;
  if (thread === undefined) {
    const [existing] = yield* sql`SELECT id FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
    if (existing === undefined) return yield* notFound("No such thread.");
    return yield* invalid("Change permissions when the current turn has ended.");
  }
  return changed(null);
});

/** The mode the thread runs with: its own when it chose one, otherwise the Workshop's default (CHG-0617). */
export const effectiveModeOf = (
  mode: ThreadPermissionMode | null,
  defaultMode: ThreadPermissionMode,
): ThreadPermissionMode => mode ?? defaultMode;

/**
 * The level the effective mode derives, which tells the harnesses whether to enforce their sandbox and run their own
 * prompts (CHG-0031): Supervised and Auto-accept edits show the harnesses' prompts, Auto and Full access lean on the
 * sandbox and allow each harness request through the mode instead.
 */
export const harnessApprovalLevelOf = (
  mode: ThreadPermissionMode | null,
  defaultMode: ThreadPermissionMode,
): ApprovalLevel => {
  const asking: Record<ThreadPermissionMode, ApprovalLevel> = {
    Auto: "RiskyOnly",
    AutoAcceptEdits: "CommandsAndEdits",
    FullAccess: "RiskyOnly",
    Supervised: "CommandsAndEdits",
  };
  return asking[effectiveModeOf(mode, defaultMode)];
};
