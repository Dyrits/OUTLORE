import { Cause, Effect } from "effect";

// The one way a timed sweep runs in the background: its cadence, and a single error boundary. A sweep that failed, as a
// busy database fails, is logged and runs again; it never ends the sweep for the rest of the session. Each sweep still
// builds its own layer, so its fiber starts and stops with its own scope.

/** The soonest a sweep runs again after a failure, so a failure that persists is retried at a calm pace, not in a spin. */
const retryMillis = 60 * 1000;

/** What a sweep is given: its name for the log, its work, and when it is next due. */
export type TimedSweep<A, E, R, E2, R2> = {
  /** Ends the wait early when it completes, such as the next committed change. */
  readonly wakeOn?: Effect.Effect<unknown>;
  /** Whether the first run is at once (the default) or after the first wait. */
  readonly isRunAtStart?: boolean;
  readonly name: string;
  /** Milliseconds from now until the sweep is next due, read after every run; it may change as the data does. */
  readonly untilNext: Effect.Effect<number, E2, R2>;
  /** What one run does. */
  readonly work: Effect.Effect<A, E, R>;
};

/** Runs `effect`, giving its value, or `fallback` after logging a failure or defect; only an interruption passes. */
const recover = <A, E, R, B>(what: string, effect: Effect.Effect<A, E, R>, fallback: B) =>
  effect.pipe(
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterruptsOnly(cause),
      (cause) =>
        Effect.logWarning(`${what} failed and will run again at its next time`, cause).pipe(Effect.as(fallback)),
    ),
  );

/** Starts the sweep on the scope's own fiber: run, wait until it is next due, run again, until the scope closes. */
export const timedSweep = <A, E, R, E2, R2>(options: TimedSweep<A, E, R, E2, R2>) => {
  const pause = (hasFailed: boolean) =>
    Effect.gen(function* () {
      // A time that cannot be read is the retry delay; a run that failed waits at least that long.
      const due = yield* recover(`${options.name}: reading when it is next due`, options.untilNext, retryMillis);
      const sleep = Effect.sleep(hasFailed ? Math.max(due, retryMillis) : due);
      yield* options.wakeOn === undefined ? sleep : Effect.raceFirst(sleep, options.wakeOn);
    });
  const cycle = recover(options.name, Effect.as(options.work, false), true).pipe(
    Effect.flatMap((hasFailed) => pause(hasFailed)),
    Effect.forever,
  );
  const loop = options.isRunAtStart === false ? pause(false).pipe(Effect.andThen(cycle)) : cycle;
  // Everything but an interruption is caught above, so the die only turns the type's leftover failures into defects.
  return Effect.forkScoped(Effect.orDie(loop));
};
