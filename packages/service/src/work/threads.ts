import { join } from "node:path";
import { Clock, Context, Deferred, Effect, FiberMap, FiberSet, Layer, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { ConnectorGateway, Connectors } from "../connectors/index.ts";
import {
  Changes,
  Endpoints,
  Harness,
  type ImageAttachment,
  PriceTable,
  removeScratch,
  type ServiceFailure,
} from "../core/index.ts";
import { HarnessTools } from "../harness/index.ts";
import { Vault } from "../vault/index.ts";
import { Approvals } from "./approvals.ts";
import { AttachmentsRoot, type StoredAttachment } from "./attachments.ts";
import { Commands, makeCommands } from "./commands.ts";
import { makeLifecycle, recoverThreadStates, stopThread } from "./lifecycle.ts";
import { listPending, listThreadsWithPending } from "./pendingMessages.ts";
import { finishRitualRun } from "./rituals.ts";
import { Suggestions } from "./suggestions.ts";
import { resumeThread, retryThread } from "./threadRecovery.ts";
import { type Admitted, admitBackgroundWake, admitTurn, isCurrentTurn } from "./turnAdmission.ts";
import { makeTurnRunner } from "./turnRunner.ts";
import { type ActiveTurn, makeTurnScopes } from "./turnScopes.ts";
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
    const vault = yield* Vault;
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
    // What each turn holds while the harness runs it, so messages can be steered into the thread's main turn.
    const scopes = makeTurnScopes({ approvals, connectorGateway, endpoints, harness });

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
        if (!(yield* scopes.steer(threadId, { id: message.id, images: imagesOf(message.attachments), text })))
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

    const runAdmitted = makeTurnRunner({
      accountsRoot,
      approvals,
      commands: { run: (operation) => commands.run(operation) },
      endpoints,
      harness,
      imagesOf,
      isCurrent,
      local,
      publishDraft,
      scopes,
      scratchRoot,
      sql,
      vault,
    });

    const run = Effect.fnUntraced(function* (threadId: string, turn: Admitted): Effect.fn.Return<void, unknown> {
      const settled = yield* Deferred.make<void>();
      const completed = yield* runAdmitted(threadId, turn, Deferred.await(settled)).pipe(
        Effect.ensuring(Deferred.succeed(settled, void 0)),
      );
      if (completed !== true) return;
      // Messages that arrived during the turn start the next one, in this same fiber,
      // so the thread's entry in the fiber map always holds its current turn.
      const next = yield* local(admitTurn(threadId));
      if (next !== null) yield* run(threadId, next);
    });

    const wake = (threadId: string): Effect.Effect<void> =>
      Effect.suspend(() => {
        const running = scopes.mainTurnOf(threadId);
        if (running !== null) return steerInto(threadId, running);
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
    const takeBackgroundWake = (threadId: string): Effect.Effect<boolean> =>
      Effect.suspend(() => {
        if (scopes.isRunning(threadId)) return Effect.succeed(true);
        return Effect.gen(function* () {
          const turn = yield* local(admitBackgroundWake(threadId));
          if (turn === null) return false;
          if (turn === "taken") return true;
          yield* FiberMap.run(turns, threadId, run(threadId, turn).pipe(Effect.orDie));
          return true;
        }).pipe(Effect.orDie);
      });
    harness.onBackgroundWake?.(takeBackgroundWake);

    const interrupt = Effect.fnUntraced(function* (threadId: string) {
      if (!(yield* scopes.interrupt(threadId))) return false;
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
      publishTopics: changes.publishTopics,
      removeScratch: (id) => local(removeScratch(join(scratchRoot, id))).pipe(Effect.orDie),
      sql,
      ...(connectors._tag === "Some" ? { stopConnectorCalls: connectors.value.stopRevokedCalls } : {}),
      threads: { cancel, wake, wakeMission },
      withdrawQuestions: withdrawAll,
    });

    // Stopping also ends the run when the thread is a Ritual's run errand: the stopped turn completes on its own
    // when interrupted, but never when stopped, so the stop itself records it (rituals, CHG-0616).
    const stop = (threadId: string) =>
      commands.run(Effect.tap(stopThread(threadId), () => finishRitualRun(threadId, "Interrupted"))).pipe(Effect.orDie);

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
