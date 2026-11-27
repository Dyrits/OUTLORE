import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Fiber, Layer, Option, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { ConnectorCalls, connectorCallsLayer } from "../../src/connectors/calls.ts";
import { Endpoints, type TurnOutcome } from "../../src/core/index.ts";
import type { Service } from "../../src/index.ts";
import { Approvals } from "../../src/work/index.ts";
import type { Admitted } from "../../src/work/turnAdmission.ts";
import { makeTurnScopes, type TurnScope } from "../../src/work/turnScopes.ts";
import { completeTurn } from "../../src/work/turns.ts";
import { answer, ask, isAsking, push, settle, start, unprotected } from "../fixtures/approvals.ts";

const sideKeyOf = (threadId: string) => `${threadId}#companion`;
const tools = ["calendar__list-events"];

/** A harness stand-in that records which run each steer and interrupt was sent to. */
const recordingHarness = () => {
  const interrupted: Array<string> = [];
  const steered: Array<string> = [];
  return {
    harness: {
      interrupt: (runKey: string) => Effect.sync(() => interrupted.push(runKey) > 0),
      steer: (runKey: string, _message: unknown) => Effect.sync(() => steered.push(runKey) > 0),
    },
    interrupted,
    steered,
  };
};

/** Scopes over the service's own approvals and endpoints, a stand-in gateway over a real snapshot registry, and a recording harness. */
const inScopes = <A, E>(
  body: (world: {
    readonly approvals: Approvals["Service"];
    readonly calls: ConnectorCalls["Service"];
    readonly endpoints: Endpoints["Service"];
    readonly harness: ReturnType<typeof recordingHarness>;
    readonly scopes: ReturnType<typeof makeTurnScopes>;
  }) => Effect.Effect<A, E, SqlClient.SqlClient | Approvals | Endpoints | ConnectorCalls | Service>,
) =>
  Effect.gen(function* () {
    const approvals = yield* Approvals;
    const calls = yield* ConnectorCalls;
    const endpoints = yield* Endpoints;
    const harness = recordingHarness();
    const connectorGateway = {
      beginTurn: (threadId: string, runKey: string = threadId) =>
        calls.takeSnapshot(threadId, tools, runKey).pipe(Effect.as(tools)),
      endTurn: (runKey: string) => calls.dropSnapshot(runKey),
    };
    const scopes = makeTurnScopes({ approvals, connectorGateway, endpoints, harness: harness.harness });
    return yield* body({ approvals, calls, endpoints, harness, scopes });
  });

/** A thread whose turn is with the harness (it asks a question and waits), and the id of that turn. */
const startRunningThread = Effect.gen(function* () {
  const started = yield* start(ask(push));
  yield* settle(started.missionId, isAsking);
  const sql = yield* SqlClient.SqlClient;
  const [turn] = yield* sql<{
    id: string;
  }>`SELECT id FROM turns WHERE thread_id = ${started.threadId} AND status = 'running'`;
  return { ...started, turnId: (turn as { id: string }).id };
});

/** Opens a scope that stays open until the returned closer runs, as a turn's own scope does. */
const openScope = (
  scopes: ReturnType<typeof makeTurnScopes>,
  request: Parameters<ReturnType<typeof makeTurnScopes>["open"]>[0],
) =>
  Effect.gen(function* () {
    const scope = yield* Scope.make();
    const opened = yield* scopes.open(request).pipe(Scope.provide(scope));
    return { close: Scope.close(scope, Exit.void), opened };
  });

/** Lets a command be allowed once for a run: the thread asks, the owner allows. */
const allowOnce = (
  approvals: Approvals["Service"],
  threadId: string,
  missionId: Parameters<typeof settle>[0],
  command: string,
  runKey: string,
) =>
  Effect.gen(function* () {
    const request = yield* approvals
      .requestApproval(threadId, { action: `Run ${command}`, command }, runKey)
      .pipe(Effect.forkChild);
    const detail = yield* settle(missionId, (read) =>
      read.questions.some((question) => question.outcome === null && question.details === command),
    );
    const question = detail.questions.find((open) => open.outcome === null && open.details === command);
    if (question === undefined) return yield* Effect.die("the question was not asked");
    yield* answer(question, "Allow");
    expect((yield* Fiber.join(request)).isAllowed).toBe(true);
  });

/** Whether the run may use its one-time allowance for the command now: a prompt not allowed would ask the owner and wait. */
const isAllowedOnce = (approvals: Approvals["Service"], threadId: string, command: string, runKey: string) =>
  approvals
    .answerPrompt(threadId, { input: { command }, toolName: "Bash" }, null, runKey)
    .pipe(
      Effect.timeoutOption("300 millis"),
      Effect.map(Option.match({ onNone: () => false, onSome: (decision) => decision.isAllowed })),
    );

