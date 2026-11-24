import { expect, it } from "@effect/vitest";
import { Effect, PubSub, Ref } from "effect";
import { TestClock } from "effect/testing";
import { timedSweep } from "../../src/work/timedSweep.ts";

const minute = 60 * 1000;
const hour = 60 * minute;

const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let index = 0; index < 20; index++) yield* Effect.yieldNow;
  });

/** A sweep's work that counts its runs and fails the ones `fails` names, 1 being the first. */
const counting = (fails: (run: number) => Effect.Effect<never, string> | null) =>
  Effect.gen(function* () {
    const runs = yield* Ref.make(0);
    const work = Ref.updateAndGet(runs, (count) => count + 1).pipe(Effect.flatMap((run) => fails(run) ?? Effect.void));
    return { runs: Ref.get(runs), work };
  });

it.effect("runs at once, then at each time it is next due", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const { runs, work } = yield* counting(() => null);
      yield* timedSweep({ name: "Sweep", untilNext: Effect.succeed(hour), work });
      yield* advance(0);
      expect(yield* runs).toBe(1);
      yield* advance(hour - 1);
      expect(yield* runs).toBe(1);
      yield* advance(1);
      expect(yield* runs).toBe(2);
    }),
  ),
);

it.effect("waits for its first time before the first run when told to", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const { runs, work } = yield* counting(() => null);
      yield* timedSweep({ isRunAtStart: false, name: "Sweep", untilNext: Effect.succeed(hour), work });
      yield* advance(hour - 1);
      expect(yield* runs).toBe(0);
      yield* advance(1);
      expect(yield* runs).toBe(1);
    }),
  ),
);

it.effect("runs again at its next time after a failure, and after a defect", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const { runs, work } = yield* counting((run) =>
        run === 1 ? Effect.fail("SQLITE_BUSY") : run === 2 ? Effect.die("SQLITE_BUSY") : null,
      );
      yield* timedSweep({ name: "Sweep", untilNext: Effect.succeed(hour), work });
      yield* advance(0);
      expect(yield* runs).toBe(1);
      yield* advance(hour);
      expect(yield* runs).toBe(2);
      yield* advance(hour);
      expect(yield* runs).toBe(3);
      yield* advance(hour);
      expect(yield* runs).toBe(4);
    }),
  ),
);

it.effect("retries a failure that persists once a minute, not in a spin, even when the work stays due", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const { runs, work } = yield* counting(() => Effect.fail("SQLITE_BUSY"));
      yield* timedSweep({ name: "Sweep", untilNext: Effect.succeed(1), work });
      yield* advance(0);
      expect(yield* runs).toBe(1);
      yield* advance(minute - 1);
      expect(yield* runs).toBe(1);
      yield* advance(1);
      expect(yield* runs).toBe(2);
      yield* advance(2 * minute);
      expect(yield* runs).toBe(4);
    }),
  ),
);

it.effect("tries again in a minute when it cannot read when it is next due", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const reads = yield* Ref.make(0);
      const untilNext = Ref.updateAndGet(reads, (count) => count + 1).pipe(
        Effect.flatMap((read) => (read === 1 ? Effect.die("SQLITE_BUSY") : Effect.succeed(hour))),
      );
      const { runs, work } = yield* counting(() => null);
      yield* timedSweep({ name: "Sweep", untilNext, work });
      yield* advance(0);
      expect(yield* runs).toBe(1);
      yield* advance(minute);
      expect(yield* runs).toBe(2);
      yield* advance(hour - 1);
      expect(yield* runs).toBe(2);
      yield* advance(1);
      expect(yield* runs).toBe(3);
    }),
  ),
);

it.effect("wakes early when told, such as by a change, and only once per change", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const changes = yield* PubSub.unbounded<void>();
      const subscription = yield* PubSub.subscribe(changes);
      const { runs, work } = yield* counting(() => null);
      yield* timedSweep({ name: "Sweep", untilNext: Effect.succeed(hour), wakeOn: PubSub.take(subscription), work });
      yield* advance(0);
      expect(yield* runs).toBe(1);
      yield* PubSub.publish(changes, undefined);
      yield* advance(0);
      expect(yield* runs).toBe(2);
      yield* advance(hour - 1);
      expect(yield* runs).toBe(2);
    }),
  ),
);

it.effect("waits only for a change when nothing is due yet", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const changes = yield* PubSub.unbounded<void>();
      const subscription = yield* PubSub.subscribe(changes);
      const { runs, work } = yield* counting(() => null);
      yield* timedSweep({ name: "Sweep", untilNext: Effect.succeed(null), wakeOn: PubSub.take(subscription), work });
      yield* advance(0);
      expect(yield* runs).toBe(1);
      yield* advance(400 * 24 * hour);
      expect(yield* runs).toBe(1);
      yield* PubSub.publish(changes, undefined);
      yield* advance(0);
      expect(yield* runs).toBe(2);
    }),
  ),
);

it.effect("stops when its scope closes", () =>
  Effect.gen(function* () {
    const { runs, work } = yield* counting(() => null);
    yield* Effect.scoped(
      timedSweep({ name: "Sweep", untilNext: Effect.succeed(hour), work }).pipe(Effect.andThen(advance(0))),
    );
    expect(yield* runs).toBe(1);
    yield* advance(3 * hour);
    expect(yield* runs).toBe(1);
  }),
);
