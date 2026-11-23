import type { HostUpdate as HostUpdateView } from "@outlore/contracts";
import { Context, Effect, Layer, Ref } from "effect";
import { SqlClient } from "effect/sql";
import { RemoteConfig } from "../remote/config.ts";
import { HostUpdater } from "./hostUpdater.ts";

/** How often an armed update looks at the updater and at the turns still running. */
const pollSeconds = 2;

type Progress = {
  /** The owner asked for the update and the host will install it once no turn is running. */
  readonly isArmed: boolean;
  /** The check the host asked for has not ended yet. */
  readonly isChecking: boolean;
  /** The owner asked to install now: the install does not wait for the running turns, which stop when the host quits. */
  readonly isForced: boolean;
  readonly isInstalling: boolean;
  /** Why the last attempt ended without an install; shown until the next one. */
  readonly failure: string | null;
  readonly installingVersion: string;
};

const initial: Progress = {
  failure: null,
  installingVersion: "",
  isArmed: false,
  isChecking: false,
  isForced: false,
  isInstalling: false,
};

/**
 * Updating this host on a paired device's word (app-updates, Updating a host from a paired device): `arm` looks for a
 * newer release, downloads it, and installs it once no turn is running. `force` does the same without waiting: the
 * install quits the host, which ends the turns as the desktop's Restart and update does (the next start records them
 * as interrupted). Once armed the install is the host's own decision: the device that asked may disconnect or reload.
 */
export class HostUpdate extends Context.Service<
  HostUpdate,
  {
    /** Starts the update if it can start and answers where it stands; asking again changes nothing. */
    readonly arm: Effect.Effect<HostUpdateView, never, SqlClient.SqlClient>;
    /**
     * Like `arm`, and installs without waiting for the running turns; on an update already armed and waiting it lifts
     * the wait. An install under way, or an updater that is unsupported, is left alone, so asking again changes nothing.
     */
    readonly force: Effect.Effect<HostUpdateView, never, SqlClient.SqlClient>;
    /** Where updating the host stands, with the host's release. */
    readonly read: Effect.Effect<HostUpdateView, never, SqlClient.SqlClient>;
  }
>()("outlore/HostUpdate") {}

const countRunningTurns = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ total: number }>`SELECT COUNT(*) AS total FROM turns WHERE status = 'running'`;
  return rows[0]?.total ?? 0;
}).pipe(Effect.orDie);

const make = Effect.gen(function* () {
  const updater = yield* HostUpdater;
  const { release } = yield* RemoteConfig;
  const scope = yield* Effect.scope;
  const progress = yield* Ref.make(initial);

  const read = Effect.gen(function* () {
    const current = yield* Ref.get(progress);
    const status = yield* updater.state;
    if (current.isInstalling && status._tag !== "Failed") {
      return { release, status: { _tag: "Installing", version: current.installingVersion } } satisfies HostUpdateView;
    }
    if (status._tag === "Idle" && current.isChecking)
      return { release, status: { _tag: "Checking" } } satisfies HostUpdateView;
    if ((status._tag === "Idle" || status._tag === "Ready") && !current.isArmed && current.failure !== null) {
      return { release, status: { _tag: "Failed", message: current.failure } } satisfies HostUpdateView;
    }
    if (status._tag === "Ready" && current.isArmed) {
      const runningCount = yield* countRunningTurns;
      return {
        release,
        status:
          runningCount === 0 || current.isForced
            ? { _tag: "Installing", version: status.version }
            : { _tag: "WaitingForTurns", runningCount, version: status.version },
      } satisfies HostUpdateView;
    }
    return { release, status } satisfies HostUpdateView;
  });

  const stop = (failure: string | null) =>
    Ref.update(progress, (current) => ({
      ...current,
      failure,
      isArmed: false,
      isChecking: false,
      isForced: false,
      isInstalling: false,
    }));

  /** Checks if needed, then waits until the update is ready and no turn is running, and installs it. */
  const run = Effect.gen(function* () {
    let status = yield* updater.state;
    if (status._tag === "Idle" || status._tag === "Failed") status = yield* updater.check;
    yield* Ref.update(progress, (current) => ({ ...current, isChecking: false }));
    for (;;) {
      if (status._tag === "Ready") {
        const runningCount = (yield* Ref.get(progress)).isForced ? 0 : yield* countRunningTurns;
        if (runningCount === 0) {
          const installingVersion = status.version;
          yield* Ref.update(progress, (current) => ({ ...current, installingVersion, isInstalling: true }));
          const outcome = yield* updater.install;
          if (outcome.failure !== null) yield* stop(outcome.failure);
          return;
        }
      } else if (status._tag === "Idle" || status._tag === "Unsupported") {
        return yield* stop(null);
      } else if (status._tag === "Failed") {
        return yield* stop(status.message);
      }
      yield* Effect.sleep(`${pollSeconds} seconds`);
      status = yield* updater.state;
    }
  }).pipe(Effect.orDie);

  const begin = (isForced: boolean) =>
    Effect.gen(function* () {
      const status = yield* updater.state;
      const current = yield* Ref.get(progress);
      if (status._tag === "Unsupported" || current.isInstalling) return yield* read;
      if (current.isArmed) {
        if (isForced) yield* Ref.update(progress, (armed) => ({ ...armed, isForced: true }));
        return yield* read;
      }
      yield* Ref.set(progress, {
        ...initial,
        isArmed: true,
        isChecking: status._tag === "Idle" || status._tag === "Failed",
        isForced,
      });
      yield* Effect.forkIn(run, scope);
      return yield* read;
    });

  return { arm: begin(false), force: begin(true), read } satisfies HostUpdate["Service"];
});

/** The coordinator, over the updater this host has. */
export const hostUpdateLayer = Layer.effect(HostUpdate, make);
