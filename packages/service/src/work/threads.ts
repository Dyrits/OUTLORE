import { join } from "node:path";
import { Clock, Context, Effect, FiberMap, FiberSet, Layer, Match, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { ConnectorGateway, Connectors } from "../connectors/index.ts";
import {
  Changes,
  Endpoints,
  Harness,
  type HarnessEvent,
  type ImageAttachment,
  PriceTable,
  readSettings,
  removeScratch,
  type ServiceFailure,
} from "../core/index.ts";
import { HarnessTools, qualifiedToolNameOf, removedAccountReasonOf, toolServerName } from "../harness/index.ts";
import { Approvals } from "./approvals.ts";
import { readApprovalTerms } from "./approvalTerms.ts";
import { AttachmentsRoot, type StoredAttachment } from "./attachments.ts";
import { Commands, makeCommands } from "./commands.ts";
import { fileChangeOf, reportedChangeOf } from "./fileChanges.ts";
import { readConversationSoFar } from "./handover.ts";
import { makeLifecycle, recoverThreadStates, stopThread } from "./lifecycle.ts";
import { listPending, listThreadsWithPending } from "./messaging.ts";
import { prepareStartingContext } from "./startingContext.ts";
import { Suggestions } from "./suggestions.ts";
import { resumeThread, retryThread } from "./threadRecovery.ts";
import { unaskedToolNamesOf } from "./threadToolAccess.ts";
import { askOwnerFor } from "./threadToolHandlers.ts";
import { type Admitted, admitTurn, isCurrentTurn, readRunningTurnId } from "./turnAdmission.ts";
import {
  completeTurn,
  deliverSteered,
  recordTurnFailure,
  saveTurnActivity,
  saveTurnNotice,
  saveTurnReply,
} from "./turns.ts";
import { ScratchRoot } from "./workspaces.ts";

/** Owns thread state and admits at most one turn per thread. */
export class Threads extends Context.Service<
  Threads,
  {
    /** Cancels turns already invalidated in a committed lifecycle change. */
    readonly cancel: (ids: ReadonlyArray<string>) => Effect.Effect<void>;
    /** Takes a thread waiting on its missing workspace folder out of Attention and starts its turn again. */
    readonly retry: (threadId: string) => Effect.Effect<void, ServiceFailure>;
    /** Continues a Stopped thread with the messages kept for it (thread-tree, Stopping). */
    readonly resume: (threadId: string) => Effect.Effect<void, ServiceFailure>;
    /**
     * Ends the thread's running turn and withdraws its open questions; the thread stays usable and its
     * undelivered messages start its next turn. False when no turn runs (thread-messaging, Interruptions).
     */
    readonly interrupt: (threadId: string) => Effect.Effect<boolean>;
    /** Ends the thread's current turn, withdraws its open questions, and marks it Stopped; threads beneath keep running. */
    readonly stop: (threadId: string) => Effect.Effect<void>;
    /**
     * Delivers the thread's undelivered messages: a running turn takes in those not queued (steering);
     * otherwise they start a turn.
     */
    readonly wake: (threadId: string) => Effect.Effect<void>;
    /** Once threads stopped outside a turn's end, wakes the mission's threads whose messages wait. */
    readonly wakeMission: (missionId: string) => Effect.Effect<void>;
  }
>()("outlore/Threads") {}

/** Where each provider account added in Outlore keeps its own folder (provider-accounts). */
export class AccountsRoot extends Context.Service<AccountsRoot, string>()("outlore/AccountsRoot") {}

/** A turn the harness is running, with the steered messages already written to it. */
type ActiveTurn = {
  readonly turnId: string;
  readonly written: Set<string>;
};

/** Threads and their shared command runner over the store and the harness adapters. */
export const threadsLayer = Layer.effectContext(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const harness = yield* Harness;
    const changes = yield* Changes;
    const scratchRoot = yield* ScratchRoot;
    const prices = yield* PriceTable;
    const harnessTools = yield* HarnessTools;
    const accountsRoot = yield* AccountsRoot;
    const attachmentsRoot = yield* AttachmentsRoot;
    /** The stored files as a harness takes them: where each is kept. */
    const imagesOf = (files: ReadonlyArray<StoredAttachment>): ReadonlyArray<ImageAttachment> =>
      files.map((file) => ({ mediaType: file.mediaType, name: file.name, path: join(attachmentsRoot, file.file) }));
    const approvals = yield* Approvals;
    const connectorGateway = yield* ConnectorGateway;
    // The connectors are the service's own; a runner built without them stops no connector call.
    const connectors = yield* Effect.serviceOption(Connectors);
    const suggestions = yield* Suggestions;
    /** Withdraws everything the thread waits on the owner for: questions and suggestions. */
    const withdrawAll = (threadId: string) =>
      approvals.withdraw(threadId).pipe(Effect.andThen(suggestions.withdraw(threadId)));
    const endpoints = yield* Endpoints;
    const services = Context.make(SqlClient.SqlClient, sql).pipe(
      Context.add(Changes, changes),
      Context.add(PriceTable, prices),
      Context.add(ScratchRoot, scratchRoot),
      Context.add(HarnessTools, harnessTools),
      Context.add(AccountsRoot, accountsRoot),
    );
    /** Runs a step over the store, the change feed, and the scratch root this layer was built with. */
    const local = <A, E>(
      step: Effect.Effect<A, E, SqlClient.SqlClient | Changes | PriceTable | ScratchRoot | HarnessTools | AccountsRoot>,
    ) => Effect.provideContext(step, services);
    const turns = yield* FiberMap.make<string>();
    // Wakes for other threads run here, outside any turn's fiber, which a later wake may replace.
    const background = yield* FiberSet.make();
    // Turns the harness is running, by thread, so messages can be steered into them.
    const active = new Map<string, ActiveTurn>();

    // Provisional recovery until the recovery decision is settled: a process that
    // ended mid-turn leaves no trustworthy Underway state, and nothing is replayed.
    // With nothing running, no thread is left waiting on a thread beneath it.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE turns SET status = 'interrupted', ended_at = ${startedAt} WHERE status = 'running'`;
    yield* recoverThreadStates;

    const isCurrent = (turnId: string) => local(isCurrentTurn(turnId));
    const publishDraft = (threadId: string, text: string) => PubSub.publish(changes.drafts, { text, threadId });
    /**
     * Writes the thread's undelivered messages that are not queued into its running turn, each once.
     * Thread messages always steer; the owner's steer unless sent as Queue (CHG-0039).
     */
    const steerInto = Effect.fnUntraced(function* (threadId: string, turn: ActiveTurn) {
      if (!(yield* isCurrent(turn.turnId))) return;
      const pending = yield* local(listPending(threadId, true));
      for (const message of pending) {
        if (!(yield* isCurrent(turn.turnId))) return;
        if (turn.written.has(message.id)) continue;
        turn.written.add(message.id);
        const text = message.text;
        // Not taken: the turn just ended, and the message starts the next one.
        if (!(yield* harness.steer(threadId, { id: message.id, images: imagesOf(message.attachments), text })))
          turn.written.delete(message.id);
      }
    }, Effect.orDie);

    /**
     * Once a turn ends or a thread stops, a running slot frees: wakes the mission's other threads whose
     * messages wait, in the background.
     */
    const wakeMission = (missionId: string, exceptThreadIds: ReadonlyArray<string> = []) =>
      FiberSet.run(
        background,
        Effect.gen(function* () {
          const waiting = yield* local(listThreadsWithPending(missionId, ""));
          for (const threadId of waiting) if (!exceptThreadIds.includes(threadId)) yield* wake(threadId);
        }).pipe(Effect.orDie),
      ).pipe(Effect.asVoid);

    const run = Effect.fnUntraced(function* (
      threadId: string,
      turn: Admitted,
    ): Effect.fn.Return<null | undefined, unknown> {
      if (!(yield* isCurrent(turn.turnId))) return;
      const removed = yield* local(removedAccountReasonOf(turn));
      if (removed !== null) {
        return yield* commands.run(local(recordTurnFailure(threadId, turn, removed, false))).pipe(Effect.orDie);
      }
      const { shouldStreamReplies, shouldUseCodeMode } = yield* local(readSettings);
      const terms = yield* local(
        readApprovalTerms(threadId, turn.harness).pipe(Effect.provideService(Harness, harness)),
      );
      const { context, cwd, isInWorkspace, note } = yield* local(prepareStartingContext(threadId));
      // A session that starts with no memory of the thread, after a handover, is given its conversation.
      const history =
        turn.sessionId === null ? yield* local(readConversationSoFar(threadId, turn.turnId, turn.model)) : null;
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
              const change =
                call.fileEdit !== undefined
                  ? reportedChangeOf(call.fileEdit)
                  : turn.harness === "claude"
                    ? yield* fileChangeOf(call.toolName, call.input, cwd)
                    : null;
              yield* commands.run(local(saveTurnActivity(threadId, turn, call.id, call.toolName, call.input, change)));
            }).pipe(Effect.orDie),
        });
      if (!(yield* isCurrent(turn.turnId))) return;
      // The tool server answers under the setting this turn starts with, as its harness lists the tools (CHG-0446).
      yield* endpoints.holdCodeMode(threadId, shouldUseCodeMode);
      // The connectors list their tools again, and the thread's snapshot of the tools it is offered for this turn is taken;
      // with Code Mode on the harness lists none of them, they are reached by code (connectors specification).
      const snapshot = yield* connectorGateway.beginTurn(threadId);
      const connectorTools = shouldUseCodeMode ? [] : snapshot;
      active.set(threadId, { turnId: turn.turnId, written: new Set() });
      const outcome = yield* harness
        .runTurn({
          access: {
            ...terms,
            connectorTools,
            isInWorkspace,
            mcpUrl,
            unaskedTools: [
              ...unaskedToolNamesOf(toolServerName, shouldUseCodeMode),
              // Claude Code runs only the tools it is told; each connector tool asks for itself in the gateway.
              ...connectorTools.map((name) => qualifiedToolNameOf(toolServerName, name)),
            ],
            usesCodeMode: shouldUseCodeMode,
          },
          askOwner: askOwnerFor(approvals, sql, threadId),
          configDirectory: turn.accountId === null ? null : join(accountsRoot, turn.accountId),
          context,
          conversationSoFar: local(readConversationSoFar(threadId, turn.turnId, turn.model)).pipe(Effect.orDie),
          cwd,
          effort: turn.effort,
          folderRoot: isInWorkspace ? cwd : scratchRoot,
          harness: turn.harness,
          images: imagesOf(turn.attachments),
          ...(turn.isBackgroundWake ? { isResuming: true } : {}),
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
      // Messages that arrived during the turn start the next one, in this same fiber,
      // so the thread's entry in the fiber map always holds its current turn.
      const next = yield* local(admitTurn(threadId));
      if (next !== null) yield* run(threadId, next);
    });

    const wake = (threadId: string): Effect.Effect<void> =>
      Effect.suspend(() => {
        const running = active.get(threadId);
        if (running !== undefined) return steerInto(threadId, running);
        return local(admitTurn(threadId)).pipe(
          Effect.flatMap((turn) =>
            turn === null
              ? Effect.void
              : FiberMap.run(turns, threadId, run(threadId, turn).pipe(Effect.orDie)).pipe(Effect.asVoid),
          ),
          Effect.orDie,
        );
      });

    /**
     * A harness process woke itself with no message to run, as Claude Code does when a background command ends: its
     * work runs as a turn of the thread, so its replies are recorded and its commands may be allowed. Answers whether
     * the work is taken; a thread that may not work now (Stopped, held, over budget) refuses, and the process closes.
     */
    const admitBackgroundWake = (threadId: string): Effect.Effect<boolean> =>
      Effect.suspend(() => {
        if (active.has(threadId)) return Effect.succeed(true);
        return Effect.gen(function* () {
          // A turn admitted a moment ago takes in what the process began.
          if ((yield* local(readRunningTurnId(threadId))) !== null) return true;
          const turn = yield* local(admitTurn(threadId, true));
          if (turn === null) return false;
          yield* FiberMap.run(turns, threadId, run(threadId, turn).pipe(Effect.orDie));
          return true;
        }).pipe(Effect.orDie);
      });
    harness.onResume?.(admitBackgroundWake);

    const interrupt = Effect.fnUntraced(function* (threadId: string) {
      if (!active.has(threadId) || !(yield* harness.interrupt(threadId))) return false;
      // The turn's end, in its own fiber, sets the thread's state and starts its next turn.
      yield* withdrawAll(threadId);
      return true;
    });

    const { cancel } = makeLifecycle({
      cancelTurn: (id) => FiberMap.remove(turns, id),
      clearDraft: (id) => publishDraft(id, "").pipe(Effect.asVoid),
      withdraw: withdrawAll,
    });
    // Turn events, owner requests, and tools share the runner over these same thread callbacks.
    const commands = makeCommands({
      publish: changes.publish,
      removeScratch: (id) => local(removeScratch(join(scratchRoot, id))).pipe(Effect.orDie),
      sql,
      ...(connectors._tag === "Some" ? { stopConnectorCalls: connectors.value.stopRevokedCalls } : {}),
      threads: { cancel, wake, wakeMission },
      withdrawQuestions: withdrawAll,
    });

    const stop = (threadId: string) => commands.run(stopThread(threadId)).pipe(Effect.orDie);

    const resume = (threadId: string) =>
      commands.run(local(resumeThread(threadId))).pipe(Effect.catchTag("SqlError", Effect.die));
    const retry = (threadId: string) =>
      commands.run(local(retryThread(threadId))).pipe(Effect.catchTag("SqlError", Effect.die));

    return Context.make(Commands, commands).pipe(
      Context.add(Threads, {
        cancel,
        interrupt,
        resume,
        retry,
        stop,
        wake,
        wakeMission,
      }),
    );
  }),
);