// The scopes are built directly over a real service whose harness has no enforced sandbox, so a command is asked about
// unless it was allowed once.
const world = () => Layer.mergeAll(unprotected(), connectorCallsLayer);

describe("two runs of one thread", () => {
  it.live(
    "ending a side scope leaves the main scope's one-time approval, snapshot, code mode and interrupt route",
    () =>
      inScopes(({ approvals, calls, endpoints, harness, scopes }) =>
        Effect.gen(function* () {
          const { missionId, threadId, turnId } = yield* startRunningThread;
          const sideKey = sideKeyOf(threadId);
          const main = yield* openScope(scopes, { isUsingCodeMode: false, threadId, turnId });
          const side = yield* openScope(scopes, { isUsingCodeMode: true, runKey: sideKey, threadId, turnId });
          expect([main.opened.kind, main.opened.runKey]).toEqual(["main", threadId]);
          expect([side.opened.kind, side.opened.runKey]).toEqual(["side", sideKey]);
          yield* allowOnce(approvals, threadId, missionId, "git status", threadId);
          yield* allowOnce(approvals, threadId, missionId, "git log", sideKey);
          expect([endpoints.heldCodeMode(threadId), endpoints.heldCodeMode(sideKey)]).toEqual([false, true]);

          yield* side.close;

          expect(endpoints.heldCodeMode(sideKey)).toBeNull();
          expect(endpoints.heldCodeMode(threadId)).toBe(false);
          expect(calls.snapshotOf(sideKey)).toBeNull();
          expect([...(calls.snapshotOf(threadId) ?? [])]).toEqual(tools);
          expect(yield* isAllowedOnce(approvals, threadId, "git status", threadId)).toBe(true);
          expect(yield* isAllowedOnce(approvals, threadId, "git log", sideKey)).toBe(false);
          expect(yield* scopes.interrupt(threadId)).toBe(true);
          expect(harness.interrupted).toEqual([threadId]);
        }),
      ).pipe(Effect.provide(world())),
  );

  it.live("ending the main scope leaves the side scope's one-time approval, snapshot and code mode", () =>
    inScopes(({ approvals, calls, endpoints, scopes }) =>
      Effect.gen(function* () {
        const { missionId, threadId, turnId } = yield* startRunningThread;
        const sideKey = sideKeyOf(threadId);
        const main = yield* openScope(scopes, { isUsingCodeMode: false, threadId, turnId });
        const side = yield* openScope(scopes, { isUsingCodeMode: true, runKey: sideKey, threadId, turnId });
        yield* allowOnce(approvals, threadId, missionId, "git status", threadId);
        yield* allowOnce(approvals, threadId, missionId, "git log", sideKey);

        yield* main.close;

        expect(scopes.isRunning(threadId)).toBe(false);
        expect(calls.snapshotOf(threadId)).toBeNull();
        expect([...(calls.snapshotOf(sideKey) ?? [])]).toEqual(tools);
        expect(endpoints.heldCodeMode(sideKey)).toBe(true);
        expect(yield* isAllowedOnce(approvals, threadId, "git log", sideKey)).toBe(true);
        expect(yield* isAllowedOnce(approvals, threadId, "git status", threadId)).toBe(false);
        yield* side.close;
      }),
    ).pipe(Effect.provide(world())),
  );

  it.live("sends steering and an interrupt given by thread id to the main run, never to a side run", () =>
    inScopes(({ harness, scopes }) =>
      Effect.gen(function* () {
        const { threadId, turnId } = yield* startRunningThread;
        const main = yield* openScope(scopes, { isUsingCodeMode: false, threadId, turnId });
        const side = yield* openScope(scopes, {
          isUsingCodeMode: false,
          runKey: sideKeyOf(threadId),
          threadId,
          turnId,
        });
        expect(yield* scopes.steer(threadId, { id: "m1", images: [], text: "More" })).toBe(true);
        expect(yield* scopes.interrupt(threadId)).toBe(true);
        expect(harness.steered).toEqual([threadId]);
        expect(harness.interrupted).toEqual([threadId]);
        expect(scopes.mainTurnOf(threadId)).toBe(main.opened.turn);
        yield* side.close;
        yield* main.close;
      }),
    ).pipe(Effect.provide(world())),
  );

  it.live("does not take a side run for the thread's own turn", () =>
    inScopes(({ harness, scopes }) =>
      Effect.gen(function* () {
        const { threadId, turnId } = yield* startRunningThread;
        const side = yield* openScope(scopes, {
          isUsingCodeMode: false,
          runKey: sideKeyOf(threadId),
          threadId,
          turnId,
        });
        expect(scopes.isRunning(threadId)).toBe(false);
        expect(scopes.mainTurnOf(threadId)).toBeNull();
        expect(yield* scopes.interrupt(threadId)).toBe(false);
        expect(yield* scopes.steer(threadId, { id: "m1", images: [], text: "More" })).toBe(false);
        expect([harness.interrupted, harness.steered]).toEqual([[], []]);
        yield* side.close;
      }),
    ).pipe(Effect.provide(world())),
  );
});

