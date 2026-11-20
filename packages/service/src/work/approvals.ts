import type { Choice } from "@outlore/contracts";
import { Clock, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import type { ToolUse } from "../connectors/index.ts";
import { Changes } from "../core/index.ts";
import { capabilities, findCoveringPermission } from "../policy/index.ts";
import {
  type ApprovalRequest,
  Approvals,
  type ChoiceDecision,
  type Decision,
  type FolderQuestion,
} from "./approvalContracts.ts";
import { readMissionIdOf } from "./lifecycle.ts";
import { makePromptPolicy } from "./promptPolicy.ts";

export { type ApprovalRequest, Approvals, type Decision, type FolderQuestion } from "./approvalContracts.ts";

import { markPrompted } from "./activities.ts";
import { type Asked, allowingOutcomes, makeQuestions, type Resolution, textOf } from "./questions.ts";

const connectorAllowedText = "Allowed. The call runs now.";

import { readRunningTurnId } from "./turnAdmission.ts";

/** Approvals over the store, holding the open questions and one-time allowances in memory. */
export const approvalsLayer = Layer.effect(
  Approvals,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    // Targets approved through `request_approval` that the next matching harness prompt may run once.
    const allowances = new Map<
      string,
      Array<{ readonly target: string; readonly turnId: string; readonly outsideSandbox: boolean }>
    >();
    // The real path the owner last allowed a harness to start in, by thread, for a thread folder that is a link.
    const allowedFolders = new Map<string, string>();

    // Provisional until recovery is settled (work-in-progress, open questions): a
    // restart ends the harness process behind an open question, so it is withdrawn.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE questions SET outcome = 'Withdrawn', resolved_at = ${startedAt} WHERE outcome IS NULL`;
    // The thread lifecycle returns the threads that waited on them to Resting (lifecycle.ts, recoverThreadStates).

    const missionOf = (threadId: string) =>
      readMissionIdOf(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    const readTurnId = (threadId: string) =>
      readRunningTurnId(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    const allowOnce = (threadId: string, target: string, turnId: string, outsideSandbox: boolean) =>
      Effect.sync(() =>
        allowances.set(threadId, [
          ...(allowances.get(threadId) ?? []),
          { outsideSandbox, target: target.trim(), turnId },
        ]),
      );

    const takeAllowance = Effect.fnUntraced(function* (threadId: string, target: string, outsideSandbox: boolean) {
      const turnId = yield* readTurnId(threadId);
      const targets = allowances.get(threadId) ?? [];
      const index = targets.findIndex(
        (grant) => grant.target === target.trim() && grant.turnId === turnId && grant.outsideSandbox === outsideSandbox,
      );
      if (index === -1) return false;
      allowances.set(threadId, targets.toSpliced(index, 1));
      return true;
    });

    const questions = makeQuestions(sql, changes, (threadId) => allowances.delete(threadId));
    const { ask, record, answer, answerChoices, withdraw } = questions;
    const answerPrompt = yield* makePromptPolicy({
      allowedFolderOf: (id) => allowedFolders.get(id),
      missionOf,
      questions,
      readTurnId,
      takeAllowance,
    });
    const requestApproval = Effect.fnUntraced(function* (threadId: string, request: ApprovalRequest) {
      const missionId = yield* missionOf(threadId);
      if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
      const turnId = yield* readTurnId(threadId);
      if (turnId === null) return { isAllowed: false, text: "No running turn to approve." } satisfies Decision;
      const outsideSandbox = request.outsideSandbox ?? false;
      // The question names only what the service knows: the exact command, and whether it leaves the sandbox.
      const kind = outsideSandbox ? capabilities.outsideSandbox : null;
      const asked: Asked = {
        details: request.command,
        kind: "Approval",
        missionId,
        // Always allow saves this exact command, never a pattern the thread proposed.
        pattern: request.command.trim(),
        permission: kind ?? "Run this exact command",
        source: "Thread",
        summary: outsideSandbox ? `${request.action}. Run this exact command outside the sandbox.` : request.action,
        threadId,
      };
      const covering = yield* findCoveringPermission(threadId, request.command, kind);
      if (covering !== null) {
        const resolution: Resolution = { message: covering.sentence, outcome: "AllowedByPermission" };
        yield* record(asked, resolution);
        yield* allowOnce(threadId, request.command, turnId, outsideSandbox);
        return { isAllowed: true, text: textOf(resolution, outsideSandbox) } satisfies Decision;
      }
      const resolution = yield* ask(asked);
      const isAllowed = allowingOutcomes.includes(resolution.outcome) && (yield* readTurnId(threadId)) === turnId;
      if (isAllowed) yield* allowOnce(threadId, request.command, turnId, outsideSandbox);
      return { isAllowed, text: textOf(resolution, outsideSandbox) } satisfies Decision;
    }, Effect.orDie);

    /**
     * One question per call to a connector's tool, in words built from the catalog: the thread waits in Attention with no
     * time limit. A standing permission of this tool of this connector, and no other, answers it unasked.
     */
    const askToolUse = Effect.fnUntraced(function* (threadId: string, use: ToolUse) {
      const missionId = yield* missionOf(threadId);
      if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
      if ((yield* readTurnId(threadId)) === null)
        return { isAllowed: false, text: "This thread is not at work, so nothing runs." } satisfies Decision;
      // The connector's id has no `/`, so the pattern splits one way only; a permission for one tool never covers another.
      const pattern = `${use.connector}/${use.tool}`;
      const asked: Asked = {
        details: use.details,
        kind: "Approval",
        missionId,
        pattern,
        permission: capabilities.useConnectorTool,
        source: "Thread",
        summary: use.summary,
        threadId,
      };
      const covering = yield* findCoveringPermission(threadId, pattern, capabilities.useConnectorTool);
      if (covering !== null) {
        yield* record(asked, { message: covering.sentence, outcome: "AllowedByPermission" });
        return { isAllowed: true, text: connectorAllowedText } satisfies Decision;
      }
      const resolution = yield* ask(asked);
      return allowingOutcomes.includes(resolution.outcome)
        ? ({ isAllowed: true, text: connectorAllowedText } satisfies Decision)
        : ({ isAllowed: false, text: textOf(resolution) } satisfies Decision);
    }, Effect.orDie);

    /** Holds the turn on the owner's choices, then tells the thread what was chosen, or that it was skipped. */
    const askChoices = Effect.fnUntraced(function* (threadId: string, choices: ReadonlyArray<Choice>) {
      const missionId = yield* missionOf(threadId);
      if (missionId === null) return { _tag: "Skipped", text: "Unknown thread." } satisfies ChoiceDecision;
      if ((yield* readTurnId(threadId)) === null)
        return { _tag: "Skipped", text: "This thread is not at work, so nothing runs." } satisfies ChoiceDecision;
      const resolution = yield* ask({
        choices,
        details: choices.map((choice) => choice.question).join("\n"),
        kind: "Choice",
        missionId,
        source: "Harness",
        summary: `Asks: ${choices.map((choice) => choice.header || choice.question).join(", ")}.`,
        threadId,
      });
      return resolution.outcome === "Answered" && resolution.answers != null
        ? ({ _tag: "Answered", answers: resolution.answers } satisfies ChoiceDecision)
        : ({ _tag: "Skipped", text: textOf(resolution) } satisfies ChoiceDecision);
    });

    const askAboutFolder = Effect.fnUntraced(
      function* (threadId: string, question: FolderQuestion) {
        const missionId = yield* missionOf(threadId);
        if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
        // A Confirmation refuses Always allow and never looks up a standing permission.
        const resolution = yield* ask({
          details: `${question.folder}\npoints to ${question.pointsTo}`,
          kind: "Confirmation",
          missionId,
          source: "Harness",
          summary: `${question.summary}.`,
          threadId,
        });
        const isAllowed = resolution.outcome === "Allowed";
        if (isAllowed && question.startsIn !== null) allowedFolders.set(threadId, question.startsIn);
        else allowedFolders.delete(threadId);
        return { isAllowed, text: textOf(resolution) } satisfies Decision;
      },
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.orDie,
    );

    const markActivity = (threadId: string, toolUseId: string | null) =>
      toolUseId === null
        ? Effect.void
        : Clock.currentTimeMillis.pipe(
            Effect.flatMap((now) => markPrompted(threadId, toolUseId, now)),
            Effect.provideService(SqlClient.SqlClient, sql),
            Effect.orDie,
          );

    return {
      answer,
      answerChoices,
      answerPrompt: (threadId, prompt, toolUseId = null) =>
        markActivity(threadId, toolUseId).pipe(
          Effect.andThen(
            answerPrompt(
              threadId,
              prompt.toolName,
              prompt.input,
              prompt.isOutsideSandbox ?? false,
              prompt.isUnsandboxed ?? false,
            ),
          ),
          Effect.provideService(SqlClient.SqlClient, sql),
        ),
      askAboutFolder,
      askChoices: (threadId, choices, toolUseId = null) =>
        markActivity(threadId, toolUseId).pipe(
          Effect.andThen(askChoices(threadId, choices)),
          Effect.provideService(SqlClient.SqlClient, sql),
          Effect.orDie,
        ),
      askToolUse: (threadId, use) => askToolUse(threadId, use).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
      confirmAction: Effect.fnUntraced(
        function* (threadId, summary, details) {
          const missionId = yield* missionOf(threadId);
          if (missionId === null) return { isAllowed: false, text: "Unknown thread." };
          const resolution = yield* ask({
            details,
            kind: "Confirmation",
            missionId,
            source: "Thread",
            summary,
            threadId,
          });
          return { isAllowed: resolution.outcome === "Allowed", text: textOf(resolution) };
        },
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.orDie,
      ),
      endTurn: (threadId) => Effect.sync(() => allowances.delete(threadId)).pipe(Effect.asVoid),
      recordDecision: Effect.fnUntraced(function* (threadId, summary, details, outcome, evidence) {
        const missionId = yield* missionOf(threadId);
        if (missionId === null) return;
        yield* record(
          { details, kind: "Confirmation", missionId, source: "Thread", summary, threadId },
          { message: evidence, outcome },
        );
      }, Effect.orDie),
      requestApproval: (threadId, request) =>
        requestApproval(threadId, request).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
      withdraw,
    };
  }),
);
