import { Effect, Layer } from "effect";
import { Harness, type TurnRequest } from "../../src/core/index.ts";
import { fakeHarnessLayer } from "../../src/index.ts";

/** The scripted fake harness, keeping every turn request it is given, in order, in `received`. */
export const recordingHarnessLayer = (received: Array<TurnRequest>) =>
  Layer.effect(
    Harness,
    Effect.gen(function* () {
      const fake = yield* Harness;
      return Harness.of({
        ...fake,
        runTurn: (request) => Effect.sync(() => received.push(request)).pipe(Effect.andThen(fake.runTurn(request))),
      });
    }),
  ).pipe(Layer.provide(fakeHarnessLayer("10 millis")));

/** Waits until the harness has received a turn request for the thread, and returns its latest. */
export const receivedFor = (received: ReadonlyArray<TurnRequest>, threadId: string) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 300; attempt++) {
      const found = received.findLast((request) => request.threadId === threadId);
      if (found !== undefined) return found;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.die(new Error(`no turn reached the harness for ${threadId}`));
  });
