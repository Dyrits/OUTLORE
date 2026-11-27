import { join } from "node:path";
import { Effect, Match } from "effect";
import type { SqlClient, SqlError } from "effect/sql";
import type { ConnectorGateway } from "../connectors/index.ts";
import {
  type Changes,
  type Endpoints,
  Harness,
  type HarnessEvent,
  type ImageAttachment,
  type PriceTable,
  readSettings,
  reportedChangeOf,
} from "../core/index.ts";
import { type HarnessTools, qualifiedToolNameOf, removedAccountReasonOf, toolServerName } from "../harness/index.ts";
import type { Vault } from "../vault/index.ts";
import { prepareAccountKey } from "./accountKeys.ts";
import type { Approvals } from "./approvals.ts";
import { readApprovalTerms } from "./approvalTerms.ts";
import { askOwnerFor } from "./askOwner.ts";
import type { StoredAttachment } from "./attachments.ts";
import type { CommandRunner } from "./commands.ts";
import { mightMoveFolder } from "./folderMoves.ts";
import { readConversationSoFar, readInterruptedConversation } from "./handover.ts";
import { prepareStartingContext } from "./startingContext.ts";
import type { AccountsRoot, ActiveTurn } from "./threads.ts";
import { unaskedToolNamesOf } from "./threadToolAccess.ts";
import type { Admitted } from "./turnAdmission.ts";
import {
  completeTurn,
  deliverSteered,
  recordTurnFailure,
  saveTurnActivity,
  saveTurnFolderMove,
  saveTurnNotice,
  saveTurnReply,
} from "./turns.ts";
import type { ScratchRoot } from "./workspaces.ts";

// One admitted turn of a thread, from its preparation to its recorded end (thread-messaging, thread-tree): the part of
// the Threads layer that talks to the harness.

/** The services a step of the layer runs over: the store, the change feed, and the roots the layer was built with. */
export type LayerServices = SqlClient.SqlClient | Changes | PriceTable | ScratchRoot | HarnessTools | AccountsRoot;

/** What a turn runs with, taken from the Threads layer that owns the thread's state. */
export type TurnRunnerDependencies = {
  readonly accountsRoot: string;
  /** The turns the harness is running, by thread, so messages can be steered into them. */
  readonly active: Map<string, ActiveTurn>;
  readonly approvals: Approvals["Service"];
  readonly commands: Pick<CommandRunner, "run">;
  readonly connectorGateway: ConnectorGateway["Service"];
  readonly endpoints: Endpoints["Service"];
  readonly harness: Harness["Service"];
  readonly imagesOf: (files: ReadonlyArray<StoredAttachment>) => ReadonlyArray<ImageAttachment>;
  readonly isCurrent: (turnId: string) => Effect.Effect<boolean, SqlError.SqlError>;
  readonly local: <A, E>(step: Effect.Effect<A, E, LayerServices>) => Effect.Effect<A, E>;
  readonly publishDraft: (threadId: string, text: string) => Effect.Effect<unknown>;
  readonly scratchRoot: string;
  readonly sql: SqlClient.SqlClient;
  /** The Vault, which holds an API key account's key until a turn on that account starts. */
  readonly vault: Vault["Service"];
};