describe("the end of one run", () => {
  it.live("releases everything the run held in one finalizer, however its turn ends", () =>
    inScopes(({ approvals, calls, endpoints, scopes }) =>
      Effect.gen(function* () {
        const { missionId, threadId, turnId } = yield* startRunningThread;
        const sideKey = sideKeyOf(threadId);
        const failed = yield* Effect.exit(
          Effect.gen(function* () {
            yield* scopes.open({ isUsingCodeMode: true, runKey: sideKey, threadId, turnId });
            yield* allowOnce(approvals, threadId, missionId, "git log", sideKey);
            return yield* Effect.fail("the turn failed");
          }).pipe(Effect.scoped),
        );
        expect(Exit.isFailure(failed)).toBe(true);
        expect(calls.snapshotOf(sideKey)).toBeNull();
        expect(endpoints.heldCodeMode(sideKey)).toBeNull();
        expect(yield* isAllowedOnce(approvals, threadId, "git log", sideKey)).toBe(false);
      }),
    ).pipe(Effect.provide(world())),
  );

  it.live(
    "spends a main run's one-time approval and snapshot, and keeps its code mode for the thread's kept process",
    () =>
      inScopes(({ approvals, calls, endpoints, scopes }) =>
        Effect.gen(function* () {
          const { missionId, threadId, turnId } = yield* startRunningThread;
          const main = yield* openScope(scopes, { isUsingCodeMode: true, threadId, turnId });
          yield* allowOnce(approvals, threadId, missionId, "git status", threadId);
          yield* main.close;
          expect(yield* isAllowedOnce(approvals, threadId, "git status", threadId)).toBe(false);
          expect(calls.snapshotOf(threadId)).toBeNull();
          expect(scopes.isRunning(threadId)).toBe(false);
          expect(endpoints.heldCodeMode(threadId)).toBe(true);
        }),
      ).pipe(Effect.provide(world())),
  );
});

describe("the thread's own state and session", () => {
  const outcomeOf = (sessionId: string) =>
    ({ billing: "Unknown", cost: null, isInterrupted: false, sessionId, usage: null }) satisfies TurnOutcome;

  const endWith = (scope: (threadId: string, turnId: string) => TurnScope, sessionId: string) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const { missionId, threadId, turnId } = yield* startRunningThread;
      yield* sql`UPDATE threads SET session_id = 'main-session' WHERE id = ${threadId}`;
      const [thread] = yield* sql<{ accountId: string | null; harness: Admitted["harness"]; state: string }>`
        SELECT harness, account_id AS accountId, state FROM threads WHERE id = ${threadId}`;
      const row = thread as { accountId: string | null; harness: Admitted["harness"]; state: string };
      const turn = {
        accountId: row.accountId,
        attachments: [],
        effort: "default",
        harness: row.harness,
        isBackgroundWake: false,
        messages: [],
        missionId,
        model: "default",
        sessionId: null,
        turnId,
      } satisfies Admitted;
      yield* completeTurn(threadId, turn, outcomeOf(sessionId), scope(threadId, turnId));
      const [after] = yield* sql<{ sessionId: string | null; state: string }>`
        SELECT session_id AS sessionId, state FROM threads WHERE id = ${threadId}`;
      return { after, before: row.state };
    });
  const scopeOf = (kind: TurnScope["kind"]) => (threadId: string, turnId: string) =>
    ({
      kind,
      runKey: kind === "main" ? threadId : sideKeyOf(threadId),
      snapshot: [],
      threadId,
      turn: { turnId, written: new Set<string>() },
    }) satisfies TurnScope;

  it.live("is written by the main scope's end: the session it reports becomes the thread's", () =>
    endWith(scopeOf("main"), "new-session").pipe(
      Effect.tap(({ after, before }) =>
        Effect.sync(() => {
          expect(before).toBe("Attention");
          expect(after).toEqual({ sessionId: "new-session", state: "Resting" });
        }),
      ),
      Effect.provide(world()),
    ),
  );

  it.live("is left as it was by the end of a side scope, whatever session that run reports", () =>
    endWith(scopeOf("side"), "side-session").pipe(
      Effect.tap(({ after, before }) =>
        Effect.sync(() => expect(after).toEqual({ sessionId: "main-session", state: before })),
      ),
      Effect.provide(world()),
    ),
  );
});
