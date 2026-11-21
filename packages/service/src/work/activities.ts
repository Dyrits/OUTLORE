import type { Activity, FileDiff } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type FileChange, linesOfStoredDiff, storedDiffOf } from "../core/fileChanges.ts";
import { notFound, textFieldOf } from "../core/index.ts";
import { plainActionOf, reasonOf } from "../policy/index.ts";

// The tool calls a harness reports as they start, shown with a thread's actions as the steps of its turn
// (action-approval, What a working thread is doing).

const detailLength = 120;

/** The first line of a target, cut to a short line; a call's output and a file's content are never kept. */
const shortOf = (text: string) => {
  const [first = ""] = text.trim().split("\n");
  return first.length > detailLength || first !== text.trim() ? `${first.slice(0, detailLength).trimEnd()}…` : first;
};

/** Outlore's own tools, which the thread calls through its tool server, as the harness lists them. */
const chroniclerPrefix = "mcp__outlore__";

/**
 * Claude Code's choice question: the conversation shows it as the agent's bubbles with the owner's answers (CHG-0535),
 * so it has no step. Lines recorded before that stay stored and are not listed.
 */
const choiceQuestionTool = "AskUserQuestion";

/** Calls that already have a line of their own, or are the harness's own machinery. */
const leftOut = new Set([
  `${chroniclerPrefix}request_approval`,
  `${chroniclerPrefix}answer_prompt`,
  choiceQuestionTool,
]);

const kinds: Record<string, string> = {
  Glob: "List files",
  Grep: "Search files",
  TodoWrite: "Update its plan",
  ToolSearch: "Look up tools",
};

/** The target a call is about: its file, pattern, address, query, or what the harness says of a command. */
const detailOf = (toolName: string, input: unknown) => {
  if (toolName === "Bash") return shortOf(textFieldOf(input, "command") ?? "");
  const subject =
    textFieldOf(input, "file_path") ??
    textFieldOf(input, "notebook_path") ??
    textFieldOf(input, "pattern") ??
    textFieldOf(input, "url") ??
    textFieldOf(input, "query") ??
    "";
  return shortOf(subject);
};

/**
 * A harness tool call in plain words and a short target, or null for one left out. A command says what it is for when
 * the harness gives its reason, else it is "Run a command" with the command's first line.
 */
export const callDescriptionOf = (toolName: string, input: unknown): Pick<Activity, "detail" | "summary"> | null => {
  if (leftOut.has(toolName)) return null;
  // Code Mode's one tool: the calls its code makes are not reported by the harness, so this line is how a run shows.
  if (toolName === `${chroniclerPrefix}run_code`)
    return { detail: "run code", summary: "Run code that calls its tools" };
  if (toolName.startsWith(chroniclerPrefix))
    return { detail: toolName.slice(chroniclerPrefix.length).replaceAll("_", " "), summary: "Use an Outlore tool" };
  const kind = Object.hasOwn(kinds, toolName) ? kinds[toolName] : null;
  const summary = toolName === "Bash" ? (reasonOf(input) ?? "Run a command") : (kind ?? plainActionOf(toolName));
  return { detail: detailOf(toolName, input), summary };
};

/**
 * A thread's tool calls that were not asked about as actions, oldest first. A call that modified a file carries its
 * counts only: its diff is read apart, by `readFileDiff`, so this list stays small.
 */
export const listThreadActivities = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<
    Omit<Activity, "change"> & { added: number | null; hasChange: number; removed: number | null }
  >`
      SELECT a.id, a.at, a.summary, a.detail, d.added AS added, d.removed AS removed,
        d.thread_id IS NOT NULL AS hasChange
      FROM thread_activities a
      LEFT JOIN thread_activity_diffs d ON d.thread_id = a.thread_id AND d.activity_id = a.id
      WHERE a.thread_id = ${threadId} AND a.is_prompted = 0 AND a.summary <> ${plainActionOf(choiceQuestionTool)}
      ORDER BY a.at, a.rowid`;
  return rows.map(
    ({ added, hasChange, removed, ...activity }): Activity =>
      hasChange === 1 ? { ...activity, change: { added, removed } } : activity,
  );
});

/**
 * Keeps the diff of a call that modified a file, replacing an earlier one for the same call. A call that already reached
 * the permission prompt shows as its action and keeps no diff.
 */
export const saveActivityChange = Effect.fnUntraced(function* (
  threadId: string,
  activityId: string,
  change: FileChange,
) {
  const sql = yield* SqlClient.SqlClient;
  const stored = storedDiffOf(change);
  yield* sql`INSERT OR REPLACE INTO thread_activity_diffs (thread_id, activity_id, added, removed, note, text)
      SELECT ${threadId}, ${activityId}, ${change.added}, ${change.removed}, ${stored.note}, ${stored.text}
      WHERE EXISTS (SELECT 1 FROM thread_activities WHERE thread_id = ${threadId} AND id = ${activityId} AND is_prompted = 0)`;
});

/** The diff of one call that modified a file, in the shape the app draws; not found when the call kept none. */
export const readFileDiff = Effect.fnUntraced(function* (threadId: string, activityId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ added: number | null; note: string | null; removed: number | null; text: string }>`
      SELECT added, removed, note, text FROM thread_activity_diffs
      WHERE thread_id = ${threadId} AND activity_id = ${activityId}`;
  if (row === undefined) return yield* notFound("That step has no diff.");
  return {
    added: row.added,
    lines: linesOfStoredDiff(row.text),
    note: row.note,
    removed: row.removed,
  } satisfies FileDiff;
});

/**
 * Marks a call as having reached the permission prompt, whichever of the two arrives first, so it shows once, as its
 * action. A prompt for a call the harness never reported leaves a hidden row.
 */
export const markPrompted = Effect.fnUntraced(function* (threadId: string, toolUseId: string, at: number) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`INSERT INTO thread_activities (id, thread_id, at, summary, detail, is_prompted)
      VALUES (${toolUseId}, ${threadId}, ${at}, '', '', 1)
      ON CONFLICT (thread_id, id) DO UPDATE SET is_prompted = 1`;
  // A call that is asked about may be denied, and its diff would then describe a change that never happened.
  yield* sql`DELETE FROM thread_activity_diffs WHERE thread_id = ${threadId} AND activity_id = ${toolUseId}`;
});
