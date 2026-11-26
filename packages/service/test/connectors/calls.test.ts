import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { ConnectorCalls, connectorCallsLayer } from "../../src/connectors/calls.ts";

const inRegistry = <A, E>(body: Effect.Effect<A, E, ConnectorCalls>) => body.pipe(Effect.provide(connectorCallsLayer));

describe("the calls underway", () => {
  it.live(
    "gives two calls of one tool by one thread each its own identifier and stops both once the tool is revoked",
    () =>
      inRegistry(
        Effect.gen(function* () {
          const calls = yield* ConnectorCalls;
          yield* calls.takeSnapshot("t1", ["calendar__list-events"]);
          const identifiers: Array<string> = [];
          const holds = [yield* Deferred.make<void>(), yield* Deferred.make<void>()];
          const call = (index: number) =>
            calls.track({ connector: "calendar", listedName: "calendar__list-events", threadId: "t1" }, (invocation) =>
              Effect.sync(() => identifiers.push(invocation.id)).pipe(
                Effect.andThen(
                  Effect.raceFirst(
                    Deferred.await(holds[index] as Deferred.Deferred<void>).pipe(Effect.as("finished")),
                    Deferred.await(invocation.stopped).pipe(Effect.as("stopped")),
                  ),
                ),
              ),
            );
          const first = yield* Effect.forkChild(call(0));
          const second = yield* Effect.forkChild(call(1));
          while (identifiers.length < 2) yield* Effect.sleep("5 millis");
          expect(new Set(identifiers).size).toBe(2);
          // Nothing is revoked while the snapshot holds the tool.
          expect(yield* calls.stopRevoked).toBe(0);
          yield* calls.narrowSnapshots(() => Effect.succeed(new Set()));
          expect(yield* calls.stopRevoked).toBe(2);
          expect([yield* Fiber.join(first), yield* Fiber.join(second)]).toEqual(["stopped", "stopped"]);
        }),
      ),
  );

  it.live("forgets a call however it ends, so a later revocation stops nothing", () =>
    inRegistry(
      Effect.gen(function* () {
        const calls = yield* ConnectorCalls;
        yield* calls.takeSnapshot("t1", ["calendar__a"]);
        yield* calls.track({ connector: "calendar", listedName: "calendar__a", threadId: "t1" }, () => Effect.void);
        yield* Effect.exit(
          calls.track({ connector: "calendar", listedName: "calendar__a", threadId: "t1" }, () => Effect.die("boom")),
        );
        yield* calls.narrowSnapshots(() => Effect.succeed(new Set()));
        expect(yield* calls.stopRevoked).toBe(0);
      }),
    ),
  );

  it.live("narrows a snapshot and never widens it, so a tool switched on during a turn is not added to it", () =>
    inRegistry(
      Effect.gen(function* () {
        const calls = yield* ConnectorCalls;
        yield* calls.takeSnapshot("t1", ["a", "b"]);
        yield* calls.narrowSnapshots(() => Effect.succeed(new Set(["a", "c"])));
        expect([...(calls.snapshotOf("t1") ?? [])]).toEqual(["a"]);
        yield* calls.narrowSnapshots(() => Effect.succeed(new Set(["a", "b", "c"])));
        expect([...(calls.snapshotOf("t1") ?? [])]).toEqual(["a"]);
        yield* calls.dropSnapshot("t1");
        expect(calls.snapshotOf("t1")).toBeNull();
      }),
    ),
  );
});
