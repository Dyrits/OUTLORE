import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import { HarnessFailure, type HarnessPrompt, type PromptAnswer, textFieldOf } from "../core/index.ts";
import type { ChoiceDecision } from "./approvalContracts.ts";
import type { Approvals } from "./approvals.ts";
import { isNotBeingDeletedOf } from "./questVisibility.ts";

// Asking the owner for a thread that cannot use a tool: Claude Code's permission prompts and the harnesses' own questions.

/** Why a thread may not call a thread tool now, or null: an unknown or deleting thread, or one the chatter guard paused. */
export const readCallerRefusal = Effect.fnUntraced(function* (threadId: string, name: string) {
  const sql = yield* SqlClient.SqlClient;
  const [caller] = yield* sql<{
    blocker: string | null;
  }>`SELECT blocker FROM threads WHERE id = ${threadId} AND ${isNotBeingDeletedOf(sql, "threads")}`;
  if (caller === undefined) return "Unknown thread.";
  if (caller.blocker === "Chatter" && name !== "send_thread_message" && name !== "report_result")
    return "Paused by the chatter guard. Wait for the owner.";
  return null;
});

/**
 * A thread's ask-the-owner capability for its turn request: the answer `answer_prompt` gives Claude Code,
 * without MCP. A store that cannot answer fails the turn rather than leave the harness waiting.
 */
export const askOwnerFor =
  (approvals: Approvals["Service"], sql: SqlClient.SqlClient, threadId: string) => (prompt: HarnessPrompt) =>
    Effect.gen(function* () {
      const refusal = yield* readCallerRefusal(threadId, "answer_prompt");
      if (refusal !== null) return { isAllowed: false, text: refusal } satisfies PromptAnswer;
      // The folder question is one-time: it never goes through the standing permissions (harness/threadFolder.ts).
      if (prompt.folderCheck !== undefined) {
        const answered = yield* approvals.askAboutFolder(threadId, {
          folder: textFieldOf(prompt.input, "file_path") ?? "",
          pointsTo: prompt.folderCheck.pointsTo,
          startsIn: prompt.folderCheck.startsIn,
          summary: textFieldOf(prompt.input, "description") ?? `${prompt.toolName} asks about its folder`,
        });
        return { isAllowed: answered.isAllowed, text: answered.text } satisfies PromptAnswer;
      }
      if (prompt.choices !== undefined) return promptAnswerOf(yield* approvals.askChoices(threadId, prompt.choices));
      const decision = yield* approvals.answerPrompt(threadId, prompt);
      return {
        isAllowed: decision.isAllowed,
        text: decision.text,
      } satisfies PromptAnswer;
    }).pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.orDie,
      Effect.catchDefect((defect) =>
        Effect.fail(
          new HarnessFailure({
            reason: `Outlore could not ask about ${prompt.toolName}: ${defect instanceof Error ? defect.message : String(defect)}`,
          }),
        ),
      ),
    );

/** What a harness is told of the owner's choice: the answers, or why there are none. */
export const promptAnswerOf = (chosen: ChoiceDecision): PromptAnswer =>
  Match.valueTags(chosen, {
    Answered: ({ answers }) => ({ answers, isAllowed: true, text: "" }),
    Skipped: ({ text }) => ({ isAllowed: false, text }),
  });