/** Makes the step that runs one admitted turn through the harness and records how it ended. */
export const makeTurnRunner = (dependencies: TurnRunnerDependencies) => {
  const {
    accountsRoot,
    active,
    approvals,
    commands,
    connectorGateway,
    endpoints,
    harness,
    imagesOf,
    isCurrent,
    local,
    publishDraft,
    scratchRoot,
    sql,
    vault,
  } = dependencies;
  const runAdmitted = Effect.fnUntraced(function* (
    threadId: string,
    turn: Admitted,
    awaitSettlement: Effect.Effect<void>,
  ): Effect.fn.Return<true | null | undefined, unknown> {
    if (!(yield* isCurrent(turn.turnId))) return;
    const removed = yield* local(removedAccountReasonOf(turn));
    if (removed !== null) {
      return yield* commands.run(local(recordTurnFailure(threadId, turn, removed, false))).pipe(Effect.orDie);
    }
    const { shouldStreamReplies, shouldUseCodeMode } = yield* local(readSettings);
    const terms = yield* local(readApprovalTerms(threadId, turn.harness).pipe(Effect.provideService(Harness, harness)));
    const { context, cwd, isInWorkspace, note } = yield* local(prepareStartingContext(threadId));
    // A new session gets the whole conversation. Codex may omit interrupted input from its resumed context.
    const interrupted =
      turn.sessionId !== null && turn.harness === "codex"
        ? yield* local(readInterruptedConversation(threadId, turn.turnId, turn.model))
        : null;
    const history =
      turn.sessionId === null
        ? yield* local(readConversationSoFar(threadId, turn.turnId, turn.model))
        : (interrupted?.text ?? null);
    const mcpUrl = yield* endpoints.urlFor(threadId);
    const onEvent = (event: HarnessEvent) =>
      Match.valueTags(event, {
        Delivered: (delivered) => commands.run(local(deliverSteered(turn, delivered.messageId))).pipe(Effect.orDie),
        Draft: (written) =>
          shouldStreamReplies ? publishDraft(threadId, written.text).pipe(Effect.asVoid) : Effect.void,
        Notice: (notice) => commands.run(local(saveTurnNotice(threadId, turn, notice.text))).pipe(Effect.orDie),
        Reply: (reply) =>
          commands
            .run(local(saveTurnReply(threadId, turn, reply.text, reply.model ?? null, reply.usage ?? null)))
            .pipe(Effect.andThen(publishDraft(threadId, "")), Effect.orDie),
        ToolCall: (call) =>
          Effect.gen(function* () {
            const change = call.fileEdit === undefined ? null : reportedChangeOf(call.fileEdit);
            yield* commands.run(local(saveTurnActivity(threadId, turn, call.id, call.toolName, call.input, change)));
            // A thread in a workspace may move its shell into a worktree; the scratch folder has none to move to.
            if (isInWorkspace && mightMoveFolder(call.toolName, call.input))
              yield* commands.run(local(saveTurnFolderMove(threadId, turn, cwd, call.toolName, call.input)));
          }).pipe(Effect.orDie),
      });
    if (!(yield* isCurrent(turn.turnId))) return;
    // The tool server answers under the setting this turn starts with, as its harness lists the tools (CHG-0446).
    yield* endpoints.holdCodeMode(threadId, shouldUseCodeMode);
    // The connectors list their tools again, and the thread's snapshot of the tools it is offered for this turn is taken;
    // connectorTools always carries the snapshot so a kept harness process restarts and re-lists run_code when connectors change under Code Mode, while unaskedTools names individual connector tools only when Code Mode is off (connectors specification).
    const snapshot = yield* connectorGateway.beginTurn(threadId);
    const directConnectorTools = shouldUseCodeMode ? [] : snapshot;
    active.set(threadId, { turnId: turn.turnId, written: new Set() });
    // An API key account's key is read from the Vault into the harness's environment; a sign-in account has none.
    yield* local(prepareAccountKey(vault, accountsRoot, turn.accountId)).pipe(Effect.orDie);
    const outcome = yield* harness
      .runTurn({
        access: {
          ...terms,
          connectorTools: snapshot,
          isInWorkspace,
          isUsingCodeMode: shouldUseCodeMode,
          mcpUrl,
          unaskedTools: [
            ...unaskedToolNamesOf(toolServerName, shouldUseCodeMode),
            // Claude Code runs only the tools it is told; each connector tool asks for itself in the gateway.
            ...directConnectorTools.map((name) => qualifiedToolNameOf(toolServerName, name)),
          ],
        },
        askOwner: askOwnerFor(approvals, sql, threadId),
        awaitSettlement,
        configDirectory: turn.accountId === null ? null : join(accountsRoot, turn.accountId),
        context,
        conversationSoFar: local(readConversationSoFar(threadId, turn.turnId, turn.model)).pipe(Effect.orDie),
        cwd,
        effort: turn.effort,
        folderRoot: isInWorkspace ? cwd : scratchRoot,
        harness: turn.harness,
        images: imagesOf([...(interrupted?.attachments ?? []), ...turn.attachments]),
        ...(turn.isBackgroundWake ? { isBackgroundWake: true } : {}),
        model: turn.model,
        note: history === null ? note : `${history}\n\n${note}`,
        onEvent,
        sessionId: turn.sessionId,
        text: turn.messages.join("\n\n"),
        threadId,
      })
      .pipe(
        Effect.result,
        // However the turn ends, what was allowed once in it is spent (action-approval, CHG-0063).
        Effect.ensuring(
          Effect.sync(() => active.delete(threadId)).pipe(
            Effect.andThen(approvals.endTurn(threadId)),
            Effect.andThen(connectorGateway.endTurn(threadId)),
          ),
        ),
      );
    yield* publishDraft(threadId, "");
    if (outcome._tag === "Failure") {
      return yield* commands.run(local(recordTurnFailure(threadId, turn, outcome.failure.reason))).pipe(Effect.orDie);
    }
    yield* commands.run(local(completeTurn(threadId, turn, outcome.success))).pipe(Effect.orDie);
    return true;
  });

  return runAdmitted;
};
