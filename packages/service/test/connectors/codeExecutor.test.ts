import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import {
  CodeCallFailure,
  CodeExecutor,
  type CodeFunctions,
  codeExecutorLayer,
  defaultCodeLimits,
} from "../../src/connectors/index.ts";

const echo = (input: unknown) => Effect.succeed({ echoed: input });
const functions = { fake: { echo, fail: () => Effect.fail(new CodeCallFailure({ message: "Switched off" })) } };

const run = (code: string, limits = defaultCodeLimits, given: CodeFunctions = functions) =>
  Effect.gen(function* () {
    return yield* (yield* CodeExecutor).run(code, given, limits);
  }).pipe(Effect.provide(codeExecutorLayer));

describe("running a thread's code", () => {
  it.live("returns what an async arrow function returns after awaiting its calls in order", () =>
    Effect.gen(function* () {
      const result = yield* run(
        "async () => { const first = await connectors.fake.echo({ n: 1 }); const second = await connectors.fake.echo({ n: 2 }); return [first, second]; }",
      );
      expect(result.outcome).toEqual({ _tag: "Returned", value: [{ echoed: { n: 1 } }, { echoed: { n: 2 } }] });
      expect(result.callCount).toBe(2);
    }),
  );

  it.live("accepts a plain body with a return statement", () =>
    Effect.gen(function* () {
      const result = yield* run("const answer = await connectors.fake.echo('x');\nreturn answer.echoed;");
      expect(result.outcome).toEqual({ _tag: "Returned", value: "x" });
    }),
  );

  it.live("throws a failed call into the code, which can catch it", () =>
    Effect.gen(function* () {
      const caught = yield* run(
        "async () => { try { await connectors.fake.fail({}); } catch (error) { return 'caught: ' + error.message; } }",
      );
      expect(caught.outcome).toEqual({ _tag: "Returned", value: "caught: Switched off" });
      const uncaught = yield* run("async () => connectors.fake.fail({})");
      expect(uncaught.outcome).toEqual({ _tag: "Failed", message: "Error: Switched off" });
    }),
  );

  it.live("offers no file, network, process or module access", () =>
    Effect.gen(function* () {
      const result = yield* run(
        "async () => [typeof fetch, typeof require, typeof process, typeof XMLHttpRequest, typeof WebSocket, typeof std, typeof os, typeof Deno, typeof Bun]",
      );
      expect(result.outcome).toEqual({ _tag: "Returned", value: Array(9).fill("undefined") });
    }),
  );

  it.live("stops an endless loop at the time limit", () =>
    Effect.gen(function* () {
      const result = yield* run("async () => { while (true) {} }", { ...defaultCodeLimits, cpuMillis: 100 });
      expect(result.outcome).toEqual({ _tag: "Failed", message: "The code ran past its time limit (100 ms)." });
    }),
  );

  it.live("does not count the wait for a call against the time limit", () =>
    Effect.gen(function* () {
      const slow = { fake: { slow: () => Effect.sleep("300 millis").pipe(Effect.as("done")) } };
      const result = yield* run("async () => connectors.fake.slow({})", { ...defaultCodeLimits, cpuMillis: 100 }, slow);
      expect(result.outcome).toEqual({ _tag: "Returned", value: "done" });
    }),
  );

  it.live("stops code that takes more memory than its limit", () =>
    Effect.gen(function* () {
      const result = yield* run("async () => { const kept = []; while (true) kept.push('x'.repeat(1024)); }", {
        ...defaultCodeLimits,
        memoryBytes: 4 * 1024 * 1024,
      });
      expect(result.outcome).toEqual({ _tag: "Failed", message: "The code ran out of memory (4 MB)." });
    }),
  );

  it.live("refuses calls past the call limit", () =>
    Effect.gen(function* () {
      const result = yield* run(
        "async () => { for (let index = 0; index < 5; index++) await connectors.fake.echo(index); }",
        {
          ...defaultCodeLimits,
          maxCalls: 3,
        },
      );
      expect(result.outcome).toEqual({ _tag: "Failed", message: "Error: The code made more than 3 connector calls." });
      expect(result.callCount).toBe(3);
    }),
  );

  it.live("keeps what the code logs", () =>
    Effect.gen(function* () {
      const result = yield* run(
        "async () => { console.log('found', 2, { a: 1 }); console.error('oops'); return null; }",
      );
      expect(result.logs).toEqual(['found 2 {"a":1}', "oops"]);
      expect(result.outcome).toEqual({ _tag: "Returned", value: null });
    }),
  );

  it.live("reports a syntax error", () =>
    Effect.gen(function* () {
      const result = yield* run("async () => { return ; ) }");
      expect(result.outcome._tag).toBe("Failed");
      expect(result.outcome._tag === "Failed" && result.outcome.message).toMatch(/^SyntaxError/);
    }),
  );

  it.live("interrupts a call underway when the run is interrupted", () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const interrupted = yield* Deferred.make<void>();
      const waiting = {
        fake: {
          wait: () =>
            Deferred.succeed(started, void 0).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() => Deferred.succeed(interrupted, void 0)),
            ),
        },
      };
      const fiber = yield* Effect.forkChild(run("async () => connectors.fake.wait({})", defaultCodeLimits, waiting));
      yield* Deferred.await(started);
      yield* Fiber.interrupt(fiber);
      yield* Deferred.await(interrupted);
    }),
  );

  it.live("runs each call on a fresh runtime, so nothing carries over", () =>
    Effect.gen(function* () {
      yield* run("async () => { globalThis.kept = 1; }");
      const result = yield* run("async () => typeof kept");
      expect(result.outcome).toEqual({ _tag: "Returned", value: "undefined" });
    }),
  );
});
